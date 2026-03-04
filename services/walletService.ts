import { db } from './firebase';
import { collection, doc, runTransaction, addDoc, getDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { logger } from '../utils/logger';

export interface WalletTransaction {
    id?: string;
    venueId: string;
    orderId?: string;
    type: 'CREDIT' | 'DEBIT'; // CREDIT: Dinero añadido a billetera (Ganancias), DEBIT: Dinero deducido (Deuda/Pago)
    amount: number;
    description: string;
    createdAt: string;
    referenceType: 'ORDER_ONLINE' | 'ORDER_CASH' | 'PAYOUT' | 'DEBT_PAYMENT';
}

export interface VenueWallet {
    venueId: string;
    balance: number; // Positivo = Plataforma debe a la Sede. Negativo = Sede debe a la Plataforma.
    updatedAt: string;
}

export const walletService = {
    /**
     * @deprecated ADVERTENCIA DE SEGURIDAD: NO USAR DESDE CÓDIGO CLIENTE
     * 
     * Esta función permite la manipulación directa del saldo de billetera desde el cliente,
     * lo cual es una vulnerabilidad de seguridad crítica. Usa la Cloud Function 
     * `createOrder` en su lugar, la cual maneja transacciones de billetera de forma segura.
     * 
     * Esta función se mantiene solo como referencia y será eliminada en v2.0.
     * 
     * @throws {Error} Siempre lanza error para prevenir uso
     */
    processTransaction: async (venueId: string, amount: number, type: 'CREDIT' | 'DEBIT', referenceType: WalletTransaction['referenceType'], orderId?: string, description?: string) => {
        throw new Error(
            'OBSOLETO: walletService.processTransaction es inseguro para uso en cliente. ' +
            'Usa la Cloud Function createOrder en su lugar. ' +
            'Esta función solo es segura cuando se llama desde Cloud Functions del lado del servidor.'
        );

        // Implementación original mantenida abajo solo como referencia - CÓDIGO INALCANZABLE
        /* 
        try {
            await runTransaction(db, async (transaction) => {
                const walletRef = doc(db, 'wallets', venueId);
                const walletDoc = await transaction.get(walletRef);

                let currentBalance = 0;
                if (walletDoc.exists()) {
                    currentBalance = walletDoc.data().balance;
                }

                const adjustment = type === 'CREDIT' ? amount : -amount;
                const newBalance = currentBalance + adjustment;

                transaction.set(walletRef, {
                    venueId,
                    balance: newBalance,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                const transactionRef = doc(collection(db, 'wallet_transactions'));
                transaction.set(transactionRef, {
                    venueId,
                    orderId,
                    type,
                    amount,
                    description: description || '',
                    referenceType,
                    createdAt: new Date().toISOString()
                });
            });
            return { success: true };
        } catch (error) {
            logger.error("Error procesando transacción de billetera:", error);
            throw error;
        }
        */
    },

    /**
     * Obtiene el saldo actual de la billetera para una sede.
     */
    getWalletBalance: async (venueId: string): Promise<VenueWallet | null> => {
        const walletRef = doc(db, 'wallets', venueId);
        const walletDoc = await getDoc(walletRef);
        if (walletDoc.exists()) {
            return walletDoc.data() as VenueWallet;
        }
        return { venueId, balance: 0, updatedAt: new Date().toISOString() };
    },

    /**
     * Obtiene el historial de transacciones para una sede.
     */
    getTransactions: async (venueId: string) => {
        const q = query(
            collection(db, 'wallet_transactions'),
            where('venueId', '==', venueId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WalletTransaction[];
    }
};
