import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from '../utils/logger';

/**
 * Script para inicializar Firestore con datos de ejemplo
 * Ejecuta este script una vez para crear las colecciones y datos iniciales
 */

export const initializeFirestore = async () => {
    logger.log('🔥 Iniciando población de Firestore...');

    try {
        // 1. Crear Venue por defecto
        logger.log('📍 Creando venue por defecto...');
        const venueRef = doc(db, 'venues', 'default-venue');
        await setDoc(venueRef, {
            name: 'Restaurante Rescatto',
            address: 'Calle 85 #12-34, Bogotá',
            latitude: 4.6681,
            longitude: -74.0535,
            closingTime: '22:00',
            rating: 4.8,
            createdAt: new Date().toISOString(),
        });
        logger.log('✅ Venue creado');

        // 2. Crear productos de ejemplo
        logger.log('🍽️ Creando productos de ejemplo...');
        const products = [
            {
                venueId: 'default-venue',
                name: 'Bandeja Paisa',
                type: 'PLATE',
                originalPrice: 28000,
                discountedPrice: 18000,
                quantity: 5,
                imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
                availableUntil: '22:00',
                isDynamicPricing: false,
            },
            {
                venueId: 'default-venue',
                name: 'Ajiaco Santafereño',
                type: 'PLATE',
                originalPrice: 25000,
                discountedPrice: 16000,
                quantity: 3,
                imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400',
                availableUntil: '22:00',
                isDynamicPricing: false,
            },
            {
                venueId: 'default-venue',
                name: 'Lechona Tolimense',
                type: 'PLATE',
                originalPrice: 22000,
                discountedPrice: 14000,
                quantity: 4,
                imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
                availableUntil: '21:30',
                isDynamicPricing: true,
            },
            {
                venueId: 'default-venue',
                name: 'Postre: Tres Leches',
                type: 'DESSERT',
                originalPrice: 12000,
                discountedPrice: 8000,
                quantity: 8,
                imageUrl: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400',
                availableUntil: '23:00',
                isDynamicPricing: false,
            },
            {
                venueId: 'default-venue',
                name: 'Pan Artesanal',
                type: 'BAKERY',
                originalPrice: 8000,
                discountedPrice: 5000,
                quantity: 12,
                imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',
                availableUntil: '20:00',
                isDynamicPricing: false,
            },
        ];

        for (const product of products) {
            const productRef = doc(collection(db, 'products'));
            await setDoc(productRef, {
                ...product,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            logger.log(`  ✅ Producto creado: ${product.name}`);
        }

        // 3. Crear órdenes de ejemplo
        logger.log('📦 Creando órdenes de ejemplo...');
        const orders = [
            {
                venueId: 'default-venue',
                customerName: 'María González',
                products: [],
                totalAmount: 18000,
                status: 'COMPLETED',
                pickupDeadline: new Date(Date.now() - 86400000).toISOString(), // Ayer
                createdAt: new Date(Date.now() - 86400000).toISOString(),
            },
            {
                venueId: 'default-venue',
                customerName: 'Carlos Rodríguez',
                products: [],
                totalAmount: 32000,
                status: 'READY_PICKUP',
                pickupDeadline: new Date(Date.now() + 3600000).toISOString(), // En 1 hora
                createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
            {
                venueId: 'default-venue',
                customerName: 'Laura Martínez',
                products: [],
                totalAmount: 14000,
                status: 'PENDING',
                pickupDeadline: new Date(Date.now() + 7200000).toISOString(), // En 2 horas
                createdAt: new Date().toISOString(),
            },
        ];

        for (const order of orders) {
            const orderRef = doc(collection(db, 'orders'));
            await setDoc(orderRef, {
                ...order,
                updatedAt: new Date().toISOString(),
            });
            logger.log(`  ✅ Orden creada: ${order.customerName}`);
        }

        logger.log('🎉 ¡Firestore inicializado exitosamente!');
        logger.log('');
        logger.log('📊 Resumen:');
        logger.log('  - 1 venue creado');
        logger.log(`  - ${products.length} productos creados`);
        logger.log(`  - ${orders.length} órdenes creadas`);

        return {
            success: true,
            message: 'Firestore inicializado correctamente',
        };
    } catch (error: any) {
        logger.error('❌ Error inicializando Firestore:', error);
        throw error;
    }
};

// Función para verificar si ya hay datos
export const checkIfDataExists = async () => {
    const venuesSnapshot = await getDocs(collection(db, 'venues'));
    const productsSnapshot = await getDocs(collection(db, 'products'));

    return {
        hasVenues: !venuesSnapshot.empty,
        hasProducts: !productsSnapshot.empty,
        venueCount: venuesSnapshot.size,
        productCount: productsSnapshot.size,
    };
};
