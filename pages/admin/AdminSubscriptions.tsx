import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, where, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { SubscriptionRequest } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import {
    CheckCircle, XCircle, Eye, Filter, Loader2
} from 'lucide-react';

type FilterStatus = 'pending_review' | 'pending_payment' | 'approved' | 'rejected' | 'all';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending_payment: { label: 'Pago pendiente', color: 'bg-gray-100 text-gray-700' },
    pending_review:  { label: 'En revisión',    color: 'bg-amber-100 text-amber-700' },
    approved:        { label: 'Aprobado',        color: 'bg-emerald-100 text-emerald-700' },
    rejected:        { label: 'Rechazado',       color: 'bg-red-100 text-red-700' },
};

export const AdminSubscriptions: React.FC = () => {
    const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
    const [filter, setFilter] = useState<FilterStatus>('pending_review');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [proofModal, setProofModal] = useState<SubscriptionRequest | null>(null);

    useEffect(() => {
        loadRequests(true);
    }, [filter]);

    const loadRequests = async (initial = false) => {
        if (initial) {
            setLoading(true);
            setRequests([]);
            setLastDoc(null);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const constraints: any[] = [orderBy('createdAt', 'desc')];
            if (filter !== 'all') constraints.unshift(where('status', '==', filter));
            if (!initial && lastDoc) constraints.push(startAfter(lastDoc));
            const q = query(collection(db, 'subscription_requests'), ...constraints, limit(20));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionRequest));
            setRequests(prev => initial ? data : [...prev, ...data]);
            setLastDoc(snap.docs[snap.docs.length - 1] || null);
            setHasMore(snap.docs.length === 20);
        } catch (err) {
            logger.error('AdminSubscriptions load error:', err);
            if (initial) setRequests([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        setActionLoading(requestId);
        try {
            const fn = httpsCallable(functions, 'approveSubscriptionRequest');
            await fn({ requestId });
        } catch (err) {
            logger.error('approveSubscriptionRequest error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        setActionLoading(rejectModal.id);
        try {
            const fn = httpsCallable(functions, 'rejectSubscriptionRequest');
            await fn({ requestId: rejectModal.id, reason: rejectReason || 'Pago no verificado.' });
            setRejectModal(null);
            setRejectReason('');
        } catch (err) {
            logger.error('rejectSubscriptionRequest error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const filterTabs: { key: FilterStatus; label: string }[] = [
        { key: 'pending_review',  label: 'En revisión' },
        { key: 'pending_payment', label: 'Pendientes' },
        { key: 'approved',        label: 'Aprobados' },
        { key: 'rejected',        label: 'Rechazados' },
        { key: 'all',             label: 'Todos' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-white">Suscripciones Rescatto Pass</h1>
                <p className="text-gray-400 text-sm mt-1">Verifica y aprueba los pagos de suscripción.</p>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
                {filterTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            filter === tab.key
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-emerald-500" />
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Filter size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="font-bold">Sin solicitudes en este estado</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => {
                        const status = STATUS_LABELS[req.status] ?? { label: req.status, color: 'bg-gray-100 text-gray-700' };
                        const isActioning = actionLoading === req.id;

                        return (
                            <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-black text-gray-900">{req.userName}</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500">{req.userEmail}</p>
                                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                                            <span>Plan: <b>{req.planId === 'monthly' ? 'Mensual' : 'Anual'}</b></span>
                                            <span>Monto: <b className="text-emerald-700">{formatCOP(req.amount)}</b></span>
                                            <span>Ref: <b className="font-mono tracking-widest">{req.referenceCode}</b></span>
                                            {req.transactionNumber && (
                                                <span>Transacción: <b>{req.transactionNumber}</b></span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-1">
                                            {new Date(req.createdAt).toLocaleString('es-CO')}
                                        </p>
                                        {req.rejectedReason && (
                                            <p className="text-xs text-red-600 mt-1">Motivo: {req.rejectedReason}</p>
                                        )}
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {req.paymentProofUrl && (
                                            <a
                                                href={req.paymentProofUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors"
                                            >
                                                <Eye size={14} /> Comprobante
                                            </a>
                                        )}

                                        {req.status === 'pending_review' && (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(req.id)}
                                                    disabled={isActioning}
                                                    className="flex items-center gap-1.5 text-xs font-black text-white bg-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors active:scale-95 disabled:opacity-60"
                                                >
                                                    {isActioning
                                                        ? <Loader2 size={14} className="animate-spin" />
                                                        : <CheckCircle size={14} />
                                                    }
                                                    Aprobar
                                                </button>
                                                <button
                                                    onClick={() => setRejectModal({ id: req.id })}
                                                    disabled={isActioning}
                                                    className="flex items-center gap-1.5 text-xs font-black text-white bg-red-500 px-4 py-2 rounded-xl hover:bg-red-600 transition-colors active:scale-95 disabled:opacity-60"
                                                >
                                                    <XCircle size={14} /> Rechazar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {hasMore && (
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={() => loadRequests(false)}
                                disabled={loadingMore}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-60"
                            >
                                {loadingMore ? 'Cargando...' : 'Cargar más'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de rechazo */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                        <h3 className="font-black text-gray-900">Motivo del rechazo</h3>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Ej: Monto incorrecto, referencia no encontrada..."
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!!actionLoading}
                                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-black hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSubscriptions;
