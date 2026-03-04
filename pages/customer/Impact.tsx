import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Leaf, Zap, Star, Award, TrendingUp,
    TreePine, ShoppingBag, Gift, Share2, Flame,
    Trophy, ChevronRight, Bell, Medal
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GuestPromptBanner } from '../../components/customer/common/GuestPromptBanner';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../utils/logger';
import { messagingService } from '../../services/messagingService';
import { leaderboardService, LeaderboardEntry } from '../../services/leaderboardService';

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
        label: 'Novato',
        emoji: '🌱',
        color: 'from-green-400 to-emerald-500',
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        minRescues: 0,
        maxRescues: 5,
    },
    HERO: {
        label: 'Héroe',
        emoji: '⚡',
        color: 'from-blue-400 to-cyan-500',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        minRescues: 6,
        maxRescues: 20,
    },
    GUARDIAN: {
        label: 'Guardián',
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
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Racha Activa</p>
                    <div className="flex items-center gap-2 mt-1">
                        <Flame
                            size={28}
                            className={`${isOnFire ? 'text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]' : 'text-white/50'}`}
                        />
                        <span className="text-4xl font-black">{current}</span>
                        <span className="text-lg font-medium text-white/80">días</span>
                    </div>
                </div>
                <div className="bg-white/20 rounded-2xl px-4 py-3 text-center">
                    <p className="text-white/70 text-xs">Mejor racha</p>
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
                    x{multiplier} de puntos activo
                </div>
            )}

            {/* Progress to next milestone */}
            {nextMilestone ? (
                <div>
                    <div className="flex justify-between text-xs text-white/70 mb-1.5">
                        <span>Día {current}</span>
                        <span>🎯 {nextMilestone.label} → {nextMilestone.bonus}</span>
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
                        {daysToNext} día{daysToNext !== 1 ? 's' : ''} más para desbloquear {nextMilestone.bonus}
                    </p>
                </div>
            ) : (
                <p className="text-white/80 text-sm font-medium">
                    🏆 ¡Máximo multiplicador activo! x3.0 puntos en cada rescate.
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
    const firstName = name.split(' ')[0];
    const formatCOP = (v: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    const shareText = [
        `🌱 ¡Soy ${levelEmoji} ${level} en Rescatto!`,
        ``,
        `🍽️ He salvado ${totalRescues} comidas de terminar en la basura`,
        `💨 Evité ${co2Saved.toFixed(1)} kg de CO₂`,
        `💰 Ahorré ${formatCOP(moneySaved)}`,
        streak >= 3 ? `🔥 Llevo ${streak} días seguidos rescatando` : '',
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
                                <p className="text-xl font-black">{firstName} rescató</p>
                            </div>
                            <div className="text-4xl">{levelEmoji}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-white/20 rounded-xl p-3">
                                <p className="text-3xl font-black">{totalRescues}</p>
                                <p className="text-xs text-white/80">comidas salvadas</p>
                            </div>
                            <div className="bg-white/20 rounded-xl p-3">
                                <p className="text-3xl font-black">{co2Saved.toFixed(1)}</p>
                                <p className="text-xs text-white/80">kg CO₂ evitados</p>
                            </div>
                            <div className="bg-white/20 rounded-xl p-3">
                                <p className="text-lg font-black">{formatCOP(moneySaved)}</p>
                                <p className="text-xs text-white/80">dinero ahorrado</p>
                            </div>
                            {streak >= 3 && (
                                <div className="bg-orange-500/80 rounded-xl p-3">
                                    <p className="text-3xl font-black">🔥{streak}</p>
                                    <p className="text-xs text-white/80">días de racha</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white/20 rounded-xl px-3 py-2 inline-flex items-center gap-2">
                            <span className="text-sm font-bold">{levelEmoji} {level}</span>
                            <span className="text-white/60 text-xs">•</span>
                            <span className="text-xs text-white/80">{points.toLocaleString('es-CO')} pts</span>
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
                        Compartir mi impacto
                    </button>

                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full border-2 border-green-500 text-green-700 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                        <span className="text-lg">💬</span>
                        Compartir por WhatsApp
                    </a>

                    <button
                        onClick={onClose}
                        className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
                    >
                        Cerrar
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
    const [redeeming, setRedeeming] = useState<string | null>(null);
    const [showShareCard, setShowShareCard] = useState(false);
    const [requestingNotifs, setRequestingNotifs] = useState(false);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [leaderboardLoading, setLeaderboardLoading] = useState(false);
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
        leaderboardService.getTopRescuers(user?.city, 10)
            .then(setLeaderboard)
            .catch(err => logger.error('Leaderboard load error:', err))
            .finally(() => setLeaderboardLoading(false));
    }, [user?.city]);

    // Trees equivalent (1 tree absorbs ~21kg CO2/year)
    const treesEquivalent = Math.max(0, Math.round((co2Saved / 21) * 10) / 10);

    const nextLevel = level === 'NOVICE' ? LEVEL_CONFIG.HERO
        : level === 'HERO' ? LEVEL_CONFIG.GUARDIAN
            : null;

    const handleRedeem = async (reward: Reward) => {
        if (points < reward.cost) {
            toastError(`Necesitas ${reward.cost - points} puntos más para canjear esto`);
            return;
        }

        setRedeeming(reward.id);
        try {
            const redeemPoints = httpsCallable(functions, 'redeemPoints');
            await redeemPoints({ rewardId: reward.id, cost: reward.cost });
            success(`¡"${reward.name}" canjeado con éxito! 🎉`);
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
                success('🔔 Notificaciones activadas. Te avisaremos de tus pedidos y ofertas.');
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

    const isNotificationSupported = 'Notification' in window && Notification.permission !== 'granted';

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Banner de invitado */}
            {showGuestBanner && (
                <GuestPromptBanner
                    featureName="tu impacto y puntos de rescate"
                    icon="🌱"
                    onDismiss={() => setShowGuestBanner(false)}
                />
            )}
            {/* Header */}
            <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-gray-100">
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
                            <h1 className="text-lg font-bold text-gray-900">Mi Impacto</h1>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowShareCard(true)}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-sm"
                    >
                        <Share2 size={14} />
                        Compartir
                    </button>
                </div>
            </header>

            <main className="p-4 space-y-5">

                {/* Level Card */}
                <div className={`bg-gradient-to-br ${levelConfig.color} rounded-2xl p-5 text-white shadow-lg`}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Nivel actual</p>
                            <h2 className="text-2xl font-extrabold flex items-center gap-2 mt-1">
                                {levelConfig.emoji} {levelConfig.label}
                            </h2>
                        </div>
                        <div className="bg-white/20 rounded-2xl px-4 py-2 text-center">
                            <p className="text-white/70 text-xs">Puntos</p>
                            <p className="text-2xl font-extrabold">{points.toLocaleString('es-CO')}</p>
                            {streakMultiplier > 1.0 && (
                                <p className="text-yellow-200 text-[10px] font-bold">x{streakMultiplier} 🔥</p>
                            )}
                        </div>
                    </div>

                    {nextLevel && (
                        <div>
                            <div className="flex justify-between text-xs text-white/70 mb-1">
                                <span>{totalRescues} rescates</span>
                                <span>→ {nextLevel.label} en {nextLevel.minRescues - totalRescues} más</span>
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
                            🏆 ¡Has alcanzado el nivel máximo! Eres un Guardián del Planeta.
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
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Tu Impacto Ambiental</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard
                            icon={<ShoppingBag size={14} />}
                            label="Rescates"
                            value={totalRescues}
                            color="bg-gradient-to-br from-emerald-500 to-teal-600"
                        />
                        <StatCard
                            icon={<Leaf size={14} />}
                            label="CO₂ evitado"
                            value={co2Saved.toFixed(1)}
                            unit="kg"
                            color="bg-gradient-to-br from-green-500 to-emerald-600"
                        />
                        <StatCard
                            icon={<TreePine size={14} />}
                            label="Equiv. árboles"
                            value={treesEquivalent}
                            color="bg-gradient-to-br from-teal-500 to-cyan-600"
                        />
                        <StatCard
                            icon={<TrendingUp size={14} />}
                            label="Dinero ahorrado"
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
                            <p className="font-bold text-sm">Comparte tu impacto</p>
                            <p className="text-xs text-white/70">Invita amigos y gana +50 pts por cada uno</p>
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
                                <p className="font-bold text-sm text-gray-900">Activa las notificaciones</p>
                                <p className="text-xs text-gray-500">Entérate de nuevas ofertas y tu racha</p>
                            </div>
                        </div>
                        <ChevronRight size={20} className="text-gray-400" />
                    </button>
                )}

                {/* Badges */}
                {impact?.badges && impact.badges.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Insignias</h3>
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <div className="flex flex-wrap gap-3">
                                {impact.badges.map(badge => (
                                    <div
                                        key={badge.id}
                                        className="flex flex-col items-center gap-1 p-3 bg-amber-50 rounded-xl border border-amber-100"
                                    >
                                        <span className="text-2xl">{badge.icon}</span>
                                        <span className="text-xs font-bold text-amber-700 text-center leading-tight max-w-[64px]">
                                            {badge.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Streak Milestones */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Logros de Racha</h3>
                    <div className="space-y-2">
                        {STREAK_MILESTONES.map(milestone => {
                            const unlocked = streakLongest >= milestone.days;
                            return (
                                <div
                                    key={milestone.days}
                                    className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${unlocked
                                        ? 'bg-orange-50 border-orange-200'
                                        : 'bg-white border-gray-100 opacity-60'
                                        }`}
                                >
                                    <div className={`text-2xl ${unlocked ? '' : 'grayscale'}`}>
                                        {unlocked ? '🔥' : '⬜'}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold text-sm ${unlocked ? 'text-orange-700' : 'text-gray-500'}`}>
                                            Racha de {milestone.label}
                                        </p>
                                        <p className={`text-xs ${unlocked ? 'text-orange-500' : 'text-gray-400'}`}>
                                            {milestone.bonus} permanentes
                                        </p>
                                    </div>
                                    {unlocked ? (
                                        <Trophy size={18} className="text-orange-500" />
                                    ) : (
                                        <span className="text-xs text-gray-400">{milestone.days - streakCurrent}d más</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* City Leaderboard */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Medal size={18} className="text-amber-500" />
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                                Top Rescatadores
                                {user?.city ? ` · ${user.city}` : ''}
                            </h3>
                        </div>
                        {!user?.city && (
                            <span className="text-[10px] text-gray-400">Global</span>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {leaderboardLoading ? (
                            <div className="p-6 text-center text-gray-400 text-sm">Cargando ranking...</div>
                        ) : leaderboard.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                Sé el primero en aparecer aquí 🌱
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
                                            {/* Rank */}
                                            <div className="w-7 text-center flex-shrink-0">
                                                {medal ? (
                                                    <span className="text-lg">{medal}</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                                                )}
                                            </div>

                                            {/* Avatar */}
                                            <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-black text-sm shadow-sm overflow-hidden bg-emerald-600 text-white">
                                                {entry.avatarUrl ? (
                                                    <img src={entry.avatarUrl} alt={firstName} className="w-full h-full object-cover" />
                                                ) : (
                                                    firstName.charAt(0)
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className={`font-bold text-sm truncate ${isCurrentUser ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                        {firstName} {isCurrentUser && '(Tú)'}
                                                    </p>
                                                    <span className="text-xs">{lvl.emoji}</span>
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    {entry.totalRescues} rescates · {entry.co2Saved.toFixed(1)}kg CO₂
                                                </p>
                                            </div>

                                            {/* Streak badge */}
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

                    {/* Motivational CTA if user not in top 10 */}
                    {!leaderboardLoading && leaderboard.length > 0 && !leaderboard.find(e => e.userId === user?.id) && (
                        <p className="text-center text-xs text-gray-400 mt-2">
                            Sigue rescatando para aparecer en el top 10 de {user?.city || 'tu ciudad'} 🚀
                        </p>
                    )}
                </div>

                {/* Rewards / Canjear */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">Canjear Puntos</h3>
                    <p className="text-xs text-gray-400 mb-3">Tienes {points} pts disponibles</p>
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
                        ¿Cómo ganar puntos?
                    </h3>
                    <ul className="space-y-2 text-sm text-emerald-700">
                        <li className="flex items-start gap-2">
                            <Star size={14} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                            <span>+1 punto por cada 1.000 COP ahorrado frente al precio original</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Leaf size={14} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                            <span>+10 puntos por cada kg de CO₂ que evitas</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Flame size={14} className="flex-shrink-0 mt-0.5 text-orange-500" />
                            <span>🔥 Mantén tu racha para multiplicar puntos hasta x3.0</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Award size={14} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                            <span>Los puntos se acreditan automáticamente al completar un pedido</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <Gift size={14} className="flex-shrink-0 mt-0.5 text-purple-500" />
                            <span>+50 pts cuando un amigo completa su primer pedido con tu código</span>
                        </li>
                    </ul>
                </div>

            </main>

            {/* Share Card Modal */}
            {showShareCard && (
                <ImpactShareCard
                    name={user?.fullName || 'Usuario'}
                    level={levelConfig.label}
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
