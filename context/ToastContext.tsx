import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser usado dentro de ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, type, message, duration };

    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => {
    showToast('success', message, duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    showToast('error', message, duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    showToast('warning', message, duration);
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    showToast('info', message, duration);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Componente Contenedor de Toasts
const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

// Ítem de Toast Individual
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
      className={`relative overflow-hidden bg-gradient-to-br ${config.gradient} backdrop-blur-xl border-2 border-white/50 p-5 rounded-2xl ${config.shadow} shadow-2xl flex items-center gap-4 min-w-[350px] animate-slide-in-right transform hover:scale-105 transition-all duration-300`}
    >
      {/* Efecto de borde degradado */}
      <div className={`absolute inset-0 bg-gradient-to-r ${config.borderGradient} opacity-20 rounded-2xl pointer-events-none`}></div>

      {/* Ícono con resplandor */}
      <div className={`${config.iconColor} bg-white/80 p-2 rounded-xl shadow-lg`}>
        <Icon size={28} strokeWidth={2.5} />
      </div>

      {/* Mensaje */}
      <p className={`${config.textColor} flex-1 text-base font-semibold leading-snug`}>{toast.message}</p>

      {/* Botón de cerrar */}
      <button
        onClick={() => onRemove(toast.id)}
        className={`${config.textColor} hover:bg-white/50 p-1.5 rounded-lg transition-all duration-200 hover:rotate-90`}
      >
        <X size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
};