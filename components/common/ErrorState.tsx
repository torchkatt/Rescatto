import React from 'react';
import { AlertCircle, RefreshCcw, Home, MessageSquare } from 'lucide-react';
import * as Sentry from '@sentry/react';

interface ErrorStateProps {
    error?: Error;
    resetErrorBoundary?: () => void;
    title?: string;
    message?: string;
    showHome?: boolean;
    showSupport?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    error,
    resetErrorBoundary,
    title = "¡Ups! Algo no salió como esperábamos",
    message = "Hemos tenido un pequeño inconveniente técnico. No te preocupes, ya estamos trabajando en ello.",
    showHome = true,
    showSupport = true
}) => {
    
    // Report to Sentry if error is provided
    React.useEffect(() => {
        if (error) {
            Sentry.captureException(error);
        }
    }, [error]);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-rose-100 rounded-full blur-3xl opacity-50 animate-pulse"></div>
                <div className="relative w-24 h-24 bg-rose-50 rounded-[2rem] flex items-center justify-center text-rose-500 shadow-inner">
                    <AlertCircle size={48} />
                </div>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">
                {title}
            </h2>
            
            <p className="text-slate-500 max-w-md mx-auto leading-relaxed mb-12">
                {message}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-sm">
                {resetErrorBoundary && (
                    <button
                        onClick={() => {
                            // Reset del boundary + recarga forzada: si el error vino de un
                            // chunk/estado roto, solo limpiar state re-explota. El reload
                            // es el único reintento confiable.
                            try { resetErrorBoundary(); } catch (_e) { /* ignorar errores del boundary reset */ }
                            window.location.reload();
                        }}
                        className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95"
                    >
                        <RefreshCcw size={16} />
                        Reintentar
                    </button>
                )}

                {showHome && (
                    <button
                        onClick={() => {
                            // Redirige a la raíz con reload completo. El <RoleRedirect/>
                            // del App.tsx se encargará de enviar al dashboard del rol
                            // (customer, driver, venue owner, admin, super admin).
                            // Usamos replace para no dejar el error en el historial.
                            window.location.replace(`${window.location.origin}/`);
                        }}
                        className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Home size={16} />
                        Volver al Inicio
                    </button>
                )}

                {showSupport && (
                    <button
                        onClick={() => {
                            window.location.replace(`${window.location.origin}/#/chat`);
                        }}
                        className="w-full sm:w-auto px-8 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <MessageSquare size={16} />
                        Soporte
                    </button>
                )}
            </div>
            
            {error && (
                <div className="mt-12 p-4 bg-slate-50 rounded-xl border border-slate-100 max-w-lg w-full">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-left">Detalles técnicos</p>
                    <p className="text-xs text-slate-400 font-mono text-left break-all opacity-60">
                        {error.message || "Unknown error occurred"}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ErrorState;
