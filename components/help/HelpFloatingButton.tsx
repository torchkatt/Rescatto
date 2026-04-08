import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

const HIDDEN_KEY = 'rescatto_help_fab_hidden';

function helpRouteForRole(role?: UserRole): string {
  if (!role) return '/app/help';
  const map: Partial<Record<UserRole, string>> = {
    [UserRole.CUSTOMER]: '/app/help',
    [UserRole.DRIVER]: '/driver/help',
    [UserRole.VENUE_OWNER]: '/dashboard/help',
    [UserRole.KITCHEN_STAFF]: '/dashboard/help',
    [UserRole.ADMIN]: '/backoffice/help',
    [UserRole.SUPER_ADMIN]: '/backoffice/help',
    [UserRole.CITY_ADMIN]: '/backoffice/help',
  };
  return map[role] ?? '/app/help';
}

interface HelpFloatingButtonProps {
  /**
   * 'customer' — posiciona el botón por encima del bottom nav (88px desde abajo)
   * 'default'  — posición estándar (24px desde abajo)
   */
  layout?: 'customer' | 'default';
}

export const HelpFloatingButton: React.FC<HelpFloatingButtonProps> = ({ layout = 'default' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(HIDDEN_KEY) === '1'
  );

  if (!user || dismissed) return null;

  const bottomClass = layout === 'customer'
    ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'
    : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]';

  const handleClick = () => {
    navigate(helpRouteForRole(user.role));
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(HIDDEN_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      className={`fixed right-4 ${bottomClass} z-40 flex flex-col items-end gap-1`}
      role="group"
      aria-label="Botón de ayuda"
    >
      {/* Botón cerrar (pequeño, encima) */}
      <button
        onClick={handleDismiss}
        aria-label="Ocultar botón de ayuda"
        className="w-5 h-5 rounded-full bg-gray-400/80 hover:bg-gray-500 text-white flex items-center justify-center transition-colors"
      >
        <X size={10} />
      </button>

      {/* Botón principal */}
      <button
        onClick={handleClick}
        aria-label="Centro de ayuda"
        className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-lg shadow-emerald-900/30 flex items-center justify-center transition-all"
      >
        <HelpCircle size={22} />
      </button>
    </div>
  );
};
