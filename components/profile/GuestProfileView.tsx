import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, ArrowRight, Heart, ShoppingBag, Sparkles } from 'lucide-react';

export const GuestProfileView: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-md mx-auto px-6 pt-12 pb-24 flex flex-col items-center text-center">
                {/* Ilustration/Icon Header */}
                <div className="relative mb-8">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center animate-pulse">
                        <Sparkles className="text-emerald-600 w-12 h-12" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center border border-gray-100 animate-bounce">
                        <Heart className="text-rose-500 w-5 h-5 fill-rose-500" />
                    </div>
                </div>

                {/* Text Content */}
                <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">
                    ¡Únete a la <br />
                    <span className="text-emerald-600">comunidad Rescatto!</span>
                </h1>
                <p className="text-gray-500 text-lg leading-relaxed mb-10">
                    Crea una cuenta para guardar tus favoritos, ver tus pedidos y disfrutar de beneficios exclusivos.
                </p>

                {/* Action Buttons */}
                <div className="w-full space-y-4 mb-12">
                    <button
                        onClick={() => navigate('/login?mode=register')}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        <UserPlus size={22} />
                        Crear mi cuenta
                    </button>

                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-4 bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        <LogIn size={22} />
                        Ya tengo cuenta
                    </button>
                </div>

                {/* Features Highlights */}
                <div className="grid grid-cols-2 gap-4 w-full text-left">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <ShoppingBag className="text-emerald-600 mb-2" size={20} />
                        <h3 className="font-bold text-gray-900 text-sm">Tus Pedidos</h3>
                        <p className="text-gray-400 text-xs">Gestiona tus rescates de comida.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <Heart className="text-rose-500 mb-2" size={20} />
                        <h3 className="font-bold text-gray-900 text-sm">Favoritos</h3>
                        <p className="text-gray-400 text-xs">Guarda tus locales preferidos.</p>
                    </div>
                </div>

                {/* Footer Link */}
                <button
                    onClick={() => navigate('/app')}
                    className="mt-12 text-gray-400 font-bold hover:text-gray-600 flex items-center gap-2 group transition-colors"
                >
                    Seguir explorando como invitado
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};
