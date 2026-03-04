import React, { useState, useEffect } from 'react';
import { ChefHat, Leaf, PiggyBank, ArrowRight, X } from 'lucide-react';
import { Button } from '../common/Button';

interface OnboardingModalProps {
    onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Check if user has seen onboarding
        const hasSeen = localStorage.getItem('rescatto_onboarding_completed');
        if (!hasSeen) {
            // Small delay for better entrance
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleNext = () => {
        if (step < 2) {
            setStep(step + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('rescatto_onboarding_completed', 'true');
        setTimeout(onComplete, 300); // Allow animation to finish
    };

    if (!isOpen) return null;

    const slides = [
        {
            icon: <ChefHat size={64} className="text-orange-500" />,
            title: "Comida deliciosa, precios increíbles",
            desc: "Rescata platos de alta calidad de tus restaurantes favoritos con hasta un 70% de descuento.",
            color: "bg-orange-50"
        },
        {
            icon: <Leaf size={64} className="text-emerald-500" />,
            title: "Ayuda al Planeta",
            desc: "Cada pack sorpresa que rescatas evita emisiones de CO2. ¡Comer rico nunca se sintió tan bien!",
            color: "bg-emerald-50"
        },
        {
            icon: <PiggyBank size={64} className="text-purple-500" />,
            title: "Ahorra Dinero",
            desc: "Disfruta de la mejor gastronomía local sin romper tu alcancía. Únete a la revolución anti-desperdicio.",
            color: "bg-purple-50"
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/50 rounded-full hover:bg-white transition-colors"
                >
                    <X size={20} className="text-gray-500" />
                </button>

                {/* Content */}
                <div className="p-8 pt-12 text-center">
                    <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 ${slides[step].color} transition-colors duration-500`}>
                        <div className="animate-bounce-slow">
                            {slides[step].icon}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-3 transition-all duration-300">
                        {slides[step].title}
                    </h2>

                    <p className="text-gray-500 leading-relaxed mb-8 h-20">
                        {slides[step].desc}
                    </p>

                    {/* Dots */}
                    <div className="flex justify-center gap-2 mb-8">
                        {slides.map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-emerald-500' : 'w-2 bg-gray-200'
                                    }`}
                            />
                        ))}
                    </div>

                    <Button
                        onClick={handleNext}
                        className="w-full py-4 text-lg font-bold shadow-lg shadow-emerald-200"
                    >
                        {step === 2 ? '¡Empezar a Rescatar!' : 'Siguiente'}
                        {step < 2 && <ArrowRight size={20} className="ml-2" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};
