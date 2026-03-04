import React from 'react';
import { User, UserRole } from '../../types';
import { Mail, Shield, Calendar, MapPin, Smartphone, User as UserIcon, CheckCircle } from 'lucide-react';

interface UserProfilePreviewProps {
    user: User;
    venues?: any[];
}

export const UserProfilePreview: React.FC<UserProfilePreviewProps> = ({ user, venues = [] }) => {
    const getRoleColor = (role: UserRole) => {
        switch (role) {
            case UserRole.SUPER_ADMIN: return 'bg-purple-100 text-purple-700 border-purple-200';
            case UserRole.ADMIN: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case UserRole.VENUE_OWNER: return 'bg-blue-100 text-blue-700 border-blue-200';
            case UserRole.KITCHEN_STAFF: return 'bg-orange-100 text-orange-700 border-orange-200';
            case UserRole.DRIVER: return 'bg-amber-100 text-amber-700 border-amber-200';
            case UserRole.CUSTOMER: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getRoleLabel = (role: UserRole) => {
        const labels: Record<string, string> = {
            [UserRole.SUPER_ADMIN]: 'Super Admin',
            [UserRole.ADMIN]: 'Administrador',
            [UserRole.VENUE_OWNER]: 'Dueño',
            [UserRole.KITCHEN_STAFF]: 'Cocina',
            [UserRole.DRIVER]: 'Repartidor',
            [UserRole.CUSTOMER]: 'Cliente',
        };
        return labels[role] || role;
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden font-sans border border-gray-100 max-w-[320px] mx-auto relative">
            {/* Header Background */}
            <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-600 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            </div>

            {/* Avatar & Basic Info */}
            <div className="px-6 pb-6 text-center -mt-12 relative">
                <div className="inline-block relative">
                    <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg mx-auto">
                        <div className="w-full h-full bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-3xl font-bold">
                            {user.fullName?.charAt(0).toUpperCase() || <UserIcon size={32} />}
                        </div>
                    </div>
                    {user.isVerified && (
                        <div className="absolute bottom-1 right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-white shadow-sm" title="Usuario Verificado">
                            <CheckCircle size={12} />
                        </div>
                    )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 mt-3 mb-1">{user.fullName || 'Sin Nombre'}</h3>

                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getRoleColor(user.role)}`}>
                    <Shield size={10} className="mr-1.5" />
                    {getRoleLabel(user.role)}
                </div>
            </div>

            {/* Detailed Info */}
            <div className="px-6 pb-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 transition-colors hover:bg-emerald-50/50 hover:border-emerald-100">
                    <div className="bg-white p-2 rounded-lg text-gray-400 shadow-sm shrink-0">
                        <Mail size={16} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Email</p>
                        <p className="text-sm text-gray-700 font-medium truncate" title={user.email}>{user.email}</p>
                    </div>
                </div>

                {user.phone && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 transition-colors hover:bg-emerald-50/50 hover:border-emerald-100">
                        <div className="bg-white p-2 rounded-lg text-gray-400 shadow-sm shrink-0">
                            <Smartphone size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Teléfono</p>
                            <p className="text-sm text-gray-700 font-medium">{user.phone}</p>
                        </div>
                    </div>
                )}

                {(user.venueId || (user.venueIds && user.venueIds.length > 0) || user.role === UserRole.SUPER_ADMIN) && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 transition-colors hover:bg-emerald-50/50 hover:border-emerald-100">
                        <div className="bg-white p-2 rounded-lg text-gray-400 shadow-sm shrink-0">
                            <MapPin size={16} />
                        </div>
                        <div className="w-full text-left">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sede(s)</p>
                            <p className="text-sm text-gray-700 font-medium truncate">
                                {user.role === UserRole.SUPER_ADMIN ? (
                                    <span className="text-purple-600 font-bold italic">Todas las sedes</span>
                                ) : user.venueIds && user.venueIds.length > 0 ? (
                                    user.venueIds.map(id => {
                                        const venue = venues.find(v => v.id === id);
                                        return venue ? venue.name : id;
                                    }).join(', ')
                                ) : user.venueId ? (
                                    (() => {
                                        const venue = venues.find(v => v.id === user.venueId);
                                        return venue ? venue.name : (user.venueId === 'default-venue' ? 'Sede por defecto' : user.venueId);
                                    })()
                                ) : 'Sin sede asignada'}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="bg-white p-2 rounded-lg text-gray-400 shadow-sm shrink-0">
                        <Calendar size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Miembro Desde</p>
                        <p className="text-sm text-gray-700 font-medium">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Actions (Visual Only) */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between gap-3">
                <button className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold shadow-sm hover:bg-gray-50">
                    Mensaje
                </button>
                <button className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold shadow-sm hover:bg-gray-50">
                    Ver Historial
                </button>
            </div>
        </div>
    );
};
