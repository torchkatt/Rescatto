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
    
    // Draggable state
    const [position, setPosition] = useState({ x: 0, y: 0 }); // Offset from bottom-right
    const [isDragging, setIsDragging] = useState(false);
    const dragStarted = React.useRef(false);
    const startPos = React.useRef({ x: 0, y: 0 });

    const shouldHide = false; // Always show as per user request

    if (shouldHide) return null;

    const toggleChat = (e: React.MouseEvent | React.TouchEvent) => {
        // Prevent click if we were dragging
        if (dragStarted.current) {
            dragStarted.current = false;
            return;
        }

        const nextOpen = !isOpen;
        if (!nextOpen) {
            closeChat();
            setActiveTab('messages');
        }
        
        setIsOpen(nextOpen);
    };

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        startPos.current = { x: clientX - position.x, y: clientY - position.y };
        setIsDragging(true);
        dragStarted.current = false;
    };

    const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        const newX = clientX - startPos.current.x;
        const newY = clientY - startPos.current.y;
        
        // Basic threshold to consider it a drag vs a click
        if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
            dragStarted.current = true;
        }
        
        setPosition({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        // We keep dragStarted.current as true for a moment to prevent toggleChat from firing
        setTimeout(() => {
            if (!isDragging) dragStarted.current = false;
        }, 50);
    };

    const handleTabClick = (tab: 'messages' | 'assistant') => {
        setActiveTab(tab);
        if (tab !== 'messages') closeChat();
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchMove={handleDragMove}
                onTouchEnd={handleDragEnd}
                onClick={toggleChat}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
                className={`fixed bottom-24 lg:bottom-40 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center justify-center z-50 select-none touch-none ${isDragging ? 'scale-110 shadow-emerald-500/50 opacity-90' : 'hover:scale-105 active:scale-95'}`}
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

            {/* Chat Overlay for Protagonism */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-all animate-in fade-in duration-500"
                    onClick={toggleChat}
                />
            )}

            {/* Chat Modal */}
            {isOpen && (
                <div className="fixed left-4 right-4 sm:left-auto sm:right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] w-auto sm:w-96 max-w-[420px] h-[70vh] sm:h-[600px] bg-white/90 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 origin-bottom-right">
                    {/* Header with Pill Tabs */}
                    <div className="p-4 border-b border-gray-100 bg-white/50">
                        <div className="bg-gray-100/80 p-1 rounded-2xl flex relative">
                            {/* Animated Background Indicator */}
                            <div 
                                className={`absolute inset-y-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ${
                                    activeTab === 'messages' ? 'translate-x-0' : 'translate-x-full'
                                }`}
                            />
                            
                            <button
                                onClick={() => handleTabClick('messages')}
                                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 z-10 ${
                                    activeTab === 'messages' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <MessageSquare size={14} className={activeTab === 'messages' ? 'fill-emerald-600/10' : ''} />
                                <span>Mensajes</span>
                                {unreadCount > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-emerald-600 text-white rounded-full shadow-sm">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                            
                            <button
                                onClick={() => handleTabClick('assistant')}
                                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 z-10 ${
                                    activeTab === 'assistant' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <Sparkles size={14} className={activeTab === 'assistant' ? 'fill-purple-600/10' : ''} />
                                <span>Asistente IA</span>
                            </button>
                        </div>
                    </div>

                    {/* Content: usa currentChat del contexto para decidir qué mostrar */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'messages' ? (
                            currentChat ? (
                                <ChatWindow 
                                    onBack={() => closeChat()} 
                                    showBackButton={true}
                                />
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
