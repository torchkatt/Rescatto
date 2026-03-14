import React, { useState } from 'react';
import { UsersManager } from './UsersManager';
import { VenuesManager } from './VenuesManager';
import { AdminOverview } from './sections/AdminOverview';
import { AdminInventory } from './sections/AdminInventory';
import { AdminSales } from './sections/AdminSales';
import { AdminDeliveries } from './sections/AdminDeliveries';
import { AdminSettings } from './sections/AdminSettings';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Users,
    Store,
    Package,
    BarChart3,
    Truck,
    Settings,
    LogOut
} from 'lucide-react';
import { ChatButton } from '../../components/chat/ChatButton';

export const SuperAdminDashboard: React.FC = () => {
    const { logout } = useAuth();

    return (
        <div className="space-y-6 overflow-x-hidden">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">Panel de Super Administrador</h1>
                <p className="text-gray-500">Vista general y control total de la plataforma.</p>
            </div>

            {/* 
               We are transitioning to a route-based approach via Sidebar. 
               However, to keep current functionality working immediately inside this dashboard "home",
               we can render the Overview by default, or provide links card.
               
               Actually, the Sidebar links now point to /admin/users, /admin/venues etc.
               So this /admin page should mainly be the Dashboard Overview.
            */}
            <AdminOverview />
        </div>
    );
};;