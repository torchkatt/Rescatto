import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { migrationService } from '../../services/migrationService';
import { Store, Database, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

/**
 * MarketplaceInit — Panel de inicialización del marketplace.
 * Permite ejecutar seed de categorías y migración de datos legacy.
 * Solo visible para SUPER_ADMIN en el backoffice.
 */

type InitStep = 'idle' | 'seeding' | 'migrating' | 'done' | 'error';

export const MarketplaceInit: React.FC = () => {
  const { success, error: showError } = useToast();
  const [step, setStep] = useState<InitStep>('idle');
  const [results, setResults] = useState<{ categories?: any; venues?: any; products?: any }>({});

  const handleInit = async () => {
    try {
      // Step 1: Seed categories via Cloud Function
      setStep('seeding');
      const seedFn = httpsCallable(functions, 'seedCategories');
      const catResult: any = await seedFn();
      const catData = catResult.data as { created: number; skipped: boolean };

      // Step 2: Migrate venues → sellers
      setStep('migrating');
      const migrationResult = await migrationService.migrateAll();

      setResults({
        categories: catData,
        venues: migrationResult.venues,
        products: migrationResult.products,
      });

      setStep('done');
      success(`✅ Marketplace inicializado: ${catData.created} categorías, ${migrationResult.venues.migrated} sellers, ${migrationResult.products.migrated} listings`);
    } catch (err: any) {
      setStep('error');
      showError(`Error: ${err.message || 'No se pudo inicializar el marketplace'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-500/10 rounded-xl">
          <Store size={20} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white">Inicializar Marketplace</h3>
          <p className="text-xs text-neutral-400">Crea categorías, migra venues→sellers y products→listings</p>
        </div>
      </div>

      {step === 'idle' && (
        <button
          onClick={handleInit}
          className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
        >
          <Database size={18} />
          Inicializar Marketplace
        </button>
      )}

      {step === 'seeding' && (
        <div className="flex items-center gap-3 bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <RefreshCw size={18} className="animate-spin text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-white">Creando categorías...</p>
            <p className="text-xs text-neutral-400">Esto puede tomar unos segundos</p>
          </div>
        </div>
      )}

      {step === 'migrating' && (
        <div className="flex items-center gap-3 bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <RefreshCw size={18} className="animate-spin text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-white">Migrando datos legacy...</p>
            <p className="text-xs text-neutral-400">venues→sellers, products→listings</p>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-neutral-800 rounded-xl p-4 border border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle size={18} />
            <span className="font-bold">Marketplace inicializado</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {results.categories && (
              <div className="bg-neutral-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-black text-emerald-400">{results.categories.created}</p>
                <p className="text-neutral-400">Categorías</p>
              </div>
            )}
            {results.venues && (
              <div className="bg-neutral-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-black text-emerald-400">{results.venues.migrated}</p>
                <p className="text-neutral-400">Sellers</p>
              </div>
            )}
            {results.products && (
              <div className="bg-neutral-900 rounded-lg p-3 text-center">
                <p className="text-2xl font-black text-emerald-400">{results.products.migrated}</p>
                <p className="text-neutral-400">Listings</p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="flex items-center gap-3 bg-red-500/10 rounded-xl p-4 border border-red-500/30">
          <AlertTriangle size={18} className="text-red-400" />
          <div>
            <p className="text-sm font-bold text-red-400">Error al inicializar</p>
            <button onClick={() => setStep('idle')} className="text-xs text-red-300 hover:text-red-200 mt-1">
              Reintentar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceInit;