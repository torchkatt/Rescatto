import React from 'react';
import { Truck, MapPin } from 'lucide-react';

export const AdminDeliveries: React.FC = () => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Truck className="text-emerald-600" />
                Gestión de Domicilios
            </h2>

            {/* Drivers Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Drivers Activos</p>
                    <p className="text-3xl font-bold text-gray-800">0</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Entregas en Curso</p>
                    <p className="text-3xl font-bold text-gray-800">0</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Completadas Hoy</p>
                    <p className="text-3xl font-bold text-gray-800">0</p>
                </div>
            </div>

            {/* Active Deliveries */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-lg">Entregas Activas</h3>
                </div>
                <div className="p-12 text-center">
                    <Truck className="mx-auto mb-4 text-gray-300" size={48} />
                    <p className="text-gray-500">No hay entregas activas en este momento</p>
                </div>
            </div>

            {/* Drivers List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-lg">Lista de Repartidores</h3>
                </div>
                <div className="p-12 text-center">
                    <p className="text-gray-500">No hay repartidores registrados</p>
                    <p className="text-sm text-gray-400 mt-2">Los usuarios con rol DRIVER aparecerán aquí</p>
                </div>
            </div>
        </div>
    );
};
