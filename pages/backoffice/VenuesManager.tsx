import React from 'react';
import { Store } from 'lucide-react';

const VenuesManager: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Restaurantes</h1>
          <p className="text-neutral-400 mt-1">Aprobación, revisión y moderación de negocios asociados.</p>
        </div>
        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
          <Store className="w-6 h-6 text-emerald-400" />
        </div>
      </div>
      
      <div className="h-96 border-2 border-dashed border-neutral-800 rounded-3xl flex items-center justify-center bg-neutral-900/50">
         <p className="text-neutral-500 font-medium">Módulo en construcción (Fase 4: Verificación)</p>
      </div>
    </div>
  );
};

export default VenuesManager;
