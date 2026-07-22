/**
 * Wompi Payment Service — Proxy vía Cloud Function
 * 
 * La firma de integridad de Wompi se genera en el backend (generateWompiSignature)
 * con el WOMPI_INTEGRITY_SECRET que solo conoce el servidor.
 * 
 * El frontend NUNCA calcula montos ni genera firmas.
 * En desarrollo, si el backend no está disponible, se lanza error en vez de
 * devolver firmas mock (eso permitiría firmas falsas en pruebas).
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { logger } from '../utils/logger';

interface WompiSignatureResponse {
    signature: string;
    reference: string;
    amountInCents: number;
    currency: string;
    publicKey: string;
}

const WOMPI_PUBLIC_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY;
const generateSignature = httpsCallable<{ reference: string; amount: number; currency: string }, WompiSignatureResponse>(functions, 'generateWompiSignature');

/**
 * Fetch Wompi Integrity Signature from Backend
 * Nunca devuelve firmas mock — si el backend no responde, lanza error.
 */
export const getWompiSignature = async (reference: string, amount: number, currency: string = 'COP'): Promise<WompiSignatureResponse> => {
    try {
        const result = await generateSignature({ reference, amount, currency });
        return { ...result.data, publicKey: result.data.publicKey || WOMPI_PUBLIC_KEY || 'pub_test_PLACEHOLDER' };
    } catch (error: any) {
        logger.error('Wompi Signature API Error:', error);

        if (import.meta.env.DEV) {
            // En desarrollo, mostrar un error claro en vez de devolver firma mock
            throw new Error(
                'El backend de pagos no está disponible. Asegúrate de que los emuladores de Firebase Functions estén corriendo.\n' +
                'Ejecuta: firebase emulators:start --only functions'
            );
        }

        throw new Error('No se pudo obtener la firma de pago. Intenta de nuevo más tarde.');
    }
};
