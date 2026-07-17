import { logger } from '../utils/logger';
import { stripHtml } from '../utils/sanitize';
import { UserRole } from '../types';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * AI Chat Security Layer — Extended
 * 
 * Five layers of protection + strike system + audit logging + admin notifications
 */

// ─── L1: Input Validation ───

export const INPUT_LIMITS = {
  MAX_MESSAGE_LENGTH: 500,
  MAX_PROFILE_FIELD: 100,
  MAX_SEARCH_QUERY: 100,
  MAX_CONCURRENT_TOOLS: 5,
} as const;

/**
 * Expanded jailbreak / prompt injection / code generation patterns
 */
const JAILBREAK_PATTERNS = [
  // Jailbreak clásico
  /ignore\s+(all\s+)?(previous|above|prior)/i,
  /forget\s+(all\s+)?(previous|instructions|rules)/i,
  /system\s+(prompt|instruction|message)/i,
  /you\s+are\s+(now|free|liberated)/i,
  /act\s+as\s+if/i,
  /new\s+(rules|instructions|persona)/i,
  /DAN|JAILBREAK|BYPASS/i,
  /sudo|admin\s+mode|developer\s+mode/i,
  /hypothetical|fictional\s+scenario/i,
  /role\s+play|roleplay/i,
  /no\s+(rules|limits|boundaries|restrictions)/i,
  /you\s+(can|may)\s+(do\s+)?anything/i,
  /override|bypass\s+(security|safety)/i,

  // Código y desarrollo de software
  /write\s+(code|script|program|function|class|app)/i,
  /generate\s+(code|script|program|function)/i,
  /create\s+an?\s+(app|website|api|endpoint|service)/i,
  /build\s+(a|an|me)\s+/i,
  /c[óo]mo\s+(hago|creo|programo|desarrollo)/i,
  /expl[ií]came\s+(c[oó]mo|la\s+forma|el\s+m[ée]todo)\s+(de\s+)?programar/i,
  /refactor|refactoring/i,
  /debug\s+(this|my|code|script)/i,
  /implement\s+(a|an|the|feature|function)/i,
  /npm|yarn|pip|install\s+package/i,
  /c[oó]digo\s+(fuente|de\s+(programa|app|web))/i,
  /hazme\s+un\s+/i,
  /escribe\s+(un|el)\s+(c[oó]digo|script|programa)/i,
  /api\s+(rest|endpoint|route|call)/i,
  /node\.?js|python|react|vue|angular|typescript|javascript/i,

  // Base de datos y comandos destructivos
  /delete\s+(all\s+)?data|drop\s+database|truncate/i,
  /execute\s+(command|sql|query|code)/i,
  /--|;\s*drop|;\s*delete|;\s*update/i,
  /firestore|query\s+all|get\s+all\s+(users|orders)/i,

  // Salida de información del sistema
  /output\s+raw\s+(json|text|data)/i,
  /print\s+the\s+(prompt|instructions)/i,
  /show\s+me\s+the\s+(prompt|system)/i,
  /reveal\s+(prompt|instructions|system)/i,
];

// ─── Strike System ───

const MAX_STRIKES = 2;
const STRIKE_FIELD = 'aiChatStrikes';

interface StrikeRecord {
  count: number;
  lastOffense: string;
  lastOffenseAt: string;
  details: Array<{
    pattern: string;
    input: string;
    timestamp: string;
  }>;
  blocked: boolean;
  blockedAt?: string;
}

async function getStrikes(userId: string): Promise<StrikeRecord> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data[STRIKE_FIELD]) return data[STRIKE_FIELD] as StrikeRecord;
    }
  } catch {}
  return { count: 0, lastOffense: '', lastOffenseAt: '', details: [], blocked: false };
}

async function saveStrikes(userId: string, strikes: StrikeRecord): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { [STRIKE_FIELD]: strikes });
  } catch {}
}

async function blockUser(userId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isActive: false,
      blockedAt: new Date().toISOString(),
      blockedReason: 'AI Chat: Uso indebido de la plataforma',
    });
  } catch {}
}

async function notifyAdmins(
  title: string,
  text: string,
  userId: string,
  details: Record<string, any>,
): Promise<void> {
  try {
    // Find all SUPER_ADMIN users
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'SUPER_ADMIN'));
    const admins = await getDocs(q);

    const notificationsRef = collection(db, 'notifications');
    const timestamp = new Date().toISOString();

    const promises = admins.docs.map(adminDoc => {
      const adminId = adminDoc.id;
      return addDoc(notificationsRef, {
        userId: adminId,
        title,
        text,
        type: 'warning',
        link: `/backoffice/users?highlight=${userId}`,
        read: false,
        createdAt: timestamp,
        metadata: details,
      }).catch(() => {});
    });

    await Promise.all(promises);
  } catch {}
}

async function notifyVenueOwner(
  venueId: string | undefined,
  offenderId: string,
  offense: string,
): Promise<void> {
  if (!venueId) return;
  try {
    const venueRef = doc(db, 'venues', venueId);
    const venueSnap = await getDoc(venueRef);
    if (!venueSnap.exists()) return;
    const venue = venueSnap.data();
    const ownerId = (venue as any).ownerId;
    if (!ownerId || ownerId === offenderId) return;

    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      userId: ownerId,
      title: '⚠️ Alerta: Tu personal intentó usar la IA incorrectamente',
      text: `Un miembro de tu equipo ha recibido una advertencia por uso indebido del asistente IA de Rescatto. Motivo: ${offense}. Si continúa, su cuenta será bloqueada.`,
      type: 'warning',
      link: `/dashboard/profile`,
      read: false,
      createdAt: new Date().toISOString(),
      metadata: { offenderId, offense },
    });
  } catch {}
}

// ─── L5: Enhanced Detection ───

/**
 * Check if input contains jailbreak/prompt injection/code patterns.
 * Returns { matched: true, pattern: '...', category: '...' } or null.
 */
export function detectPromptInjection(input: string): { matched: boolean; pattern: string; category: string } | null {
  const codePatterns = [/write\s+code/i, /generate\s+code/i, /build\s+(a|an|me)\s+/i, /hazme\s+un\s+/i, /escribe\s+un\s+código/i, /node\.?js|python|react|vue|angular|typescript|javascript/i, /npm|yarn|pip/i];
  const jailbreakPatterns = [/ignore\s+(all\s+)?(previous|above|prior)/i, /forget\s+(all\s+)?(previous|instructions|rules)/i, /system\s+(prompt|instruction|message)/i, /DAN|JAILBREAK|BYPASS/i, /sudo|admin\s+mode|developer\s+mode/i, /override|bypass\s+(security|safety)/i, /delete\s+(all\s+)?data|drop\s+database|truncate/i, /execute\s+(command|sql|query|code)/i, /--|;\s*drop|;\s*delete|;\s*update/i, /reveal\s+(prompt|instructions|system)/i];

  for (const p of codePatterns) {
    if (p.test(input)) return { matched: true, pattern: p.source, category: 'code_generation' };
  }
  for (const p of jailbreakPatterns) {
    if (p.test(input)) return { matched: true, pattern: p.source, category: 'jailbreak' };
  }
  return null;
}

/**
 * Get current strike count for a user (1-indexed: 0 = clean, 1 = first offense pending)
 */
export async function getStrikeCount(userId: string): Promise<number> {
  const strikes = await getStrikes(userId);
  return strikes.count + 1;
}

// ─── Security Incident Handler ───

export interface SecurityIncident {
  userId: string;
  userName: string;
  userRole: string;
  venueId?: string;
  venueName?: string;
  input: string;
  pattern: string;
  category: string;
  strikeNumber: number;
  maxStrikes: number;
}

/**
 * Handle a security incident: log, strike, notify, and optionally block.
 * Returns the message to show to the user.
 */
export async function handleSecurityIncident(incident: SecurityIncident): Promise<string> {
  const { userId, userName, userRole, venueId, input, pattern, category, strikeNumber, maxStrikes } = incident;
  const now = new Date().toISOString();

  // 1. Audit log
  try {
    const auditRef = collection(db, 'audit_logs');
    await addDoc(auditRef, {
      action: 'AI_CHAT_SECURITY_VIOLATION',
      performedBy: userId,
      performedByName: userName,
      userRole,
      timestamp: serverTimestamp(),
      details: {
        category,
        matchedPattern: pattern,
        input: input.slice(0, 200),
        strikeNumber,
        maxStrikes,
        venueId,
      },
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        location: typeof window !== 'undefined' ? window.location.href : '',
      },
    });
  } catch {}

  // 2. Strike tracking
  const strikes = await getStrikes(userId);
  strikes.count = strikeNumber;
  strikes.lastOffense = category;
  strikes.lastOffenseAt = now;
  strikes.details.push({ pattern, input: input.slice(0, 200), timestamp: now });
  await saveStrikes(userId, strikes);

  // 3. Notify SUPER_ADMINs
  const adminTitle = `🚨 Alerta IA: ${userName} (${userRole}) — ${category}`;
  const adminText = `El usuario ${userName} (${userId}) intentó: "${input.slice(0, 100)}..." — Patrón detectado: ${pattern} — Strike ${strikeNumber}/${maxStrikes}`;
  await notifyAdmins(adminTitle, adminText, userId, {
    category,
    pattern,
    input: input.slice(0, 200),
    strikeNumber,
    userRole,
    venueId,
  });

  // 4. Notify venue owner if applicable
  if (venueId && (userRole === 'VENUE_OWNER' || userRole === 'KITCHEN_STAFF')) {
    await notifyVenueOwner(venueId, userId, category);
  }

  // 5. Block if max strikes reached
  if (strikeNumber >= maxStrikes) {
    strikes.blocked = true;
    strikes.blockedAt = now;
    await saveStrikes(userId, strikes);
    await blockUser(userId);

    // Admin alert: account blocked
    await notifyAdmins(
      `🔒 Cuenta bloqueada: ${userName}`,
      `La cuenta de ${userName} (${userId}) ha sido bloqueada automáticamente por alcanzar ${maxStrikes} strikes de uso indebido de la IA. Último intento: "${input.slice(0, 100)}..."`,
      userId,
      { action: 'ACCOUNT_BLOCKED', category, strikeNumber: maxStrikes },
    );

    return `🚫 **Has violado las normas de uso de RescattoBot en ${maxStrikes} ocasiones.**\n\nTu cuenta ha sido **bloqueada** por seguridad. Un administrador revisará tu caso.\n\nSi crees que esto es un error, contacta con soporte.`;
  }

  // First strike warning
  return `⚠️ **Rescatto no permite ese tipo de uso.**\n\nHas intentado: *${category === 'code_generation' ? 'generar código o desarrollar software' : 'manipular el asistente'}*. RescattoBot solo puede ayudarte con temas relacionados a la plataforma.\n\n**Advertencia ${strikeNumber}/${maxStrikes}.** Si continúas, tu cuenta será bloqueada automáticamente.\n\nPor favor, usa el asistente para lo que fue diseñado: buscar productos, consultar pedidos, y obtener ayuda sobre Rescatto.`;
}

/**
 * Sanitize and validate user input for tools
 */
export function sanitizeToolInput(input: string, maxLength: number = INPUT_LIMITS.MAX_MESSAGE_LENGTH): string {
  // Strip HTML completely
  let clean = stripHtml(input);
  // Remove excessive whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  // Truncate to max length
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength) + '...';
  }
  return clean;
}

/**
 * Validate profile field values (name, address, city, phone)
 */
export function validateProfileField(key: string, value: string): string | null {
  const cleaned = stripHtml(value).trim();
  if (!cleaned) return null;

  if (cleaned.length > INPUT_LIMITS.MAX_PROFILE_FIELD) {
    return cleaned.slice(0, INPUT_LIMITS.MAX_PROFILE_FIELD);
  }

  // Phone validation
  if (key === 'phone' && !/^[\d\s+\-()]{7,20}$/.test(cleaned)) {
    return null; // Invalid phone number
  }

  return cleaned;
}

// ─── L2: Role Enforcement ───

/**
 * Check if user role is allowed to access a resource.
 * Admin can access anything. Regular users can only access their own data.
 */
export function canAccessUserData(requestorRole: string, requestorId: string, targetUserId: string): boolean {
  if (requestorId === targetUserId) return true;
  if (requestorRole === UserRole.SUPER_ADMIN || requestorRole === UserRole.ADMIN) return true;
  return false;
}

/**
 * Check if user can perform admin-level operations
 */
export function isAdminRole(role: string): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

// ─── L3: Rate Limiting ───

/**
 * Simple in-memory rate limiter for write operations
 */
const writeOpCounts: Record<string, { count: number; resetAt: number }> = {};

export function checkWriteRateLimit(userId: string, maxPerMinute: number = 10): boolean {
  const key = `write_${userId}`;
  const now = Date.now();

  if (!writeOpCounts[key] || writeOpCounts[key].resetAt < now) {
    writeOpCounts[key] = { count: 0, resetAt: now + 60_000 };
  }

  writeOpCounts[key].count++;
  return writeOpCounts[key].count <= maxPerMinute;
}

// ─── L4: Destructive Action Guard ───

/**
 * List of tools that perform destructive actions (need confirmation)
 */
export const DESTRUCTIVE_TOOLS = new Set([
  'clearCart',
  'removeFromCart',
  'unlinkProvider',
]);

export function isDestructiveTool(toolName: string): boolean {
  return DESTRUCTIVE_TOOLS.has(toolName);
}

// ─── L5: Content Safety ───

/**
 * Final safety check before a tool executes.
 * Returns { allowed, reason }
 */
export function safetyCheck(
  toolName: string,
  userId: string | undefined,
  userRole: string | undefined,
  args: Record<string, any>,
): { allowed: boolean; reason?: string } {
  // Reject unauthenticated write operations
  if (!userId) {
    const writeTools = ['addToCart', 'removeFromCart', 'clearCart', 'sendMessageToVenue', 'sendMessageToDriver', 'toggleFavorite', 'updateProfile'];
    if (writeTools.includes(toolName)) {
      return { allowed: false, reason: 'Debes iniciar sesión para realizar esta acción.' };
    }
  }

  // Reject destructive tools for non-admin roles
  if (isDestructiveTool(toolName) && userRole && !isAdminRole(userRole)) {
    return { allowed: false, reason: 'Esta acción requiere confirmación. Por favor, ve a la configuración de la app para realizarla.' };
  }

  // Limit message content length
  if (toolName === 'sendMessageToVenue' || toolName === 'sendMessageToDriver') {
    if (args.message && args.message.length > INPUT_LIMITS.MAX_MESSAGE_LENGTH) {
      return { allowed: false, reason: `El mensaje es demasiado largo (máx ${INPUT_LIMITS.MAX_MESSAGE_LENGTH} caracteres).` };
    }
  }

  return { allowed: true };
}
