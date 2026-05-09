import React from 'react';
import { useToastStore } from '../stores/useToastStore';
import { useShallow } from 'zustand/react/shallow';
import { ToastContainer } from '../components/common/Toast';

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
            <ToastContainer />
        </>
    );
};
