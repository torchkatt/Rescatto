import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { logger } from '../utils/logger';

export const useFavorites = () => {
    const { user } = useAuth();
    const [favorites, setFavorites] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Load favorites from localStorage first (for speed), then sync with Firestore
    useEffect(() => {
        if (!user) {
            setFavorites([]);
            setLoading(false);
            return;
        }

        const localKey = `rescatto_favs_${user.id}`;

        // 1. Load Local
        const localFavs = localStorage.getItem(localKey);
        if (localFavs) {
            try {
                setFavorites(JSON.parse(localFavs));
            } catch {
                localStorage.removeItem(localKey);
            }
            setLoading(false);
        }

        // 2. Sync with Firestore (Background)
        let cancelled = false;
        const fetchRemote = async () => {
            try {
                const userRef = doc(db, 'users', user.id);
                const userDoc = await getDoc(userRef);

                if (!cancelled && userDoc.exists()) {
                    const userData = userDoc.data();
                    const remoteFavs = userData.favoriteVenueIds || [];

                    // Update state and local storage if different
                    if (JSON.stringify(remoteFavs) !== localFavs) {
                        setFavorites(remoteFavs);
                        localStorage.setItem(localKey, JSON.stringify(remoteFavs));
                    }
                }
            } catch (error) {
                logger.error('Error syncing favorites:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchRemote();
        return () => { cancelled = true; };
    }, [user?.id]);

    const toggleFavorite = useCallback(async (venueId: string) => {
        if (!user) return false;

        const localKey = `rescatto_favs_${user.id}`;
        let newFavs: string[];
        const isFav = favorites.includes(venueId);

        // Optimistic UI Update
        if (isFav) {
            newFavs = favorites.filter(id => id !== venueId);
        } else {
            newFavs = [...favorites, venueId];
        }

        setFavorites(newFavs);
        localStorage.setItem(localKey, JSON.stringify(newFavs));

        // Persist to Firestore
        try {
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                favoriteVenueIds: isFav ? arrayRemove(venueId) : arrayUnion(venueId)
            });
        } catch (error) {
            logger.error('Error saving favorite:', error);
            // Revert on error (optional, usually ignored for favs)
        }

        return !isFav;
    }, [user, favorites]);

    const isFavorite = useCallback((venueId: string) => {
        return favorites.includes(venueId);
    }, [favorites]);

    return { favorites, toggleFavorite, isFavorite, loading };
};
