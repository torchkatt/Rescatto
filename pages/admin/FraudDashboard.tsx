import React, { useState, useCallback, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { adminService } from '../../services/adminService';
import {
    ScanSearch, AlertTriangle, ShieldCheck, ShieldOff,
    RefreshCw, CheckCircle, Clock, ChevronDown
} from 'lucide-react';

interface FraudMetric {
    id: string;
    userId: string;
    orderId: string;
    score: number;
    reasons: string[];
    ordersLastHour: number;
    ordersLastDay: number;
    isFlagged: boolean;
    isBlocked: boolean;
    orderAmount: number;
    venueId: string;
    evaluatedAt: any;
    resolvedAt?: any;
    resolvedBy?: string;
    resolution?: string;
}

const SCORE_COLORS: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
};

function scoreLevel(score: number) {
    if (score >= 90) return { label: 'Crítico', color: SCORE_COLORS.critical };
    if (score >= 60) return { label: 'Alto', color: SCORE_COLORS.high };
    if (score >= 30) return { label: 'Medio', color: SCORE_COLORS.medium };
    return { label: 'Bajo', color: SCORE_COLORS.low };
}

export const FraudDashboard: React.FC = () => {
    const { user } = useAuth();
    const { success, error: toastError } = useToast();
    const confirm = useConfirm();
    const [flaggedOnly, setFlaggedOnly] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);

    const buildQuery = useCallback((extra: any[]) =>
        query(
            collection(db, 'fraud_metrics'),
            ...(flaggedOnly ? [where('isFlagged', '==', true)] : []),
            orderBy('score', 'desc'),
            ...extra
        ),
        [flaggedOnly]
    );

    // Memoizar opciones para evitar re-renders infinitos en usePaginatedQuery
    const queryOptions = useMemo(() => ({
        pageSize: 30,
        transform: (doc: any) => ({ id: doc.id, ...doc.data() } as FraudMetric)
    }), []);

    const { data: metrics, loading, loadingMore, hasMore, loadMore, refresh } = usePaginatedQuery<FraudMetric>(
        buildQuery,
        queryOptions
    );

    const handleResolve = async (metric: FraudMetric) => {
        const confirmed = await confirm({
            title: 'Resolver Flag de Fraude',
            message: `Marcar como revisada la orden ${metric.orderId.slice(-6).toUpperCase()} (score: ${metric.score})?`,
            confirmLabel: 'Resolver',
            variant: 'warning',
        });
        if (!confirmed) return;

        setResolving(metric.id);
        try {
            const resolveFn = httpsCallable(functions, 'resolveFraudFlag');
            await resolveFn({ metricId: metric.id, resolution: 'reviewed_by_admin' });
            success('Flag resuelto.');
            refresh();
        } catch {
            toastError('Error al resolver el flag.');
        } finally {
            setResolving(null);
        }
    };

    const unresolvedCount = metrics.filter(m => !m.resolvedAt).length;
    const blockedCount = metrics.filter(m => m.isBlocked).length;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-100 rounded-xl">
                        <ScanSearch className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Antifraude</h1>
                        <p className="text-sm text-gray-500">Detección y revisión de órdenes sospechosas</p>
                    </div>
                </div>
                <button
                    onClick={refresh}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Actualizar
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard icon={<AlertTriangle className="w-5 h-5 text-orange-500" />} label="Flaggeados" value={unresolvedCount} color="bg-orange-50" />
                <StatCard icon={<ShieldOff className="w-5 h-5 text-red-500" />} label="Bloqueados" value={blockedCount} color="bg-red-50" />
                <StatCard icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />} label="Total revisados" value={metrics.filter(m => m.resolvedAt).length} color="bg-emerald-50" />
                <StatCard icon={<Clock className="w-5 h-5 text-blue-500" />} label="Total cargados" value={metrics.length} color="bg-blue-50" />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setFlaggedOnly(true)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${flaggedOnly ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                    Solo flaggeados
                </button>
                <button
                    onClick={() => setFlaggedOnly(false)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${!flaggedOnly ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                    Todos
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando...
                    </div>
                ) : metrics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <ShieldCheck className="w-10 h-10 mb-3 text-emerald-400" />
                        <p className="font-medium">Sin flags de fraude activos</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left">Orden</th>
                                        <th className="px-4 py-3 text-left">Score</th>
                                        <th className="px-4 py-3 text-left">Razones</th>
                                        <th className="px-4 py-3 text-right">Monto</th>
                                        <th className="px-4 py-3 text-center">Estado</th>
                                        <th className="px-4 py-3 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {metrics.map(m => {
                                        const level = scoreLevel(m.score);
                                        const isResolved = !!m.resolvedAt;
                                        return (
                                            <tr key={m.id} className={`hover:bg-gray-50/50 transition-colors ${isResolved ? 'opacity-50' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <div className="font-mono font-bold text-gray-800">#{m.orderId.slice(-6).toUpperCase()}</div>
                                                    <div className="text-xs text-gray-400 truncate max-w-[120px]">{m.userId}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${level.color}`}>
                                                        {m.score} — {level.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 max-w-xs">
                                                    <ul className="text-xs text-gray-600 space-y-0.5">
                                                        {m.reasons.map((r, i) => (
                                                            <li key={i} className="flex items-start gap-1">
                                                                <span className="text-orange-400 mt-0.5">•</span> {r}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-700">
                                                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(m.orderAmount)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {isResolved ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Resuelto
                                                        </span>
                                                    ) : m.isBlocked ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                                            <ShieldOff className="w-3 h-3" /> Bloqueado
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                                            <AlertTriangle className="w-3 h-3" /> Flag
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {!isResolved && (
                                                        <button
                                                            onClick={() => handleResolve(m)}
                                                            disabled={resolving === m.id}
                                                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                                                        >
                                                            {resolving === m.id ? '...' : 'Resolver'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {hasMore && (
                            <div className="px-4 py-3 border-t border-gray-50 text-center">
                                <button
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className="flex items-center gap-2 mx-auto px-5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                    {loadingMore ? 'Cargando...' : 'Cargar más'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string }> = ({ icon, label, value, color }) => (
    <div className={`${color} rounded-2xl p-4 flex items-center gap-3`}>
        <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
        <div>
            <div className="text-2xl font-bold text-gray-800">{value}</div>
            <div className="text-xs text-gray-500 font-medium">{label}</div>
        </div>
    </div>
);
