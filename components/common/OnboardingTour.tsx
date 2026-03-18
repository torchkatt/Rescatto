import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';

interface OnboardingTourProps {
    isBusinessOwner: boolean;
    hasSeenOnboarding?: boolean;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ isBusinessOwner, hasSeenOnboarding }) => {
    const { user } = useAuth();
    const { t } = useTranslation();

    // Si ya vio el onboarding o no es dueño, no renderizar nada
    const [run, setRun] = useState(false);

    useEffect(() => {
        if (isBusinessOwner && hasSeenOnboarding === false) {
            // Un pequeño delay para que cargue la interfaz antes del Tour
            const timer = setTimeout(() => {
                setRun(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isBusinessOwner, hasSeenOnboarding]);

    const steps: Step[] = [
        {
            target: 'body',
            placement: 'center',
            content: (
                <div className="text-center p-4">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('tour_welcome_title')}</h2>
                    <p className="text-gray-600">
                        {t('tour_welcome_desc')}
                    </p>
                </div>
            ),
            disableBeacon: true,
        },
        {
            target: '.tour-step-dashboard',
            content: t('tour_dashboard_desc'),
            placement: 'bottom',
        },
        {
            target: '.tour-step-products',
            content: t('tour_products_desc'),
            placement: 'bottom',
        },
        {
            target: '.tour-step-orders',
            content: t('tour_orders_desc'),
            placement: 'right',
        },
    ];

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            // Guardar en Firestore que el usuario completó/saltó el tour
            if (user && user.id) {
                try {
                    const userRef = doc(db, 'users', user.id);
                    await updateDoc(userRef, { hasSeenOnboarding: true });
                } catch (error) {
                    logger.error("No se pudo actualizar el estado de Onboarding:", error);
                }
            }
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous={true}
            showProgress={true}
            showSkipButton={true}
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#059669', // Emerald-600
                    zIndex: 10000,
                },
                buttonNext: {
                    borderRadius: '8px',
                    fontWeight: 600,
                },
                buttonBack: {
                    color: '#4B5563',
                },
                buttonSkip: {
                    color: '#9CA3AF',
                }
            }}
            locale={{
                back: t('tour_btn_back'),
                close: t('tour_btn_close'),
                last: t('tour_btn_last'),
                next: t('tour_btn_next'),
                skip: t('tour_btn_skip'),
            }}
        />
    );
};
