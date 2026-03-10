import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Unsubscribe,
    writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Chat, Message, ChatType, MessageType, UserRole } from '../types';
import { logger } from '../utils/logger';

/**
 * Get or create a chat between participants
 */
export const getOrCreateChat = async (
    currentUserId: string,
    currentUserName: string,
    currentUserRole: UserRole,
    otherUserId: string,
    otherUserName: string,
    otherUserRole: UserRole,
    chatType: ChatType,
    orderId?: string
): Promise<Chat> => {
    try {
        // Check if chat already exists
        const chatsRef = collection(db, 'chats');
        const q = query(
            chatsRef,
            where('participants', 'array-contains', currentUserId)
        );

        const snapshot = await getDocs(q);
        const existingChat = snapshot.docs.find(doc => {
            const data = doc.data();
            return (
                data.participants.includes(otherUserId) &&
                data.type === chatType &&
                (!orderId || data.orderId === orderId)
            );
        });

        if (existingChat) {
            return { id: existingChat.id, ...existingChat.data() } as Chat;
        }

        // Create new chat
        const participantNames: Record<string, string> = {
            [currentUserId]: currentUserName,
            [otherUserId]: otherUserName,
        };

        const participantRoles: Record<string, UserRole> = {
            [currentUserId]: currentUserRole,
            [otherUserId]: otherUserRole,
        };

        // Build metadata dynamically to avoid undefined values (Firebase doesn't allow undefined)
        const metadata: any = {};

        if (chatType.includes('customer')) {
            metadata.customerName = currentUserRole === 'CUSTOMER' ? currentUserName : otherUserName;
        }

        if (chatType.includes('venue')) {
            metadata.venueName = currentUserRole === 'VENUE_OWNER' ? currentUserName : otherUserName;
        }

        if (chatType.includes('driver')) {
            metadata.driverName = currentUserRole === 'DRIVER' ? currentUserName : otherUserName;
        }

        if (orderId) {
            metadata.orderNumber = orderId;
        }

        const newChat: Omit<Chat, 'id'> = {
            participants: [currentUserId, otherUserId],
            participantNames,
            participantRoles,
            orderId,
            lastMessage: {
                text: '',
                senderId: '',
                timestamp: new Date().toISOString(),
                read: false,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            type: chatType,
            metadata,
        };

        const docRef = await addDoc(chatsRef, newChat);
        return { id: docRef.id, ...newChat } as Chat;
    } catch (error) {
        logger.error('Error getting or creating chat:', error);
        throw error;
    }
};

/**
 * Send a message in a chat
 */
export const sendMessage = async (
    chatId: string,
    senderId: string,
    senderName: string,
    senderRole: UserRole,
    text: string,
    type: MessageType = 'text',
    extraData?: { imageUrl?: string; location?: { lat: number; lng: number } }
): Promise<void> => {
    try {
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const timestamp = new Date().toISOString();

        const newMessage: Omit<Message, 'id'> = {
            chatId,
            senderId,
            senderName,
            senderRole,
            text,
            timestamp,
            read: false,
            type,
            ...(extraData || {})
        };

        await addDoc(messagesRef, newMessage);

        // Update chat's last message
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
            lastMessage: {
                text,
                senderId,
                timestamp,
                read: false,
            },
            updatedAt: timestamp,
        });
    } catch (error) {
        logger.error('Error sending message:', error);
        throw error;
    }
};

/**
 * Send a system message
 */
export const sendSystemMessage = async (
    chatId: string,
    text: string
): Promise<void> => {
    try {
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const timestamp = new Date().toISOString();

        const systemMessage: Omit<Message, 'id'> = {
            chatId,
            senderId: 'system',
            senderName: 'Sistema',
            senderRole: 'SUPER_ADMIN' as UserRole,
            text,
            timestamp,
            read: false,
            type: 'system',
        };

        await addDoc(messagesRef, systemMessage);

        // Update chat's last message
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
            lastMessage: {
                text,
                senderId: 'system',
                timestamp,
                read: false,
            },
            updatedAt: timestamp,
        });
    } catch (error) {
        logger.error('Error sending system message:', error);
        throw error;
    }
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (
    chatId: string,
    userId: string
): Promise<void> => {
    try {
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        // Solo consultamos por read==false — Firestore auto-indexa campos simples.
        // Filtramos client-side por senderId para no marcar los propios mensajes,
        // evitando así la necesidad de un índice compuesto (senderId != + read ==).
        const q = query(messagesRef, where('read', '==', false));

        const snapshot = await getDocs(q);
        const batch = writeBatch(db);

        snapshot.docs.forEach(docSnapshot => {
            // Solo marcar mensajes enviados por OTROS (no los propios)
            if (docSnapshot.data().senderId !== userId) {
                batch.update(docSnapshot.ref, { read: true });
            }
        });

        await batch.commit();

        // Update chat's last message read status if it's not from current user
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);
        const chatData = chatDoc.data();

        if (chatData && chatData.lastMessage.senderId !== userId) {
            await updateDoc(chatRef, {
                'lastMessage.read': true,
            });
        }
    } catch (error) {
        logger.error('Error marking messages as read:', error);
        throw error;
    }
};

/**
 * Get user's chats
 */
export const getUserChats = async (userId: string): Promise<Chat[]> => {
    try {
        const chatsRef = collection(db, 'chats');
        const q = query(
            chatsRef,
            where('participants', 'array-contains', userId),
            orderBy('updatedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as Chat[];
    } catch (error) {
        logger.error('Error getting user chats:', error);
        throw error;
    }
};

/**
 * Get chat messages
 */
export const getChatMessages = async (chatId: string): Promise<Message[]> => {
    try {
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as Message[];
    } catch (error) {
        logger.error('Error getting chat messages:', error);
        throw error;
    }
};

/**
 * Subscribe to chat messages (real-time)
 */
export const subscribeToChatMessages = (
    chatId: string,
    callback: (messages: Message[]) => void
): Unsubscribe => {
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(q, snapshot => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as Message[];
        callback(messages);
    }, (error) => {
        logger.warn('subscribeToChatMessages error:', error.code);
    });
};

/**
 * Subscribe to user's chats (real-time)
 */
export const subscribeToUserChats = (
    userId: string,
    callback: (chats: Chat[]) => void
): Unsubscribe => {
    const chatsRef = collection(db, 'chats');
    const q = query(
        chatsRef,
        where('participants', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, snapshot => {
        const chats = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as Chat[];
        callback(chats);
    }, (error) => {
        logger.warn('subscribeToUserChats error:', error.code);
    });
};

/**
 * Get unread message count for user
 */
export const getUnreadCount = (chats: Chat[], userId: string): number => {
    return chats.filter(
        chat =>
            !chat.lastMessage.read &&
            chat.lastMessage.senderId !== userId &&
            chat.lastMessage.senderId !== ''
    ).length;
};

/**
 * Delete a chat (admin only)
 */
export const deleteChat = async (chatId: string): Promise<void> => {
    try {
        // Delete all messages first
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const messagesSnapshot = await getDocs(messagesRef);

        const batch = writeBatch(db);
        messagesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete the chat
        const chatRef = doc(db, 'chats', chatId);
        batch.delete(chatRef);

        await batch.commit();
    } catch (error) {
        logger.error('Error deleting chat:', error);
        throw error;
    }
};

/**
 * Get chat by ID
 */
export const getChatById = async (chatId: string): Promise<Chat | null> => {
    try {
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            return null;
        }

        return {
            id: chatDoc.id,
            ...chatDoc.data(),
        } as Chat;
    } catch (error) {
        logger.error('Error getting chat by ID:', error);
        throw error;
    }
};
