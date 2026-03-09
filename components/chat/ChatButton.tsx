import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { MessageSquare, X, Sparkles } from 'lucide-react';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { AIChat } from './AIChat';

export const ChatButton: React.FC = () => {
    const { unreadCount, currentChat, closeChat } = useChat();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'messages' | 'assistant'>('messages');

    const path = location.pathname;
    const hiddenOnPaths = [
        '/app/cart',
        '/app/checkout',
        '/app/orders',
        '/app/profile',
        '/app/impact',
        '/app/favorites',
    ];
    const shouldHide =
        hiddenOnPaths.includes(path) ||
        path.startsWith('/app/venue/') ||
        path.startsWith('/app/product/');

    if (shouldHide) return null;

    const toggleChat = () => {
        setIsOpen(prev => {
            if (prev) {
                // Al cerrar el panel también cerramos el chat activo
                closeChat();
                setActiveTab('messages');
            }
            return !prev;
        });
    };

    const handleTabClick = (tab: 'messages' | 'assistant') => {
        setActiveTab(tab);
        if (tab !== 'messages') closeChat();
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={toggleChat}
                className="fixed bottom-safe right-4 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-40"
            >
                {isOpen ? (
                    <X size={24} />
                ) : (
                    <div className="relative">
                        <MessageSquare size={24} />
                        {unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            </div>
                        )}
                    </div>
                )}
            </button>

            {/* Chat Modal */}
            {isOpen && (
                <div className="fixed left-4 right-4 sm:left-auto sm:right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] w-auto sm:w-96 max-w-[420px] h-[70vh] sm:h-[600px] bg-white rounded-xl shadow-2xl z-40 overflow-hidden flex flex-col">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => handleTabClick('messages')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all ${activeTab === 'messages'
                                    ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <MessageSquare size={18} />
                            <span>Mensajes</span>
                            {unreadCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => handleTabClick('assistant')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all ${activeTab === 'assistant'
                                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <Sparkles size={18} />
                            <span>Asistente IA</span>
                        </button>
                    </div>

                    {/* Content: usa currentChat del contexto para decidir qué mostrar */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'messages' ? (
                            currentChat ? (
                                <ChatWindow />
                            ) : (
                                <ChatList />
                            )
                        ) : (
                            <AIChat />
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatButton;
