import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Leaf, DollarSign, Plus, ClipboardList, Settings as SettingsIcon, ArrowUpRight, ArrowDownRight, BarChart as BarChartIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { AnalyticsData, UserRole } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { logger } from '../utils/logger';
import { formatCOP } from '../utils/formatters';

const MetricCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; trend?: string }> = ({ title, value, icon, color, trend }) => (
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
          {trend} vs mes anterior
        </div>
      )}
    </div>
    <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full ${color} opacity-5 group-hover:scale-150 transition-transform duration-500 ease-out`}></div>
  </div>
);

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

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AnalyticsData>({
    revenue: 0,
    wasteSavedKg: 0,
    mealsSaved: 0,
    chartData: []
  });

  useEffect(() => {
    // Soporta tanto venueId (legacy) como venueIds (post-migración)
    const venueId = user?.venueIds?.[0] ?? user?.venueId;
    if (venueId) {
      dataService.getAnalytics(venueId)
        .then(setMetrics)
        .catch(err => logger.error(err));
    }
  }, [user?.venueId, JSON.stringify(user?.venueIds)]);

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Hola, <span className="text-emerald-600">{user?.fullName?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-slate-500 font-medium mt-1 capitalize">{today}</p>
        </div>
        <div className="px-5 py-2 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-sm font-semibold text-slate-700">Rescatto Partner <span className="text-amber-500">Oro</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {user?.role !== UserRole.KITCHEN_STAFF && (
          <MetricCard
            title="Ingresos Recuperados"
            value={formatCOP(metrics.revenue)}
            icon={<DollarSign size={24} className="text-blue-600" />}
            color="bg-blue-500"
            trend="+12%"
          />
        )}
        <MetricCard
          title="Comida Salvada"
          value={`${metrics.wasteSavedKg} kg`}
          icon={<Leaf size={24} className="text-emerald-600" />}
          color="bg-emerald-500"
          trend="+5%"
        />
        <MetricCard
          title="Platos Rescatados"
          value={`${metrics.mealsSaved}`}
          icon={<TrendingUp size={24} className="text-purple-600" />}
          color="bg-purple-500"
          trend="+8%"
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
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800">Tendencia de Impacto</h2>
              <select className="bg-slate-50 border border-slate-200 text-slate-600 text-base rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none block p-2 transition-all duration-200 cursor-pointer">
                <option>Últimos 7 días</option>
                <option>Este mes</option>
              </select>
            </div>
            <div className="h-72 w-full">
              {metrics.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.chartData}>
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
                  <p>Sin datos suficientes aún</p>
                </div>
              )}         </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Acciones Rápidas</h2>
            <ActionCard
              to="/products"
              title="Nuevo Producto"
              subtitle="Publicar oferta flash"
              icon={<Plus size={24} className="text-emerald-600" />}
              color="bg-emerald-500"
            />
            <ActionCard
              to="/order-management"
              title="Gestionar Pedidos"
              subtitle="4 pendientes"
              icon={<ClipboardList size={24} className="text-blue-600" />}
              color="bg-blue-500"
            />
            <ActionCard
              to="/settings"
              title="Configuración"
              subtitle="Perfil y horarios"
              icon={<SettingsIcon size={24} className="text-purple-600" />}
              color="bg-purple-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;