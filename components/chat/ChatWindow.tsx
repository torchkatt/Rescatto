import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { MessageBubble } from './MessageBubble';
import { X, Send, Loader2, MessageSquare, MapPin, ArrowLeft } from 'lucide-react';
import { doc, setDoc, serverTimestamp, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { logger } from '../../utils/logger';
import { LoadingSpinner } from '../customer/common/Loading';

interface ChatWindowProps {
    onClose?: () => void;
    onBack?: () => void;
    showBackButton?: boolean;
    className?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
    onClose, 
    onBack, 
    showBackButton = false, 
    className = '' 
}) => {
    const { currentChat, messages, loading, sending, sendMessage, closeChat, loadMoreMessages, hasMoreMessages, loadingMoreMessages } = useChat();
    const { user } = useAuth();
    const { error: toastError } = useToast();
    const { t } = useTranslation();
    const [messageText, setMessageText] = useState('');
    const [typing, setTyping] = useState<Record<string, boolean>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [hasNewMessages, setHasNewMessages] = useState(false);
    const [newMessagesCount, setNewMessagesCount] = useState(0);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Typing presence logic
    useEffect(() => {
        if (!currentChat?.id || !user?.id) return;
        const typingRef = doc(db, 'chats', currentChat.id, 'typing', user.id);

        const setTypingStatus = async (isTyping: boolean) => {
            try {
                await setDoc(typingRef, { isTyping, updatedAt: serverTimestamp() }, { merge: true });
            } catch (e) {
                logger.error('Error setting typing status:', e);
            }
        };

        if (messageText.length > 0) {
            setTypingStatus(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setTypingStatus(false), 3000);
        } else {
            setTypingStatus(false);
        }

        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            setTypingStatus(false);
        };
    }, [messageText, currentChat?.id, user?.id]);

    // Subscribe to others typing
    useEffect(() => {
        if (!currentChat?.id || !user?.id) return;
        const typingCollection = collection(db, 'chats', currentChat.id, 'typing');

        return onSnapshot(typingCollection, (snapshot) => {
            const typingData: Record<string, boolean> = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                // Only if it's someone else and they updated recently (< 10s)
                if (doc.id !== user.id && data.isTyping) {
                    typingData[doc.id] = true;
                }
            });
            setTyping(typingData);
        });
    }, [currentChat?.id, user?.id]);

    // Auto-scroll to bottom when new messages or typing status arrive
    useEffect(() => {
        if (isAtBottom) {
            scrollToBottom();
        } else if (messages.length > 0) {
            setHasNewMessages(true);
            const last = messages[messages.length - 1];
            if (last && last.senderId !== user?.id) {
                setNewMessagesCount((prev) => prev + 1);
            }
        }
    }, [messages, typing]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!messageText.trim() || sending) return;

        try {
            await sendMessage(messageText);
            setMessageText('');
        } catch {
            toastError(t('chat_error_send'));
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSendLocation = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    await sendMessage('', 'location', {
                        location: {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        }
                    });
                },
                (error) => {
                    logger.error('Error getting location:', error);
                    toastError(t('chat_error_location'));
                }
            );
        } else {
            toastError(t('chat_error_geolocation'));
        }
    };

    const getOtherParticipantName = () => {
        if (!currentChat || !user) return t('chat_user');
        const otherId = currentChat.participants.find(id => id !== user.id);
        return (otherId && currentChat.participantNames[otherId])
            ? currentChat.participantNames[otherId]
            : t('chat_user');
    };

    if (!currentChat) {
        return (
            <div className={`flex flex-col items-center justify-center h-full bg-gray-50/50 ${className}`}>
                <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-sm mx-auto">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                        <MessageSquare size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{t('chat_hello')}</h3>
                    <p className="text-gray-500">
                        {t('chat_select_desc')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-[#fdfdfd] shadow-2xl relative overflow-hidden ${className}`}>
            {/* Background Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23059669' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white shadow-sm z-20 relative">
                <div className="flex items-center gap-3">
                    {/* Back Button (Global context) or nothing (Specific order context) */}
                    {showBackButton ? (
                        <button
                            onClick={() => onBack?.()}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-all active:scale-90"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                    ) : (
                        /* Only show close button if no other way to exit and specifically on mobile if needed, 
                           but for order chat we want only the right X */
                        onClose && !showBackButton && (
                            <button
                                onClick={() => {
                                    closeChat();
                                    onClose();
                                }}
                                className="md:hidden p-1.5 hover:bg-gray-100 rounded-xl transition-all active:scale-90 hidden"
                            >
                                <X size={20} className="text-gray-600" />
                            </button>
                        )
                    )}

                    <div className="relative">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-100">
                            {getOtherParticipantName().charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                    </div>
                    
                    <div className="flex flex-col">
                        <h3 className="font-black text-gray-900 leading-none mb-1 text-sm">{getOtherParticipantName()}</h3>
                        {currentChat.metadata?.orderNumber ? (
                            <button
                                onClick={() => {
                                    const role = user?.role;
                                    const url = role === 'CUSTOMER'
                                        ? `/app/orders?orderId=${currentChat.metadata.orderNumber}`
                                        : `/order-management?search=${currentChat.metadata.orderNumber}`;
                                    window.location.href = url;
                                }}
                                className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors flex items-center gap-1"
                            >
                                <span>Pedido #{currentChat.metadata.orderNumber.slice(0, 8)}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            </button>
                        ) : (
                            <span className="text-[10px] font-bold text-gray-400">{t('chat_online')}</span>
                        )}
                    </div>
                </div>

                {onClose && (
                    <button
                        onClick={() => {
                            closeChat();
                            onClose();
                        }}
                        className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-2xl transition-all active:scale-90"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div
                ref={listRef}
                className="flex-1 overflow-y-auto px-5 py-6"
                onScroll={() => {
                    const el = listRef.current;
                    if (!el) return;
                    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
                    setIsAtBottom(atBottom);
                    if (atBottom) {
                        setHasNewMessages(false);
                        setNewMessagesCount(0);
                    }
                }}
            >
                {loading && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <LoadingSpinner />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mb-4">
                            <MessageSquare size={24} className="text-gray-300" />
                        </div>
                        <p className="text-gray-400 font-bold text-xs max-w-[180px]">{t('chat_no_messages')}</p>
                    </div>
                ) : (
                    <>
                        {hasMoreMessages && (
                            <div className="flex justify-center mb-4">
                                <button
                                    onClick={loadMoreMessages}
                                    disabled={loadingMoreMessages}
                                    className="px-3 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-60"
                                >
                                    {loadingMoreMessages ? t('loading') : t('chat_load_older')}
                                </button>
                            </div>
                        )}
                        {messages.map((message, index) => {
                            const isMine = message.senderId === user?.id;
                            const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;

                            return (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isMine={isMine}
                                    showAvatar={showAvatar}
                                />
                            );
                        })}

                        {/* Typing Indicator */}
                        {Object.keys(typing).length > 0 && (
                            <div className="flex gap-2 mb-4 items-center animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 border border-gray-200 shadow-sm">
                                    <MessageSquare size={14} className="fill-gray-400/10" />
                                </div>
                                <div className="bg-white border border-gray-100 px-3 py-2 rounded-2xl shadow-sm flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {hasNewMessages && (
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20">
                    <button
                        onClick={() => {
                            setHasNewMessages(false);
                            setNewMessagesCount(0);
                            scrollToBottom();
                        }}
                        className="px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
                    >
                        {t('chat_new_messages', { count: newMessagesCount })}
                    </button>
                </div>
            )}

            {/* Input */}
            <div className="px-5 py-5 pb-8 bg-white border-t border-gray-100">
                <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-100 focus-within:border-emerald-200 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-emerald-500/5 transition-all duration-300">
                    <button
                        onClick={handleSendLocation}
                        disabled={sending}
                        className="p-3.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-30"
                        title={t('chat_share_location')}
                    >
                        <MapPin size={22} />
                    </button>
                    <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={t('chat_placeholder')}
                        disabled={sending}
                        className="flex-1 py-3 bg-transparent text-gray-900 placeholder-gray-400 font-bold focus:outline-none text-sm"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!messageText.trim() || sending}
                        className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all flex items-center justify-center w-12 h-12"
                    >
                        {sending ? (
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

export default ChatWindow;
