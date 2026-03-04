import React, { useEffect, useState } from 'react';
import { DonationCenter } from '../../../types';
import { dataService } from '../../../services/dataService';
import { Heart, MapPin, Phone, Building2, Info, CheckCircle2 } from 'lucide-react';
import { logger } from '../../../utils/logger';

interface DonationCenterSelectorProps {
    onSelect: (center: DonationCenter | null) => void;
    selectedCenterId?: string;
}

export const DonationCenterSelector: React.FC<DonationCenterSelectorProps> = ({ onSelect, selectedCenterId }) => {
    const [centers, setCenters] = useState<DonationCenter[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCenters = async () => {
            try {
                const data = await dataService.getDonationCenters();
                setCenters(data);
            } catch (error) {
                logger.error("Error fetching donation centers:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCenters();
    }, []);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'SHELTER': return <Heart size={16} />;
            case 'NURSING_HOME': return <Building2 size={16} />;
            case 'FOUNDATION': return <Info size={16} />;
            default: return <MapPin size={16} />;
        }
    };

    const getTypeText = (type: string) => {
        switch (type) {
            case 'SHELTER': return 'Albergue';
            case 'NURSING_HOME': return 'Asilo / Ancianato';
            case 'FOUNDATION': return 'Fundación';
            default: return 'Institución';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 animate-pulse">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Heart className="text-emerald-500 animate-bounce" size={24} />
                </div>
                <p className="text-emerald-700 font-medium font-poppins">Cargando centros de ayuda...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {centers.map((center) => (
                    <div
                        key={center.id}
                        onClick={() => onSelect(center)}
                        className={`relative group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-300 transform hover:scale-[1.02] ${selectedCenterId === center.id
                                ? 'border-emerald-500 bg-emerald-50/50 shadow-lg ring-1 ring-emerald-500/20'
                                : 'border-gray-100 bg-white hover:border-emerald-200 hover:shadow-md'
                            }`}
                    >
                        {/* Status Badge */}
                        {selectedCenterId === center.id && (
                            <div className="absolute top-3 right-3 z-10 animate-scaleIn">
                                <CheckCircle2 className="text-emerald-600 fill-emerald-50" size={24} />
                            </div>
                        )}

                        <div className="flex h-full">
                            {/* Image side */}
                            <div className="w-24 h-full relative overflow-hidden hidden sm:block">
                                <img
                                    src={center.imageUrl || 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=400&q=80'}
                                    alt={center.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-emerald-900/10 group-hover:bg-transparent transition-colors"></div>
                            </div>

                            {/* Content side */}
                            <div className="flex-1 p-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                        {getTypeIcon(center.type)}
                                        {getTypeText(center.type)}
                                    </span>
                                </div>
                                <h4 className="font-bold text-gray-800 leading-tight mb-1 group-hover:text-emerald-700 transition-colors">
                                    {center.name}
                                </h4>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <MapPin size={12} className="text-emerald-400" />
                                        {center.address}, {center.city}
                                    </p>
                                    <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                                        {center.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {centers.length === 0 && (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <Heart size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 font-medium">No hay centros disponibles en este momento.</p>
                </div>
            )}
        </div>
    );
};
