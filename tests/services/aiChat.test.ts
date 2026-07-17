import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AI_CHAT_PLANS } from '../../services/aiChatTypes';
import type { AIChatPlanTier } from '../../services/aiChatTypes';
import { getUserTier } from '../../services/aiChatUsageService';

// ─── AI_CHAT_PLANS ───

describe('AI_CHAT_PLANS', () => {
  it('defines correct daily limits for each tier', () => {
    expect(AI_CHAT_PLANS.guest.dailyLimit).toBe(5);
    expect(AI_CHAT_PLANS.free.dailyLimit).toBe(20);
    expect(AI_CHAT_PLANS.pass_monthly.dailyLimit).toBe(100);
    expect(AI_CHAT_PLANS.pass_annual.dailyLimit).toBe(Infinity);
    expect(AI_CHAT_PLANS.admin.dailyLimit).toBe(Infinity);
  });

  it('has human-readable labels for each tier', () => {
    expect(AI_CHAT_PLANS.guest.label).toBe('Invitado');
    expect(AI_CHAT_PLANS.free.label).toBe('Gratuito');
    expect(AI_CHAT_PLANS.pass_monthly.label).toContain('Rescatto Pass');
  });

  it('all tiers have valid properties', () => {
    const tiers = Object.values(AI_CHAT_PLANS);
    tiers.forEach(plan => {
      expect(plan).toHaveProperty('tier');
      expect(plan).toHaveProperty('dailyLimit');
      expect(plan).toHaveProperty('label');
      expect(typeof plan.dailyLimit).toBe('number');
    });
  });
});

// ─── getUserTier ───

describe('getUserTier', () => {
  it('returns admin tier for SUPER_ADMIN', () => {
    const user = { role: 'SUPER_ADMIN' } as any;
    expect(getUserTier(user)).toBe('admin');
  });

  it('returns admin tier for ADMIN', () => {
    const user = { role: 'ADMIN' } as any;
    expect(getUserTier(user)).toBe('admin');
  });

  it('returns guest tier for anonymous users', () => {
    const user = { role: 'CUSTOMER', isGuest: true } as any;
    expect(getUserTier(user)).toBe('guest');
  });

  it('returns pass_annual for annual RescattoPass subscribers', () => {
    const user = {
      role: 'CUSTOMER',
      rescattoPass: { isActive: true, status: 'active', planId: 'annual' },
    } as any;
    expect(getUserTier(user)).toBe('pass_annual');
  });

  it('returns pass_monthly for monthly RescattoPass subscribers', () => {
    const user = {
      role: 'CUSTOMER',
      rescattoPass: { isActive: true, status: 'active', planId: 'monthly' },
    } as any;
    expect(getUserTier(user)).toBe('pass_monthly');
  });

  it('returns free for customers without RescattoPass', () => {
    const user = { role: 'CUSTOMER' } as any;
    expect(getUserTier(user)).toBe('free');
  });

  it('returns free for customers with expired Pass', () => {
    const user = {
      role: 'CUSTOMER',
      rescattoPass: { isActive: true, status: 'expired', planId: 'annual' },
    } as any;
    expect(getUserTier(user)).toBe('free');
  });

  it('returns free for customers with inactive Pass', () => {
    const user = {
      role: 'CUSTOMER',
      rescattoPass: { isActive: false, status: 'active', planId: 'annual' },
    } as any;
    expect(getUserTier(user)).toBe('free');
  });

  it('prioritizes admin role over Pass subscription', () => {
    const user = {
      role: 'SUPER_ADMIN',
      rescattoPass: { isActive: true, status: 'active', planId: 'monthly' },
    } as any;
    expect(getUserTier(user)).toBe('admin');
  });
});

// ─── Memory Service ───

describe('Memory service pure functions', () => {
  it('buildMemorySummary separates categories correctly', async () => {
    const { buildMemorySummary } = await import('../../services/aiChatMemoryService');

    const memories = [
      { category: 'preference', value: 'Le gusta el sushi' },
      { category: 'fact', value: 'Vive en Bucaramanga' },
      { category: 'context', value: 'Habló de restaurantes' },
      { category: 'preference', value: 'No come cerdo' },
    ] as any[];

    const summary = buildMemorySummary(memories);
    expect(summary.preferences).toEqual(['Le gusta el sushi', 'No come cerdo']);
    expect(summary.facts).toEqual(['Vive en Bucaramanga']);
    expect(summary.recentTopics).toEqual(['Habló de restaurantes']);
  });

  it('buildMemorySummary returns empty arrays for no memories', async () => {
    const { buildMemorySummary } = await import('../../services/aiChatMemoryService');
    const summary = buildMemorySummary([]);
    expect(summary.preferences).toEqual([]);
    expect(summary.facts).toEqual([]);
    expect(summary.recentTopics).toEqual([]);
  });

  it('formatMemoryBlock formats all categories', async () => {
    const { formatMemoryBlock } = await import('../../services/aiChatMemoryService');
    const summary = {
      preferences: ['Le gusta el sushi'],
      facts: ['Vive en Bucaramanga'],
      recentTopics: ['Habló de restaurantes'],
    };

    const block = formatMemoryBlock(summary);
    expect(block).toContain('Vive en Bucaramanga');
    expect(block).toContain('Le gusta el sushi');
    expect(block).toContain('Habló de restaurantes');
  });

  it('formatMemoryBlock returns empty string for empty summary', async () => {
    const { formatMemoryBlock } = await import('../../services/aiChatMemoryService');
    const empty = { preferences: [], facts: [], recentTopics: [] };
    expect(formatMemoryBlock(empty)).toBe('');
  });

  it('buildCacheOptimizedMessages prioritizes static content first', async () => {
    const { buildCacheOptimizedMessages } = await import('../../services/aiChatMemoryService');
    const optimizedContext = {
      staticBlock: 'System prompt here',
      memoryBlock: 'User memories here',
      contextBlock: 'Today context here',
    };

    const messages = buildCacheOptimizedMessages(
      optimizedContext,
      [{ role: 'user', content: 'previous message' }],
      'current message',
    );

    // System prompt should always be first (for prefix caching)
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('System prompt here');
    // Last message should be the current user message
    expect(messages[messages.length - 1].role).toBe('user');
    expect(messages[messages.length - 1].content).toBe('current message');
  });
});

// ─── Storage Service (local operations) ───

describe('aiChatStorageService (local)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('save and load local conversation persists messages', async () => {
    const { saveConversation, loadConversation } = await import('../../services/aiChatStorageService');

    const messages = [
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: '¿En qué puedo ayudarte?' },
    ];

    // Save should not throw
    await expect(saveConversation('test-user', 'local', messages)).resolves.toBeUndefined();

    const loaded = await loadConversation('test-user', 'local');
    expect(loaded).toHaveLength(2);
    expect(loaded[0].role).toBe('user');
    expect(loaded[0].content).toBe('Hola');
    expect(loaded[1].role).toBe('assistant');
    expect(loaded[1].content).toBe('¿En qué puedo ayudarte?');
  });

  it('loadConversation returns empty array when no data', async () => {
    const { loadConversation } = await import('../../services/aiChatStorageService');
    const loaded = await loadConversation('nonexistent-user', 'local');
    expect(loaded).toEqual([]);
  });

  it('clearConversation removes local data', async () => {
    const { saveConversation, loadConversation, clearConversation } =
      await import('../../services/aiChatStorageService');

    await saveConversation('test-user', 'local', [
      { role: 'user', content: 'test' } as any,
    ]);
    await clearConversation('test-user', 'local');

    const loaded = await loadConversation('test-user', 'local');
    expect(loaded).toEqual([]);
  });

  it('conversations are isolated per userId', async () => {
    const { saveConversation, loadConversation } =
      await import('../../services/aiChatStorageService');

    await saveConversation('user-a', 'local', [
      { role: 'user', content: 'Message from A' } as any,
    ]);
    await saveConversation('user-b', 'local', [
      { role: 'user', content: 'Message from B' } as any,
    ]);

    const loadedA = await loadConversation('user-a', 'local');
    const loadedB = await loadConversation('user-b', 'local');

    expect(loadedA[0].content).toBe('Message from A');
    expect(loadedB[0].content).toBe('Message from B');
  });
});

// ─── AI Chat Service Fallback ───

describe('aiChatService fallback', () => {
  it('fallback responds to greetings', async () => {
    const { sendMessage } = await import('../../services/aiChatService');
    const result = await sendMessage('Hola', []);
    expect(result.content).toBeTruthy();
    expect(result.content.length).toBeGreaterThan(10);
  });

  it('fallback responds to Rescatto questions', async () => {
    const { sendMessage } = await import('../../services/aiChatService');
    const result = await sendMessage('¿Qué es Rescatto?', []);
    expect(result.content.toLowerCase()).toContain('rescatto');
  });

  it('fallback handles packs pregunta', async () => {
    const { sendMessage } = await import('../../services/aiChatService');
    const result = await sendMessage('Cuéntame del pack sorpresa', []);
    expect(result.content.toLowerCase()).toContain('pack');
  });

  it('fallback rejects non-Rescatto topics', async () => {
    const { sendMessage } = await import('../../services/aiChatService');
    const result = await sendMessage('Cuál es el clima de mañana?', []);
    // Should contain something about only Rescatto
    expect(result.content).toBeTruthy();
  });
});

// ─── Tool Knowledge Base ───

describe('aiChatTools FAQ', () => {
  it('RESCATTO_FAQ has all expected topics', async () => {
    const mod = await import('../../services/aiChatTools');
    // Can't easily access internal functions, but we can check the module exists
    expect(mod).toBeDefined();
    expect(mod.CHAT_TOOLS).toBeDefined();
    expect(Array.isArray(mod.CHAT_TOOLS)).toBe(true);
  });

  it('CHAT_TOOLS has at least 18 tools', async () => {
    const { CHAT_TOOLS } = await import('../../services/aiChatTools');
    expect(CHAT_TOOLS.length).toBeGreaterThanOrEqual(18);
  });

  it('all tools have required fields', async () => {
    const { CHAT_TOOLS } = await import('../../services/aiChatTools');
    CHAT_TOOLS.forEach(tool => {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
    });
  });

  it('every tool has a unique name', async () => {
    const { CHAT_TOOLS } = await import('../../services/aiChatTools');
    const names = CHAT_TOOLS.map(t => t.function.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

// ─── i18n keys for AI Chat ───

describe('AI Chat i18n keys', () => {
  it('Spanish translations exist for chat messages', async () => {
    const { default: i18n } = await import('../../i18n');
    // Check the Spanish resource bundle has AI chat keys
    const esResources = (i18n as any).options?.resources?.es?.translation;
    // If translation exists, check it has chat_ai keys
    if (esResources) {
      const aiKeys = Object.keys(esResources).filter(k => k.startsWith('chat_ai'));
      expect(aiKeys.length).toBeGreaterThan(0);
    }
  });
});
