import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Share2, Copy, Gift, Users, Check, Star, Trophy, Award, Zap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db, functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { logger } from '../../utils/logger';

interface Props {
    user: User;
}

const REFERRAL_BONUS = 50; // puntos por cada amigo que completa su primer pedido

export const ReferralSection: React.FC<Props> = ({ user }) => {
    const { success, error } = useToast();
    const [copied, setCopied] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [friendCount, setFriendCount] = useState(0);
    const [isCounting, setIsCounting] = useState(false);
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [referralCode, setReferralCode] = useState((user.referralCode || '').trim());

    const hasValidReferralCode = referralCode.length >= 6;
    const referralLink = `https://rescatto.com/registro?ref=${referralCode}`;
    const shareText = `¡Únete a Rescatto con mi código y salvemos el planeta comiendo delicioso! 🌱\n\nUsa el código: *${referralCode}*\nO regístrate directo: ${referralLink}`;

    useEffect(() => {
        if (hasValidReferralCode) return;

        const ensureCode = async () => {
            setIsGeneratingCode(true);
            try {
                const ensureReferralCode = httpsCallable(functions, 'ensureReferralCode');
                const result: any = await ensureReferralCode({});
                const code = (result?.data?.referralCode || '').trim();
                if (code.length >= 6) {
                    setReferralCode(code);
                }
            } catch (err) {
                logger.error('Error ensuring referral code:', err);
                const code = (err as any)?.code || '';
                if (!String(code).includes('not-found')) {
                    error('No fue posible generar tu código de referido en este momento.');
                }
            } finally {
                setIsGeneratingCode(false);
            }
        };

        ensureCode();
    }, [hasValidReferralCode, error]);

    // Count how many users have been invited with this code
    useEffect(() => {
        if (!hasValidReferralCode) return;
        setIsCounting(true);
        
        const getStats = async () => {
            try {
                const getReferralStats = httpsCallable(functions, 'getReferralStats');
                const result: any = await getReferralStats({});
                setFriendCount(result.data.count || 0);
            } catch (err) {
                logger.error('Error getting referral stats:', err);
            } finally {
                setIsCounting(false);
            }
        };

        getStats();
    }, [hasValidReferralCode, referralCode]);

    const copyToClipboard = async (text: string, label = 'Código') => {
        if (!hasValidReferralCode) {
            error('Tu código aún no está disponible. Intenta de nuevo en unos segundos.');
            return;
        }
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
        if (!hasValidReferralCode) {
            error('Tu código aún no está disponible para compartir.');
            return;
        }
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
        <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-6 lg:p-10 shadow-2xl shadow-emerald-500/5 border border-white/50 mb-6 animate-in slide-in-from-bottom-6 duration-700 ease-out">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 mb-10 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-600 shadow-inner border border-emerald-100/50">
                        <Gift size={32} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Invita y Gana</h2>
                        <p className="text-slate-500 text-sm font-medium">
                            +{REFERRAL_BONUS} puntos para ti y tu amigo en su primer rescate
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats row */}
            {isGeneratingCode && (
                <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/50 backdrop-blur-sm px-4 py-3 text-sm text-amber-700 font-bold flex items-center gap-2 animate-pulse">
                    <Zap size={16} />
                    Generando tu código de referido...
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                <div className="bg-emerald-50/50 backdrop-blur-sm rounded-3xl p-5 text-center border border-emerald-100 shadow-sm hover:shadow-md transition-all group">
                    <p className="text-3xl font-black text-emerald-600 leading-none group-hover:scale-110 transition-transform">{isCounting ? '...' : friendCount}</p>
                    <p className="text-[11px] text-emerald-700 font-black mt-3 uppercase tracking-widest leading-tight">Amigos<br/>Invitados</p>
                </div>
                <div className="bg-amber-50/50 backdrop-blur-sm rounded-3xl p-5 text-center border border-amber-100 shadow-sm hover:shadow-md transition-all group">
                    <p className="text-3xl font-black text-amber-600 leading-none group-hover:scale-110 transition-transform">{pointsEarned}</p>
                    <p className="text-[11px] text-amber-700 font-black mt-3 uppercase tracking-widest leading-tight">Puntos<br/>Totales</p>
                </div>
                <div className="bg-blue-50/50 backdrop-blur-sm rounded-3xl p-5 text-center border border-blue-100 shadow-sm hover:shadow-md transition-all group">
                    <p className="text-3xl font-black text-blue-600 leading-none group-hover:scale-110 transition-transform">+{REFERRAL_BONUS}</p>
                    <p className="text-[11px] text-blue-700 font-black mt-3 uppercase tracking-widest leading-tight">Bono por<br/>Amigo</p>
                </div>
                <div className="bg-purple-50/50 backdrop-blur-sm rounded-3xl p-5 text-center border border-purple-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute -top-1 -right-1 p-2 opacity-5 group-hover:opacity-20 transition-opacity">
                        <Star size={24} />
                    </div>
                    <p className="text-2xl font-black text-purple-600 leading-none tracking-tighter group-hover:scale-105 transition-transform">
                        {friendCount >= 15 ? 'GOLD' : friendCount >= 5 ? 'SILVER' : 'BRONZE'}
                    </p>
                    <p className="text-[11px] text-purple-700 font-black mt-3 uppercase tracking-widest leading-tight">Nivel<br/>Referidor</p>
                </div>
            </div>

            {/* Progress to next Tier */}
            <div className="mb-12 bg-slate-50/80 backdrop-blur-sm rounded-[2rem] p-8 border border-slate-100/50 shadow-inner">
                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-3 mb-6">
                    <div className="text-center sm:text-left">
                        <h4 className="font-black text-slate-800 text-lg tracking-tight mb-1">Tu Camino a Premium</h4>
                        <p className="text-sm text-slate-500 font-medium">
                            {friendCount >= 15 ? '✨ ¡Nivel Máximo Alcanzado!' : `Próximo hito: ${friendCount < 5 ? 5 : 15} amigos`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-700 bg-emerald-100/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-emerald-200/50">
                            {friendCount < 5 ? '🥉 BRONZE' : friendCount < 15 ? '🥈 SILVER' : '🥇 GOLD'}
                        </span>
                    </div>
                </div>
                
                <div className="relative pt-4 pb-2">
                    <div className="h-4 bg-slate-200/50 rounded-full overflow-hidden relative shadow-inner">
                        <div 
                            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 transition-all duration-1000 ease-out flex items-center justify-end px-3 relative"
                            style={{ width: `${Math.min((friendCount / (friendCount < 5 ? 5 : 15)) * 100, 100)}%` }}
                        >
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-glow"></div>
                        </div>
                    </div>
                    
                    {/* Markers */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex justify-between px-1">
                        <div className="flex flex-col items-center">
                            <div className={`w-1 h-5 rounded-full ${friendCount >= 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        </div>
                        <div className="flex flex-col items-center" style={{ left: '33.3%' }}>
                            <div className={`w-1 h-5 rounded-full ${friendCount >= 5 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        </div>
                        <div className="flex flex-col items-center" style={{ left: '100%' }}>
                            <div className={`w-1 h-5 rounded-full ${friendCount >= 15 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between mt-4 px-1">
                    <div className="text-center">
                        <span className="text-[10px] font-black text-slate-400 block uppercase">Inicio</span>
                        <span className="text-xs font-black text-slate-800">0</span>
                    </div>
                    <div className="text-center">
                        <span className="text-[10px] font-black text-slate-400 block uppercase">Silver</span>
                        <span className="text-xs font-black text-slate-800">5</span>
                    </div>
                    <div className="text-center">
                        <span className="text-[10px] font-black text-slate-400 block uppercase">Gold</span>
                        <span className="text-xs font-black text-slate-800">15</span>
                    </div>
                    <div className="text-center">
                        <span className="text-[10px] font-black text-slate-400 block uppercase">Elite</span>
                        <span className="text-xs font-black text-slate-800">25+</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                {/* Left: código + QR + botones */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden flex flex-col items-center text-center shadow-2xl shadow-emerald-500/30 group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-1000" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-[80px] -ml-32 -mb-32 transition-transform group-hover:scale-110 duration-1000" />

                    <p className="text-emerald-50 mb-4 font-black text-xs uppercase tracking-[0.2em] relative z-10 opacity-80">Tu código exclusivo</p>

                    {/* Toggle: Code / QR */}
                    <div className="bg-black/20 backdrop-blur-lg p-1.5 rounded-2xl mb-8 relative z-10 flex gap-1 border border-white/10 shadow-lg w-full max-w-[180px]">
                        <button
                            onClick={() => setShowQR(false)}
                            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${!showQR ? 'bg-white text-emerald-700 shadow-lg scale-[1.02]' : 'hover:bg-white/10 text-white'}`}
                            disabled={!hasValidReferralCode}
                        >
                            Código
                        </button>
                        <button
                            onClick={() => setShowQR(true)}
                            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${showQR ? 'bg-white text-emerald-700 shadow-lg scale-[1.02]' : 'hover:bg-white/10 text-white'}`}
                            disabled={!hasValidReferralCode}
                        >
                            QR
                        </button>
                    </div>

                    <div className="w-full flex justify-center items-center h-[200px] mb-8 relative z-10">
                        {showQR ? (
                            <div className="bg-white p-5 rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-500 transform hover:scale-105 transition-transform border border-emerald-100">
                                <QRCodeSVG
                                    value={referralLink}
                                    size={150}
                                    level="H"
                                    marginSize={1}
                                    includeMargin={false}
                                />
                                <div className="mt-3 flex items-center justify-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{referralCode}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/15 backdrop-blur-xl border border-white/30 rounded-[2rem] px-10 py-7 shadow-2xl transform hover:scale-105 transition-all duration-500 group/code w-full max-w-[280px]">
                                <div className="text-4xl sm:text-5xl font-black tracking-widest text-white drop-shadow-lg scale-y-110">
                                    {hasValidReferralCode ? referralCode : '...'}
                                </div>
                                <div className="mt-4 flex items-center justify-center gap-2 opacity-60 group-hover/code:opacity-100 transition-opacity">
                                    <Copy size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Toca para copiar</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full relative z-10">
                        <button
                            onClick={() => copyToClipboard(referralCode, 'Código')}
                            className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/20 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-xl active:scale-95 disabled:opacity-50"
                            disabled={!hasValidReferralCode}
                        >
                            {copied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} strokeWidth={2.5} />}
                            {copied ? '¡COPIADO!' : 'COPIAR CÓDIGO'}
                        </button>
                        <button
                            onClick={handleNativeShare}
                            className="flex-1 bg-white text-emerald-700 hover:bg-emerald-50 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-2xl active:scale-95 shadow-emerald-900/10 disabled:opacity-50"
                            disabled={!hasValidReferralCode}
                        >
                            <Share2 size={18} strokeWidth={2.5} />
                            COMPARTIR
                        </button>
                    </div>

                    {/* WhatsApp button */}
                    <button
                        onClick={handleWhatsApp}
                        className="mt-4 w-full relative z-10 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2.5 text-sm shadow-xl shadow-green-900/10 active:scale-95 disabled:opacity-50"
                        disabled={!hasValidReferralCode}
                    >
                        <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                            <span className="text-xs">💬</span>
                        </div>
                        ENVIAR POR WHATSAPP
                    </button>

                    {/* Copy link */}
                    <button
                        onClick={() => copyToClipboard(referralLink, 'Enlace')}
                        className="mt-6 text-white/50 text-[11px] hover:text-white transition-colors relative z-10 font-bold uppercase tracking-widest flex items-center gap-1.5"
                    >
                        <div className="w-1 h-1 rounded-full bg-white/30" />
                        Copiar enlace directo
                    </button>
                </div>

                {/* Right: How it works + Rewards */}
                <div className="flex flex-col space-y-6">
                    <div className="bg-slate-50/50 backdrop-blur-sm rounded-[2.5rem] p-8 border border-slate-100/50 flex flex-col justify-between h-full">
                        <div className="space-y-8">
                            <div className="flex items-start gap-5 group">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center flex-shrink-0 border-4 border-white shadow-xl group-hover:scale-110 transition-transform text-xl font-black italic">
                                    1
                                </div>
                                <div className="pt-1">
                                    <h3 className="font-black text-slate-800 tracking-tight text-lg">Invita a tus amigos</h3>
                                    <p className="text-slate-500 text-sm mt-1 leading-relaxed font-medium">
                                        Comparte tu código o QR exclusivo. Tus amigos se registran y ambos ganan desde el inicio.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-5 group">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 border-4 border-white shadow-xl group-hover:scale-110 transition-transform text-xl font-black italic">
                                    2
                                </div>
                                <div className="pt-1">
                                    <h3 className="font-black text-slate-800 tracking-tight text-lg">Su primer rescate</h3>
                                    <p className="text-slate-500 text-sm mt-1 leading-relaxed font-medium">
                                        El bono de <span className="text-amber-600 font-bold">50 puntos</span> se acredita en cuanto tu amigo complete su primer pedido.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-5 group">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 border-4 border-white shadow-xl group-hover:scale-110 transition-transform text-xl font-black italic">
                                    3
                                </div>
                                <div className="pt-1">
                                    <h3 className="font-black text-slate-800 tracking-tight text-lg">¡Escala niveles!</h3>
                                    <p className="text-slate-500 text-sm mt-1 leading-relaxed font-medium">
                                        Entre más amigos invites, mejores beneficios desbloqueas. ¡Sin límites! 🚀
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tier Benefits */}
                        <div className="mt-10 space-y-4 pt-10 border-t border-slate-200/50">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Recompensas desbloqueables</h4>
                            
                            <div className={`p-5 rounded-3xl border transition-all duration-500 flex items-center gap-4 ${friendCount >= 5 ? 'bg-emerald-500 text-white border-emerald-400 shadow-xl shadow-emerald-500/20' : 'bg-white border-slate-100 opacity-60 grayscale-[0.5]'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${friendCount >= 5 ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                                    <Award size={24} strokeWidth={2.5} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <p className="font-black text-sm tracking-tight uppercase">Embajador Silver</p>
                                        <p className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${friendCount >= 5 ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>5 AMIGOS</p>
                                    </div>
                                    <p className={`text-[11px] mt-1 font-bold ${friendCount >= 5 ? 'text-emerald-50' : 'text-slate-500'}`}>✨ Insignia especial y +10% puntos extra.</p>
                                </div>
                                {friendCount >= 5 && <Check className="text-white" size={24} strokeWidth={3} />}
                            </div>

                            <div className={`p-5 rounded-3xl border transition-all duration-500 flex items-center gap-4 ${friendCount >= 15 ? 'bg-amber-500 text-white border-amber-400 shadow-xl shadow-amber-500/20' : 'bg-white border-slate-100 opacity-60 grayscale-[0.5]'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${friendCount >= 15 ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                                    <Zap size={24} strokeWidth={2.5} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <p className="font-black text-sm tracking-tight uppercase">Gurú Gold</p>
                                        <p className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${friendCount >= 15 ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>15 AMIGOS</p>
                                    </div>
                                    <p className={`text-[11px] mt-1 font-bold ${friendCount >= 15 ? 'text-amber-50' : 'text-slate-500'}`}>🚀 1 mes de Rescatto Pass Gratis.</p>
                                </div>
                                {friendCount >= 15 && <Check className="text-white" size={24} strokeWidth={3} />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
