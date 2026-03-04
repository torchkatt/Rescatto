import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { geminiService, AIMessage } from '../../services/geminiService';
import { AIContextBuilder } from '../../services/aiContextBuilder';
import { Send, Loader2, Sparkles, HelpCircle, Package, MapPin } from 'lucide-react';
import { LoadingSpinner } from '../customer/common/Loading';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserRole } from '../../types';
import { logger } from '../../utils/logger';

interface AIChatProps {
    className?: string;
}

export const AIChat: React.FC<AIChatProps> = ({ className = '' }) => {
    const { user } = useAuth();
    const { error: showError } = useToast();
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Quick suggestions based on role
    const getSuggestions = () => {
        if (user?.role === UserRole.SUPER_ADMIN) {
            return [
                { icon: Sparkles, text: 'Resumen del Sistema' },
                { icon: MapPin, text: 'Ver los Negocios Activos' },
                { icon: Package, text: 'Métricas y Ventas de hoy' },
                { icon: HelpCircle, text: '¿Cómo asignar credenciales nuevas?' }
            ];
        }
        if (user?.role === UserRole.VENUE_OWNER) {
            return [
                { icon: Package, text: '¿Cómo publico un Pack Sorpresa?' },
                { icon: Sparkles, text: '¿Cómo funcionan los pagos hacia mi negocio?' },
                { icon: MapPin, text: '¿Es posible limitar las cantidades diarias?' }
            ];
        }
        // DEFAULT FALLBACK (Customer / others)
        return [
            { icon: HelpCircle, text: '¿Cómo funciona Rescatto?' },
            { icon: Package, text: '¿Qué trae el Pack Sorpresa?' },
            { icon: Sparkles, text: '¿Cuáles son los métodos de pago?' },
            { icon: HelpCircle, text: '¿A qué hora debo ir a recoger mi pedido?' },
            { icon: MapPin, text: 'Mostrar restaurantes cerca de mí' },
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
            showError('No pude procesar tu mensaje. Intenta nuevamente.');
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
        <div className={`flex flex-col h-full bg-gradient-to-br from-purple-50 to-blue-50 ${className}`}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-purple-200 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                        <Sparkles size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">RescattoBot IA</h3>
                        <p className="text-xs text-purple-600">Tu asistente virtual</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6" ref={chatContainerRef}>
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mb-4">
                            <Sparkles size={32} className="text-white" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">
                            ¡Hola! Soy tu asistente virtual 👋
                        </h4>
                        <p className="text-gray-600 text-sm mb-6 max-w-xs">
                            Puedo ayudarte con información sobre restaurantes, productos, pedidos y cómo usar Rescatto.
                        </p>
                        <div className="space-y-2 w-full max-w-xs">
                            <p className="text-xs text-gray-500 font-medium mb-2">Preguntas frecuentes:</p>
                            {quickSuggestions.map((suggestion, index) => {
                                const Icon = suggestion.icon;
                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleSuggestionClick(suggestion.text)}
                                        className="w-full flex items-center gap-2 px-4 py-2 bg-white border border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-left text-sm"
                                    >
                                        <Icon size={16} className="text-purple-600" />
                                        <span className="text-gray-700">{suggestion.text}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex gap-3 mb-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Sparkles size={16} className="text-white" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[85%] px-4 py-3 rounded-2xl ${message.role === 'user'
                                        ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'
                                        : 'bg-white border border-purple-200 text-gray-800 shadow-sm'
                                        }`}
                                >
                                    {message.role === 'assistant' ? (
                                        <div className="markdown-content text-sm">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                                                    li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                                    strong: ({ node, ...props }) => <strong className="font-semibold text-purple-700" {...props} />,
                                                    a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-purple-200 pl-3 italic my-2" {...props} />,
                                                }}
                                            >
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    )}
                                    <p className={`text-[10px] mt-1 text-right ${message.role === 'user' ? 'text-purple-100' : 'text-gray-400'
                                        }`}>
                                        {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                {message.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm mt-1">
                                        {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mt-1">
                                    <Sparkles size={16} className="text-white animate-pulse" />
                                </div>
                                <div className="bg-white border border-purple-200 px-4 py-3 rounded-2xl shadow-sm">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <div className="px-6 py-4 bg-white/80 backdrop-blur-sm border-t border-purple-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Escribe tu pregunta..."
                        disabled={isThinking}
                        className="flex-1 px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                    />
                    <button
                        onClick={() => sendMessage(inputText)}
                        disabled={!inputText.trim() || isThinking}
                        className="px-4 py-2 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center w-12 h-10"
                    >
                        {isThinking ? (
                            <LoadingSpinner size="xs" color="white" />
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
