import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useNotifications } from './NotificationContext';
import { useTranslation } from 'react-i18next';
import { collection, query, where, orderBy, limit, startAfter, getDocs, onSnapshot, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../services/firebase';
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
    getUnreadCount,
    getChatById,
} from '../services/chatService';
import { logger } from '../utils/logger';

const CHAT_PAGE_SIZE = 20;
const MESSAGE_PAGE_SIZE = 20;

interface ChatContextType {
    // State
    chats: Chat[];
    currentChat: Chat | null;
    messages: Message[];
    unreadCount: number;
    loading: boolean;
    sending: boolean;
    loadingMoreChats: boolean;
    hasMoreChats: boolean;
    loadingMoreMessages: boolean;
    hasMoreMessages: boolean;

    // Actions
    openChat: (chatId: string) => Promise<void>;
    closeChat: () => void;
    sendMessage: (text: string, type?: MessageType, extraData?: { imageUrl?: string; location?: { lat: number; lng: number } }) => Promise<void>;
    sendSystemMessage: (chatId: string, text: string) => Promise<void>;
    createChat: (
        otherUserId: string | string[],
        otherUserName: string,
        otherUserRole: UserRole,
        chatType: ChatType,
        orderId?: string
    ) => Promise<Chat>;
    markAsRead: (chatId: string) => Promise<void>;
    refreshChats: () => Promise<void>;
    loadMoreChats: () => Promise<void>;
    loadMoreMessages: () => Promise<void>;
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
    const { t } = useTranslation();
    const {
        sendNotification,
        notifications,
        markAsRead: markNotificationAsRead,
        activeLink,
        setActiveLink
    } = useNotifications();

    const [chats, setChats] = useState<Chat[]>([]);
    const [baseChats, setBaseChats] = useState<Chat[]>([]);
    const [extraChats, setExtraChats] = useState<Chat[]>([]);
    const [currentChat, setCurrentChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [latestMessages, setLatestMessages] = useState<Message[]>([]);
    const [olderMessages, setOlderMessages] = useState<Message[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [loadingMoreChats, setLoadingMoreChats] = useState(false);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [chatsLastDoc, setChatsLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [messagesLastDoc, setMessagesLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

    // Fetch user's chats (paginated)
    useEffect(() => {
        if (!user?.id) {
            setChats([]);
            setUnreadCount(0);
            setBaseChats([]);
            setExtraChats([]);
            setChatsLastDoc(null);
            setHasMoreChats(true);
            return;
        }
        // Hybrid: realtime for latest chats only
        const chatsRef = collection(db, 'chats');
        const q = query(
            chatsRef,
            where('participants', 'array-contains', user.id),
            orderBy('updatedAt', 'desc'),
            limit(CHAT_PAGE_SIZE)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Chat[];
            setBaseChats(data);
            setChatsLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMoreChats(snapshot.docs.length === CHAT_PAGE_SIZE);
            setUnreadCount(getUnreadCount(data, user.id));
        });

        return () => unsub();
    }, [user?.id]);

    useEffect(() => {
        const merged = [...baseChats, ...extraChats];
        const unique = Array.from(new Map(merged.map(c => [c.id, c])).values());
        setChats(unique);
        if (user?.id) setUnreadCount(getUnreadCount(unique, user.id));
    }, [baseChats, extraChats, user?.id]);

    // 1. Manage Active Link and Message Fetch
    useEffect(() => {
        if (!currentChat?.id) {
            setMessages([]);
            setLatestMessages([]);
            setOlderMessages([]);
            setMessagesLastDoc(null);
            setHasMoreMessages(true);
            setActiveLink(null);
            return;
        }

        const link = `/chat?id=${currentChat.id}`;
        setActiveLink(link);
        // Hybrid: realtime for latest messages in current chat
        const messagesRef = collection(db, `chats/${currentChat.id}/messages`);
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(MESSAGE_PAGE_SIZE));

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
            const ordered = [...data].reverse();
            setLatestMessages(ordered);
            setMessagesLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMoreMessages(snapshot.docs.length === MESSAGE_PAGE_SIZE);
        });

        return () => {
            setActiveLink(null);
            unsub();
        };
    }, [currentChat?.id, setActiveLink]);

    useEffect(() => {
        setMessages([...olderMessages, ...latestMessages]);
    }, [olderMessages, latestMessages]);


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
                showError(t('chat_not_found'));
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
                showError(t('chat_error_open'));
            }
        } finally {
            setLoading(false);
        }
    };

    const closeChat = () => {
        setCurrentChat(null);
        setMessages([]);
        setLatestMessages([]);
        setOlderMessages([]);
        setMessagesLastDoc(null);
        setHasMoreMessages(true);
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
            // Refresh recent messages after send (keeps UI in sync if snapshot lag)
            await fetchMessages();

            // Enviar notificación al otro participante
            const otherUserId = currentChat.participants.find(id => id !== user.id);
            if (otherUserId) {
                // Determinar el título basado en el tipo de chat o el nombre del remitente
                const title = t('chat_notif_title', { name: user.fullName });
                const notificationText = type === 'location' ? t('chat_notif_location') :
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

    const fetchChats = async (initial = false) => {
        if (!user?.id) return;
        if (initial) {
            setLoading(true);
            setChatsLastDoc(null);
            setHasMoreChats(true);
        }
        try {
            const constraints: any[] = [
                where('participants', 'array-contains', user.id),
                orderBy('updatedAt', 'desc'),
            ];
            if (!initial && chatsLastDoc) constraints.push(startAfter(chatsLastDoc));
            constraints.push(limit(CHAT_PAGE_SIZE));
            const q = query(collection(db, 'chats'), ...constraints);
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Chat[];
            if (initial) {
                setExtraChats([]);
            } else {
                setExtraChats(prev => [...prev, ...data]);
            }
            setChatsLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMoreChats(snapshot.docs.length === CHAT_PAGE_SIZE);
        } catch (error) {
            logger.error('Error fetching chats:', error);
        } finally {
            if (initial) setLoading(false);
        }
    };

    const fetchMessages = async () => {
        if (!currentChat?.id) return;
        try {
            const constraints: any[] = [orderBy('timestamp', 'desc')];
            if (messagesLastDoc) constraints.push(startAfter(messagesLastDoc));
            constraints.push(limit(MESSAGE_PAGE_SIZE));
            const q = query(collection(db, `chats/${currentChat.id}/messages`), ...constraints);
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
            const ordered = [...data].reverse();
            setOlderMessages(prev => [...ordered, ...prev]);
            setMessagesLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMoreMessages(snapshot.docs.length === MESSAGE_PAGE_SIZE);
        } catch (error) {
            logger.error('Error fetching messages:', error);
        }
    };

    const loadMoreChats = async () => {
        if (!user?.id || !hasMoreChats || loadingMoreChats) return;
        setLoadingMoreChats(true);
        await fetchChats(false);
        setLoadingMoreChats(false);
    };

    const loadMoreMessages = async () => {
        if (!currentChat?.id || !hasMoreMessages || loadingMoreMessages) return;
        setLoadingMoreMessages(true);
        await fetchMessages();
        setLoadingMoreMessages(false);
    };

    const createChat = async (
        otherUserId: string | string[],
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
            showError(t('chat_error_create'));
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
            await fetchChats(true);
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
        loadingMoreChats,
        hasMoreChats,
        loadingMoreMessages,
        hasMoreMessages,
        openChat,
        closeChat,
        sendMessage,
        sendSystemMessage,
        createChat,
        markAsRead,
        refreshChats,
        loadMoreChats,
        loadMoreMessages,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
