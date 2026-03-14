import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useTranslation } from 'react-i18next';
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
    const { chats, openChat, loadMoreChats, hasMoreChats, loadingMoreChats } = useChat();
    const { t } = useTranslation();
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
        return otherUserId ? chat.participantNames[otherUserId] : t('chat_user');
    };

    const getUnreadBadge = (chat: Chat) => {
        if (!user?.id) return null;
        // Logic: if last message is not from me AND it's not read
        const isFromMe = chat.lastMessage.senderId === user.id;
        const isUnread = !chat.lastMessage.read;
        
        if (isFromMe || !isUnread || !chat.lastMessage.text) {
            return null;
        }
        
        return (
            <div className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-emerald-600 text-white rounded-full text-[10px] font-black shadow-sm shadow-emerald-100 animate-pulse">
                {t('chat_new')}
            </div>
        );
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return format(date, 'HH:mm', { locale: es });
        } else if (diffInHours < 48) {
            return t('chat_yesterday');
        } else {
            return format(date, 'dd/MM', { locale: es });
        }
    };

    return (
        <div className={`flex flex-col h-full bg-white/50 ${className}`}>
            {/* Search Container */}
            <div className="px-5 py-4">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <Search size={18} className="text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('chat_search_ph')}
                        className="w-full pl-11 pr-4 py-3 bg-gray-100/80 border-2 border-gray-200/50 focus:border-emerald-500/30 focus:bg-white focus:shadow-xl focus:shadow-emerald-500/10 rounded-2xl outline-none transition-all font-bold placeholder:font-bold placeholder:text-gray-400 text-sm"
                    />
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
                {filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                            <MessageCircle size={32} className="text-emerald-600/30" />
                        </div>
                        <h3 className="text-gray-900 font-black text-sm mb-1">
                            {searchQuery ? t('chat_no_results') : t('chat_empty_tray')}
                        </h3>
                        <p className="text-gray-400 text-xs font-bold leading-relaxed px-4">
                            {searchQuery
                                ? t('chat_no_results_desc')
                                : t('chat_empty_desc')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredChats.map(chat => {
                            const unread = !chat.lastMessage.read && chat.lastMessage.senderId !== user?.id;
                            return (
                                <button
                                    key={chat.id}
                                    onClick={() => handleChatClick(chat.id)}
                                    className="w-full group p-3 rounded-2xl hover:bg-emerald-50 transition-all active:scale-[0.98] text-left relative overflow-hidden"
                                >
                                    <div className="flex gap-4 relative z-10">
                                        {/* Avatar with status ring */}
                                        <div className="relative">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg transition-transform group-hover:scale-105 ${
                                                unread ? 'bg-emerald-600 shadow-emerald-200' : 'bg-gray-200 text-gray-400 shadow-transparent'
                                            }`}>
                                                {getOtherParticipantName(chat).charAt(0).toUpperCase()}
                                            </div>
                                            {unread && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full animate-bounce" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 py-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-black text-gray-900 truncate">
                                                    {getOtherParticipantName(chat)}
                                                </h4>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                                    {chat.lastMessage.timestamp && formatTimestamp(chat.lastMessage.timestamp)}
                                                </span>
                                            </div>

                                            <p className={`text-xs truncate pr-4 ${unread ? 'text-gray-900 font-black' : 'text-gray-500 font-bold'}`}>
                                                {chat.lastMessage.senderId === user?.id ? (
                                                    <span className="text-emerald-600/60 mr-1">{t('chat_you')}</span>
                                                ) : ''}
                                                {chat.lastMessage.text || t('chat_no_messages_short')}
                                            </p>

                                            {chat.metadata.orderNumber && (
                                                <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-gray-100 rounded-full group-hover:bg-white transition-colors">
                                                    <div className="w-1 h-1 bg-gray-400 rounded-full" />
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                        Pedido #{chat.metadata.orderNumber.slice(0, 8)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Hover background effect */}
                                    <div className="absolute inset-0 bg-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            );
                        })}
                        {hasMoreChats && searchQuery.length === 0 && (
                            <div className="pt-3 flex justify-center">
                                <button
                                    onClick={loadMoreChats}
                                    disabled={loadingMoreChats}
                                    className="px-3 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-60"
                                >
                                    {loadingMoreChats ? t('loading') : t('chat_load_more_chats')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatList;
