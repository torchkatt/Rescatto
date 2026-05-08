import React, { ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from '../components/customer/common/Button';
import { useConfirmStore } from '../stores/useConfirmStore';

// useConfirm API unchanged — returns confirm function directly
export const useConfirm = () => useConfirmStore(state => state.confirm);

// ConfirmProvider only renders the modal — no local state needed
export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <>
            {children}
            <ConfirmModal />
        </>
    );
};

const ConfirmModal: React.FC = () => {
    const isOpen = useConfirmStore(state => state.isOpen);
    const options = useConfirmStore(state => state.options);
    const handleConfirm = useConfirmStore(state => state._handleConfirm);
    const handleCancel = useConfirmStore(state => state._handleCancel);

    if (!isOpen || !options) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
                onClick={handleCancel}
            />

            {/* Dialog Card */}
            <div className="relative overflow-hidden bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in fade-in duration-300 border border-white/50">
                {/* Accent bar */}
                <div className={`h-2 w-full bg-gradient-to-r ${
                    options.variant === 'danger' ? 'from-red-500 to-rose-500' :
                    options.variant === 'warning' ? 'from-amber-500 to-yellow-500' :
                    'from-emerald-500 to-teal-500'
                }`} />

                <div className="p-8 relative">
                    {/* Background glow */}
                    <div className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl opacity-10 rounded-full pointer-events-none ${
                        options.variant === 'danger' ? 'bg-red-500' :
                        options.variant === 'warning' ? 'bg-amber-500' :
                        'bg-emerald-500'
                    }`} />

                    <div className="flex flex-col items-center text-center gap-6 relative z-10">
                        <div className={`p-4 rounded-2xl shadow-inner ${
                            options.variant === 'danger' ? 'bg-red-50 text-red-600' :
                            options.variant === 'warning' ? 'bg-amber-50 text-amber-600' :
                            'bg-emerald-50 text-emerald-600'
                        }`}>
                            {options.variant === 'danger' || options.variant === 'warning'
                                ? <AlertTriangle size={32} strokeWidth={2.5} />
                                : <HelpCircle size={32} strokeWidth={2.5} />
                            }
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 leading-tight">
                                {options.title || '¿Confirmar?'}
                            </h3>
                            <p className="text-slate-600 font-medium leading-relaxed">
                                {options.message}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-10">
                        <Button
                            variant="primary"
                            className={`w-full py-4 rounded-2xl text-sm font-black shadow-lg transition-all active:scale-95 ${
                                options.variant === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' :
                                options.variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' :
                                'bg-slate-900 hover:bg-slate-800 shadow-slate-100'
                            }`}
                            onClick={handleConfirm}
                        >
                            {options.confirmLabel || 'SÍ, CONTINUAR'}
                        </Button>
                        <button
                            onClick={handleCancel}
                            className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm font-bold transition-colors"
                        >
                            {options.cancelLabel || 'No, cancelar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
