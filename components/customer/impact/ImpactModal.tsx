import React, { useState, useEffect } from 'react';
import {
    X, Leaf, Zap, Star, TrendingUp,
    TreePine, ShoppingBag, Gift, Flame
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../services/firebase';
import { useToast } from '../../../context/ToastContext';
import { logger } from '../../../utils/logger';
import { leaderboardService, LeaderboardEntry } from '../../../services/leaderboardService';
import { useTranslation } from 'react-i18next';

// --- Types & Config ---

interface Reward {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: string;
    category: 'discount' | 'free_item' | 'donation';
}

const LEVEL_CONFIG = {
    NOVICE: { label: 'impact_level_novice', emoji: '🌱', color: 'from-green-400 to-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', minRescues: 0, maxRescues: 5 },
    HERO: { label: 'impact_level_hero', emoji: '⚡', color: 'from-blue-400 to-cyan-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', minRescues: 6, maxRescues: 20 },
    GUARDIAN: { label: 'impact_level_guardian', emoji: '🏆', color: 'from-amber-400 to-orange-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50', minRescues: 21, maxRescues: Infinity },
};

const AVAILABLE_REWARDS: Reward[] = [
    { id: 'discount_5k', name: '5.000 COP de descuento', description: 'Descuento en tu próximo pedido', cost: 50, icon: '🏷️', category: 'discount' },
    { id: 'discount_10k', name: '10.000 COP de descuento', description: 'Descuento en tu próximo pedido', cost: 90, icon: '💰', category: 'discount' },
    { id: 'free_pack', name: 'Pack Sorpresa Gratis', description: 'Canjea por un pack de hasta 15.000 COP', cost: 150, icon: '🎁', category: 'free_item' },
    { id: 'donation_meal', name: 'Dona una comida', description: 'Dona un pack en tu nombre a un banco de alimentos', cost: 100, icon: '❤️', category: 'donation' },
];

const STREAK_MILESTONES = [
    { days: 3, multiplier: 1.5, label: '3 días', bonus: '+50% puntos' },
    { days: 7, multiplier: 2.0, label: '7 días', bonus: '+100% puntos' },
    { days: 14, multiplier: 2.5, label: '14 días', bonus: '+150% puntos' },
    { days: 30, multiplier: 3.0, label: '30 días', bonus: '+200% puntos' },
];

// --- Subcomponents ---

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; unit?: string; color: string }> = ({ icon, label, value, unit, color }) => (
    <div className={`${color} rounded-2xl p-4 flex flex-col gap-1`}>
        <div className="flex items-center gap-2 text-white/80 text-[10px] font-bold uppercase tracking-wider">
            {icon}
            {label}
        </div>
        <div className="text-white font-black text-2xl leading-none">
            {value}
            {unit && <span className="text-sm font-medium ml-1 opacity-80">{unit}</span>}
        </div>
    </div>
);

interface ImpactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ImpactModal: React.FC<ImpactModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { success, error: toastError, info } = useToast();
    const { t, i18n } = useTranslation();
    const [redeeming, setRedeeming] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [leaderboardLoading, setLeaderboardLoading] = useState(false);
    const [leaderboardPeriod, setLeaderboardPeriod] = useState<'all-time' | 'monthly' | 'weekly'>('all-time');
    const [userRank, setUserRank] = useState<{ rank: number, totalPlayers: number } | null>(null);

    const impact = user?.impact;
    const streak = user?.streak;
    const level = (impact?.level || 'NOVICE') as keyof typeof LEVEL_CONFIG;
    const levelConfig = LEVEL_CONFIG[level];
    const points = impact?.points ?? 0;
    const totalRescues = impact?.totalRescues ?? 0;
    const co2Saved = impact?.co2Saved ?? 0;
    const moneySaved = impact?.moneySaved ?? 0;
    const streakCurrent = streak?.current ?? 0;
    const streakLongest = streak?.longest ?? 0;
    const streakMultiplier = streak?.multiplier ?? 1.0;

    useEffect(() => {
        if (!isOpen) return;
        setLeaderboardLoading(true);
        Promise.all([
            leaderboardService.getTopRescuers(user?.city, 10, leaderboardPeriod),
            user?.id ? leaderboardService.getMyRank(user.id, user.city, leaderboardPeriod) : Promise.resolve(null)
        ]).then(([topRescuers, rank]) => {
            setLeaderboard(topRescuers);
            setUserRank(rank);
        }).catch(err => logger.error('Leaderboard load error:', err))
        .finally(() => setLeaderboardLoading(false));
    }, [isOpen, user?.city, user?.id, leaderboardPeriod]);

    const treesEquivalent = Math.max(0, Math.round((co2Saved / 21) * 10) / 10);
    const nextLevel = level === 'NOVICE' ? LEVEL_CONFIG.HERO : level === 'HERO' ? LEVEL_CONFIG.GUARDIAN : null;

    if (!isOpen) return null;

    const handleRedeem = async (reward: Reward) => {
        if (points < reward.cost) {
            toastError(t('impact_redeem_need', { count: reward.cost - points }));
            return;
        }
        setRedeeming(reward.id);
        try {
            const redeemPoints = httpsCallable(functions, 'redeemPoints');
            await redeemPoints({ rewardId: reward.id });
            success(t('impact_redeem_success', { name: reward.name }));
        } catch (err) {
            toastError(t('impact_redeem_error'));
        } finally {
            setRedeeming(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-brand-dark/40 backdrop-blur-md animate-in fade-in duration-300" 
                onClick={onClose} 
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                
                {/* Header */}
                <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <Leaf size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">{t('impact_title')}</h2>
                            <p className="text-xs text-gray-500 font-medium">Salva el planeta, un rescate a la vez</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    
                    {/* Level & Streak Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Level Card */}
                        <div className={`bg-gradient-to-br ${levelConfig.color} rounded-3xl p-6 text-white shadow-lg overflow-hidden relative group`}>
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="relative z-10 flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{t('impact_current_level')}</p>
                                    <h3 className="text-3xl font-black mt-1">{levelConfig.emoji} {t(levelConfig.label)}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{t('impact_points_label')}</p>
                                    <p className="text-3xl font-black mt-1">{points.toLocaleString()}</p>
                                </div>
                            </div>
                            
                            {nextLevel && (
                                <div className="relative z-10 space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-white/80">
                                        <span>{totalRescues} {t('impact_stat_rescues')}</span>
                                        <span>{t('impact_stat_remaining', { level: t(nextLevel.label), count: Math.max(0, nextLevel.minRescues - totalRescues) })}</span>
                                    </div>
                                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-white rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(100, (totalRescues / nextLevel.minRescues) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Streak Card */}
                        <div className={`rounded-3xl p-6 shadow-lg relative overflow-hidden group ${streakCurrent >= 3 ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white' : 'bg-gray-50 border border-gray-100 text-gray-900'}`}>
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div>
                                    <p className={`${streakCurrent >= 3 ? 'text-white/70' : 'text-gray-400'} text-[10px] font-black uppercase tracking-widest`}>{t('impact_streak_active')}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Flame size={28} className={streakCurrent >= 3 ? 'text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]' : 'text-gray-300'} />
                                        <span className="text-4xl font-black">{streakCurrent}</span>
                                        <span className={`text-lg font-bold ${streakCurrent >= 3 ? 'text-white/80' : 'text-gray-400'}`}>{t('impact_streak_days_label')}</span>
                                    </div>
                                </div>
                                <div className={`${streakCurrent >= 3 ? 'bg-white/20' : 'bg-white'} rounded-2xl p-3 text-center min-w-[80px] shadow-sm`}>
                                    <p className={`${streakCurrent >= 3 ? 'text-white/70' : 'text-gray-400'} text-[10px] font-black uppercase tracking-widest`}>{t('impact_streak_best')}</p>
                                    <p className="text-2xl font-black">{streakLongest}</p>
                                </div>
                            </div>
                            {streakMultiplier > 1 && (
                                <div className="inline-flex items-center gap-1.5 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-[10px] font-black relative z-10">
                                    <Zap size={10} />
                                    {t('impact_multiplier_active', { multiplier: streakMultiplier })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Environmental Stats */}
                    <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t('impact_env_title')}</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard icon={<ShoppingBag size={14} />} label={t('impact_stat_rescues')} value={totalRescues} color="bg-emerald-500" />
                            <StatCard icon={<Leaf size={14} />} label={t('impact_stat_co2')} value={co2Saved.toFixed(1)} unit="kg" color="bg-teal-500" />
                            <StatCard icon={<TreePine size={14} />} label={t('impact_stat_trees')} value={treesEquivalent} color="bg-cyan-500" />
                            <StatCard icon={<TrendingUp size={14} />} label={t('impact_stat_money')} value={moneySaved.toLocaleString('es-CO')} unit="COP" color="bg-blue-500" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Leaderboard Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('impact_top_rescuers')}</h3>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    {(['all-time', 'monthly', 'weekly'] as const).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setLeaderboardPeriod(p)}
                                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
                                                leaderboardPeriod === p ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'
                                            }`}
                                        >
                                            {p === 'all-time' ? t('impact_hist') : p === 'monthly' ? t('impact_monthly') : t('impact_weekly')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 rounded-2xl overflow-hidden divide-y divide-gray-100 border border-gray-100">
                                {leaderboardLoading ? (
                                    <div className="p-10 text-center animate-pulse text-gray-400 text-xs font-bold">{t('impact_loading_rank')}</div>
                                ) : leaderboard.length === 0 ? (
                                    <div className="p-10 text-center text-gray-400 text-xs font-bold">{t('impact_be_first')}</div>
                                ) : (
                                    leaderboard.slice(0, 5).map((entry, idx) => {
                                        const isCurrentUser = entry.userId === user?.id;
                                        const medals = ['🥇', '🥈', '🥉'];
                                        return (
                                            <div key={entry.userId} className={`flex items-center gap-3 p-4 ${isCurrentUser ? 'bg-emerald-50' : ''}`}>
                                                <div className="w-6 text-center text-sm font-black text-gray-400">
                                                    {idx < 3 ? medals[idx] : `#${idx + 1}`}
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 overflow-hidden">
                                                    {entry.avatarUrl ? <img src={entry.avatarUrl} className="w-full h-full object-cover" /> : entry.fullName.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-black truncate ${isCurrentUser ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                        {entry.fullName.split(' ')[0]} {isCurrentUser && '(Tú)'}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 font-bold">{entry.totalRescues} rescates · {entry.co2Saved.toFixed(1)}kg CO₂</p>
                                                </div>
                                                {entry.streak >= 3 && <div className="text-[10px] font-black text-orange-500 flex items-center gap-0.5"><Flame size={12} /> {entry.streak}</div>}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Rewards Section */}
                        <div>
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t('impact_redeem_title')}</h3>
                            <div className="space-y-3">
                                {AVAILABLE_REWARDS.map(reward => {
                                    const canAfford = points >= reward.cost;
                                    return (
                                        <div key={reward.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${canAfford ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-gray-50 opacity-60'}`}>
                                            <div className="text-2xl shrink-0">{reward.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-gray-900 truncate">{reward.name}</p>
                                                <p className="text-[10px] text-gray-500 font-bold">{reward.description}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleRedeem(reward)}
                                                disabled={!canAfford || !!redeeming}
                                                className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all ${canAfford ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                            >
                                                {redeeming === reward.id ? '...' : `${reward.cost} PTS`}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* How it works */}
                    <div className="bg-emerald-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-800 rounded-full blur-3xl -mr-32 -mt-32" />
                        <div className="relative z-10">
                            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                                <Zap className="text-yellow-400" />
                                {t('impact_how_earn')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { icon: <Star className="text-yellow-400" />, text: t('impact_earn_savings') },
                                    { icon: <Leaf className="text-emerald-400" />, text: t('impact_earn_co2') },
                                    { icon: <Flame className="text-orange-400" />, text: t('impact_earn_streak') },
                                    { icon: <Gift className="text-purple-400" />, text: t('impact_earn_referral') }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
                                        <div className="shrink-0">{item.icon}</div>
                                        <p className="text-xs font-bold leading-relaxed">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Link */}
                <div className="p-6 text-center border-t border-gray-100 bg-gray-50/50">
                    <button 
                        onClick={() => success('¡Pronto podrás compartir tu certificado de impacto!')}
                        className="text-emerald-600 text-xs font-black uppercase tracking-widest hover:underline"
                    >
                        {t('impact_share_btn')}
                    </button>
                </div>
            </div>
        </div>
    );
};
