import React from 'react';
import { BarChart3, Download } from 'lucide-react';

export const AdminSales: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <BarChart3 className="text-emerald-600" />
                    Ventas y Analytics
                </h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                    <Download size={18} />
                    Exportar Reporte
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Ventas Totales (Mes)</p>
                    <p className="text-3xl font-bold text-gray-800">$0</p>
                    <p className="text-xs text-green-600 mt-1">+0% vs mes anterior</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Comisión Plataforma</p>
                    <p className="text-3xl font-bold text-gray-800">$0</p>
                    <p className="text-xs text-gray-500 mt-1">10% de las ventas</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Pedidos Completados</p>
                    <p className="text-3xl font-bold text-gray-800">0</p>
                    <p className="text-xs text-blue-600 mt-1">0 activos</p>
                </div>
            </div>

            {/* Charts Placeholder */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-4">Ingresos por Negocio</h3>
                <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
                    <p className="text-gray-400">Gráfico de barras por negocio (Por implementar)</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-4">Productos Más Vendidos</h3>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <p className="text-gray-400">Top 10 productos (Por implementar)</p>
                </div>
            </div>
        </div>
    );
};
