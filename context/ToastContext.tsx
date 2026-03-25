import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, Toast } from '../stores/useToastStore';
import { useShallow } from 'zustand/react/shallow';

// Re-export useToast as thin wrapper around the Zustand store
// — API unchanged: { showToast, success, error, warning, info }
// useShallow prevents infinite re-renders caused by new object refs on each selector call
export const useToast = () => useToastStore(
    useShallow(state => ({
        showToast: state.showToast,
        success: state.success,
        error: state.error,
        warning: state.warning,
        info: state.info,
    }))
);

// ToastProvider now only renders the visual container — no state needed here
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <>
            {children}
            <ToastContainerConnected />
        </>
    );
};

// Reads toasts from the store and renders them
const ToastContainerConnected: React.FC = () => {
    const toasts = useToastStore(state => state.toasts);
    const removeToast = useToastStore(state => state.removeToast);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-1/2 -translate-x-1/2 z-[90] space-y-2 w-[calc(100%-1.25rem)] max-w-sm">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
        </div>
    );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
    const configs = {
        success: {
            icon: CheckCircle,
            gradient: 'from-emerald-500/20 to-green-500/20',
            borderGradient: 'from-emerald-500 to-green-500',
            textColor: 'text-emerald-900',
            iconColor: 'text-emerald-600',
            shadow: 'shadow-emerald-200/50',
        },
        error: {
            icon: XCircle,
            gradient: 'from-red-500/20 to-rose-500/20',
            borderGradient: 'from-red-500 to-rose-500',
            textColor: 'text-red-900',
            iconColor: 'text-red-600',
            shadow: 'shadow-red-200/50',
        },
        warning: {
            icon: AlertCircle,
            gradient: 'from-amber-500/20 to-yellow-500/20',
            borderGradient: 'from-amber-500 to-yellow-500',
            textColor: 'text-amber-900',
            iconColor: 'text-amber-600',
            shadow: 'shadow-amber-200/50',
        },
        info: {
            icon: Info,
            gradient: 'from-blue-500/20 to-cyan-500/20',
            borderGradient: 'from-blue-500 to-cyan-500',
            textColor: 'text-blue-900',
            iconColor: 'text-blue-600',
            shadow: 'shadow-blue-200/50',
        },
    };

    const config = configs[toast.type];
    const Icon = config.icon;

    return (
        <div
            className={`relative overflow-hidden bg-gradient-to-br ${config.gradient} backdrop-blur-xl border border-white/70 p-3 rounded-2xl ${config.shadow} shadow-lg flex items-center gap-2.5 animate-slide-in-right transition-all duration-300`}
        >
            <div className={`absolute inset-0 bg-gradient-to-r ${config.borderGradient} opacity-20 rounded-2xl pointer-events-none`} />
            <div className={`${config.iconColor} bg-white/85 p-1.5 rounded-lg shadow-sm`}>
                <Icon size={18} strokeWidth={2.25} />
            </div>
            <p className={`${config.textColor} flex-1 text-[13px] font-semibold leading-tight break-words max-h-12 overflow-hidden`}>{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className={`${config.textColor} hover:bg-white/50 p-1 rounded-md transition-all duration-200`}
            >
                <X size={16} strokeWidth={2.5} />
            </button>
        </div>
    );
};
