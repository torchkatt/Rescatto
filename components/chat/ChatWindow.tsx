import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MessageBubble } from './MessageBubble';
import { X, Send, Loader2, MessageSquare, MapPin } from 'lucide-react';
import { LoadingSpinner } from '../customer/common/Loading';

interface ChatWindowProps {
    onClose?: () => void;
    className?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ onClose, className = '' }) => {
    const { currentChat, messages, loading, sending, sendMessage, closeChat } = useChat();
    const { user } = useAuth();
    const { error: toastError } = useToast();
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!messageText.trim() || sending) return;

        await sendMessage(messageText);
        setMessageText('');
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
                    console.error('Error getting location:', error);
                }
            );
        } else {
            toastError('Geolocalización no soportada por el navegador.');
        }
    };

    const getOtherParticipantName = () => {
        if (!currentChat || !user) return 'Usuario';
        const otherId = currentChat.participants.find(id => id !== user.id);
        return (otherId && currentChat.participantNames[otherId])
            ? currentChat.participantNames[otherId]
            : 'Usuario';
    };

    if (!currentChat) {
        return (
            <div className={`flex flex-col items-center justify-center h-full bg-gray-50/50 ${className}`}>
                <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-sm mx-auto">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                        <MessageSquare size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">¡Hola! 👋</h3>
                    <p className="text-gray-500">
                        Selecciona una conversación de la lista para comenzar a chatear con tus clientes o repartidores.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-white ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                    {/* Botón de volver para móvil */}
                    <button
                        onClick={() => closeChat()}
                        className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-all active:scale-90"
                    >
                        <X size={20} className="text-gray-600" />
                    </button>

                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold shadow-sm">
                        {getOtherParticipantName().charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 leading-tight">{getOtherParticipantName()}</h3>
                        {currentChat.metadata.orderNumber && (
                            <p className="text-[10px] uppercase font-bold text-gray-400">Pedido #{currentChat.metadata.orderNumber.slice(0, 8)}</p>
                        )}
                    </div>
                </div>

                {onClose && (
                    <button
                        onClick={() => {
                            closeChat();
                            onClose();
                        }}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-all active:scale-90"
                    >
                        <X size={20} className="text-gray-600" />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                {loading && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <LoadingSpinner />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-400">No hay mensajes aún. ¡Comienza la conversación!</p>
                    </div>
                ) : (
                    <>
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
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <div className="px-4 sm:px-6 py-4 bg-white border-t border-gray-100">
                <div className="flex gap-2 items-center">
                    <button
                        onClick={handleSendLocation}
                        disabled={sending}
                        className="p-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center justify-center w-12 h-12 active:scale-95"
                        title="Compartir ubicación"
                    >
                        <MapPin size={20} />
                    </button>
                    <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Escribe un mensaje..."
                        disabled={sending}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100 text-base outline-none transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!messageText.trim() || sending}
                        className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-100 flex items-center justify-center w-12 h-12 active:scale-95"
                    >
                        {sending ? (
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

export default ChatWindow;
