import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { OrderStatistics } from '../../services/analyticsService';

interface OrdersChartProps {
    data: OrderStatistics;
}

const COLORS = {
    pending: '#fbbf24',
    paid: '#3b82f6',
    readyForPickup: '#10b981',
    completed: '#6b7280',
    missed: '#ef4444',
    disputed: '#a855f7',
};

const STATUS_LABELS = {
    pending: 'Pendiente',
    paid: 'Pagado',
    readyForPickup: 'Listo',
    completed: 'Completado',
    missed: 'Perdido',
    disputed: 'Disputado',
};

export const OrdersChart: React.FC<OrdersChartProps> = ({ data }) => {
    const chartData = Object.entries(data)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => ({
            name: STATUS_LABELS[key as keyof OrderStatistics],
            value,
            color: COLORS[key as keyof OrderStatistics],
        }));

    const totalOrders = Object.values(data).reduce((sum, val) => sum + val, 0);

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Pedidos por Estado</h3>

            {totalOrders === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400">
                    <p>No hay datos para mostrar</p>
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry) => `${entry.name}: ${entry.value}`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const percentage = ((payload[0].value as number / totalOrders) * 100).toFixed(1);
                                        return (
                                            <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-200">
                                                <p className="text-sm font-semibold text-gray-800">
                                                    {payload[0].name}
                                                </p>
                                                <p className="text-sm text-emerald-600 font-bold">
                                                    {payload[0].value} pedidos ({percentage}%)
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        {chartData.map(item => (
                            <div key={item.name} className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="text-sm text-gray-600">
                                    {item.name}: <span className="font-semibold">{item.value}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default OrdersChart;
