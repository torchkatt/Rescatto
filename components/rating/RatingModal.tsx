import React, { useState } from 'react';
import { X, Star } from 'lucide-react';
import { StarRating } from './StarRating';
import { createRating } from '../../services/ratingService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Order, UserRole } from '../../types';
import { logger } from '../../utils/logger';

interface RatingModalProps {
    order: Order;
    onClose: () => void;
    onSuccess: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({ order, onClose, onSuccess }) => {
    const { user } = useAuth();
    const { success, error } = useToast();

    const [venueRating, setVenueRating] = useState<number>(0);
    const [venueComment, setVenueComment] = useState<string>('');
    const [driverRating, setDriverRating] = useState<number>(0);
    const [driverComment, setDriverComment] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (venueRating === 0) {
            error('Por favor califica al restaurante');
            return;
        }

        if (order.driverId && driverRating === 0) {
            error('Por favor califica al conductor');
            return;
        }

        if (!user) return;

        setLoading(true);

        try {
            // Rate the venue
            await createRating({
                orderId: order.id,
                fromUserId: user.id,
                fromUserRole: UserRole.CUSTOMER,
                toUserId: order.venueId, // Using venueId as the target
                toUserRole: UserRole.VENUE_OWNER,
                score: venueRating,
                comment: venueComment,
                venueId: order.venueId,
            });

            // Rate the driver if exists
            if (order.driverId) {
                await createRating({
                    orderId: order.id,
                    fromUserId: user.id,
                    fromUserRole: UserRole.CUSTOMER,
                    toUserId: order.driverId,
                    toUserRole: UserRole.DRIVER,
                    score: driverRating,
                    comment: driverComment,
                    driverId: order.driverId,
                });
            }

            success('¡Gracias por tu calificación!');
            onSuccess();
            onClose();
        } catch (err: any) {
            logger.error('Error submitting rating:', err);
            error(err.message || 'Error al enviar calificación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto cursor-default"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Star className="text-yellow-400" />
                        Califica tu Experiencia
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Venue Rating */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                        <h3 className="font-semibold text-gray-800 mb-3">Restaurante</h3>
                        <div className="mb-3">
                            <StarRating
                                value={venueRating}
                                onChange={setVenueRating}
                                size="lg"
                            />
                        </div>
                        <textarea
                            value={venueComment}
                            onChange={(e) => setVenueComment(e.target.value)}
                            placeholder="Cuéntanos sobre tu experiencia (opcional)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Driver Rating */}
                    {order.driverId && (
                        <div className="bg-gray-50 p-4 rounded-xl">
                            <h3 className="font-semibold text-gray-800 mb-3">Conductor</h3>
                            <div className="mb-3">
                                <StarRating
                                    value={driverRating}
                                    onChange={setDriverRating}
                                    size="lg"
                                />
                            </div>
                            <textarea
                                value={driverComment}
                                onChange={(e) => setDriverComment(e.target.value)}
                                placeholder="¿Cómo fue el servicio de entrega? (opcional)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                                rows={3}
                            />
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading || venueRating === 0 || (!!order.driverId && driverRating === 0)}
                        >
                            {loading ? 'Enviando...' : 'Enviar Calificación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RatingModal;
