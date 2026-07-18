import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Transaction, TransactionStatus, TransactionType, DeliveryMethod } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { ArrowLeft, Package, Truck, Download, Calendar, MapPin, Clock, CreditCard, AlertTriangle, Ban, ShoppingCart, MessageSquare, Star, RefreshCw } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { logger } from '../../utils/logger';
import { GuestConversionBanner } from '../../components/customer/common/GuestConversionBanner';
import { formatCOP } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import { SEO } from '../../components/common/SEO';

const PAGE_SIZE = 20;

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  [TransactionStatus.PENDING]: { label: 'Pendiente', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: <Clock size={14} /> },
  [TransactionStatus.CONFIRMED]: { label: 'Confirmado', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <Package size={14} /> },
  [TransactionStatus.IN_PROGRESS]: { label: 'En Progreso', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: <RefreshCw size={14} /> },
  [TransactionStatus.READY]: { label: 'Listo', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <Package size={14} /> },
  [TransactionStatus.IN_TRANSIT]: { label: 'En Camino', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <Truck size={14} /> },
  [TransactionStatus.COMPLETED]: { label: 'Completado', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <Star size={14} /> },
  [TransactionStatus.CANCELLED]: { label: 'Cancelado', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <Ban size={14} /> },
  [TransactionStatus.DISPUTED]: { label: 'Disputado', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <AlertTriangle size={14} /> },
};

const DELIVERY_ICONS: Record<DeliveryMethod, React.ReactNode> = {
  [DeliveryMethod.PICKUP]: <MapPin size={14} />,
  [DeliveryMethod.SHIPPING]: <Truck size={14} />,
  [DeliveryMethod.DIGITAL]: <Download size={14} />,
  [DeliveryMethod.IN_PERSON]: <Calendar size={14} />,
};

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  [DeliveryMethod.PICKUP]: 'Recogida',
  [DeliveryMethod.SHIPPING]: 'Envío',
  [DeliveryMethod.DIGITAL]: 'Digital',
  [DeliveryMethod.IN_PERSON]: 'Presencial',
};

const TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.PURCHASE]: 'Compra',
  [TransactionType.BOOKING]: 'Reserva',
  [TransactionType.DIGITAL]: 'Digital',
};

// ─── Component ───────────────────────────────────────────────────────────────

export const MyTransactions: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightParam = searchParams.get('highlight');

  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Scroll to highlighted transaction
  useEffect(() => {
    if (!highlightParam || loading || transactions.length === 0) return;
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightParam, loading, transactions.length]);

  // Load transactions
  useEffect(() => {
    if (!user) return;
    loadTransactions(true);
  }, [user?.id]);

  const loadTransactions = async (initial = false) => {
    if (!user) return;
    if (initial) {
      setLoading(true);
      setTransactions([]);
      setLastDoc(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const constraints: any[] = [
        where('buyerId', '==', user.id),
        orderBy('createdAt', 'desc'),
      ];
      if (!initial && lastDoc) constraints.push(startAfter(lastDoc));

      const q = query(collection(db, 'transactions'), ...constraints, limit(PAGE_SIZE));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      if (initial) {
        setTransactions(docs);
      } else {
        setTransactions(prev => [...prev, ...docs]);
      }
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      logger.error('MyTransactions: load failed', err);
      if (initial) setTransactions([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleCancel = async (transactionId: string) => {
    try {
      const { transactionService } = await import('../../services/transactionService');
      await transactionService.cancelByBuyer(transactionId);
      setTransactions(prev =>
        prev.map(tx => tx.id === transactionId ? { ...tx, status: TransactionStatus.CANCELLED } : tx)
      );
      success('Transacción cancelada');
    } catch (err) {
      logger.error('Cancel transaction failed:', err);
      showError('No se pudo cancelar la transacción');
    }
  };

  if (!user) {
    return <GuestConversionBanner />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg p-6 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="pb-nav bg-brand-bg min-h-screen">
      <SEO title={t('mytransactions_seo_title')} description={t('mytransactions_seo_desc')} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4 pt-safe-top">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">{t('mytransactions_title')}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
            <ShoppingCart size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="font-bold text-gray-600 mb-2">{t('mytransactions_empty_title')}</p>
            <p className="text-sm text-gray-400 mb-6">{t('mytransactions_empty_desc')}</p>
            <button
              onClick={() => navigate('/app/explore')}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
            >
              {t('mytransactions_explore_btn')}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {transactions.map(tx => {
                const statusCfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG[TransactionStatus.PENDING];
                const isHighlighted = highlightParam === tx.id;

                return (
                  <div
                    key={tx.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                      isHighlighted ? 'ring-2 ring-emerald-400 ring-offset-2' : 'border-gray-100'
                    }`}
                  >
                    {/* Top bar */}
                    <div className="px-5 py-3 flex items-center justify-between border-b border-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                          {TYPE_LABELS[tx.transactionType] || 'Transacción'}
                        </span>
                        <span className="text-gray-200">·</span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(tx.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="px-5 py-3 space-y-2">
                      {tx.lineItems.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-gray-700 font-medium">
                            {item.quantity}x {item.title}
                          </span>
                          <span className="font-bold text-gray-900">
                            {formatCOP(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Bottom bar */}
                    <div className="px-5 py-3 bg-gray-50/50 flex items-center justify-between border-t border-gray-100">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          {DELIVERY_ICONS[tx.deliveryMethod]}
                          {DELIVERY_LABELS[tx.deliveryMethod]}
                        </span>
                        {tx.trackingNumber && (
                          <span className="flex items-center gap-1 text-emerald-600 font-bold">
                            <Package size={12} />
                            {tx.trackingNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-gray-900">
                          {formatCOP(tx.totalAmount)}
                        </span>
                        {tx.status === TransactionStatus.PENDING && (
                          <button
                            onClick={() => handleCancel(tx.id)}
                            className="text-[11px] font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            {t('mytransactions_cancel_btn')}
                          </button>
                        )}
                        {tx.status === TransactionStatus.COMPLETED && tx.downloadUrl && (
                          <button
                            onClick={() => window.open(tx.downloadUrl, '_blank')}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-1"
                          >
                            <Download size={12} />
                            {t('mytransactions_download_btn')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => loadTransactions(false)}
                  disabled={loadingMore}
                  className="bg-white border border-gray-200 text-gray-700 font-bold px-8 py-3 rounded-full hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? t('mytransactions_loading') : t('mytransactions_load_more')}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default MyTransactions;