import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from '../utils/logger';
import type { ChatMessage } from './aiChatTypes';

/**
 * AI Chat Storage Service
 * 
 * Two modes:
 * - 'local': conversations stored in localStorage (private, offline, no cost)
 * - 'cloud': conversations stored in Firestore (synced across devices)
 * 
 * User can switch at any time via Settings → AI Chat Storage.
 * When switching, conversations are migrated automatically.
 */

const STORAGE_KEY = 'rescatto_ai_chat';
const MAX_MESSAGES = 50; // Keep last 50 messages per session

// ─── Preference ───

/**
 * Get user's storage preference from Firestore.
 * Defaults to 'cloud' for logged-in users, 'local' for guests.
 */
export async function getStoragePreference(userId: string, isGuest: boolean): Promise<'local' | 'cloud'> {
  if (isGuest) return 'local';

  try {
    const prefRef = doc(db, 'users', userId);
    const snap = await getDoc(prefRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.aiChatStorage === 'local' || data.aiChatStorage === 'cloud') {
        return data.aiChatStorage;
      }
    }
    return 'cloud'; // Default for registered users
  } catch {
    return 'cloud';
  }
}

/**
 * Set user's storage preference in Firestore.
 */
export async function setStoragePreference(userId: string, mode: 'local' | 'cloud'): Promise<void> {
  try {
    const prefRef = doc(db, 'users', userId);
    await setDoc(prefRef, { aiChatStorage: mode }, { merge: true });
  } catch (error) {
    logger.error('aiStorage: error setting preference', error);
    throw error;
  }
}

// ─── Local Storage ───

function getLocalKey(userId: string): string {
  return `${STORAGE_KEY}_${userId}`;
}

function saveLocal(userId: string, messages: ChatMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(getLocalKey(userId), JSON.stringify(trimmed));
  } catch (error) {
    logger.error('aiStorage: local save error', error);
  }
}

function loadLocal(userId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(getLocalKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function clearLocal(userId: string): void {
  try {
    localStorage.removeItem(getLocalKey(userId));
  } catch {}
}

// ─── Cloud Storage (Firestore) ───

function getCloudDocRef(userId: string) {
  return doc(db, 'users', userId, 'ai_chat', 'conversation');
}

async function saveCloud(userId: string, messages: ChatMessage[]): Promise<void> {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    const ref = getCloudDocRef(userId);
    await setDoc(ref, {
      messages: trimmed.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp?.toISOString() || new Date().toISOString(),
      })),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('aiStorage: cloud save error', error);
  }
}

async function loadCloud(userId: string): Promise<ChatMessage[]> {
  try {
    const ref = getCloudDocRef(userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const data = snap.data();
    if (!Array.isArray(data.messages)) return [];
    return data.messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
  } catch {
    return [];
  }
}

async function clearCloud(userId: string): Promise<void> {
  try {
    const ref = getCloudDocRef(userId);
    await deleteDoc(ref);
  } catch {}
}

// ─── Public API ───

/**
 * Save conversation messages according to user's storage preference.
 */
export async function saveConversation(
  userId: string,
  mode: 'local' | 'cloud',
  messages: ChatMessage[],
): Promise<void> {
  if (mode === 'local') {
    saveLocal(userId, messages);
  } else {
    await saveCloud(userId, messages);
  }
}

/**
 * Load conversation messages from user's storage preference.
 */
export async function loadConversation(
  userId: string,
  mode: 'local' | 'cloud',
): Promise<ChatMessage[]> {
  if (mode === 'local') {
    return loadLocal(userId);
  }
  return loadCloud(userId);
}

/**
 * Clear conversation from storage.
 */
export async function clearConversation(
  userId: string,
  mode: 'local' | 'cloud',
): Promise<void> {
  if (mode === 'local') {
    clearLocal(userId);
  } else {
    await clearCloud(userId);
  }
}

/**
 * Migrate conversations from one storage mode to another.
 * Returns the migrated messages so the UI can update.
 */
export async function migrateConversation(
  userId: string,
  fromMode: 'local' | 'cloud',
  toMode: 'local' | 'cloud',
): Promise<ChatMessage[]> {
  // Load from source
  const messages = fromMode === 'local'
    ? loadLocal(userId)
    : await loadCloud(userId);

  if (messages.length === 0) return [];

  // Save to destination
  if (toMode === 'local') {
    saveLocal(userId, messages);
  } else {
    await saveCloud(userId, messages);
  }

  // Clear source
  if (fromMode === 'local') {
    clearLocal(userId);
  } else {
    await clearCloud(userId);
  }

  return messages;
}
