import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from '../utils/logger';

/**
 * AI Chat Memory Service
 * 
 * Persistent memory for RescattoBot — remembers user preferences, facts, and behaviors
 * across sessions. Stored in Firestore: users/{userId}/ai_memories/{memoryId}
 * 
 * Also handles context optimization and prompt caching for DeepSeek.
 */

const MEMORY_COLLECTION = 'ai_chat_memories';
const CACHE_DOC = 'ai_chat_cache';

// ─── Types ───

export type MemoryCategory = 'preference' | 'fact' | 'behavior' | 'context';

export interface AIMemory {
  id: string;
  userId: string;
  category: MemoryCategory;
  key: string;          // e.g., 'cuisine', 'location', 'dietary_restriction'
  value: string;        // e.g., 'Le gusta el sushi', 'Vive en Bucaramanga'
  confidence: number;   // 0-1, how sure we are about this memory
  source: string;       // what triggered it: 'explicit', 'inferred', 'system'
  createdAt: Timestamp;
  lastAccessed: Timestamp;
  lastReinforced: Timestamp;
  ttlDays: number;      // days before auto-expiration
}

export interface MemorySummary {
  preferences: string[];
  facts: string[];
  recentTopics: string[];
  userSince?: string;
}

// ─── TTL Configuration ───

const TTL_CONFIG: Record<MemoryCategory, number> = {
  preference: 90,   // preferences last 3 months
  fact: 365,        // facts last 1 year
  behavior: 30,     // behaviors last 1 month
  context: 7,       // context lasts 1 week
};

// ─── Memory Operations ───

/**
 * Load all active (non-expired) memories for a user
 */
export async function loadUserMemories(userId: string): Promise<AIMemory[]> {
  try {
    const memoriesRef = collection(db, MEMORY_COLLECTION);
    const q = query(
      memoriesRef,
      where('userId', '==', userId),
      limit(30)
    );
    const snapshot = await getDocs(q);
    const now = Date.now();
    const results: AIMemory[] = [];

    snapshot.forEach(doc => {
      const mem = { id: doc.id, ...doc.data() } as AIMemory;
      const ageDays = (now - mem.createdAt.toMillis()) / (1000 * 60 * 60 * 24);
      if (ageDays < mem.ttlDays) {
        results.push(mem);
      }
    });

    // Sort by lastAccessed desc (client-side to avoid composite index requirement)
    results.sort((a, b) => b.lastAccessed.toMillis() - a.lastAccessed.toMillis());

    return results;
  } catch (error) {
    logger.error('aiMemory: load error', error);
    return [];
  }
}

/**
 * Build a compact memory summary string for injection into the AI prompt
 */
export function buildMemorySummary(memories: AIMemory[]): MemorySummary {
  const prefs = memories
    .filter(m => m.category === 'preference')
    .map(m => m.value);

  const facts = memories
    .filter(m => m.category === 'fact')
    .map(m => m.value);

  const contexts = memories
    .filter(m => m.category === 'context')
    .map(m => m.value);

  return {
    preferences: prefs,
    facts: facts,
    recentTopics: contexts,
  };
}

/**
 * Format memory summary as a compact text block for the system prompt
 */
export function formatMemoryBlock(summary: MemorySummary): string {
  const parts: string[] = [];

  if (summary.facts.length > 0) {
    parts.push(`📋 Sobre este usuario: ${summary.facts.join('. ')}`);
  }
  if (summary.preferences.length > 0) {
    parts.push(`❤️ Preferencias: ${summary.preferences.join('. ')}`);
  }
  if (summary.recentTopics.length > 0) {
    parts.push(`💬 Temas recientes: ${summary.recentTopics.slice(-3).join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

/**
 * Save or reinforce a memory
 */
export async function saveMemory(
  userId: string,
  category: MemoryCategory,
  key: string,
  value: string,
  confidence: number = 0.7,
  source: string = 'inferred',
): Promise<void> {
  try {
    const memoriesRef = collection(db, MEMORY_COLLECTION);
    const q = query(memoriesRef, where('userId', '==', userId), where('key', '==', key), limit(1));
    const snapshot = await getDocs(q);

    const now = Timestamp.now();

    if (!snapshot.empty) {
      // Reinforce existing memory
      const existing = snapshot.docs[0];
      const data = existing.data() as AIMemory;
      const newConfidence = Math.min(1, data.confidence + 0.1);
      await updateDoc(existing.ref, {
        value,
        confidence: newConfidence,
        lastAccessed: now,
        lastReinforced: now,
        ttlDays: TTL_CONFIG[category],
      });
    } else {
      // Create new memory
      const memoryData = {
        userId,
        category,
        key,
        value,
        confidence,
        source,
        createdAt: now,
        lastAccessed: now,
        lastReinforced: now,
        ttlDays: TTL_CONFIG[category],
      };
      await setDoc(doc(collection(db, MEMORY_COLLECTION)), memoryData);
    }
  } catch (error) {
    logger.error('aiMemory: save error', error);
  }
}

/**
 * Delete a memory by key
 */
export async function deleteMemory(userId: string, key: string): Promise<void> {
  try {
    const memoriesRef = collection(db, MEMORY_COLLECTION);
    const q = query(memoriesRef, where('userId', '==', userId), where('key', '==', key));
    const snapshot = await getDocs(q);
    snapshot.forEach(d => deleteDoc(d.ref));
  } catch (error) {
    logger.error('aiMemory: delete error', error);
  }
}

// ─── Context Optimization ───

export interface OptimizedContext {
  staticBlock: string;     // System prompt + tools (cacheable)
  memoryBlock: string;     // User memories (semi-static)
  contextBlock: string;    // Today's session context (dynamic)
}

/**
 * Build the optimized context blocks for DeepSeek prompt caching.
 * 
 * Strategy: Static prefix (system prompt + tools) is always first,
 * maximizing DeepSeek's automatic prefix caching.
 */
export function buildOptimizedContext(
  systemPrompt: string,
  memorySummary: MemorySummary,
  userName: string,
  userRole: string,
  userCity?: string,
  remainingMessages?: number | string,
): OptimizedContext {
  // Static block — always the same → cached by DeepSeek
  const staticBlock = systemPrompt;

  // Memory block — changes when user does
  const memoryBlock = formatMemoryBlock(memorySummary);

  // Context block — daily context
  const contextParts: string[] = [
    `## CONTEXTO DE HOY`,
    `Usuario: ${userName} (${userRole})`,
  ];
  if (userCity) contextParts.push(`Ciudad: ${userCity}`);
  if (remainingMessages !== undefined) {
    contextParts.push(`Mensajes restantes hoy: ${remainingMessages}`);
  }
  contextParts.push(`Fecha: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);

  const contextBlock = contextParts.join('\n');

  return { staticBlock, memoryBlock, contextBlock };
}

/**
 * Build the messages array optimized for DeepSeek prefix caching.
 * 
 * Structure:
 * 1. System prompt (STATIC → cached)
 * 2. Memory + context (SEMI-STATIC)
 * 3. Conversation history (DYNAMIC)
 * 4. Current user message (UNIQUE)
 */
export function buildCacheOptimizedMessages(
  optimizedContext: OptimizedContext,
  conversationHistory: Array<{ role: string; content: string }>,
  currentMessage: string,
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: optimizedContext.staticBlock },
  ];

  // Add memory block if there are memories
  if (optimizedContext.memoryBlock) {
    messages.push({ role: 'system', content: `## MEMORIA DEL USUARIO\n${optimizedContext.memoryBlock}` });
  }

  // Add context block
  messages.push({ role: 'system', content: optimizedContext.contextBlock });

  // Add conversation history (last 10 messages to keep context focused)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    if (msg.content) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Current user message
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

// ─── Memory Extraction ───

/**
 * Extract potential memories from a conversation turn.
 * Called after each AI response to learn about the user.
 */
export async function extractMemoriesFromTurn(
  userId: string,
  userMessage: string,
  aiResponse: string,
): Promise<void> {
  const lowerMsg = userMessage.toLowerCase();

  // Extract dietary preferences
  if (lowerMsg.includes('vegetariano') || lowerMsg.includes('vegano') || lowerMsg.includes('soy veg')) {
    await saveMemory(userId, 'preference', 'diet', 'Dieta basada en plantas', 0.6, 'inferred');
  }
  if (lowerMsg.includes('no como') || lowerMsg.includes('no me gusta')) {
    const disliked = userMessage.match(/no (?:como|me gusta) (el|la|los|las)?\s*(.+)/i);
    if (disliked) {
      await saveMemory(userId, 'preference', `dislike_${disliked[2].trim().toLowerCase().slice(0, 20)}`, `No le gusta ${disliked[2].trim()}`, 0.5, 'inferred');
    }
  }

  // Extract location info
  if (lowerMsg.includes('vivo en') || lowerMsg.includes('soy de') || lowerMsg.includes('estoy en')) {
    const locationMatch = userMessage.match(/(?:vivo en|soy de|estoy en)\s+([A-Za-zÁ-Úá-ú\s]+)/i);
    if (locationMatch) {
      const city = locationMatch[1].trim().slice(0, 30);
      await saveMemory(userId, 'fact', 'location', `Vive en ${city}`, 0.7, 'inferred');
    }
  }

  // Extract cuisine preferences
  const cuisines = ['sushi', 'pizza', 'hamburguesa', 'italiano', 'mexicano', 'chino', 'japonés', 'colombiano', 'parrilla', 'mariscos', 'ensalada', 'saludable', 'rápido'];
  for (const cuisine of cuisines) {
    if (lowerMsg.includes(cuisine)) {
      await saveMemory(userId, 'preference', `cuisine_${cuisine}`, `Le interesa la comida ${cuisine}`, 0.4, 'inferred');
    }
  }

  // Track recent topics
  const topics = ['restaurante', 'producto', 'pedido', 'pago', 'domicilio', 'pack', 'sorpresa', 'puntos', 'pass'];
  for (const topic of topics) {
    if (lowerMsg.includes(topic)) {
      await saveMemory(userId, 'context', 'last_topic', `Habló sobre ${topic}`, 0.8, 'inferred');
      break;
    }
  }
}

/**
 * Track when a user has an active Rescatto Pass
 */
export async function trackUserTier(userId: string, tier: string): Promise<void> {
  if (tier === 'pass_monthly' || tier === 'pass_annual') {
    await saveMemory(userId, 'fact', 'subscription', `Tiene Rescatto Pass (${tier === 'pass_annual' ? 'Anual' : 'Mensual'})`, 0.9, 'system');
  }
}
