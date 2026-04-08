import React from 'react';
import Sidebar from './Sidebar';
import { ChatButton } from './chat/ChatButton';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { OnboardingTour } from './common/OnboardingTour';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  return (
    <div className="flex h-full w-full bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-4 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-8 md:p-8 overflow-y-auto overflow-x-hidden h-full w-full relative scroll-smooth no-scrollbar">
        <div className="max-w-7xl mx-auto pb-[env(safe-area-inset-bottom,0px)] md:pb-8">
          {children}
        </div>
        <PWAInstallPrompt />
      </main>
      <ChatButton />
      {/* Rellena el safe-area-bottom con el mismo bg del layout, evita barra negra */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-50 z-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} aria-hidden />

      {/* Sistema de Onboarding (Solo para Venue Owners Nuevos) */}
      {user && user.role === UserRole.VENUE_OWNER && (
        <OnboardingTour
          isBusinessOwner={true}
          hasSeenOnboarding={user.hasSeenOnboarding || false}
        />
      )}
    </div>
  );
};

export default Layout;