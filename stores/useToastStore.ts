import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

const MAX_TOASTS = 3;
const MAX_MESSAGE_LENGTH = 140;

// Timer map lives outside the store — side effects, not state
const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

interface ToastState {
    toasts: Toast[];
    removeToast: (id: string) => void;
    showToast: (type: ToastType, message: string, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],

    removeToast: (id: string) => {
        const timer = timerMap.get(id);
        if (timer) {
            clearTimeout(timer);
            timerMap.delete(id);
        }
        set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    },

    showToast: (type: ToastType, message: string, duration = 5000) => {
        const id = Math.random().toString(36).substring(7);
        const safeMessage = message.length > MAX_MESSAGE_LENGTH
            ? `${message.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
            : message;
        const toast: Toast = { id, type, message: safeMessage, duration };

        set(state => ({ toasts: [...state.toasts, toast].slice(-MAX_TOASTS) }));

        if (duration > 0) {
            const timer = setTimeout(() => {
                get().removeToast(id);
            }, duration);
            timerMap.set(id, timer);
        }
    },

    success: (message: string, duration?: number) => get().showToast('success', message, duration),
    error: (message: string, duration?: number) => get().showToast('error', message, duration),
    warning: (message: string, duration?: number) => get().showToast('warning', message, duration),
    info: (message: string, duration?: number) => get().showToast('info', message, duration),
}));
