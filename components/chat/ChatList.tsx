import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Chat } from '../../types';
import { Search, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatListProps {
    onChatSelect?: (chatId: string) => void;
    className?: string;
}

export const ChatList: React.FC<ChatListProps> = ({ onChatSelect, className = '' }) => {
    const { user } = useAuth();
    const { chats, openChat } = useChat();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredChats = chats.filter(chat => {
        const otherParticipant = Object.values(chat.participantNames).find(
            name => name !== user?.fullName
        );
        return otherParticipant?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleChatClick = async (chatId: string) => {
        await openChat(chatId);
        onChatSelect?.(chatId);
    };

    const getOtherParticipantName = (chat: Chat) => {
        const otherUserId = chat.participants.find(id => id !== user?.id);
        return otherUserId ? chat.participantNames[otherUserId] : 'Unknown';
    };

    const getUnreadBadge = (chat: Chat) => {
        if (!user?.id) return null;
        if (chat.lastMessage.senderId === user.id || chat.lastMessage.read || !chat.lastMessage.text) {
            return null;
        }
        return (
            <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></div>
        );
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return format(date, 'HH:mm', { locale: es });
        } else if (diffInHours < 48) {
            return 'Ayer';
        } else {
            return format(date, 'dd/MM', { locale: es });
        }
    };

    return (
        <div className={`flex flex-col h-full bg-white ${className}`}>
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Mensajes</h2>

                {/* Search */}
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar conversaciones..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base outline-none bg-gray-50 transition-all font-medium"
                    />
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50/50">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                            <MessageCircle size={32} className="text-emerald-500" />
                        </div>
                        <h3 className="text-gray-900 font-medium mb-1">
                            {searchQuery ? 'Sin resultados' : 'Bandeja vacía'}
                        </h3>
                        <p className="text-gray-500 text-sm max-w-[200px]">
                            {searchQuery
                                ? 'No encontramos chats con ese nombre.'
                                : 'Tus conversaciones activas aparecerán aquí.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredChats.map(chat => (
                            <button
                                key={chat.id}
                                onClick={() => handleChatClick(chat.id)}
                                className="w-full px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                            >
                                <div className="flex gap-3">
                                    {/* Avatar */}
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold text-lg">
                                        {getOtherParticipantName(chat).charAt(0).toUpperCase()}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="font-semibold text-gray-800 truncate">
                                                {getOtherParticipantName(chat)}
                                            </h4>
                                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                                {chat.lastMessage.timestamp && formatTimestamp(chat.lastMessage.timestamp)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-gray-600 truncate pr-2">
                                                {chat.lastMessage.text || 'Sin mensajes'}
                                            </p>
                                            {getUnreadBadge(chat)}
                                        </div>

                                        {chat.metadata.orderNumber && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                Pedido #{chat.metadata.orderNumber.slice(0, 8)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatList;
