import { useEffect } from 'react';

/**
 * Calls `onClose` when the user presses the Escape key.
 * Attach to any modal/drawer/overlay to support keyboard dismissal.
 */
export function useEscapeKey(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, enabled]);
}
