import { create } from 'zustand';

export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmState {
    isOpen: boolean;
    options: ConfirmOptions | null;
    _resolve: ((value: boolean) => void) | null;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    _handleConfirm: () => void;
    _handleCancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
    isOpen: false,
    options: null,
    _resolve: null,

    confirm: (options: ConfirmOptions): Promise<boolean> => {
        return new Promise(resolve => {
            set({ isOpen: true, options, _resolve: resolve });
        });
    },

    _handleConfirm: () => {
        const { _resolve } = get();
        set({ isOpen: false, options: null, _resolve: null });
        _resolve?.(true);
    },

    _handleCancel: () => {
        const { _resolve } = get();
        set({ isOpen: false, options: null, _resolve: null });
        _resolve?.(false);
    },
}));
