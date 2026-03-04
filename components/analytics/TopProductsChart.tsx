import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TopProduct } from '../../services/analyticsService';

interface TopProductsChartProps {
    data: TopProduct[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const TopProductsChart: React.FC<TopProductsChartProps> = ({ data }) => {
    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Productos Más Vendidos</h3>

            {data.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400">
                    <p>No hay datos para mostrar</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            type="number"
                            stroke="#9ca3af"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke="#9ca3af"
                            style={{ fontSize: '12px' }}
                            width={150}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-200">
                                            <p className="text-sm font-semibold text-gray-800">
                                                {payload[0].payload.name}
                                            </p>
                                            <p className="text-sm text-emerald-600 font-bold">
                                                ${(payload[0].value as number)?.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {payload[0].payload.quantitySold} unidades vendidas
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="revenue" name="Ingresos">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}

            {/* Product List */}
            {data.length > 0 && (
                <div className="mt-4 space-y-2">
                    {data.map((product, index) => (
                        <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                >
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">{product.name}</p>
                                    <p className="text-xs text-gray-500">{product.quantitySold} unidades</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-emerald-600">
                                    ${product.revenue.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TopProductsChart;
