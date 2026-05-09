import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlashDeal } from '../../../types';
import { flashDealService } from '../../../services/flashDealService';
import { Zap, ChevronRight, X } from 'lucide-react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface Props {
    deal: FlashDeal;
    onDismiss?: () => void;
}

export const FlashDealBanner: React.FC<Props> = ({ deal, onDismiss }) => {
    const navigate = useNavigate();
    const [secondsLeft, setSecondsLeft] = useState(flashDealService.getSecondsRemaining(deal));
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const dealEndTime = deal.endTime;
    useEffect(() => {
        setSecondsLeft(Math.max(0, Math.floor((new Date(dealEndTime).getTime() - Date.now()) / 1000)));
        intervalRef.current = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [dealEndTime]);

    if (secondsLeft <= 0) return null;

    const countdown = flashDealService.formatCountdown(secondsLeft);
    const isUrgent = secondsLeft < 600; // < 10 min

    const handleClick = () => {
        if (deal.productId) navigate(`/app/product/${deal.productId}`);
        else navigate(`/app/venue/${deal.venueId}`);
    };

    return (
        <div
            className={`relative rounded-2xl overflow-hidden shadow-lg cursor-pointer active:scale-98 transition-all ${isUrgent
                ? 'bg-gradient-to-r from-red-600 to-orange-600'
                : 'bg-gradient-to-r from-purple-700 to-indigo-700'
            } text-white`}
            onClick={handleClick}
        >
            {/* Animated pulse background */}
            {isUrgent && (
                <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
            )}

            {/* Dismiss button */}
            {onDismiss && (
                <button
                    onClick={e => { e.stopPropagation(); onDismiss(); }}
                    className="absolute top-2 right-2 z-10 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                    <X size={14} />
                </button>
            )}

            <div className="p-4 flex items-center gap-4">
                {/* Image or icon */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center ${isUrgent ? 'bg-white/20' : 'bg-white/10'}`}>
                    {deal.imageUrl ? (
                        <img src={deal.imageUrl} alt={deal.title} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                        <Zap size={28} className="text-yellow-300" />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isUrgent ? 'bg-white text-red-600' : 'bg-yellow-400 text-purple-900'}`}>
                            ⚡ FLASH DEAL
                        </span>
                        <span className={`text-[10px] font-bold ${isUrgent ? 'text-white animate-pulse' : 'text-white/80'}`}>
                            -{deal.extraDiscountPct}% EXTRA
                        </span>
                    </div>
                    <p className="font-black text-sm leading-tight line-clamp-1">{deal.title}</p>
                    <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{deal.venueName}</p>
                </div>

                {/* Countdown */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div className={`font-black text-xl tabular-nums leading-none ${isUrgent ? 'text-yellow-300' : 'text-white'}`}>
                        {countdown}
                    </div>
                    <p className="text-[10px] text-white/60">restante</p>
                    <ChevronRight size={16} className="text-white/60" />
                </div>
            </div>
        </div>
    );
};

// ─── List variant: all active flash deals ─────────────────────────────────────
export const FlashDealsSection: React.FC = () => {
    const [deals, setDeals] = useState<FlashDeal[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

    useEffect(() => {
        const loadInitial = async () => {
            const page = await flashDealService.getActiveDealsPage(null, 20);
            setDeals(page.data);
            setLastDoc(page.lastDoc);
            setHasMore(page.hasMore);
        };
        loadInitial();
    }, []);

    const visibleDeals = deals.filter(d => !dismissed.has(d.id));
    if (visibleDeals.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Zap size={18} className="text-yellow-500" />
                <h2 className="text-base font-black text-gray-900">Flash Deals</h2>
                <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {visibleDeals.length} activo{visibleDeals.length !== 1 ? 's' : ''}
                </span>
            </div>
            {visibleDeals.map(deal => (
                <FlashDealBanner
                    key={deal.id}
                    deal={deal}
                    onDismiss={() => setDismissed(prev => new Set([...prev, deal.id]))}
                />
            ))}
            {hasMore && (
                <div className="flex justify-center">
                    <button
                        onClick={async () => {
                            if (loadingMore) return;
                            setLoadingMore(true);
                            const next = await flashDealService.getActiveDealsPage(lastDoc, 20);
                            setDeals(prev => [...prev, ...next.data]);
                            setLastDoc(next.lastDoc);
                            setHasMore(next.hasMore);
                            setLoadingMore(false);
                        }}
                        disabled={loadingMore}
                        className="px-3 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-60"
                    >
                        {loadingMore ? 'Cargando...' : 'Cargar más deals'}
                    </button>
                </div>
            )}
        </div>
    );
};
