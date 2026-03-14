import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { walletService, VenueWallet, WalletTransaction } from '../../services/walletService';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { DollarSign, ArrowUpRight, ArrowDownLeft, AlertCircle, Mail, Info } from 'lucide-react';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';
import { adminService } from '../../services/adminService';
import { reportService } from '../../services/reportService';
import { venueService } from '../../services/venueService';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export const VenueFinance: React.FC = () => {
    const { user } = useAuth();
    const [wallet, setWallet] = useState<VenueWallet | null>(null);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastTxDoc, setLastTxDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [generatingReport, setGeneratingReport] = useState(false);
    const [selectedDate, setSelectedDate] = useState({ 
        month: new Date().getMonth(), 
        year: new Date().getFullYear() 
    });

    useEffect(() => {
        const fetchFinanceData = async () => {
            if (!user?.venueId) return;
            try {
                setLoading(true);
                const [walletData, txPage] = await Promise.all([
                    walletService.getWalletBalance(user.venueId),
                    walletService.getTransactionsPage(user.venueId, null, 20)
                ]);
                setWallet(walletData);
                setTransactions(txPage.data);
                setLastTxDoc(txPage.lastDoc);
                setHasMore(txPage.hasMore);
            } catch (error) {
                logger.error("Error fetching finance data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFinanceData();
    }, [user?.venueId]);

    if (!user?.venueId) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 bg-white rounded-3xl shadow-sm border border-gray-100">
                <div className="bg-amber-50 p-6 rounded-3xl text-amber-500 animate-pulse">
                    <AlertCircle size={64} />
                </div>
                <h3 className="text-2xl font-black text-slate-800">Acceso a Billetera</h3>
                <p className="text-slate-500 max-w-md">Esta sección está destinada a la gestión financiera de una sucursal específica. Por favor, selecciona una sede válida.</p>
                {user?.role === UserRole.SUPER_ADMIN && (
                    <button
                        onClick={() => window.location.href = '/#/admin/finance'}
                        className="px-6 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Ver Finanzas Globales
                    </button>
                )}
            </div>
        );
    }

    if (loading) return <div className="flex justify-center p-24"><LoadingSpinner size="lg" /></div>;

    const loadMoreTransactions = async () => {
        if (!user?.venueId || !hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const next = await walletService.getTransactionsPage(user.venueId, lastTxDoc, 20);
            setTransactions(prev => [...prev, ...next.data]);
            setLastTxDoc(next.lastDoc);
            setHasMore(next.hasMore);
        } catch (error) {
            logger.error('Error loading more transactions', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const balance = wallet?.balance || 0;
    const isDebt = balance < 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Estado Financiero</h1>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2">
                        <select 
                            value={selectedDate.month}
                            onChange={(e) => setSelectedDate(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                            className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none cursor-pointer"
                        >
                            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <select 
                            value={selectedDate.year}
                            onChange={(e) => setSelectedDate(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                            className="bg-transparent text-sm font-bold text-slate-600 focus:outline-none cursor-pointer border-l border-slate-100 pl-2"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={async () => {
                            if (!user?.venueId) return;
                            setGeneratingReport(true);
                            try {
                                const venue = await venueService.getVenueById(user.venueId);
                                const reportData = await adminService.getVenueFinancialReportData(
                                    user.venueId, 
                                    selectedDate.month, 
                                    selectedDate.year
                                );
                                reportService.generateVenueFinancialPDF(reportData, venue?.name || 'Sede');
                            } catch (e) {
                                logger.error("Error generating PDF", e);
                            } finally {
                                setGeneratingReport(false);
                            }
                        }}
                        disabled={generatingReport}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    >
                        {generatingReport ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <ArrowUpRight size={16} />
                        )}
                        Generar Reporte
                    </button>
                </div>
            </div>

            {/* Premium Balance Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`lg:col-span-2 relative overflow-hidden p-8 rounded-[2.5rem] shadow-2xl transition-all ${isDebt ? 'bg-slate-900' : 'bg-emerald-600'}`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <p className="text-white/70 text-sm font-black uppercase tracking-widest mb-2">Saldo Disponible para Liquidar</p>
                            <div className="text-6xl font-black text-white tracking-tighter flex items-start">
                                <span className="text-3xl mt-2 mr-1 opacity-50">$</span>
                                {formatCOP(Math.abs(balance)).replace('$', '')}
                            </div>
                        </div>
                        
                        <div className="mt-12 flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                    <p className="text-[10px] text-white/60 font-black uppercase mb-1">Cortes Realizados</p>
                                    <p className="text-xl font-bold text-white">12</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                    <p className="text-[10px] text-white/60 font-black uppercase mb-1">Pendiente</p>
                                    <p className="text-xl font-bold text-white">{formatCOP(balance > 0 ? balance : 0)}</p>
                                </div>
                            </div>
                            <button className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl active:scale-95">
                                Solicitar Retiro
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
                            <Info size={24} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-4">Información de Pago</h3>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">
                            Las liquidaciones se procesan cada martes. Asegúrate de tener tu RUT actualizado en la sección de configuración.
                        </p>
                    </div>
                    <button 
                        onClick={() => window.location.href = 'mailto:finanzas@rescatto.com'}
                        className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                        <Mail size={16} /> Contactar Finanzas
                    </button>
                </div>
            </div>

            {/* Transactions Table Section */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-50 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800">Historial de Movimientos</h3>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100">Filtros</button>
                        <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100">Exportar</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <tr>
                                <th className="px-8 py-4">Fecha & Hora</th>
                                <th className="px-8 py-4">Concepto</th>
                                <th className="px-8 py-4">Estado</th>
                                <th className="px-8 py-4 text-right">Valor Bruto</th>
                                <th className="px-8 py-4 text-right">Comisión</th>
                                <th className="px-8 py-4 text-right">Total Neto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center opacity-30">
                                            <ArrowUpRight size={48} />
                                            <p className="mt-4 font-bold text-slate-900">No hay movimientos registrados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx, idx) => (
                                    <tr key={tx.id || idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-bold text-slate-800">{new Date(tx.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{new Date(tx.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-bold text-slate-800">{tx.description}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">Ref: {tx.orderId?.slice(-6) || 'N/A'}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black uppercase tracking-tighter">
                                                Completado
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right font-medium text-slate-400 text-sm">
                                            {formatCOP(tx.amount * 1.11)}
                                        </td>
                                        <td className="px-8 py-5 text-right font-medium text-slate-400 text-sm">
                                            -{formatCOP(tx.amount * 0.11)}
                                        </td>
                                        <td className={`px-8 py-5 text-right font-black text-sm ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {tx.type === 'CREDIT' ? '+' : '-'}{formatCOP(tx.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {hasMore && (
                    <div className="p-6 flex justify-center">
                        <button
                            onClick={loadMoreTransactions}
                            disabled={loadingMore}
                            className="px-4 py-2 rounded-full text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                            {loadingMore ? 'Cargando...' : 'Cargar más movimientos'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
