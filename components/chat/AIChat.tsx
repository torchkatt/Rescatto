import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Sparkles, HelpCircle, Package, MapPin, ShoppingBag, AlertCircle, Mic, Cloud, HardDrive, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserRole } from '../../types';
import { logger } from '../../utils/logger';
import { sanitizeHtml } from '../../utils/sanitize';
import { initDeepSeek, isDeepSeekConfigured, sendMessage } from '../../services/aiChatService';
import { checkAndIncrementMessage, getRemainingMessages } from '../../services/aiChatUsageService';
import { setNavigateHook } from '../../services/aiChatTools';
import type { ChatMessage } from '../../services/aiChatTypes';
import { AI_CHAT_PLANS } from '../../services/aiChatTypes';
import { AIChatAudio } from './AIChatAudio';
import {
  getStoragePreference,
  setStoragePreference,
  saveConversation,
  loadConversation,
  migrateConversation,
} from '../../services/aiChatStorageService';

interface AIChatProps {
  className?: string;
}

// Initialize DeepSeek API key from environment
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
if (DEEPSEEK_KEY) {
  initDeepSeek(DEEPSEEK_KEY);
}

export const AIChat: React.FC<AIChatProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const { showToast, error: showErrorToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [usageInfo, setUsageInfo] = useState<{
    remaining: number;
    used: number;
    limit: number;
    tier: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [storageMode, setStorageMode] = useState<'local' | 'cloud'>('local');
  const [showStorageMenu, setShowStorageMenu] = useState(false);
  const saveTimeoutRef = useRef<number>();

  // ─── Guest guard: render only local suggestions, no API ───
  if (user?.isGuest) {
    return <AIChatGuestMode />;
  }

  // Register navigate hook
  useEffect(() => {
    setNavigateHook((path: string) => {
      navigate(path);
    });
  }, [navigate]);

  // Load storage preference + conversation on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const mode = await getStoragePreference(user.id, !!user.isGuest);
      setStorageMode(mode);
      const saved = await loadConversation(user.id, mode);
      if (saved.length > 0) {
        setMessages(saved);
      }
    })();
  }, [user?.id, user?.isGuest]);

  // Save conversation after messages change (debounced)
  useEffect(() => {
    if (!user || messages.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveConversation(user.id, storageMode, messages).catch(() => {});
    }, 500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [messages, storageMode, user?.id]);

  // Load usage info on mount
  useEffect(() => {
    if (user) {
      getRemainingMessages(user.id, user).then(info => {
        setUsageInfo({
          remaining: info.remaining === Infinity ? -1 : info.remaining,
          used: info.used,
          limit: info.limit === Infinity ? -1 : info.limit,
          tier: info.tier,
        });
      }).catch(() => {});
    }
  }, [user]);

  // Quick suggestions based on role
  const getSuggestions = () => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      return [
        { icon: MapPin, text: '🏪 ¿Qué restaurantes están activos ahora?' },
        { icon: ShoppingBag, text: '📊 ¿Cuántos pedidos hay hoy?' },
        { icon: Package, text: '🎁 Muéstrame los productos con más descuento' },
        { icon: HelpCircle, text: '📖 ¿Cómo funciona Rescatto Pass?' },
      ];
    }
    if (user?.role === UserRole.VENUE_OWNER) {
      return [
        { icon: ShoppingBag, text: '📦 Ver mis pedidos activos' },
        { icon: Sparkles, text: '🎁 Recomiéndame productos para publicar' },
        { icon: MapPin, text: '📍 ¿Cómo funcionan los precios dinámicos?' },
      ];
    }
    // Default (customer / guest)
    return [
      { icon: HelpCircle, text: '🍽️ ¿Cómo funciona Rescatto?' },
      { icon: Package, text: '🎁 Busca packs sorpresa disponibles' },
      { icon: Sparkles, text: '🔥 ¿Qué productos tienen más descuento?' },
      { icon: MapPin, text: '📍 Restaurantes cerca de mí' },
      { icon: ShoppingBag, text: '📦 Mis pedidos' },
    ];
  };

  const quickSuggestions = getSuggestions();

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendUserMessage = async (text: string) => {
    if (!text.trim() || isThinking || !user) return;

    // Check usage limits
    const limitCheck = await checkAndIncrementMessage(user.id, user);
    if (!limitCheck.allowed) {
      showErrorToast(limitCheck.error || (t('chat_ai_limit_reached') || 'Has alcanzado el límite de mensajes de hoy.'));
      return;
    }

    // Update usage info after increment
    setUsageInfo({
      remaining: limitCheck.remaining === Infinity ? -1 : limitCheck.remaining,
      used: limitCheck.used,
      limit: limitCheck.limit === Infinity ? -1 : limitCheck.limit,
      tier: limitCheck.tier,
    });

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsThinking(true);

    try {
      // Get AI response with DeepSeek + function calling + memory
      const result = await sendMessage(
        text,
        messages,
        user.id,
        {
          name: user.fullName || 'Usuario',
          role: user.role,
          city: user.city,
          tier: limitCheck.tier,
          remaining: limitCheck.remaining,
        }
      );

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: result.content,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      logger.error('Error getting AI response:', error);
      showErrorToast(t('chat_ai_error') || 'Error al obtener respuesta');
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage(inputText);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendUserMessage(suggestion);
  };

  const handleVoiceTranscript = (text: string) => {
    // Set the input text and send automatically
    setInputText(text);
    // Small delay to let the UI update
    setTimeout(() => sendUserMessage(text), 100);
  };

  const getTierBadge = () => {
    if (!usageInfo) return null;
    const plan = AI_CHAT_PLANS[usageInfo.tier as keyof typeof AI_CHAT_PLANS];
    if (!plan) return null;

    const colors: Record<string, string> = {
      guest: 'bg-gray-100 text-gray-500',
      free: 'bg-emerald-50 text-emerald-600',
      pass_monthly: 'bg-purple-50 text-purple-600',
      pass_annual: 'bg-amber-50 text-amber-600',
      admin: 'bg-blue-50 text-blue-600',
    };

    const remainingText = usageInfo.remaining === -1
      ? 'Ilimitado'
      : `${usageInfo.remaining}/${usageInfo.limit}`;

    return (
      <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${colors[usageInfo.tier] || 'bg-gray-100 text-gray-500'}`}>
        {plan.label} · {remainingText}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white/50 ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-start min-h-full text-center pt-5 pb-10">
            {/* Profile Info in Empty State */}
            <div className="flex flex-col items-center mb-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-xl shadow-emerald-200">
                <Sparkles size={40} className="text-white bg-white/20 p-2 rounded-xl" />
              </div>
              <h3 className="text-xl font-black text-gray-900">RescattoBot</h3>
              <p className="text-sm font-bold text-emerald-600 tracking-tight">Asistente IA · Alta cocina, cero desperdicio 🌱</p>

              {/* Tier badge */}
              <div className="mt-2">{getTierBadge()}</div>
            </div>

            <div className="w-full space-y-6 mt-4">
              <h4 className="text-lg font-black text-gray-800">
                ¿En qué puedo ayudarte hoy?
              </h4>

              <div className="space-y-3 px-4">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-2">{t('chat_ai_suggestions_title') || 'Sugerencias rápidas'}</p>
                <div className="grid grid-cols-1 gap-2.5">
                  {quickSuggestions.map((suggestion, index) => {
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion.text)}
                        className="flex items-center gap-4 px-5 py-4 bg-white border border-emerald-100 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all active:scale-95 text-sm font-bold text-left text-gray-700 group shadow-sm shadow-emerald-100/20"
                      >
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                          <span className="text-lg">{suggestion.text.split(' ')[0]}</span>
                        </div>
                        <span className="flex-1">{suggestion.text.replace(/^[^\s]+\s/, '')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Usage badge at top of conversation */}
            <div className="flex justify-center mb-2">
              {getTierBadge()}
            </div>

            {/* Storage mode indicator + clear */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={() => setShowStorageMenu(!showStorageMenu)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-emerald-600 transition-colors"
                title={storageMode === 'cloud' ? (t('chat_ai_storage_saved_cloud') || 'Guardado en la nube') : (t('chat_ai_storage_saved_local') || 'Guardado localmente')}
              >
                {storageMode === 'cloud' ? <Cloud size={12} /> : <HardDrive size={12} />}
                {storageMode === 'cloud' ? t('chat_ai_storage_cloud') || 'Nube' : t('chat_ai_storage_local') || 'Local'}
              </button>

              {showStorageMenu && (
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg absolute mt-16 z-10">
                  <button
                    onClick={async () => {
                      if (!user) return;
                      const newMode = storageMode === 'cloud' ? 'local' : 'cloud';
                      const migrated = await migrateConversation(user.id, storageMode, newMode);
                      await setStoragePreference(user.id, newMode);
                      setStorageMode(newMode);
                      if (migrated.length > 0) setMessages(migrated);
                      setShowStorageMenu(false);
                      showToast('success', newMode === 'cloud' ? (t('chat_ai_migrated_cloud') || 'Conversaciones ahora en la nube ☁️') : (t('chat_ai_migrated_local') || 'Conversaciones ahora en el dispositivo 💻'));
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 hover:text-emerald-600 px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition-all whitespace-nowrap"
                  >
                    <HardDrive size={12} />
                    {(t('chat_ai_storage_migrate_to') || 'Migrar a')} {storageMode === 'cloud' ? (t('chat_ai_storage_local') || 'Local') : (t('chat_ai_storage_cloud') || 'Nube')}
                  </button>
                  <div className="w-px h-4 bg-gray-200" />
                  <button
                    onClick={async () => {
                      if (!user) return;
                      setMessages([]);
                      await saveConversation(user.id, storageMode, []);
                      setShowStorageMenu(false);
                      showToast('success', `🧹 ${t('chat_ai_cleared') || 'Conversación borrada'}`);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={12} />
                    {t('chat_ai_delete') || 'Borrar'}
                  </button>
                </div>
              )}

              <span className="text-[10px] text-gray-300">·</span>
              <span className="text-[10px] text-gray-400">
                {messages.length} {t('chat_ai_messages_count', { count: messages.length }) || `mensaje${messages.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 mb-6 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                    <Sparkles size={16} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-emerald-100'
                      : 'bg-white border border-emerald-50 text-gray-800'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="markdown-content text-sm font-medium">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                          li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-black text-emerald-700" {...props} />,
                          a: ({ node, ...props }) => <a className="text-blue-600 hover:underline font-bold" target="_blank" rel="noopener noreferrer" {...props} />,
                          blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-emerald-200 pl-3 italic my-2 bg-emerald-50/50 py-1" {...props} />,
                          code: ({ className, children, ...props }: any) => {
                            const isInline = !className?.includes('language-');
                            return isInline
                              ? <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                              : <code className="block bg-gray-900 text-green-300 p-3 rounded-xl text-xs font-mono my-2 overflow-x-auto" {...props}>{children}</code>;
                          },
                        }}
                      >
                        {sanitizeHtml(message.content)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm font-bold whitespace-pre-wrap">{message.content}</p>
                  )}
                  {message.timestamp && (
                    <p className={`text-[9px] font-black mt-2 tracking-widest ${
                      message.role === 'user' ? 'text-emerald-100/60' : 'text-gray-300'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-black text-xs mt-1 shadow-md">
                    {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            ))}
            {isThinking && (
              <div className="flex gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center mt-1 shadow-md">
                  <Sparkles size={16} className="text-white animate-pulse" />
                </div>
                <div className="bg-white border border-emerald-50 px-5 py-4 rounded-2xl shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="px-6 py-5 bg-white border-t border-emerald-100">
        <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-emerald-200 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-emerald-500/5 transition-all duration-300">
          {/* Voice button */}
          <AIChatAudio
            onTranscript={handleVoiceTranscript}
            disabled={isThinking}
          />

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Pregúntame lo que quieras sobre Rescatto..."
            disabled={isThinking}
            className="flex-1 px-4 py-3 bg-transparent placeholder:text-gray-400 text-sm font-bold focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendUserMessage(inputText)}
            disabled={!inputText.trim() || isThinking}
            className="p-3 bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all flex items-center justify-center w-12 h-12"
          >
            {isThinking ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Guest mode: local-only suggestions, no DeepSeek API ───
const AIChatGuestMode: React.FC = () => {
  const { t } = useTranslation();

  const guestSuggestions = [
    { icon: '🍽️', text: `${t('chat_ai_what_is') || '¿Qué es Rescatto?'}` },
    { icon: '💡', text: `${t('chat_ai_how_it_works') || '¿Cómo funciona?'}` },
    { icon: '🏪', text: `${t('chat_ai_find_venue') || '¿Cómo encuentro un restaurante?'}` },
    { icon: '📦', text: `${t('chat_ai_what_is_pack') || '¿Qué es un pack sorpresa?'}` },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-xl shadow-emerald-200">
        <Sparkles size={28} className="text-white" />
      </div>
      <h3 className="text-lg font-black text-gray-800 mb-2">{t('chat_ai_welcome_guest') || 'RescattoBot'}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">{t('chat_ai_login_to_chat') || 'Inicia sesión para usar el asistente IA'}</p>
      <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
        {guestSuggestions.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-sm font-semibold text-gray-600"
          >
            <span className="text-lg">{s.icon}</span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIChat;
