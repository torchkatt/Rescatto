import React, { useState, useEffect } from 'react';
import { ChefHat, Leaf, PiggyBank, Cloud, HardDrive, ArrowRight, X, Sparkles } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../../context/AuthContext';
import { setStoragePreference } from '../../../services/aiChatStorageService';

interface OnboardingModalProps {
    onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
    const { user } = useAuth();
    const [step, setStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [aiStorage, setAiStorage] = useState<'cloud' | 'local'>('cloud');

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
        if (step < 3) {
            setStep(step + 1);
        } else {
            handleClose();
        }
    };

    const handleSaveStorage = async (mode: 'cloud' | 'local') => {
        setAiStorage(mode);
        if (user && !user.isGuest) {
            await setStoragePreference(user.id, mode).catch(() => {});
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('rescatto_onboarding_completed', 'true');
        // Save default storage preference if user is registered
        if (user && !user.isGuest) {
            setStoragePreference(user.id, aiStorage).catch(() => {});
        }
        setTimeout(onComplete, 300);
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
            desc: "Cada pack sorpresa que rescatas evita emisiones de CO₂. ¡Comer rico nunca se sintió tan bien!",
            color: "bg-emerald-50"
        },
        {
            icon: <PiggyBank size={64} className="text-purple-500" />,
            title: "Ahorra Dinero",
            desc: "Disfruta de la mejor gastronomía local sin romper tu alcancía. Únete a la revolución anti-desperdicio.",
            color: "bg-purple-50"
        },
        {
            icon: <Sparkles size={64} className="text-emerald-500" />,
            title: "Asistente IA — ¿Nube o Local?",
            desc: "RescattoBot puede recordar tus conversaciones para ayudarte mejor.",
            color: "bg-emerald-50",
            custom: true,
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

                    {/* Step 4 — AI Chat Storage Picker */}
                    {step === 3 && (
                        <div className="space-y-3 mb-8">
                            <button
                                onClick={() => handleSaveStorage('cloud')}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all text-left ${
                                    aiStorage === 'cloud'
                                        ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100'
                                        : 'border-gray-100 bg-white hover:border-gray-200'
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    aiStorage === 'cloud' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    <Cloud size={24} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-gray-900">Guardar en la Nube ☁️</p>
                                    <p className="text-xs text-gray-500 font-medium">Tus conversaciones disponibles en todos tus dispositivos</p>
                                </div>
                                {aiStorage === 'cloud' && (
                                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <span className="text-white text-xs font-black">✓</span>
                                    </div>
                                )}
                            </button>

                            <button
                                onClick={() => handleSaveStorage('local')}
                                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all text-left ${
                                    aiStorage === 'local'
                                        ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100'
                                        : 'border-gray-100 bg-white hover:border-gray-200'
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    aiStorage === 'local' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    <HardDrive size={24} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-gray-900">Solo en este dispositivo 💻</p>
                                    <p className="text-xs text-gray-500 font-medium">Tus conversaciones no se suben a la nube. Más privado.</p>
                                </div>
                                {aiStorage === 'local' && (
                                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <span className="text-white text-xs font-black">✓</span>
                                    </div>
                                )}
                            </button>

                            <p className="text-[10px] text-gray-400 font-medium text-center pt-1">
                                Puedes cambiarlo cuando quieras en el chat de RescattoBot
                            </p>
                        </div>
                    )}

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
                        {step === 3 ? '¡Empezar a Rescatar!' : 'Siguiente'}
                        {step < 2 && <ArrowRight size={20} className="ml-2" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};
