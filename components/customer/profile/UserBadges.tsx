import React from 'react';
import { Award, Zap, Flame, Search, Star } from 'lucide-react';
import { Tooltip } from '../../common/Tooltip';
import { User } from '../../../types';

interface UserBadgesProps {
    badges?: User['impact']['badges'];
    totalRescues: number;
}

export const UserBadges: React.FC<UserBadgesProps> = ({ badges = [], totalRescues }) => {
    const allPossibleBadges = [
        {
            id: 'first_rescue',
            name: 'Primer Rescate',
            description: '¡Has salvado tu primer plato! 🎈',
            icon: <Award className="text-amber-500" />,
            check: (res: number) => res >= 1
        },
        {
            id: 'early_bird',
            name: 'Early Bird',
            description: 'Rescata un pack antes de las 9:00 AM ☀️',
            icon: <Zap className="text-yellow-500" />,
            check: () => badges.some(b => b.id === 'early_bird')
        },
        {
            id: 'eco_streak',
            name: 'Eco-Streak',
            description: '3 rescates en una semana 🔥',
            icon: <Flame className="text-orange-600" />,
            check: () => badges.some(b => b.id === 'eco_streak')
        },
        {
            id: 'gourmet',
            name: 'Socio Gourmet',
            description: 'Has probado 3 categorías distintas 🥗',
            icon: <Search className="text-emerald-500" />,
            check: () => badges.some(b => b.id === 'gourmet')
        },
        {
            id: 'guardian',
            name: 'Guardián Élite',
            description: 'Más de 20 platos salvados ✨',
            icon: <Star className="text-purple-500" />,
            check: (res: number) => res >= 20
        }
    ];

    return (
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Award size={24} className="text-emerald-600" />
                Tus Logros y Medallas
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                {allPossibleBadges.map((badge) => {
                    const isEarned = badge.check(totalRescues);

                    return (
                        <Tooltip key={badge.id} text={badge.description}>
                            <div className={`flex flex-col items-center gap-3 transition-all duration-300 ${isEarned ? 'scale-100 opacity-100' : 'scale-90 opacity-40 grayscale'}`}>
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${isEarned ? 'bg-gradient-to-br from-white to-gray-50 border-2 border-emerald-100 ring-4 ring-emerald-50' : 'bg-gray-100 border-2 border-dashed border-gray-300'}`}>
                                    {React.cloneElement(badge.icon as React.ReactElement, { size: 32 })}
                                </div>
                                <span className="text-xs font-bold text-gray-700 text-center uppercase tracking-tighter">
                                    {badge.name}
                                </span>
                                {isEarned && (
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                )}
                            </div>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
};
