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

// ─── Grouped state types ───────────────────────────────────────────────────────

interface ChatListState {
    base: Chat[];
    extra: Chat[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    loadingMore: boolean;
    hasMore: boolean;
}

interface MessageListState {
    latest: Message[];
    older: Message[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    loadingMore: boolean;
    hasMore: boolean;
}

interface UiState {
    loading: boolean;
    sending: boolean;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultChatList: ChatListState = {
    base: [], extra: [], lastDoc: null, loadingMore: false, hasMore: true,
};

const defaultMessageList: MessageListState = {
    latest: [], older: [], lastDoc: null, loadingMore: false, hasMore: true,
};

const defaultUi: UiState = { loading: false, sending: false };

// ─── Provider ─────────────────────────────────────────────────────────────────

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

    // Grouped state — replaces 13 individual useState calls
    const [chatList, setChatList] = useState<ChatListState>(defaultChatList);
    const [messageList, setMessageList] = useState<MessageListState>(defaultMessageList);
    const [ui, setUi] = useState<UiState>(defaultUi);

    // Derived / individual state
    const [chats, setChats] = useState<Chat[]>([]);
    const [currentChat, setCurrentChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Fetch user's chats (paginated)
    useEffect(() => {
        if (!user?.id) {
            setChatList(defaultChatList);
            setChats([]);
            setUnreadCount(0);
            return;
        }
        const chatsRef = collection(db, 'chats');
        const q = query(
            chatsRef,
            where('participants', 'array-contains', user.id),
            orderBy('updatedAt', 'desc'),
            limit(CHAT_PAGE_SIZE)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Chat[];
            setChatList(prev => ({
                ...prev,
                base: data,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === CHAT_PAGE_SIZE,
            }));
        });

        return () => unsub();
    }, [user?.id]);

    // Merge base + extra chats into the public `chats` array
    useEffect(() => {
        const merged = [...chatList.base, ...chatList.extra];
        const unique = Array.from(new Map(merged.map(c => [c.id, c])).values());
        setChats(unique);
        if (user?.id) setUnreadCount(getUnreadCount(unique, user.id));
    }, [chatList.base, chatList.extra, user?.id]);

    // Subscribe to messages for the current chat
    useEffect(() => {
        if (!currentChat?.id) {
            setMessageList(defaultMessageList);
            setMessages([]);
            setActiveLink(null);
            return;
        }

        const link = `/chat?id=${currentChat.id}`;
        setActiveLink(link);
        const messagesRef = collection(db, `chats/${currentChat.id}/messages`);
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(MESSAGE_PAGE_SIZE));

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
            const ordered = [...data].reverse();
            setMessageList(prev => ({
                ...prev,
                latest: ordered,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === MESSAGE_PAGE_SIZE,
            }));
        });

        return () => {
            setActiveLink(null);
            unsub();
        };
    }, [currentChat?.id, setActiveLink]);

    // Merge older + latest messages into the public `messages` array
    useEffect(() => {
        setMessages([...messageList.older, ...messageList.latest]);
    }, [messageList.older, messageList.latest]);

    // Mark notifications as read when current chat changes
    useEffect(() => {
        if (!currentChat?.id) return;

        const link = `/chat?id=${currentChat.id}`;
        const chatNotifications = notifications.filter(n => n.link === link && !n.read);
        if (chatNotifications.length === 0) return;

        const markRead = async () => {
            try {
                await Promise.all(chatNotifications.map(n => markNotificationAsRead(n.id)));
            } catch (e) {
                logger.warn('Error clearing chat notifications:', e);
            }
        };

        markRead();
    }, [currentChat?.id, notifications, markNotificationAsRead, activeLink]);

    const openChat = async (chatId: string) => {
        if (!user?.id) return;

        setUi(prev => ({ ...prev, loading: true }));
        try {
            const chat = await getChatById(chatId);
            if (!chat) {
                showError(t('chat_not_found'));
                return;
            }

            setCurrentChat(chat);

            try {
                await markMessagesAsRead(chatId, user.id);
            } catch (readError: unknown) {
                logger.warn('No se pudieron marcar los mensajes como leídos:', readError);
            }

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
        } catch (error: unknown) {
            logger.error('Error opening chat:', error);
            const msg = error instanceof Error ? error.message : '';
            if (msg.includes('index') || msg.includes('query requires')) {
                showError('⚠️ Faltan índices de Firebase. Revisa la consola para crear los índices necesarios.');
            } else {
                showError(t('chat_error_open'));
            }
        } finally {
            setUi(prev => ({ ...prev, loading: false }));
        }
    };

    const closeChat = () => {
        setCurrentChat(null);
        setMessageList(defaultMessageList);
        setMessages([]);
    };

    const sendMessage = async (
        text: string,
        type: MessageType = 'text',
        extraData?: { imageUrl?: string; location?: { lat: number; lng: number } }
    ) => {
        if (!user || !currentChat || (!text.trim() && type === 'text')) return;

        setUi(prev => ({ ...prev, sending: true }));
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

            const otherUserId = currentChat.participants.find(id => id !== user.id);
            if (otherUserId) {
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
            throw error;
        } finally {
            setUi(prev => ({ ...prev, sending: false }));
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
            setChatList(defaultChatList);
        }
        try {
            const constraints: Parameters<typeof query>[1][] = [
                where('participants', 'array-contains', user.id),
                orderBy('updatedAt', 'desc'),
            ];
            if (!initial && chatList.lastDoc) constraints.push(startAfter(chatList.lastDoc));
            constraints.push(limit(CHAT_PAGE_SIZE));
            const q = query(collection(db, 'chats'), ...constraints);
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Chat[];
            const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            const hasMore = snapshot.docs.length === CHAT_PAGE_SIZE;
            if (initial) {
                setChatList(prev => ({ ...prev, extra: [], lastDoc: newLastDoc, hasMore }));
            } else {
                setChatList(prev => ({
                    ...prev,
                    extra: [...prev.extra, ...data],
                    lastDoc: newLastDoc,
                    hasMore,
                }));
            }
        } catch (error) {
            logger.error('Error fetching chats:', error);
        }
    };

    const fetchOlderMessages = async () => {
        if (!currentChat?.id) return;
        try {
            const constraints: Parameters<typeof query>[1][] = [orderBy('timestamp', 'desc')];
            if (messageList.lastDoc) constraints.push(startAfter(messageList.lastDoc));
            constraints.push(limit(MESSAGE_PAGE_SIZE));
            const q = query(collection(db, `chats/${currentChat.id}/messages`), ...constraints);
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
            const ordered = [...data].reverse();
            setMessageList(prev => ({
                ...prev,
                older: [...ordered, ...prev.older],
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === MESSAGE_PAGE_SIZE,
            }));
        } catch (error) {
            logger.error('Error fetching messages:', error);
        }
    };

    const loadMoreChats = async () => {
        if (!user?.id || !chatList.hasMore || chatList.loadingMore) return;
        setChatList(prev => ({ ...prev, loadingMore: true }));
        await fetchChats(false);
        setChatList(prev => ({ ...prev, loadingMore: false }));
    };

    const loadMoreMessages = async () => {
        if (!currentChat?.id || !messageList.hasMore || messageList.loadingMore) return;
        setMessageList(prev => ({ ...prev, loadingMore: true }));
        await fetchOlderMessages();
        setMessageList(prev => ({ ...prev, loadingMore: false }));
    };

    const createChat = async (
        otherUserId: string | string[],
        otherUserName: string,
        otherUserRole: UserRole,
        chatType: ChatType,
        orderId?: string
    ): Promise<Chat> => {
        if (!user) throw new Error('User not authenticated');

        setUi(prev => ({ ...prev, loading: true }));
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
            return chat;
        } catch (error) {
            logger.error('Error creating chat:', error);
            showError(t('chat_error_create'));
            throw error;
        } finally {
            setUi(prev => ({ ...prev, loading: false }));
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
        loading: ui.loading,
        sending: ui.sending,
        loadingMoreChats: chatList.loadingMore,
        hasMoreChats: chatList.hasMore,
        loadingMoreMessages: messageList.loadingMore,
        hasMoreMessages: messageList.hasMore,
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
