import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { walletService, VenueWallet, WalletTransaction } from '../../services/walletService';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { DollarSign, ArrowUpRight, ArrowDownLeft, AlertCircle, Mail, Info } from 'lucide-react';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';

export const VenueFinance: React.FC = () => {
    const { user } = useAuth();
    const [wallet, setWallet] = useState<VenueWallet | null>(null);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFinanceData = async () => {
            if (!user?.venueId) return;
            try {
                setLoading(true);
                const [walletData, txData] = await Promise.all([
                    walletService.getWalletBalance(user.venueId),
                    walletService.getTransactions(user.venueId)
                ]);
                setWallet(walletData);
                setTransactions(txData);
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
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-amber-50 p-4 rounded-full text-amber-500">
                    <AlertCircle size={48} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Acceso a Billetera de Negocio</h3>
                <p className="text-gray-500 max-w-md"> Esta sección está destinada a la gestión financiera de una sucursal específica.</p>
                {user?.role === UserRole.SUPER_ADMIN ? (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mt-4">
                        <p className="text-emerald-800 text-sm font-medium">Como Super Admin, puedes ver la visión global de la plataforma en:</p>
                        <button
                            onClick={() => window.location.href = '/#/admin/finance'}
                            className="mt-2 text-emerald-600 font-bold hover:underline"
                        >
                            Ir a Finanzas Globales
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-gray-400">Ponte en contacto con soporte si crees que esto es un error.</p>
                )}
            </div>
        );
    }

    if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;

    const balance = wallet?.balance || 0;
    const isDebt = balance < 0;

    return (
        <div className="p-6 max-w-6xl mx-auto overflow-x-hidden">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Billetera del Negocio</h1>

            {/* Balance Card */}
            <div className={`p-6 rounded-2xl shadow-lg mb-8 text-white flex flex-col md:flex-row justify-between items-center ${isDebt ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}>
                <div>
                    <h2 className="text-lg font-medium opacity-90 mb-1">Saldo Actual</h2>
                    <div className="text-4xl font-bold flex items-center gap-2">
                        <DollarSign size={32} />
                        {formatCOP(Math.abs(balance))}
                    </div>
                    <p className="mt-2 opacity-80 flex items-center gap-2">
                        {isDebt
                            ? <><AlertCircle size={16} /> Debes comisiones a la plataforma</>
                            : "Ganancias disponibles"
                        }
                    </p>
                </div>

                {isDebt && (
                    <div className="mt-4 md:mt-0 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-4 max-w-sm">
                        <div className="flex items-start gap-2 mb-2">
                            <Info size={16} className="text-white shrink-0 mt-0.5" />
                            <p className="text-white text-sm font-medium">¿Cómo pagar tu deuda?</p>
                        </div>
                        <p className="text-white/80 text-xs leading-relaxed mb-3">
                            El pago de comisiones se realiza manualmente. Contacta a soporte para coordinar tu liquidación.
                        </p>
                        <a
                            href="mailto:soporte@rescatto.com?subject=Solicitud%20de%20liquidaci%C3%B3n%20de%20comisiones"
                            className="flex items-center gap-2 bg-white text-rose-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-rose-50 transition-colors w-full justify-center"
                        >
                            <Mail size={15} />
                            Contactar Soporte
                        </a>
                    </div>
                )}
            </div>

            {/* Transactions History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="font-bold text-lg text-gray-800">Historial de Transacciones</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-sm font-medium">
                            <tr>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Descripción</th>
                                <th className="p-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">
                                        No hay movimientos aún.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm text-gray-600">
                                            {new Date(tx.createdAt).toLocaleDateString()} <span className="text-xs opacity-70">{new Date(tx.createdAt).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {tx.type === 'CREDIT' ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                {tx.type === 'CREDIT' ? 'Ingreso' : 'Egreso'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-700">{tx.description}</td>
                                        <td className={`p-4 text-right font-bold ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {tx.type === 'CREDIT' ? '+' : '-'}{formatCOP(tx.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
