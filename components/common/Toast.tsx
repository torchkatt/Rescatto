import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { Toast, useToastStore } from '../../stores/useToastStore';

interface ToastItemProps {
    toast: Toast;
    onRemove: (id: string) => void;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
    const configs = {
        success: {
            icon: CheckCircle,
            bg: 'bg-emerald-50/90',
            border: 'border-emerald-200/50',
            iconBg: 'bg-emerald-500',
            iconColor: 'text-white',
            textColor: 'text-emerald-900',
            progressBg: 'bg-emerald-500',
            shadow: 'shadow-emerald-900/5',
        },
        error: {
            icon: XCircle,
            bg: 'bg-rose-50/90',
            border: 'border-rose-200/50',
            iconBg: 'bg-rose-500',
            iconColor: 'text-white',
            textColor: 'text-rose-900',
            progressBg: 'bg-rose-500',
            shadow: 'shadow-rose-900/5',
        },
        warning: {
            icon: AlertCircle,
            bg: 'bg-amber-50/90',
            border: 'border-amber-200/50',
            iconBg: 'bg-amber-500',
            iconColor: 'text-white',
            textColor: 'text-amber-900',
            progressBg: 'bg-amber-500',
            shadow: 'shadow-amber-900/5',
        },
        info: {
            icon: Info,
            bg: 'bg-blue-50/90',
            border: 'border-blue-200/50',
            iconBg: 'bg-blue-500',
            iconColor: 'text-white',
            textColor: 'text-blue-900',
            progressBg: 'bg-blue-500',
            shadow: 'shadow-blue-900/5',
        },
    };

    const config = configs[toast.type];
    const Icon = config.icon;

    return (
        <div
            className={`group relative overflow-hidden ${config.bg} backdrop-blur-xl border ${config.border} p-3.5 rounded-2xl ${config.shadow} shadow-2xl flex items-center gap-3.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                toast.isLeaving ? 'animate-slide-out-right' : 'animate-slide-in-right'
            }`}
            style={{ '--toast-duration': `${toast.duration || 5000}ms` } as React.CSSProperties}
            onClick={() => onRemove(toast.id)}
        >
            {/* Glossy overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
            
            {/* Icon Container */}
            <div className={`${config.iconBg} ${config.iconColor} p-2 rounded-xl shadow-lg ring-4 ring-white/30 shrink-0 transition-transform duration-300 group-hover:rotate-12`}>
                <Icon size={20} strokeWidth={2.5} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={`${config.textColor} text-[14px] font-bold leading-snug tracking-tight truncate`}>
                    {toast.message}
                </p>
                <p className={`${config.textColor} opacity-60 text-[11px] font-medium mt-0.5`}>
                    {toast.type === 'success' ? 'Completado con éxito' : 
                     toast.type === 'error' ? 'Ha ocurrido un problema' : 
                     toast.type === 'warning' ? 'Requiere tu atención' : 'Información del sistema'}
                </p>
            </div>

            {/* Close Button */}
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
                className={`${config.textColor} opacity-40 hover:opacity-100 hover:bg-black/5 p-1.5 rounded-lg transition-all duration-200`}
            >
                <X size={16} strokeWidth={3} />
            </button>

            {/* Progress Bar Container */}
            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-black/5 overflow-hidden">
                <div 
                    className={`h-full ${config.progressBg} animate-progress opacity-60`}
                />
            </div>
        </div>
    );
};

export const ToastContainer: React.FC = () => {
    const toasts = useToastStore(state => state.toasts);
    const removeToast = useToastStore(state => state.removeToast);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-1/2 -translate-x-1/2 z-[90] space-y-2 w-[calc(100%-1.25rem)] max-w-sm pointer-events-none">
            <div className="flex flex-col gap-2 pointer-events-auto">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>
        </div>
    );
};
