import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { logger } from '../utils/logger';
import { messagingService } from '../services/messagingService';

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    createdAt: string;
    link?: string;
    orderId?: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    activeLink: string | null;
    setActiveLink: (link: string | null) => void;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    sendNotification: (userId: string, title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', link?: string) => Promise<void>;
    playMessageSound: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { info } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeLink, setActiveLink] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('userId', '==', user.id),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const firstLoad = { current: true };
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
            })) as Notification[];

            // Logic for proactive toasts and sound
            if (!firstLoad.current && snapshot.docChanges().length > 0) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const notif = change.doc.data() as Notification;

                        // Si la notificación es para lo que el usuario está viendo actualmente, marcar como leída y no notificar
                        if (notif.link && activeLink === notif.link) {
                            markAsRead(change.doc.id);
                        } else {
                            // Solo notificar si es reciente (menos de 10 segundos) para evitar spam al cargar
                            const createdAt = (notif as any).createdAt?.toDate?.() || new Date(notif.createdAt);
                            const isRecent = (Date.now() - createdAt.getTime()) < 10000;

                            if (isRecent) {
                                // Show "Title: Message" to include sender name
                                const toastMessage = notif.title ? `${notif.title}: ${notif.message}` : notif.message;
                                info(toastMessage);
                                playNotificationSound();
                            }
                        }
                    }
                });
            }

            setNotifications(newNotifications);
            const unread = newNotifications.filter(n => !n.read).length;
            setUnreadCount(unread);
            firstLoad.current = false;
        });

        return () => unsubscribe();
    }, [user, info, activeLink]);

    // Audio Context Management
    const audioCtxRef = React.useRef<AudioContext | null>(null);

    useEffect(() => {
        const initAudio = () => {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
        };

        window.addEventListener('click', initAudio, { once: true });
        window.addEventListener('keydown', initAudio, { once: true });

        return () => {
            window.removeEventListener('click', initAudio);
            window.removeEventListener('keydown', initAudio);
        };
    }, []);

    const playNotificationSound = () => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;

            // "Ping" Sound (Glassy)
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
            oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); // Frequency drop

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01); // Attack
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); // Decay

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.5);
        } catch (e) {
            logger.warn('Could not play notification sound:', e);
        }
    };

    const playMessageSound = () => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;

            // "Nice Ding" - Not extravagant but noticeable
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(600, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3); // Slower drop for more "tone"

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02); // Slightly softer attack
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.3);
        } catch (e) {
            logger.warn('Could not play message sound:', e);
        }
    };

    // ── FCM Push Notifications ─────────────────────────────────────────────
    useEffect(() => {
        // Skip for unauthenticated or guest (anonymous) users
        if (!user || user.isGuest) return;

        // Request browser permission + save token to Firestore (silently fails if denied)
        messagingService.requestPermissionAndSaveToken(user.id).catch(e =>
            logger.warn('FCM token request failed:', e)
        );

        // Show foreground push messages as toasts while the app is open
        messagingService.onForegroundMessage((payload) => {
            const title = payload.notification?.title || 'Rescatto';
            const body = payload.notification?.body || '';
            info(body ? `${title}: ${body}` : title);
            playNotificationSound();
        });
    // Re-run only when the logged-in user identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, user?.isGuest]);
    // ──────────────────────────────────────────────────────────────────────

    const markAsRead = async (id: string) => {
        try {
            const notifRef = doc(db, 'notifications', id);
            await updateDoc(notifRef, { read: true });
        } catch (error) {
            logger.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        const batchPromises = unreadIds.map(id =>
            updateDoc(doc(db, 'notifications', id), { read: true })
        );
        await Promise.all(batchPromises);
    };

    // Helper to send notifications (usually done by backend, but we do it client-side for now)
    const sendNotification = async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', link?: string) => {
        try {
            await addDoc(collection(db, 'notifications'), {
                userId,
                title,
                message,
                type,
                read: false,
                createdAt: Timestamp.now(),
                link: link || null
            });
        } catch (error) {
            logger.error('Error sending notification:', error);
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            activeLink,
            setActiveLink,
            markAsRead,
            markAllAsRead,
            sendNotification,
            playMessageSound
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
