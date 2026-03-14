import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { geminiService, AIMessage } from '../../services/geminiService';
import { AIContextBuilder } from '../../services/aiContextBuilder';
import { Send, Loader2, Sparkles, HelpCircle, Package, MapPin } from 'lucide-react';
import { LoadingSpinner } from '../customer/common/Loading';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserRole } from '../../types';
import { logger } from '../../utils/logger';
import { sanitizeHtml } from '../../utils/sanitize';

interface AIChatProps {
    className?: string;
}

export const AIChat: React.FC<AIChatProps> = ({ className = '' }) => {
    const { user } = useAuth();
    const { error: showError } = useToast();
    const { t } = useTranslation();
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Quick suggestions based on role
    const getSuggestions = () => {
        if (user?.role === UserRole.SUPER_ADMIN) {
            return [
                { icon: Sparkles, text: t('chat_ai_suggestion_1_admin') },
                { icon: MapPin, text: t('chat_ai_suggestion_2_admin') },
                { icon: Package, text: t('chat_ai_suggestion_3_admin') },
                { icon: HelpCircle, text: t('chat_ai_suggestion_4_admin') }
            ];
        }
        if (user?.role === UserRole.VENUE_OWNER) {
            return [
                { icon: Package, text: t('chat_ai_suggestion_1_venue') },
                { icon: Sparkles, text: t('chat_ai_suggestion_2_venue') },
                { icon: MapPin, text: t('chat_ai_suggestion_3_venue') }
            ];
        }
        // DEFAULT FALLBACK (Customer / others)
        return [
            { icon: HelpCircle, text: t('chat_ai_suggestion_1_cust') },
            { icon: Package, text: t('chat_ai_suggestion_2_cust') },
            { icon: Sparkles, text: t('chat_ai_suggestion_3_cust') },
            { icon: HelpCircle, text: t('chat_ai_suggestion_4_cust') },
            { icon: MapPin, text: t('chat_ai_suggestion_5_cust') },
        ];
    };

    const quickSuggestions = getSuggestions();

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || isThinking || !user) return;

        const userMessage: AIMessage = {
            role: 'user',
            content: text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsThinking(true);

        try {
            // Build context with real-time data
            const context = await AIContextBuilder.buildContext(user);

            // Create placeholder for AI response
            const aiMessage: AIMessage = {
                role: 'assistant',
                content: '',
                timestamp: new Date()
            };

            // Add placeholder to messages
            setMessages(prev => [...prev, aiMessage]);

            // Get AI response stream
            const stream = geminiService.sendMessageStream(text, context);

            let fullContent = '';
            let firstChunk = true;

            for await (const chunk of stream) {
                if (firstChunk) {
                    setIsThinking(false);
                    firstChunk = false;
                }

                fullContent += chunk;

                // Update the last message with new content
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessageIndex = newMessages.length - 1;
                    if (lastMessageIndex >= 0) {
                        newMessages[lastMessageIndex] = {
                            ...newMessages[lastMessageIndex],
                            content: fullContent
                        };
                    }
                    return newMessages;
                });
            }

        } catch (error) {
            logger.error('Error getting AI response:', error);
            showError(t('chat_ai_error'));
            setIsThinking(false);

            // Remove the empty placeholder if it exists and is empty
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && !last.content) {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputText);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        sendMessage(suggestion);
    };

    return (
        <div className={`flex flex-col h-full bg-white/50 ${className}`}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5" ref={chatContainerRef}>
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-start min-h-full text-center pt-5 pb-10">
                        {/* Profile Info in Empty State */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-4 shadow-xl shadow-purple-200">
                                <Sparkles size={40} className="text-white bg-white/20 p-2 rounded-xl" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900">{t('chat_ai_bot_name')}</h3>
                            <p className="text-sm font-bold text-purple-600 tracking-tight">{t('chat_ai_assistant_label')}</p>
                        </div>

                        <div className="w-full space-y-6">
                            <h4 className="text-lg font-black text-gray-800">
                                {t('chat_ai_how_help')}
                            </h4>

                            <div className="space-y-3 px-4">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-2">{t('chat_ai_suggestions_label')}</p>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {quickSuggestions.map((suggestion, index) => {
                                        const Icon = suggestion.icon;
                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleSuggestionClick(suggestion.text)}
                                                className="flex items-center gap-4 px-5 py-4 bg-white border border-purple-100 rounded-2xl hover:border-purple-300 hover:bg-purple-50 hover:shadow-lg hover:shadow-purple-500/5 transition-all active:scale-95 text-sm font-bold text-left text-gray-700 group shadow-sm shadow-purple-100/20"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                                                    <Icon size={18} className="text-purple-600" />
                                                </div>
                                                <span className="flex-1">{suggestion.text}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex gap-3 mb-6 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                                        <Sparkles size={16} className="text-white" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm ${message.role === 'user'
                                        ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-purple-100'
                                        : 'bg-white border border-purple-50 text-gray-800'
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
                                                    strong: ({ node, ...props }) => <strong className="font-black text-purple-700" {...props} />,
                                                    a: ({ node, ...props }) => <a className="text-blue-600 hover:underline font-bold" target="_blank" rel="noopener noreferrer" {...props} />,
                                                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-purple-200 pl-3 italic my-2 bg-purple-50/50 py-1" {...props} />,
                                                }}
                                            >
                                                {sanitizeHtml(message.content)}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-bold whitespace-pre-wrap">{message.content}</p>
                                    )}
                                    <p className={`text-[9px] font-black mt-2 tracking-widest ${message.role === 'user' ? 'text-purple-100/60' : 'text-gray-300'
                                        }`}>
                                        {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
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
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center mt-1 shadow-md">
                                    <Sparkles size={16} className="text-white animate-pulse" />
                                </div>
                                <div className="bg-white border border-purple-50 px-5 py-4 rounded-2xl shadow-sm">
                                    <div className="flex gap-1.5 item-center">
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="px-6 py-5 bg-white border-t border-purple-100">
                <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-purple-200 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-purple-500/5 transition-all duration-300">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={t('chat_ai_placeholder')}
                        disabled={isThinking}
                        className="flex-1 px-4 py-3 bg-transparent placeholder:text-gray-400 text-sm font-bold focus:outline-none disabled:opacity-50"
                    />
                    <button
                        onClick={() => sendMessage(inputText)}
                        disabled={!inputText.trim() || isThinking}
                        className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-purple-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all flex items-center justify-center w-12 h-12"
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

export default AIChat;
