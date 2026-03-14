import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Leaf, Zap, Star, Award, TrendingUp,
    TreePine, ShoppingBag, Gift, Share2, Flame,
    Trophy, ChevronRight, Bell, Medal, Target, User,
    ShieldCheck, Info, InfoIcon, Heart, Tag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GuestPromptBanner } from '../../components/customer/common/GuestPromptBanner';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../utils/logger';
import { messagingService } from '../../services/messagingService';
import { leaderboardService, LeaderboardEntry } from '../../services/leaderboardService';
import { useTranslation } from 'react-i18next';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reward {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: string;
    category: 'discount' | 'free_item' | 'donation';
}

const LEVEL_CONFIG = {
    NOVICE: {
        label: 'impact_level_novice',
        emoji: '🌱',
        color: 'from-green-400 to-emerald-500',
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        minRescues: 0,
        maxRescues: 5,
    },
    HERO: {
        label: 'impact_level_hero',
        emoji: '⚡',
        color: 'from-blue-400 to-cyan-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        minRescues: 6,
        maxRescues: 20,
    },
    GUARDIAN: {
        label: 'impact_level_guardian',
        emoji: '🏆',
        color: 'from-amber-400 to-orange-500',
        textColor: 'text-amber-700',
        bgColor: 'bg-amber-50',
        minRescues: 21,
        maxRescues: Infinity,
    },
};

const AVAILABLE_REWARDS: Reward[] = [
    {
        id: 'discount_5k',
        name: '5.000 COP de descuento',
        description: 'Descuento en tu próximo pedido',
        cost: 50,
        icon: '🏷️',
        category: 'discount',
    },
    {
        id: 'discount_10k',
        name: '10.000 COP de descuento',
        description: 'Descuento en tu próximo pedido',
        cost: 90,
        icon: '💰',
        category: 'discount',
    },
    {
        id: 'free_pack',
        name: 'Pack Sorpresa Gratis',
        description: 'Canjea por un pack de hasta 15.000 COP',
        cost: 150,
        icon: '🎁',
        category: 'free_item',
    },
    {
        id: 'donation_meal',
        name: 'Dona una comida',
        description: 'Dona un pack en tu nombre a un banco de alimentos',
        cost: 100,
        icon: '❤️',
        category: 'donation',
    },
];

// ─── Streak Config ────────────────────────────────────────────────────────────

const STREAK_MILESTONES = [
    { days: 3, multiplier: 1.5, label: '3 días', bonus: '+50% puntos' },
    { days: 7, multiplier: 2.0, label: '7 días', bonus: '+100% puntos' },
    { days: 14, multiplier: 2.5, label: '14 días', bonus: '+150% puntos' },
    { days: 30, multiplier: 3.0, label: '30 días', bonus: '+200% puntos' },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────

const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    unit?: string;
    color: string;
}> = ({ icon, label, value, unit, color }) => (
    <div className={`${color} rounded-2xl p-4 flex flex-col gap-1`}>
        <div className="flex items-center gap-2 text-white/80 text-xs font-medium">
            {icon}
            {label}
        </div>
        <div className="text-white font-extrabold text-2xl leading-none">
            {value}
            {unit && <span className="text-sm font-medium ml-1 opacity-80">{unit}</span>}
        </div>
    </div>
);

const ProgressBar: React.FC<{ current: number; min: number; max: number; color: string }> = ({
    current, min, max, color
}) => {
    const percent = max === Infinity
        ? 100
        : Math.min(100, Math.round(((current - min) / (max - min + 1)) * 100));

    return (
        <div className="w-full bg-white/30 rounded-full h-2.5 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-700 ${color}`}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
};

// ─── StreakCard ───────────────────────────────────────────────────────────────

const StreakCard: React.FC<{
    current: number;
    longest: number;
    multiplier: number;
}> = ({ current, longest, multiplier }) => {
    const { t } = useTranslation();
    const nextMilestone = STREAK_MILESTONES.find(m => m.days > current);
    const daysToNext = nextMilestone ? nextMilestone.days - current : 0;

    const flameCount = Math.min(current, 7);
    const isOnFire = current >= 3;

    return (
        <div className={`rounded-2xl p-5 shadow-lg ${isOnFire
            ? 'bg-gradient-to-br from-orange-500 to-red-600'
            : 'bg-gradient-to-br from-gray-600 to-gray-700'
            } text-white`}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{t('impact_streak_active')}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <Flame
                            size={28}
                            className={`${isOnFire ? 'text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]' : 'text-white/50'}`}
                        />
                        <span className="text-4xl font-black">{current}</span>
                        <span className="text-lg font-medium text-white/80">{t('impact_streak_days_label')}</span>
                    </div>
                </div>
                <div className="bg-white/20 rounded-2xl px-4 py-3 text-center">
                    <p className="text-white/70 text-xs">{t('impact_streak_best')}</p>
                    <p className="text-2xl font-extrabold">{longest}</p>
                </div>
            </div>

            {/* Flame indicators */}
            {current > 0 && (
                <div className="flex gap-1 mb-4">
                    {Array.from({ length: Math.min(7, Math.max(flameCount, 1)) }).map((_, i) => (
                        <span
                            key={i}
                            className={`text-xl ${i < current ? 'opacity-100' : 'opacity-20'}`}
                            style={{ filter: i < current ? 'drop-shadow(0 0 4px rgba(251,191,36,0.7))' : 'none' }}
                        >
                            🔥
                        </span>
                    ))}
                    {current > 7 && <span className="text-sm font-bold self-center ml-1">+{current - 7}</span>}
                </div>
            )}

            {/* Multiplier badge */}
            {multiplier > 1.0 && (
                <div className="inline-flex items-center gap-1.5 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-black mb-3">
                    <Zap size={12} />
                    {t('impact_multiplier_active', { multiplier })}
                </div>
            )}

            {/* Progress to next milestone */}
            {nextMilestone ? (
                <div>
                    <div className="flex justify-between text-xs text-white/70 mb-1.5">
                        <span>{t('impact_streak_day_label', { current })}</span>
                        <span>🎯 {nextMilestone.days} {t('impact_streak_days_label')} → {nextMilestone.bonus}</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-yellow-300 transition-all duration-700"
                            style={{
                                width: `${Math.min(100, (current / nextMilestone.days) * 100)}%`
                            }}
                        />
                    </div>
                    <p className="text-white/60 text-xs mt-1.5">
                        {t('impact_streak_next', { days: daysToNext, bonus: nextMilestone.bonus })}
                    </p>
                </div>
            ) : (
                <p className="text-white/80 text-sm font-medium">
                    {t('impact_max_multiplier')}
                </p>
            )}
        </div>
    );
};

// ─── ImpactShareCard ──────────────────────────────────────────────────────────

const ImpactShareCard: React.FC<{
    name: string;
    level: string;
    levelEmoji: string;
    totalRescues: number;
    co2Saved: number;
    moneySaved: number;
    streak: number;
    points: number;
    onClose: () => void;
}> = ({ name, level, levelEmoji, totalRescues, co2Saved, moneySaved, streak, points, onClose }) => {
    const { t, i18n } = useTranslation();
    const firstName = name.split(' ')[0];
    const formatCOP = (v: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    const shareText = [
        `🌱 ${t('impact_level_label')}: ${levelEmoji} ${t(level === 'GUARDIAN' ? 'impact_level_guardian' : level === 'HERO' ? 'impact_level_hero' : 'impact_level_novice')}`,
        ``,
        `🍽️ ${t('impact_share_rescues')}: ${totalRescues}`,
        `💨 ${t('impact_share_co2')}: ${co2Saved.toFixed(1)} kg`,
        `💰 ${t('impact_share_money')}: ${formatCOP(moneySaved)}`,
        streak >= 3 ? `🔥 ${t('impact_share_streak')}: ${streak}` : '',
        ``,
        `Únete a la comunidad en rescatto.com 🚀`,
    ].filter(Boolean).join('\n');

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Mi Impacto en Rescatto 🌱',
                    text: shareText,
                    url: 'https://rescatto.com',
                });
            } catch (e) {
                if ((e as Error).name !== 'AbortError') {
                    window.open(whatsappUrl, '_blank');
                }
            }
        } else {
            window.open(whatsappUrl, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}>
            <div
                className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl mb-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Card Preview */}
                <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white relative overflow-hidden">
                    {/* Background decorations */}
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
                    <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-white/10" />

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-white/70 text-xs font-medium">Rescatto</p>
                                <p className="text-xl font-black">{firstName} {t('impact_stat_rescues')}</p>
                            </div>
                            <div className="text-4xl">{levelEmoji}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-white/20 rounded-xl p-3">
                                <p className="text-3xl font-black">{totalRescues}</p>
                                <p className="text-xs text-white/80">{t('impact_share_rescues')}</p>
                            </div>
                            <div className="bg-white/20 rounded-xl p-3">
                                <p className="text-3xl font-black">{co2Saved.toFixed(1)}</p>
                                <p className="text-xs text-white/80">{t('impact_share_co2')}</p>
                            </div>
                            <div className="bg-white/20 rounded-xl p-3">
                                <p className="text-lg font-black">{formatCOP(moneySaved)}</p>
                                <p className="text-xs text-white/80">{t('impact_share_money')}</p>
                            </div>
                            {streak >= 3 && (
                                <div className="bg-orange-500/80 rounded-xl p-3">
                                    <p className="text-3xl font-black">🔥{streak}</p>
                                    <p className="text-xs text-white/80">{t('impact_share_streak')}</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white/20 rounded-xl px-3 py-2 inline-flex items-center gap-2">
                            <span className="text-sm font-bold">{levelEmoji} {level}</span>
                            <span className="text-white/60 text-xs">•</span>
                            <span className="text-xs text-white/80">{points.toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-CO')} pts</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 space-y-3">
                    <button
                        onClick={handleNativeShare}
                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                    >
                        <Share2 size={20} />
                        {t('impact_share_btn')}
                    </button>

                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full border-2 border-green-500 text-green-700 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                        <span className="text-lg">💬</span>
                        {t('impact_share_wa')}
                    </a>

                    <button
                        onClick={onClose}
                        className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
                    >
                        {t('impact_close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Impact: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { success, error: toastError, info } = useToast();
    const { t, i18n } = useTranslation();
    const [redeeming, setRedeeming] = useState<string | null>(null);
    const [showShareCard, setShowShareCard] = useState(false);
    const [requestingNotifs, setRequestingNotifs] = useState(false);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [leaderboardLoading, setLeaderboardLoading] = useState(false);
    const [leaderboardPeriod, setLeaderboardPeriod] = useState<'all-time' | 'monthly' | 'weekly'>('all-time');
    const [userRank, setUserRank] = useState<{ rank: number, totalPlayers: number } | null>(null);
    const [showGuestBanner, setShowGuestBanner] = useState(!!user?.isGuest);

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

    // Load leaderboard for user's city
    useEffect(() => {
        setLeaderboardLoading(true);
        Promise.all([
            leaderboardService.getTopRescuers(user?.city, 10, leaderboardPeriod),
            user?.id ? leaderboardService.getMyRank(user.id, user.city, leaderboardPeriod) : Promise.resolve(null)
        ]).then(([topRescuers, rank]) => {
            setLeaderboard(topRescuers);
            setUserRank(rank);
        }).catch(err => logger.error('Leaderboard/Rank load error:', err))
        .finally(() => setLeaderboardLoading(false));
    }, [user?.city, user?.id, leaderboardPeriod]);

    // Trees equivalent (1 tree absorbs ~21kg CO2/year)
    const treesEquivalent = Math.max(0, Math.round((co2Saved / 21) * 10) / 10);

    const nextLevel = level === 'NOVICE' ? LEVEL_CONFIG.HERO
        : level === 'HERO' ? LEVEL_CONFIG.GUARDIAN
            : null;

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
            logger.error('Error redeeming reward:', err);
            toastError('No se pudo canjear. Intenta de nuevo.');
        } finally {
            setRedeeming(null);
        }
    };

    const handleEnableNotifications = async () => {
        if (!user?.id) return;
        setRequestingNotifs(true);
        try {
            const token = await messagingService.requestPermissionAndSaveToken(user.id);
            if (token) {
                success(t('impact_notif_success') || '🔔 Notificaciones activadas. Te avisaremos de tus pedidos y ofertas.');
            } else {
                info('Activa las notificaciones desde la configuración de tu navegador.');
            }
        } catch {
            toastError('No se pudo activar las notificaciones.');
        } finally {
            setRequestingNotifs(false);
        }
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

    const isNotificationSupported = 'Notification' in window && Notification.permission === 'default';

    return (
        <div className="min-h-screen bg-gray-50 pb-24 overflow-x-hidden">
            {/* Banner de invitado */}
            {showGuestBanner && (
                <GuestPromptBanner
                    featureName={t('impact_guest_feature')}
                    icon="🌱"
                    onDismiss={() => setShowGuestBanner(false)}
                />
            )}
            {/* Header */}
            <header className="bg-white sticky top-safe z-40 shadow-sm border-b border-gray-100">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <div className="flex items-center gap-2">
                            <Leaf size={20} className="text-emerald-500" />
                            <h1 className="text-lg font-bold text-gray-900">{t('impact_title')}</h1>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowShareCard(true)}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-sm"
                    >
                        <Share2 size={14} />
                        {t('impact_btn_share')}
                 </button>
                </div>
            </header>

            <main className="p-4 space-y-5">

                {/* Level Card */}
                <div className={`bg-gradient-to-br ${levelConfig.color} rounded-2xl p-5 text-white shadow-lg`}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{t('impact_current_level')}</p>
                            <h2 className="text-2xl font-extrabold flex items-center gap-2 mt-1">
                                {levelConfig.emoji} {t(levelConfig.label)}
                            </h2>
                        </div>
                        <div className="bg-white/20 rounded-2xl px-4 py-2 text-center">
                            <p className="text-white/70 text-xs">{t('impact_points_label')}</p>
                            <p className="text-2xl font-extrabold">{points.toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-CO')}</p>
                            {streakMultiplier > 1.0 && (
                                <p className="text-yellow-200 text-[10px] font-bold">x{streakMultiplier} 🔥</p>
                            )}
                        </div>
                    </div>

                    {nextLevel && (
                        <div>
                            <div className="flex justify-between text-xs text-white/70 mb-1">
                                <span>{totalRescues} {t('impact_stat_rescues')}</span>
                                <span>{t('impact_stat_remaining', { level: t(nextLevel.label), count: Math.max(0, nextLevel.minRescues - totalRescues) })}</span>
                            </div>
                            <ProgressBar
                                current={totalRescues}
                                min={levelConfig.minRescues}
                                max={levelConfig.maxRescues}
                                color="bg-white"
                            />
                        </div>
                    )}
                    {!nextLevel && (
                        <p className="text-white/80 text-sm font-medium">
                            {t('impact_max_level')}
                        </p>
                    )}
                </div>

                {/* Streak Card */}
                <StreakCard
                    current={streakCurrent}
                    longest={streakLongest}
                    multiplier={streakMultiplier}
                />

                {/* Stats Grid */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{t('impact_env_title')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard
                            icon={<ShoppingBag size={14} />}
                            label={t('impact_stat_rescues')}
                            value={totalRescues}
                            color="bg-gradient-to-br from-emerald-500 to-teal-600"
                        />
                        <StatCard
                            icon={<Leaf size={14} />}
                            label={t('impact_stat_co2')}
                            value={co2Saved.toFixed(1)}
                            unit="kg"
                            color="bg-gradient-to-br from-green-500 to-emerald-600"
                        />
                         <StatCard
                            icon={<TreePine size={14} />}
                            label={t('impact_stat_trees')}
                            value={treesEquivalent}
                            color="bg-gradient-to-br from-teal-500 to-cyan-600"
                        />
                        <StatCard
                            icon={<TrendingUp size={14} />}
                            label={t('impact_stat_money')}
                            value={formatCurrency(moneySaved)}
                            color="bg-gradient-to-br from-blue-500 to-indigo-600"
                        />
                    </div>
                </div>

                {/* Share CTA */}
                <button
                    onClick={() => setShowShareCard(true)}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Share2 size={20} />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-sm">{t('impact_share_btn')}</p>
                            <p className="text-xs text-white/70">{t('impact_invite_bonus')}</p>
                        </div>
                    </div>
                    <ChevronRight size={20} className="text-white/60" />
                </button>

                {/* Notifications CTA — only if not yet granted */}
                {isNotificationSupported && (
                    <button
                        onClick={handleEnableNotifications}
                        disabled={requestingNotifs}
                        className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-100 p-2 rounded-xl">
                                <Bell size={20} className="text-amber-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-sm text-gray-900">{t('impact_notif_title')}</p>
                                <p className="text-xs text-gray-500">{t('impact_notif_desc')}</p>
                            </div>
                        </div>
                        <ChevronRight size={20} className="text-gray-400" />
                    </button>
                )}

                {/* City Leaderboard */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Medal size={18} className="text-amber-500" />
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                                {t('impact_top_rescuers')}
                                {user?.city ? ` · ${user.city}` : ''}
                            </h3>
                        </div>
                        {!user?.city && (
                            <span className="text-[10px] text-gray-400">Global</span>
                        )}
                    </div>

                    {/* Period Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                        {(['all-time', 'monthly', 'weekly'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setLeaderboardPeriod(p)}
                                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                    leaderboardPeriod === p 
                                        ? 'bg-white text-emerald-600 shadow-sm' 
                                        : 'text-gray-500'
                                }`}
                            >
                                {p === 'all-time' ? t('impact_hist') : p === 'monthly' ? t('impact_monthly') : t('impact_weekly')}
                            </button>
                        ))}
                    </div>

                    {userRank && userRank.rank > 0 && (
                        <div className="mb-3 bg-emerald-600 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-xl">
                                    <Trophy size={20} className="text-yellow-300" />
                                </div>
                                <div>
                                    <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{t('impact_your_rank')}</p>
                                    <p className="text-xl font-black"># {userRank.rank}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{t('impact_level_label')}</p>
                                <p className="text-sm font-bold">{LEVEL_CONFIG[level].emoji} {t(LEVEL_CONFIG[level].label)}</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {leaderboardLoading ? (
                            <div className="p-6 text-center text-gray-400 text-sm">{t('impact_loading_rank')}</div>
                        ) : leaderboard.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                {t('impact_be_first')}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {leaderboard.map((entry, idx) => {
                                    const isCurrentUser = entry.userId === user?.id;
                                    const lvl = leaderboardService.getLevelConfig(entry.level);
                                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                                    const firstName = entry.fullName.split(' ')[0];

                                    return (
                                        <div
                                            key={entry.userId}
                                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${isCurrentUser ? 'bg-emerald-50 border-l-4 border-emerald-500' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className="w-7 text-center flex-shrink-0">
                                                {medal ? (
                                                    <span className="text-lg">{medal}</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                                                )}
                                            </div>

                                            <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-black text-sm shadow-sm overflow-hidden bg-emerald-600 text-white">
                                                {entry.avatarUrl ? (
                                                    <img src={entry.avatarUrl} alt={firstName} className="w-full h-full object-cover" />
                                                ) : (
                                                    firstName.charAt(0)
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className={`font-bold text-sm truncate ${isCurrentUser ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                        {firstName} {isCurrentUser && '(Tú)'}
                                                    </p>
                                                    <span className="text-xs">{lvl.emoji}</span>
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    {leaderboardPeriod === 'all-time' ? t('impact_hist') : (leaderboardPeriod === 'monthly' ? t('impact_monthly') : t('impact_weekly'))} · {entry.totalRescues} {t('impact_stat_rescues')} · {entry.co2Saved.toFixed(1)}kg CO₂
                                                </p>
                                            </div>

                                            {(entry.streak ?? 0) >= 3 && (
                                                <div className="flex items-center gap-0.5 text-orange-500 text-xs font-bold flex-shrink-0">
                                                    <Flame size={12} />
                                                    {entry.streak}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {!leaderboardLoading && leaderboard.length > 0 && !leaderboard.find(e => e.userId === user?.id) && (
                        <p className="text-center text-xs text-gray-400 mt-2">
                            {t('impact_keep_rescuing', { city: user?.city || '' })}
                        </p>
                    )}
                </div>

                {/* Rewards / Canjear */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">{t('impact_redeem_title')}</h3>
                    <p className="text-xs text-gray-400 mb-3">{t('impact_pts_available', { points })}</p>
                    <div className="space-y-3">
                        {AVAILABLE_REWARDS.map(reward => {
                            const canAfford = points >= reward.cost;
                            return (
                                <div
                                    key={reward.id}
                                    className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 border transition-all ${canAfford ? 'border-transparent' : 'border-gray-100 opacity-70'}`}
                                >
                                    <div className="text-3xl flex-shrink-0">{reward.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-900 text-sm truncate">{reward.name}</p>
                                        <p className="text-xs text-gray-500">{reward.description}</p>
                                    </div>
                                    <button
                                        onClick={() => handleRedeem(reward)}
                                        disabled={!canAfford || redeeming === reward.id}
                                        className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${canAfford
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                    >
                                        {redeeming === reward.id ? '...' : `${reward.cost} pts`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* How to earn points */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
                    <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                        <Zap size={16} className="text-emerald-600" />
                        {t('impact_how_earn')}
                    </h3>
                    <ul className="space-y-2 text-sm text-emerald-700">
                        <li className="flex items-start gap-2">
                            <Star size={14} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                            <span>{t('impact_earn_savings')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Leaf size={14} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                            <span>{t('impact_earn_co2')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Flame size={14} className="flex-shrink-0 mt-0.5 text-orange-500" />
                            <span>{t('impact_earn_streak')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Award size={14} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                            <span>{t('impact_earn_auto')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Gift size={14} className="flex-shrink-0 mt-0.5 text-purple-500" />
                            <span>{t('impact_earn_referral')}</span>
                        </li>
                    </ul>
                </div>

            </main>

            {/* Share Card Modal */}
            {showShareCard && (
                <ImpactShareCard
                    name={user?.fullName || t('login_role_customer')}
                    level={t(levelConfig.label)}
                    levelEmoji={levelConfig.emoji}
                    totalRescues={totalRescues}
                    co2Saved={co2Saved}
                    moneySaved={moneySaved}
                    streak={streakCurrent}
                    points={points}
                    onClose={() => setShowShareCard(false)}
                />
            )}
        </div>
    );
};

export default Impact;
