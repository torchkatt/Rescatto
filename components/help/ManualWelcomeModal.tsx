import React, { useEffect, useState } from 'react';
import { BookOpen, X, Download, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { helpService } from '../../services/helpService';
import { UserRole } from '../../types';

const PROMPTED_KEY = 'rescatto_manual_prompted';
const NEW_USER_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

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

function isNewUser(createdAt?: string | number | null): boolean {
  if (!createdAt) return false;
  const created = typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime();
  return Date.now() - created < NEW_USER_WINDOW_MS;
}

export const ManualWelcomeModal: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const userId = user?.id;
  const userIsGuest = user?.isGuest;
  const userRole = user?.role;
  const userCreatedAt = (user as any)?.createdAt;
  useEffect(() => {
    if (!userId || userIsGuest) return;
    if (localStorage.getItem(PROMPTED_KEY) === '1') return;
    if (!isNewUser(userCreatedAt)) return;

    // Marcar como mostrado de inmediato para no mostrarlo dos veces
    localStorage.setItem(PROMPTED_KEY, '1');

    // Pequeño delay para no interrumpir la carga inicial
    const timer = setTimeout(() => {
      if (userRole) {
        helpService.getManualForRole(userRole).then(entry => {
          if (entry) setManualUrl(entry.url);
          setVisible(true);
        }).catch(() => setVisible(true));
      } else {
        setVisible(true);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [userId, userIsGuest, userRole, userCreatedAt]);

  const handleDownload = () => {
    if (!manualUrl) return;
    const a = document.createElement('a');
    a.href = manualUrl;
    a.download = `rescatto-manual.pdf`;
    a.click();
    setVisible(false);
  };

  const handleGoToHelp = () => {
    setVisible(false);
    navigate(helpRouteForRole(user?.role));
  };

  const handleDismiss = () => setVisible(false);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a Rescatto"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Banda de color */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />

        <div className="p-6">
          {/* Botón cerrar */}
          <button
            onClick={handleDismiss}
            aria-label="Cerrar"
            className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>

          {/* Ícono */}
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
            <BookOpen size={24} className="text-emerald-600 dark:text-emerald-400" />
          </div>

          <h2 className="font-bold text-gray-900 dark:text-white text-lg leading-snug mb-2">
            ¡Bienvenido a Rescatto!
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-6">
            Tenemos un manual de usuario pensado para ti. Aprende a usar la plataforma en minutos y no te pierdas de nada.
          </p>

          <div className="flex flex-col gap-2">
            {manualUrl && (
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                <Download size={16} />
                Descargar manual PDF
              </button>
            )}
            <button
              onClick={handleGoToHelp}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 font-semibold text-sm rounded-xl transition-colors"
            >
              Ver centro de ayuda
              <ArrowRight size={16} />
            </button>
            <button
              onClick={handleDismiss}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 py-2 transition-colors"
            >
              Más tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
