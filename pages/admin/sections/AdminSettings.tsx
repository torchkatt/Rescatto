import React from 'react';
import { Settings as SettingsIcon, Percent } from 'lucide-react';

export const AdminSettings: React.FC = () => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <SettingsIcon className="text-emerald-600" />
                Configuración de Plataforma
            </h2>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Percent size={20} />
                    Tasas y Comisiones
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Comisión por Venta (%)
                        </label>
                        <input
                            type="number"
                            defaultValue="10"
                            className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Comisión por Entrega (%)
                        </label>
                        <input
                            type="number"
                            defaultValue="5"
                            className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-4">Parámetros Generales</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-800">Radio de búsqueda por defecto</p>
                            <p className="text-sm text-gray-500">Kilómetros para mostrar negocios cercanos</p>
                        </div>
                        <input
                            type="number"
                            defaultValue="5"
                            className="w-24 px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-800">Tiempo máximo de recogida</p>
                            <p className="text-sm text-gray-500">Minutos después de la orden</p>
                        </div>
                        <input
                            type="number"
                            defaultValue="30"
                            className="w-24 px-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
};
