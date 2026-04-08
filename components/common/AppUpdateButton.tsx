import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { clearCacheAndUpdate } from '../../utils/updateApp';

interface AppUpdateButtonProps {
  variant: 'sidebar' | 'backoffice' | 'driver' | 'profile';
}

export const AppUpdateButton: React.FC<AppUpdateButtonProps> = ({ variant }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      await clearCacheAndUpdate();
      // La página se recarga, así que esto probablemente nunca termine,
      // pero mantenemos el try/catch por seguridad
    } catch (error) {
      console.error('Error updating app:', error);
      setIsLoading(false);
    }
  };

  // Variant: sidebar — estilos similares al botón logout de Sidebar.tsx
  if (variant === 'sidebar') {
    return (
      <button
        onClick={handleUpdate}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        title="Actualizar app y limpiar caché"
      >
        <RefreshCw
          size={20}
          className={`group-hover:-translate-x-1 transition-transform ${isLoading ? 'animate-spin' : ''}`}
        />
        <span className="font-medium">Actualizar App</span>
      </button>
    );
  }

  // Variant: backoffice — estilos similares al botón logout de BackofficeLayout.tsx
  if (variant === 'backoffice') {
    return (
      <button
        onClick={handleUpdate}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-blue-900/50 text-blue-300 hover:bg-blue-800 hover:text-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Actualizar app y limpiar caché"
      >
        <RefreshCw
          className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
        />
        <span className="text-sm font-medium">Actualizar App</span>
      </button>
    );
  }

  // Variant: driver — ícono-only, similar al botón logout del driver
  if (variant === 'driver') {
    return (
      <button
        onClick={handleUpdate}
        disabled={isLoading}
        className="p-3 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Actualizar app y limpiar caché"
      >
        <RefreshCw
          size={24}
          className={isLoading ? 'animate-spin' : ''}
        />
      </button>
    );
  }

  // Variant: profile — botón similar al logout del perfil (glassmorphism)
  if (variant === 'profile') {
    return (
      <button
        onClick={handleUpdate}
        disabled={isLoading}
        className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm transition-all active:scale-95 shadow-sm border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Actualizar app y limpiar caché"
      >
        <RefreshCw
          size={16}
          className={isLoading ? 'animate-spin' : ''}
        />
        Actualizar
      </button>
    );
  }

  return null;
};
