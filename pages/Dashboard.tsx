import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Leaf, DollarSign, Plus, ClipboardList, Settings as SettingsIcon, ArrowUpRight, BarChart as BarChartIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { getDailyRevenueTrends } from '../services/analyticsService';
import { useAuth } from '../context/AuthContext';
import { AnalyticsData, UserRole } from '../types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCOP } from '../utils/formatters';
import { getUserVenueId } from '../utils/getUserVenueId';

const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; trend?: string }> = ({ title, value, icon, color, trend }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-start space-x-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group relative overflow-hidden">
      <div className={`p-4 rounded-xl ${color} bg-opacity-10 text-white flex-shrink-0 relative z-10`}>
        <div className={`absolute inset-0 ${color} opacity-20 rounded-xl`}></div>
        <div className="relative z-10 text-emerald-900 group-hover:scale-110 transition-transform duration-300">
          {React.cloneElement(icon as React.ReactElement, { className: `text-${color.replace('bg-', '')}-600` })}
        </div>
      </div>
      <div className="flex-1 relative z-10">
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
        {trend && (
          <div className="flex items-center mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
            <ArrowUpRight size={12} className="mr-1" />
            {trend} {t('dashboard_trend')}
          </div>
        )}
      </div>
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full ${color} opacity-5 group-hover:scale-150 transition-transform duration-500 ease-out`}></div>
    </div>
  );
};

const ActionCard: React.FC<{ to: string; title: string; subtitle: string; icon: React.ReactNode; color: string }> = ({ to, title, subtitle, icon, color }) => (
  <Link to={to} className="relative overflow-hidden bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 flex items-center space-x-4 group">
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-white transition-colors`}>
      <div className={`absolute inset-0 ${color} opacity-10 rounded-xl group-hover:opacity-20 transition-opacity`}></div>
      <div className="relative z-10 text-gray-700">
        {icon}
      </div>
    </div>
    <div>
      <h3 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{title}</h3>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
    <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
      <ArrowUpRight size={18} className="text-slate-300" />
    </div>
  </Link>
);

import { useDashboardStats } from '../hooks/useDashboardStats';
import { useQuery } from '@tanstack/react-query';
import { MerchantAIPredictions } from '../components/business/MerchantAIPredictions';
import { ErrorBoundary } from '../components/ErrorBoundary';
const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeVenueId, setActiveVenueId] = useState(getUserVenueId(user));
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d'>('7d');

  // Listado de sedes para el selector (si tiene múltiples)
  const { data: myVenues } = useQuery({
    queryKey: ['myVenues', user?.venueIds],
    queryFn: () => dataService.getVenuesByIds(user?.venueIds || []),
    enabled: !!user?.venueIds?.length && user.venueIds.length > 1
  });

  const venueId = activeVenueId;

  // Estadísticas en vivo (totales, top products)
  const { data: stats } = useDashboardStats(venueId);

  // Gráfica de tendencia real — usa getDailyRevenueTrends con el período seleccionado
  const { data: chartData = [], isLoading: isChartLoading } = useQuery({
    queryKey: ['dashboardChart', venueId, chartPeriod],
    queryFn: async () => {
      if (!venueId) return [];
      const days = chartPeriod === '7d' ? 7 : 30;
      const now = new Date();
      const trends = await getDailyRevenueTrends(venueId, {
        start: startOfDay(subDays(now, days - 1)),
        end: endOfDay(now),
      });
      return trends.map(d => ({
        name: format(new Date(d.date), chartPeriod === '7d' ? 'EEE' : 'd/M', { locale: es }),
        sales: d.revenue,
        waste: Math.round(d.orders * 0.5),
      }));
    },
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
  });

  // Métricas brutas desde stats (en vivo) con fallback a 0
  const displayMetrics: AnalyticsData = {
    revenue: stats?.totalRevenue ?? 0,
    wasteSavedKg: stats ? Math.round((stats.totalOrders || 0) * 0.5) : 0,
    mealsSaved: stats?.totalOrders ?? 0,
    chartData: [],
  };

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {t('dashboard_greeting', { name: user?.fullName?.split(' ')[0] })} 👋
          </h1>
          <p className="text-slate-500 font-medium mt-1 capitalize">{today}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {user?.venueIds && user.venueIds.length > 1 && (
            <select 
              value={activeVenueId}
              onChange={(e) => setActiveVenueId(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none block p-2.5 shadow-sm transition-all"
            >
              {myVenues?.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}
          <div className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Rescatto Partner <span className="text-amber-500">Oro</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {user?.role !== UserRole.KITCHEN_STAFF && (
          <>
            <MetricCard
              title={t('dashboard_revenue')}
              value={formatCOP(displayMetrics.revenue)}
              icon={<DollarSign size={24} className="text-blue-600" />}
              color="bg-blue-500"
            />
            <MetricCard
              title={t('dashboard_orders')}
              value={formatCOP(stats?.venueEarnings ?? displayMetrics.revenue * 0.9)}
              icon={<DollarSign size={24} className="text-emerald-600" />}
              color="bg-emerald-500"
            />
          </>
        )}
        <MetricCard
          title={t('dashboard_food_saved')}
          value={`${displayMetrics.wasteSavedKg} kg`}
          icon={<Leaf size={24} className="text-emerald-600" />}
          color="bg-emerald-500"
        />
        <MetricCard
          title={t('dashboard_food_saved')}
          value={`${displayMetrics.mealsSaved}`}
          icon={<TrendingUp size={24} className="text-purple-600" />}
          color="bg-purple-500"
        />
        {user?.role === UserRole.KITCHEN_STAFF && (
          <MetricCard
            title="Tu Impacto de Hoy"
            value="¡Buen trabajo!"
            icon={<TrendingUp size={24} className="text-orange-600" />}
            color="bg-orange-500"
          />
        )}
      </div>

      {user?.role !== UserRole.KITCHEN_STAFF && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* [NUEVO] IA Predictiva - Capa 13 */}
            {venueId && (
              <ErrorBoundary>
                <MerchantAIPredictions venue={{ id: venueId, ...(stats as any) } as any} />
              </ErrorBoundary>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800">{t('dashboard_revenue_trend')}</h2>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as '7d' | '30d')}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none block p-2 transition-all duration-200 cursor-pointer"
              >
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Este mes</option>
              </select>
            </div>
            <div className="h-72 w-full">
              {isChartLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorWaste" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" name="Recuperación ($)" />
                    <Area type="monotone" dataKey="waste" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorWaste)" name="Desperdicio (kg)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <BarChartIcon size={48} className="mb-2 opacity-50" />
                  <p className="text-sm">{t('dashboard_no_data')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

          <div className="space-y-6">
            {/* Top Products AI Insights */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl overflow-hidden relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl"></div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-emerald-400">✨</span> {t('dashboard_quick_actions')}
              </h2>
              <div className="space-y-4">
                {stats?.topProducts && stats.topProducts.length > 0 ? (
                  stats.topProducts.map((p, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                      <span className="text-sm font-medium text-slate-300">{p.name}</span>
                      <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black px-2 py-0.5 rounded-full">
                        {p.count} vendidos
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No hay datos de ventas recientes.</p>
                )}
              </div>
              <button
                onClick={() => navigate('/analytics')}
                className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all active:scale-[0.98]"
              >
                VER ANÁLISIS COMPLETO →
              </button>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800 mb-2">{t('dashboard_quick_actions')}</h2>
              <ActionCard
                to="/products"
                title={t('dashboard_add_product')}
                subtitle={t('dashboard_add_product_sub')}
                icon={<Plus size={24} className="text-emerald-600" />}
                color="bg-emerald-500"
              />
              <ActionCard
                to="/order-management"
                title={t('dashboard_manage_orders')}
                subtitle={`${stats?.ordersByStatus?.['PAID'] || 0} pendientes`}
                icon={<ClipboardList size={24} className="text-blue-600" />}
                color="bg-blue-500"
              />
              <ActionCard
                to="/settings"
                title={t('dashboard_config')}
                subtitle={t('dashboard_config_sub')}
                icon={<SettingsIcon size={24} className="text-purple-600" />}
                color="bg-purple-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;