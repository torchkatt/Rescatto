import React, { useState } from 'react';
import { Button } from './common/Button';
import { Package, Leaf, Users, ChevronRight, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { logger } from '../../utils/logger';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const slides = [
    {
        icon: <Sparkles size={48} className="text-emerald-500 mb-6 mx-auto animate-pulse" />,
        title: "¡Bienvenido a Rescatto! 🚀",
        description: "Únete al movimiento que está revolucionando la forma en que consumimos. Salva comida deliciosa de tus lugares favoritos antes de que sea desperdiciada.",
        image: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?q=80&w=2070&auto=format&fit=crop"
    },
    {
        icon: <Package size={48} className="text-amber-500 mb-6 mx-auto animate-bounce-slow" />,
        title: "La Magia de la Sorpresa 🎁",
        description: "Reserva 'Packs Sorpresa' con excedentes frescos del día a una fracción de su precio original. ¡No sabrás exactamente qué hay dentro hasta que lo abras!",
        image: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1974&auto=format&fit=crop"
    },
    {
        icon: <Leaf size={48} className="text-green-500 mb-6 mx-auto animate-spin-slow" />,
        title: "Tu Impacto es Real 🌱",
        description: "Cada rescate que haces evita emisiones de CO2. Gana puntos, sube de nivel y canjea increíbles recompensas mientras salvas al planeta.",
        image: "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?q=80&w=2056&auto=format&fit=crop"
    },
    {
        icon: <Users size={48} className="text-indigo-500 mb-6 mx-auto animate-bounce-slow" />,
        title: "Invita y Gana 🔥",
        description: "Comparte tu código único desde tu Perfil. ¡Gana 50 puntos por cada amigo que se una y realice su primer rescate! ¿Listo para empezar?",
        image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070&auto=format&fit=crop"
    }
];

interface Props {
    onComplete: () => void;
}

export const OnboardingTour: React.FC<Props> = ({ onComplete }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const { user } = useAuth();
    const [finishing, setFinishing] = useState(false);

    const handleNext = async () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(curr => curr + 1);
        } else {
            await handleFinish();
        }
    };

    const handleFinish = async () => {
        setFinishing(true);
        try {
            if (user && user.id) {
                const userRef = doc(db, 'users', user.id);
                await updateDoc(userRef, {
                    hasSeenOnboarding: true
                });
            }
            onComplete();
        } catch (err) {
            logger.error('Error saving onboarding state:', err);
            onComplete(); // Always dismiss even on error
        } finally {
            setFinishing(false);
        }
    };

    if (finishing) return null;

    const slide = slides[currentSlide];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-slide-up">

                {/* Skip button */}
                <button
                    onClick={handleFinish}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Hero Image */}
                <div className="h-48 relative overflow-hidden">
                    <img
                        key={slide.image}
                        src={slide.image}
                        alt={slide.title}
                        className="w-full h-full object-cover animate-pan"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
                </div>

                <div className="px-8 pb-8 pt-4 text-center">
                    {/* Content */}
                    <div className="animate-fade-in-up" key={currentSlide}>
                        {slide.icon}
                        <h2 className="text-2xl font-black text-gray-900 mb-3">{slide.title}</h2>
                        <p className="text-gray-500 font-medium leading-relaxed">{slide.description}</p>
                    </div>

                    {/* Progress Dots */}
                    <div className="flex items-center justify-center gap-2 my-8">
                        {slides.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-8 bg-emerald-500' : 'w-2 bg-gray-200'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Action */}
                    <Button
                        onClick={handleNext}
                        className="w-full bg-gray-900 text-white hover:bg-black py-4 rounded-xl text-lg font-bold shadow-xl shadow-gray-200 flex items-center justify-center gap-2 group"
                    >
                        {currentSlide === slides.length - 1 ? '¡Comenzar a Rescatar!' : 'Siguiente'}
                        {currentSlide < slides.length - 1 && <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};
