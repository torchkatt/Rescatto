import React, { useState } from 'react';
import { Wallet, Gift, ArrowRight, CheckCircle, CreditCard, Sparkles } from 'lucide-react';
import { Button } from '../common/Button';

interface UserWalletProps {
    points: number;
    onRedeem?: (rewardId: string) => void;
}

export const UserWallet: React.FC<UserWalletProps> = ({ points, onRedeem }) => {
    const [isRedeeming, setIsRedeeming] = useState(false);

    const rewards = [
        { id: 'free_shipping', name: 'Envío Gratis', cost: 50, icon: <Gift size={18} /> },
        { id: 'discount_10', name: '10% Descuento Extra', cost: 150, icon: <Sparkles size={18} /> },
        { id: 'free_pack', name: 'Pack Gratis', cost: 150, icon: <CreditCard size={18} /> },
    ];

    return (
        <div className="mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Wallet size={24} className="text-emerald-600" />
                Tu Billetera Rescatto
            </h3>

            {/* Wallet Card */}
            <div className="bg-gradient-to-br from-gray-900 to-emerald-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden mb-6">
                <div className="relative z-10 flex flex-col justify-between h-40">
                    <div className="flex justify-between items-start">
                        <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl">
                            <CreditCard className="text-white/80" />
                        </div>
                        <span className="text-emerald-400 text-xs font-black tracking-widest uppercase">LOYALTY MEMBER</span>
                    </div>

                    <div>
                        <p className="text-white/60 text-xs mb-1 uppercase tracking-tight">Balance de Puntos</p>
                        <div className="flex items-end gap-2 text-white">
                            <span className="text-4xl font-black">{points.toLocaleString()}</span>
                            <span className="text-lg font-bold text-emerald-400 mb-1">pts</span>
                        </div>
                    </div>
                </div>

                {/* Decorative circles */}
                <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-40px] left-[-20px] w-60 h-60 bg-emerald-700/10 rounded-full blur-3xl"></div>
            </div>

            {/* Redeem Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {rewards.map((reward) => {
                    const canAfford = points >= reward.cost;

                    return (
                        <div
                            key={reward.id}
                            className={`p-4 rounded-2xl border transition-all ${canAfford
                                    ? 'bg-white border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-300'
                                    : 'bg-gray-50 border-gray-100 opacity-60'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${canAfford ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-400'
                                }`}>
                                {reward.icon}
                            </div>
                            <h4 className="font-bold text-gray-900 text-sm mb-1">{reward.name}</h4>
                            <p className="text-xs text-gray-500 mb-4">{reward.cost} pts</p>

                            <button
                                disabled={!canAfford}
                                onClick={() => onRedeem?.(reward.id)}
                                className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${canAfford
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-600/20'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {canAfford ? 'Canjear' : 'Faltan Puntos'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
