import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { venueService } from '../services/venueService';
import { Venue, UserRole } from '../types';
import { logger } from '../utils/logger';

interface ThemeContextType {
    venue: Venue | null;
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string | null;
    isLoading: boolean;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    venue: null,
    primaryColor: '#10b981', // emerald-600 default
    secondaryColor: '#059669', // emerald-700 default
    logoUrl: null,
    isLoading: true,
    isDarkMode: false,
    toggleDarkMode: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [venue, setVenue] = useState<Venue | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('theme');
        return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleDarkMode = () => setIsDarkMode(prev => !prev);

    useEffect(() => {
        const loadVenueTheme = async () => {
            if (user && user.venueId && (user.role === UserRole.VENUE_OWNER || user.role === UserRole.KITCHEN_STAFF || user.role === UserRole.DRIVER)) {
                try {
                    const venueData = await venueService.getVenueById(user.venueId);
                    setVenue(venueData);

                    // Apply CSS custom properties for theming
                    if (venueData.brandColor) {
                        document.documentElement.style.setProperty('--primary-color', venueData.brandColor);
                    }
                    if (venueData.secondaryColor) {
                        document.documentElement.style.setProperty('--secondary-color', venueData.secondaryColor);
                    }
                } catch (error) {
                    logger.error('Failed to load venue theme:', error);
                }
            }
            setIsLoading(false);
        };

        loadVenueTheme();
    }, [user]);

    const value: ThemeContextType = {
        venue,
        primaryColor: venue?.brandColor || '#10b981',
        secondaryColor: venue?.secondaryColor || '#059669',
        logoUrl: venue?.logoUrl || null,
        isLoading,
        isDarkMode,
        toggleDarkMode,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
