import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product } from '../types';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';
import { cartSyncService } from '../services/cartSyncService';

interface CartItem extends Product {
    quantity: number;
    venueName?: string;
}

/** Type guard: verifica que un objeto de Firestore tenga la forma mínima de CartItem */
const isCartItem = (value: unknown): value is CartItem => {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj['id'] === 'string' &&
        typeof obj['venueId'] === 'string' &&
        typeof obj['name'] === 'string' &&
        typeof obj['quantity'] === 'number' &&
        typeof obj['discountedPrice'] === 'number'
    );
};

interface CartContextType {
    items: CartItem[];
    addToCart: (product: Product, venueName?: string) => void;
    removeFromCart: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    getTotalItems: () => number;
    getTotalPrice: () => number;
    getCartByVenue: () => Map<string, CartItem[]>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart debe ser usado dentro de CartProvider');
    }
    return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const [items, setItems] = useState<CartItem[]>([]);
    // True once the Firestore initial load for the current user is done.
    const syncReadyRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load from localStorage on mount (guest / before login) and listen for cross-tab changes
    useEffect(() => {
        const loadFromLocal = () => {
            const savedCart = localStorage.getItem('cart');
            if (savedCart) {
                try {
                    const parsed = JSON.parse(savedCart);
                    if (Array.isArray(parsed)) {
                        const validated = parsed.filter(isCartItem);
                        setItems(validated);
                    }
                } catch (error) {
                    logger.error('Error al parsear el carrito desde localStorage', error);
                }
            } else {
                setItems([]);
            }
        };

        // Initial load
        loadFromLocal();

        // Cross-tab synchronization
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'cart') {
                loadFromLocal();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // On login: load Firestore cart; on logout: reset sync flag
    useEffect(() => {
        if (!userId) {
            syncReadyRef.current = false;
            return;
        }

        let cancelled = false;
        syncReadyRef.current = false;

        const initSync = async () => {
            const cloudItems = await cartSyncService.loadCart(userId);
            if (cancelled) return;

            if (cloudItems && cloudItems.length > 0) {
                // Validar shape de cada ítem antes de aceptarlo (previene corrupción silenciosa)
                const validated = cloudItems.filter(isCartItem);
                if (validated.length > 0) {
                    setItems(validated);
                    localStorage.setItem('cart', JSON.stringify(validated));
                } else {
                    logger.warn('CartContext: cloudItems de Firestore no pasaron la validación de tipo. Se ignoran.');
                }
            } else {
                // No cloud cart — upload current local cart so it persists
                setItems(prev => {
                    if (prev.length > 0) {
                        cartSyncService.saveCart(userId, prev).catch(() => { });
                    }
                    return prev;
                });
            }

            syncReadyRef.current = true;
        };

        initSync();
        return () => { cancelled = true; };
    }, [userId]);

    // Save to localStorage on every change; debounce save to Firestore when logged in
    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(items));

        if (!userId || !syncReadyRef.current) return;

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            cartSyncService.saveCart(userId, items).catch(() => { });
        }, 800);

        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [items, userId]);

    const addToCart = useCallback((product: Product, venueName?: string) => {
        setItems(prevItems => {
            const existingItem = prevItems.find(item => item.id === product.id);
            if (existingItem) {
                return prevItems.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            } else {
                return [...prevItems, { ...product, quantity: 1, venueName }];
            }
        });
    }, []);

    const removeFromCart = useCallback((productId: string) => {
        setItems(prevItems => prevItems.filter(item => item.id !== productId));
    }, []);

    const updateQuantity = useCallback((productId: string, quantity: number) => {
        if (quantity <= 0) {
            setItems(prevItems => prevItems.filter(item => item.id !== productId));
            return;
        }
        setItems(prevItems =>
            prevItems.map(item =>
                item.id === productId ? { ...item, quantity } : item
            )
        );
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
        localStorage.removeItem('cart');
        if (userId) cartSyncService.clearCart(userId).catch(() => { });
    }, [userId]);

    const getTotalItems = useCallback(() => {
        return items.reduce((total, item) => total + item.quantity, 0);
    }, [items]);

    const getTotalPrice = useCallback(() => {
        return items.reduce((total, item) => total + (item.discountedPrice * item.quantity), 0);
    }, [items]);

    // Memoize by-venue grouping — only recomputes when items change
    const getCartByVenue = useCallback((): Map<string, CartItem[]> => {
        const venueMap = new Map<string, CartItem[]>();
        items.forEach(item => {
            const venueItems = venueMap.get(item.venueId) || [];
            venueItems.push(item);
            venueMap.set(item.venueId, venueItems);
        });
        return venueMap;
    }, [items]);

    const contextValue = useMemo(() => ({
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalPrice,
        getCartByVenue,
    }), [items, addToCart, removeFromCart, updateQuantity, clearCart,
        getTotalItems, getTotalPrice, getCartByVenue]);

    return (
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
};
