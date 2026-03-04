import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Share2, Copy, Gift, Users, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { logger } from '../../utils/logger';

interface Props {
    user: User;
}

const REFERRAL_BONUS = 50; // puntos por cada amigo que completa su primer pedido

export const ReferralSection: React.FC<Props> = ({ user }) => {
    const { success, error } = useToast();
    const [copied, setCopied] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [friendCount, setFriendCount] = useState<number | null>(null);

    const referralCode = user.referralCode || 'ACTUALIZA';
    const referralLink = `https://rescatto.com/registro?ref=${referralCode}`;
    const shareText = `¡Únete a Rescatto con mi código y salvemos el planeta comiendo delicioso! 🌱\n\nUsa el código: *${referralCode}*\nO regístrate directo: ${referralLink}`;

    // Count how many users have been invited with this code
    useEffect(() => {
        if (!user.referralCode) return;
        const q = query(collection(db, 'users'), where('invitedBy', '==', user.referralCode));
        getCountFromServer(q)
            .then(snap => setFriendCount(snap.data().count))
            .catch(err => logger.error('Error counting referrals:', err));
    }, [user.referralCode]);

    const copyToClipboard = async (text: string, label = 'Código') => {
        if (referralCode === 'ACTUALIZA') return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            success(`${label} copiado al portapapeles ✓`);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            error('Error al copiar');
        }
    };

    const handleWhatsApp = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank', 'noopener');
    };

    const handleNativeShare = async () => {
        if (referralCode === 'ACTUALIZA') return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Únete a Rescatto 🌱',
                    text: shareText,
                    url: referralLink,
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') handleWhatsApp();
            }
        } else {
            handleWhatsApp();
        }
    };

    const pointsEarned = (friendCount ?? 0) * REFERRAL_BONUS;

    return (
        <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-gray-100 mb-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center text-emerald-600 shadow-inner">
                        <Gift size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Invita y Gana</h2>
                        <p className="text-gray-500 text-sm">
                            +{REFERRAL_BONUS} puntos para ti y tu amigo en su primer rescate
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                    <p className="text-2xl font-black text-emerald-600">{friendCount ?? '—'}</p>
                    <p className="text-xs text-emerald-700 font-medium mt-0.5">amigos<br/>invitados</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                    <p className="text-2xl font-black text-amber-600">{pointsEarned}</p>
                    <p className="text-xs text-amber-700 font-medium mt-0.5">pts<br/>ganados</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                    <p className="text-2xl font-black text-blue-600">+{REFERRAL_BONUS}</p>
                    <p className="text-xs text-blue-700 font-medium mt-0.5">pts por<br/>cada uno</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: código + QR + botones */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col items-center text-center shadow-lg shadow-emerald-500/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10" />

                    <p className="text-emerald-50 mb-2 font-medium text-sm relative z-10">Tu código único</p>

                    {/* Toggle: Code / QR */}
                    <div className="flex gap-2 mb-4 relative z-10">
                        <button
                            onClick={() => setShowQR(false)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${!showQR ? 'bg-white text-emerald-700' : 'bg-white/20 text-white'}`}
                        >
                            Código
                        </button>
                        <button
                            onClick={() => setShowQR(true)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${showQR ? 'bg-white text-emerald-700' : 'bg-white/20 text-white'}`}
                        >
                            QR
                        </button>
                    </div>

                    {showQR ? (
                        <div className="bg-white p-3 rounded-2xl mb-4 relative z-10">
                            <QRCodeSVG
                                value={referralLink}
                                size={140}
                                level="M"
                                marginSize={0}
                            />
                            <p className="text-[10px] text-gray-500 mt-1 font-medium">{referralCode}</p>
                        </div>
                    ) : (
                        <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-8 py-4 mb-4 relative z-10 w-full max-w-[240px]">
                            <div className="text-4xl font-black tracking-widest text-white">
                                {referralCode}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 w-full max-w-[280px] relative z-10">
                        <button
                            onClick={() => copyToClipboard(referralCode, 'Código')}
                            className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-sm"
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copiado' : 'Copiar'}
                        </button>
                        <button
                            onClick={handleNativeShare}
                            className="flex-1 bg-white text-emerald-700 hover:bg-emerald-50 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-sm shadow-sm"
                        >
                            <Share2 size={16} />
                            Compartir
                        </button>
                    </div>

                    {/* WhatsApp button */}
                    <button
                        onClick={handleWhatsApp}
                        className="mt-2 w-full max-w-[280px] relative z-10 bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
                    >
                        <span className="text-base">💬</span>
                        Enviar por WhatsApp
                    </button>

                    {/* Copy link */}
                    <button
                        onClick={() => copyToClipboard(referralLink, 'Enlace')}
                        className="mt-1.5 text-white/60 text-[11px] hover:text-white/90 transition-colors relative z-10 underline underline-offset-2"
                    >
                        Copiar enlace directo
                    </button>
                </div>

                {/* Right: How it works */}
                <div className="flex flex-col justify-center space-y-5 bg-gray-50 rounded-3xl p-6 border border-gray-100">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 border border-blue-200 text-lg font-black">
                            1
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Invita a tus amigos</h3>
                            <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">
                                Comparte tu código o QR. Se registran con tu código al crear su cuenta.
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-gray-200 ml-14" />

                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 border border-amber-200 text-lg font-black">
                            2
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Hacen su primer rescate</h3>
                            <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">
                                Cuando completen su primer pedido, el bono se acredita automáticamente.
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-gray-200 ml-14" />

                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 border border-emerald-200 text-lg font-black">
                            3
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">¡Ambos ganan 50 pts!</h3>
                            <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">
                                Tú y tu amigo reciben +{REFERRAL_BONUS} puntos sin límite de referidos.
                            </p>
                        </div>
                    </div>

                    {/* Progress / next milestone */}
                    {friendCount !== null && (
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Users size={14} className="text-emerald-600" />
                                <p className="text-sm font-bold text-emerald-700">
                                    {friendCount} amigo{friendCount !== 1 ? 's' : ''} invitado{friendCount !== 1 ? 's' : ''}
                                </p>
                            </div>
                            {friendCount < 5 && (
                                <p className="text-xs text-emerald-600">
                                    Invita {5 - friendCount} más y desbloquea la insignia <span className="font-bold">Embajador 🌟</span>
                                </p>
                            )}
                            {friendCount >= 5 && (
                                <p className="text-xs text-emerald-600 font-bold">
                                    🌟 ¡Eres un Embajador de Rescatto!
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
