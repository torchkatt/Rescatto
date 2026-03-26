import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, title, children }) => {
  // Lock body scroll while drawer is open (only on mobile viewports)
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-700 rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-600" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 flex-shrink-0">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
