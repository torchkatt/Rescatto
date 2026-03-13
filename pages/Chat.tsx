import React from 'react';
import { ChatList } from '../components/chat/ChatList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { MessageSquare } from 'lucide-react';
import Layout from '../components/Layout';
import { useChat } from '../context/ChatContext';

export const ChatPage: React.FC = () => {
    const { currentChat } = useChat();

    return (
        <Layout>
            <div className="h-[calc(100vh-theme(spacing.20))] md:h-[calc(100vh-theme(spacing.16))] flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                {/* Lista de Chats - Barra Lateral Izquierda */}
                <div className={`${currentChat ? 'hidden md:block' : 'block'} w-full md:w-96 border-r border-gray-100 bg-white`}>
                    <ChatList />
                </div>

                {/* Ventana de Chat - Área Principal */}
                <div className={`${currentChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-gray-50/50`}>
                    <ChatWindow 
                        onBack={() => useChat().closeChat()} 
                        showBackButton={true}
                    />
                </div>
            </div>
        </Layout>
    );
};

export default ChatPage;
