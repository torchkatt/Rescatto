import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useNotifications } from './NotificationContext';
import {
    Chat,
    Message,
    ChatType,
    MessageType,
    UserRole,
} from '../types';
import {
    getOrCreateChat,
    sendMessage as sendMessageService,
    sendSystemMessage as sendSystemMessageService,
    markMessagesAsRead,
    getUserChats,
    getChatMessages,
    subscribeToChatMessages,
    subscribeToUserChats,
    getUnreadCount,
    getChatById,
} from '../services/chatService';
import { logger } from '../utils/logger';

interface ChatContextType {
    // State
    chats: Chat[];
    currentChat: Chat | null;
    messages: Message[];
    unreadCount: number;
    loading: boolean;
    sending: boolean;

    // Actions
    openChat: (chatId: string) => Promise<void>;
    closeChat: () => void;
    sendMessage: (text: string, type?: MessageType, extraData?: { imageUrl?: string; location?: { lat: number; lng: number } }) => Promise<void>;
    sendSystemMessage: (chatId: string, text: string) => Promise<void>;
    createChat: (
        otherUserId: string,
        otherUserName: string,
        otherUserRole: UserRole,
        chatType: ChatType,
        orderId?: string
    ) => Promise<Chat>;
    markAsRead: (chatId: string) => Promise<void>;
    refreshChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

interface ChatProviderProps {
    children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const { error: showError } = useToast();
    const {
        sendNotification,
        notifications,
        markAsRead: markNotificationAsRead,
        activeLink,
        setActiveLink,
        playMessageSound
    } = useNotifications();

    const [chats, setChats] = useState<Chat[]>([]);
    const [currentChat, setCurrentChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    // Subscribe to user's chats
    useEffect(() => {
        if (!user?.id) {
            setChats([]);
            setUnreadCount(0);
            return;
        }

        const unsubscribe = subscribeToUserChats(user.id, (updatedChats) => {
            setChats(updatedChats);
            setUnreadCount(getUnreadCount(updatedChats, user.id));
        });

        return () => unsubscribe();
    }, [user?.id]);

    // 1. Manage Active Link and Message Subscription (Stable)
    useEffect(() => {
        if (!currentChat?.id) {
            setMessages([]);
            setActiveLink(null);
            return;
        }

        const link = `/chat?id=${currentChat.id}`;
        setActiveLink(link);

        // Subscribe to messages
        const lastMessageIdRef = { current: '' };

        const unsubscribe = subscribeToChatMessages(currentChat.id, (updatedMessages) => {
            if (updatedMessages.length > 0) {
                const lastMsg = updatedMessages[updatedMessages.length - 1];

                // Play sound logic
                if (lastMessageIdRef.current && lastMessageIdRef.current !== lastMsg.id) {
                    if (lastMsg.senderId !== user?.id) {
                        playMessageSound();
                    }
                }
                lastMessageIdRef.current = lastMsg.id;
            }
            setMessages(updatedMessages);
        });

        return () => {
            setActiveLink(null);
            unsubscribe();
        };
    }, [currentChat?.id, setActiveLink, user?.id, playMessageSound]);


    // 2. Handle Notifications Cleaning (Reactive)
    useEffect(() => {
        if (!currentChat?.id) return;

        const link = `/chat?id=${currentChat.id}`;

        // Find notifications for THIS chat that are unread
        const chatNotifications = notifications.filter(n =>
            n.link === link && !n.read
        );

        if (chatNotifications.length === 0) return;

        // Mark them as read
        const markRead = async () => {
            try {
                // Use Promise.all to mark all found
                await Promise.all(chatNotifications.map(n => markNotificationAsRead(n.id)));
            } catch (e) {
                logger.warn('Error clearing chat notifications:', e);
            }
        };

        markRead();
    }, [currentChat?.id, notifications, markNotificationAsRead, activeLink]);

    const openChat = async (chatId: string) => {
        if (!user?.id) return;

        setLoading(true);
        try {
            const chat = await getChatById(chatId);
            if (!chat) {
                showError('Chat no encontrado');
                return;
            }

            setCurrentChat(chat);

            // Intentar marcar mensajes como leídos (Silenciosamente para no bloquear la UI)
            try {
                await markMessagesAsRead(chatId, user.id);
            } catch (readError: any) {
                logger.warn('No se pudieron marcar los mensajes como leídos (posible falta de índice):', readError);
            }

            // Intentar marcar notificaciones como leídas (Silenciosamente)
            try {
                const chatNotifications = notifications.filter(n =>
                    n.link === `/chat?id=${chatId}` && !n.read
                );

                for (const notif of chatNotifications) {
                    await markNotificationAsRead(notif.id);
                }
            } catch (notifError) {
                logger.warn('Error al limpiar notificaciones del chat:', notifError);
            }
        } catch (error: any) {
            logger.error('Error opening chat:', error);

            // Check if it's a Firebase index error
            if (error?.message?.includes('index') || error?.message?.includes('query requires')) {
                showError('⚠️ Faltan índices de Firebase. Revisa la consola para crear los índices necesarios.');
            } else {
                showError('Error al abrir el chat');
            }
        } finally {
            setLoading(false);
        }
    };

    const closeChat = () => {
        setCurrentChat(null);
        setMessages([]);
    };

    const sendMessage = async (
        text: string,
        type: MessageType = 'text',
        extraData?: { imageUrl?: string; location?: { lat: number; lng: number } }
    ) => {
        if (!user || !currentChat || (!text.trim() && type === 'text')) return;

        setSending(true);
        try {
            await sendMessageService(
                currentChat.id,
                user.id,
                user.fullName,
                user.role,
                text.trim(),
                type,
                extraData
            );

            // Enviar notificación al otro participante
            const otherUserId = currentChat.participants.find(id => id !== user.id);
            if (otherUserId) {
                // Determinar el título basado en el tipo de chat o el nombre del remitente
                const title = `Mensaje de ${user.fullName}`;
                const notificationText = type === 'location' ? '📍 Ha compartido su ubicación' :
                    text.trim().length > 50 ? text.trim().substring(0, 47) + '...' : text.trim();

                await sendNotification(
                    otherUserId,
                    title,
                    notificationText,
                    'info',
                    `/chat?id=${currentChat.id}`
                );
            }
        } catch (error) {
            logger.error('Error sending message:', error);
            throw error; // Permitir que el llamador (ChatWindow) muestre el toast y no limpie el input
        } finally {
            setSending(false);
        }
    };

    const sendSystemMessage = async (chatId: string, text: string) => {
        try {
            await sendSystemMessageService(chatId, text);
        } catch (error) {
            logger.error('Error sending system message:', error);
        }
    };

    const createChat = async (
        otherUserId: string,
        otherUserName: string,
        otherUserRole: UserRole,
        chatType: ChatType,
        orderId?: string
    ): Promise<Chat> => {
        if (!user) throw new Error('User not authenticated');

        setLoading(true);
        try {
            const chat = await getOrCreateChat(
                user.id,
                user.fullName,
                user.role,
                otherUserId,
                otherUserName,
                otherUserRole,
                chatType,
                orderId
            );

            // Note: We don't refresh chats here to avoid index errors
            // The chat list will refresh naturally when the user navigates to chats

            return chat;
        } catch (error) {
            logger.error('Error creating chat:', error);
            showError('Error al crear el chat');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (chatId: string) => {
        if (!user?.id) return;

        try {
            await markMessagesAsRead(chatId, user.id);
        } catch (error) {
            logger.error('Error marking as read:', error);
        }
    };

    const refreshChats = async () => {
        if (!user?.id) return;

        try {
            const updatedChats = await getUserChats(user.id);
            setChats(updatedChats);
            setUnreadCount(getUnreadCount(updatedChats, user.id));
        } catch (error) {
            logger.error('Error refreshing chats:', error);
        }
    };

    const value: ChatContextType = {
        chats,
        currentChat,
        messages,
        unreadCount,
        loading,
        sending,
        openChat,
        closeChat,
        sendMessage,
        sendSystemMessage,
        createChat,
        markAsRead,
        refreshChats,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
