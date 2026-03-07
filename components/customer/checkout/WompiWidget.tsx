import React, { useEffect, useRef } from 'react';
import { logger } from '../../../utils/logger';

interface WompiWidgetProps {
    currency: string;
    amountInCents: number;
    reference: string;
    publicKey: string;
    signature: string; // Integrity signature
    redirectUrl?: string; // Where to redirect after payment
    email?: string; // Pre-fill email
    fullName?: string;
    phoneNumber?: string;
    onSuccess?: (transaction: any) => void;
}

declare global {
    interface Window {
        WidgetCheckout: any;
    }
}

export const WompiWidget: React.FC<WompiWidgetProps> = ({
    currency,
    amountInCents,
    reference,
    publicKey,
    signature,
    redirectUrl,
    email,
    fullName,
    phoneNumber,
    onSuccess,
}) => {
    const scriptLoaded = useRef(false);

    useEffect(() => {
        // Load Wompi script if not already loaded
        if (!document.getElementById('wompi-script')) {
            const script = document.createElement('script');
            script.src = 'https://checkout.wompi.co/widget.js';
            script.id = 'wompi-script';
            script.async = true;
            document.body.appendChild(script);
        }
        scriptLoaded.current = true;
    }, []);

    const handlePayment = () => {
        const checkout = new window.WidgetCheckout({
            currency: currency,
            amountInCents: amountInCents,
            reference: reference,
            publicKey: publicKey,
            signature: { integrity: signature },
            redirectUrl: redirectUrl, // Optional: Redirect after payment
            customerData: {
                email: email,
                fullName: fullName,
                phoneNumber: phoneNumber,
                phoneNumberPrefix: '+57',
                legalId: '', // Optional
                legalIdType: 'CC' // Optional
            }
        });

        checkout.open((result: any) => {
            const transaction = result.transaction;
            logger.log('Transaction result:', transaction);
            // Handle valid response here if not using redirectUrl
            if (transaction.status === 'APPROVED') {
                onSuccess?.(transaction);
            }
        });
    };

    return (
        <button
            onClick={handlePayment}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
        >
            <img src="https://cdn.wompi.co/assets/wompi_logo_white.png" alt="Wompi" className="h-6" />
            Pagar con Wompi (Nequi, PSE, Tarjetas)
        </button>
    );
};
