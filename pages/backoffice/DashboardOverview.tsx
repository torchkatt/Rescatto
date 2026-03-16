import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatCOP } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import {
    Users, Store, ShoppingBag, DollarSign, Truck, TrendingUp,
    Landmark, BarChart3, RefreshCw, ArrowUpRight
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Stats {
    totalUsers: number;
    totalVenues: number;
    totalProducts: number;
    todaySales: number;
    activeDeliveries: number;
    pendingOrders: number;
}

const DashboardOverview: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stats>({
        totalUsers: 0, totalVenues: 0, totalProducts: 0,
        todaySales: 0, activeDeliveries: 0, pendingOrders: 0,
    });
    const [weeklyData, setWeeklyData] = useState<{ day: string; ventas: number }[]>([]);
    const [loading, setLoading] = useState(true);

    const loadStats = async () => {
        setLoading(true);
        try {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const todayQ = query(collection(db, 'orders'), where('createdAt', '>=', Timestamp.fromDate(today)));

            const [usersCount, venuesCount, productsCount, todaySnap, deliveriesCount, pendingCount] = await Promise.all([
                getCountFromServer(collection(db, 'users')),
                getCountFromServer(collection(db, 'venues')),
                getCountFromServer(collection(db, 'products')),
                getDocs(todayQ),
                getCountFromServer(query(collection(db, 'orders'), where('status', '==', 'IN_TRANSIT'))),
                getCountFromServer(query(collection(db, 'orders'), where('status', 'in', ['PENDING', 'PAID']))),
            ]);

            const todaySales = todaySnap.docs.reduce((sum, d) => sum + (Number(d.data().totalAmount) || 0), 0);

            // 7-day chart
            const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0, 0, 0, 0);
            const weekSnap = await getDocs(query(collection(db, 'orders'), where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))));
            const dayMap: Record<string, number> = {};
            for (let i = 0; i < 7; i++) {
                const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
                dayMap[d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })] = 0;
            }
            weekSnap.docs.forEach(d => {
                const data = d.data();
                const ts = data.createdAt?.toDate?.() || new Date(data.createdAt);
                const key = ts.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
                if (key in dayMap) dayMap[key] += Number(data.totalAmount) || 0;
            });
            setWeeklyData(Object.entries(dayMap).map(([day, ventas]) => ({ day, ventas })));

            setStats({
                totalUsers: usersCount.data().count,
                totalVenues: venuesCount.data().count,
                totalProducts: productsCount.data().count,
                todaySales,
                activeDeliveries: deliveriesCount.data().count,
                pendingOrders: pendingCount.data().count,
            });
        } catch (e) {
            logger.error('Error cargando dashboard', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadStats(); }, []);

    const kpis = [
        { label: 'Usuarios', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', path: '/backoffice/users' },
        { label: 'Negocios', value: stats.totalVenues.toLocaleString(), icon: Store, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', path: '/backoffice/venues' },
        { label: 'Productos', value: stats.totalProducts.toLocaleString(), icon: ShoppingBag, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', path: '/backoffice/venues' },
        { label: 'Ventas Hoy', value: formatCOP(stats.todaySales), icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', path: '/backoffice/finance' },
        { label: 'En Tránsito', value: stats.activeDeliveries.toLocaleString(), icon: Truck, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', path: '/backoffice/dashboard' },
        { label: 'Pedidos Pendientes', value: stats.pendingOrders.toLocaleString(), icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', path: '/backoffice/dashboard' },
    ];

    const quickLinks = [
        { label: 'Finanzas Global', icon: DollarSign, path: '/backoffice/finance', color: 'text-emerald-400' },
        { label: 'Comisiones', icon: Landmark, path: '/backoffice/commissions', color: 'text-amber-400' },
        { label: 'Auditoría', icon: BarChart3, path: '/backoffice/audit', color: 'text-blue-400' },
        { label: 'Usuarios', icon: Users, path: '/backoffice/users', color: 'text-purple-400' },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard Overview</h1>
                    <p className="text-neutral-400 mt-1">Métricas globales y pulso de la operación.</p>
                </div>
                <button
                    onClick={loadStats}
                    className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-2xl border border-neutral-700 transition"
                    title="Actualizar"
                >
                    <RefreshCw className={`w-5 h-5 text-neutral-300 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {kpis.map((kpi) => (
                    <button
                        key={kpi.label}
                        onClick={() => navigate(kpi.path)}
                        className={`flex flex-col gap-3 p-5 rounded-2xl border bg-neutral-900 hover:bg-neutral-800 transition text-left ${kpi.bg}`}
                    >
                        <div className={`p-2 rounded-xl border w-fit ${kpi.bg}`}>
                            <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                        </div>
                        {loading ? (
                            <div className="h-7 w-16 bg-neutral-700 rounded animate-pulse" />
                        ) : (
                            <p className="text-xl font-bold text-white leading-none">{kpi.value}</p>
                        )}
                        <p className="text-xs text-neutral-400 font-medium">{kpi.label}</p>
                    </button>
                ))}
            </div>

            {/* Chart + Quick Links */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7-day chart */}
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-6">Ventas — Últimos 7 días</h3>
                    {loading ? (
                        <div className="h-52 bg-neutral-800 rounded-2xl animate-pulse" />
                    ) : weeklyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={210}>
                            <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="dGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#737373' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#737373' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(v: number) => [formatCOP(v), 'Ventas']}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #404040', background: '#171717', fontSize: 12, color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2.5} fill="url(#dGrad)" dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-52 flex items-center justify-center text-neutral-500 text-sm">
                            Sin datos de ventas esta semana
                        </div>
                    )}
                </div>

                {/* Quick Links */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-5">Accesos Rápidos</h3>
                    <div className="space-y-2">
                        {quickLinks.map(link => (
                            <button
                                key={link.path}
                                onClick={() => navigate(link.path)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition group"
                            >
                                <div className="flex items-center gap-3">
                                    <link.icon className={`w-4 h-4 ${link.color}`} />
                                    <span className="text-sm font-medium text-neutral-200">{link.label}</span>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
