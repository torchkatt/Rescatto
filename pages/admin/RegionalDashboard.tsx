import React from 'react';
import { AdminOverview } from './sections/AdminOverview';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, MapPin } from 'lucide-react';

export const RegionalDashboard: React.FC = () => {
    const { user } = useAuth();
    const city = user?.city;

    if (!city) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <MapPin className="mx-auto text-gray-300 mb-4" size={48} />
                <h2 className="text-xl font-bold text-gray-800">Ciudad no asignada</h2>
                <p className="text-gray-500">Contacta al Super Administrador para asignar una ciudad a tu cuenta.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 overflow-x-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <LayoutDashboard className="text-emerald-600" />
                        Panel Regional
                    </h1>
                    <p className="text-gray-500 font-medium">Administrando operaciones en <span className="text-emerald-600 font-bold">{city}</span></p>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2 shadow-sm">
                    <MapPin size={18} />
                    <span className="font-bold">{city}</span>
                </div>
            </div>

            <AdminOverview city={city} />
        </div>
    );
};
