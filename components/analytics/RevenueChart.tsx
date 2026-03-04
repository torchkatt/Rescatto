import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DailyRevenue } from '../../services/analyticsService';
import { format } from 'date-fns';

interface RevenueChartProps {
    data: DailyRevenue[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
    const formattedData = data.map(item => ({
        ...item,
        dateFormatted: format(new Date(item.date), 'dd MMM'),
    }));

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Ingresos por Día</h3>

            {data.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400">
                    <p>No hay datos para mostrar</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={formattedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="dateFormatted"
                            stroke="#9ca3af"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            stroke="#9ca3af"
                            style={{ fontSize: '12px' }}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-200">
                                            <p className="text-sm font-semibold text-gray-800">
                                                {payload[0].payload.dateFormatted}
                                            </p>
                                            <p className="text-sm text-emerald-600 font-bold">
                                                ${(payload[0].value as number)?.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {payload[0].payload.orders} pedido{payload[0].payload.orders !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="revenue"
                            name="Ingresos"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ fill: '#10b981', r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default RevenueChart;
