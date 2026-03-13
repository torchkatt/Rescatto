import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AuditLog } from '../../types';
import { Activity, ShieldAlert, Users, Zap } from 'lucide-react';

interface AuditLogStatsProps {
    logs: AuditLog[]; // Logs for the chart (should be a larger set, e.g. last 30 days)
    totalCount: number;
}

export const AuditLogStats: React.FC<AuditLogStatsProps> = ({ logs, totalCount }) => {

    // 1. Process Data for Chart
    const statsData = useMemo(() => {
        const daysMap = new Map<string, number>();
        const today = new Date();

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
            daysMap.set(key, 0);
        }

        logs.forEach(log => {
            let dateStr = '';
            if (typeof log.timestamp === 'string') {
                dateStr = log.timestamp;
            } else if (log.timestamp && typeof (log.timestamp as any).toDate === 'function') {
                dateStr = (log.timestamp as any).toDate().toISOString();
            } else if (log.timestamp && (log.timestamp as any).seconds) {
                // Handle raw timestamp object if toDate is not available
                dateStr = new Date((log.timestamp as any).seconds * 1000).toISOString();
            }

            if (dateStr) {
                const key = dateStr.split('T')[0];
                if (daysMap.has(key)) {
                    daysMap.set(key, (daysMap.get(key) || 0) + 1);
                }
            }
        });

        return Array.from(daysMap.entries()).map(([date, count]) => ({
            date: new Date(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
            fullDate: date,
            count
        }));
    }, [logs]);

    // 2. Process KPIs
    const kpis = useMemo(() => {
        const criticalCount = logs.filter(l => l.action.includes('DELETE') || l.action.includes('FAIL')).length;
        const uniqueActors = new Set(logs.map(l => l.performedBy)).size;

        return [
            { label: 'Eventos (7 días)', value: logs.length, icon: <Activity className="text-blue-600" size={20} />, color: 'bg-blue-50 border-blue-100' },
            { label: 'Acciones Críticas', value: criticalCount, icon: <ShieldAlert className="text-red-600" size={20} />, color: 'bg-red-50 border-red-100' },
            { label: 'Usuarios Activos', value: uniqueActors, icon: <Users className="text-purple-600" size={20} />, color: 'bg-purple-50 border-purple-100' },
            { label: 'Total Histórico', value: totalCount, icon: <Zap className="text-amber-600" size={20} />, color: 'bg-amber-50 border-amber-100' },
        ];
    }, [logs, totalCount]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {/* KPI Cards */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border ${kpi.color} flex items-center justify-between transition-all hover:shadow-md`}>
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{kpi.label}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value.toLocaleString()}</p>
                        </div>
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                            {kpi.icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* Activity Chart */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700">Actividad Reciente</h3>
                    <span className="text-xs text-gray-400">Últimos 7 días</span>
                </div>
                <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statsData}>
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                cursor={{ fill: '#f3f4f6' }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {statsData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.count > 10 ? '#34d399' : '#94a3b8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
