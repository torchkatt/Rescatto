import React from 'react';
import { Leaf, DollarSign, Cloud, Award } from 'lucide-react';
import { User } from '../../../types';

interface ImpactStatsProps {
    impact?: User['impact'];
}

export const ImpactStats: React.FC<ImpactStatsProps> = ({ impact }) => {
    // Default values if no impact data exists yet
    const stats = {
        co2Saved: impact?.co2Saved || 0,
        moneySaved: impact?.moneySaved || 0,
        totalRescues: impact?.totalRescues || 0,
        treesEquivalent: impact?.treesEquivalent || (impact?.co2Saved ? Math.floor(impact.co2Saved / 25) : 0)
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* CO2 Saved Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <Cloud size={120} className="text-emerald-600" />
                </div>
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 text-emerald-600">
                        <Cloud size={24} />
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-1">
                        {stats.co2Saved.toFixed(1)} <span className="text-lg font-bold">kg</span>
                    </div>
                    <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">CO2 Ahorrado</div>
                    <p className="text-xs text-gray-400 mt-2">Equivale a {stats.treesEquivalent} árboles plantados 🌳</p>
                </div>
            </div>

            {/* Money Saved Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-blue-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <DollarSign size={120} className="text-blue-600" />
                </div>
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                        <DollarSign size={24} />
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-1">
                        <span className="text-lg font-bold">$</span>{stats.moneySaved.toLocaleString()}
                    </div>
                    <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Dinero Ahorrado</div>
                    <p className="text-xs text-gray-400 mt-2">¡Tu bolsillo y el planeta te lo agradecen! 👏</p>
                </div>
            </div>

            {/* Total Rescues Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-orange-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <Award size={120} className="text-orange-600" />
                </div>
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-4 text-orange-600">
                        <Award size={24} />
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-1">
                        {stats.totalRescues}
                    </div>
                    <div className="text-sm font-semibold text-orange-600 uppercase tracking-wider">Rescates</div>
                    <p className="text-xs text-gray-400 mt-2">Cada plato salvado cuenta una historia ✨</p>
                </div>
            </div>
        </div>
    );
};
