import { logger } from '../utils/logger';
// Wompi Payment Service

interface WompiSignatureResponse {
    signature: string;
    reference: string;
    amountInCents: number;
    currency: string;
    publicKey: string;
}

/**
 * Fetch Wompi Integrity Signature from Backend
 */
export const getWompiSignature = async (reference: string, amount: number, currency: string = 'COP'): Promise<WompiSignatureResponse> => {
    // VITE_API_URL must be set in production. Falls back to local emulator in dev only.
    const apiUrl = import.meta.env.VITE_API_URL
        ?? (import.meta.env.DEV ? 'http://127.0.0.1:5001/rescatto-business-dashboard/us-central1' : null);

    if (!apiUrl) {
        throw new Error('VITE_API_URL no está configurada. Revisar variables de entorno en producción.');
    }

    try {
        const response = await fetch(`${apiUrl}/generateWompiSignature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference, amount, currency }),
        });

        if (!response.ok) {
            if (import.meta.env.DEV) {
                logger.warn('⚠️ Backend not found. Returning MOCK signature.');
                return {
                    signature: "mock_signature_" + Date.now(),
                    reference,
                    amountInCents: Math.round(amount * 100),
                    currency,
                    publicKey: import.meta.env.VITE_WOMPI_PUBLIC_KEY || "pub_test_PLACEHOLDER"
                };
            }
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        return data as WompiSignatureResponse;

    } catch (error: any) {
        logger.error('Wompi Signature API Error:', error);
        throw error;
    }
};
