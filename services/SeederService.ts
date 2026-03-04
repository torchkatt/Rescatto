import {
    collection,
    addDoc,
    Timestamp,
    doc,
    setDoc,
    query,
    limit,
    deleteDoc,
    getDocs,
    updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { authService } from './authService';
import { UserRole, ProductType, OrderStatus } from '../types';
import { logger } from '../utils/logger';

// ⚠️  PRODUCTION GUARD — This service must NEVER run in a production build.
const IS_PROD = import.meta.env.PROD;

function guardProd(methodName: string): void {
    if (IS_PROD) {
        const msg = `[SeederService.${methodName}] FATAL: Seeding is disabled in production. This call has been blocked.`;
        logger.error(msg);
        throw new Error(msg);
    }
}

// Mock Data Arrays
const VENUE_NAMES = [
    "La Trattoria Di Nonna", "Sushi Master", "Burger Kingpin", "Tacos El Pastor",
    "Green Leaf Salad", "Bakery Delights", "Smoothie Heaven", "Curry House",
    "Pizza Express", "Steakhouse 99", "Vegan Vibes", "Donut World"
];

const CATEGORIES = [
    "bakery",    // Panadería
    "pizza",     // Pizza
    "cafe",      // Café
    "market",    // Mercado
    "healthy"    // Saludable
];

const PRODUCT_NAMES = [
    "Pack Sorpresa", "Cena Especial", "Almuerzo Ejecutivo", "Desayuno Completo",
    "Bolsa de Pan", "Combo Sushi", "Tacos Variados", "Ensalada del Día",
    "Pizza Familiar", "Postres Surtidos"
];

const IMAGES = {
    VENUE: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    FOOD: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
};

export const SeederService = {
    // --- UTILS: CLEAR DATABASE ---
    clearDatabase: async () => {
        guardProd('clearDatabase');
        const collections = ['venues', 'categories', 'products', 'users', 'orders', 'ratings', 'chats', 'donation_centers'];
        const batchSize = 100;

        for (const colName of collections) {
            const colRef = collection(db, colName);
            const q = query(colRef, limit(batchSize));
            const snapshot = await getDocs(q);

            // Note: Simple delete for demo. In prod, use batch/recursive delete.
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            logger.log(`Cleared collection: ${colName}`);
        }
    },

    // --- SEED VENUES ---
    seedVenues: async (count: number = 10) => {
        guardProd('seedVenues');
        const venuesRef = collection(db, 'venues');
        const createdVenues = [];

        for (let i = 0; i < count; i++) {
            const name = VENUE_NAMES[i % VENUE_NAMES.length] + ` ${Math.floor(Math.random() * 100)}`;
            const category = CATEGORIES[i % CATEGORIES.length];

            const venueData = {
                name,
                address: `Calle ${Math.floor(Math.random() * 100)} #${Math.floor(Math.random() * 100)}-${Math.floor(Math.random() * 100)}, Ciudad`,
                latitude: 4.6 + (Math.random() * 0.1), // Approx Bogota coords
                longitude: -74.0 - (Math.random() * 0.1),
                closingTime: "22:00",
                rating: 3.5 + (Math.random() * 1.5), // Rating between 3.5 and 5.0
                // Professional restaurant images
                imageUrl: `https://picsum.photos/seed/restaurant_${i}/800/600`,
                coverImageUrl: `https://picsum.photos/seed/cover_restaurant_${i}/1200/400`,
                categories: [category, "Gourmet"], // Ensure main category is first
                dietaryTags: i % 2 === 0 ? ['VEGAN', 'GLUTEN_FREE'] : ['VEGETARIAN', 'KETO'],
                logoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff&size=128&bold=true`,
                deliveryConfig: {
                    isEnabled: true,
                    baseFee: 3000,        // COP - tarifa base
                    pricePerKm: 500,      // COP por km adicional
                    maxDistance: 10,      // km de radio máximo
                    freeDeliveryThreshold: 50000, // Envío gratis sobre 50k COP
                    minOrderAmount: 0,
                },
                createdAt: Timestamp.now()
            };

            const docRef = await addDoc(venuesRef, venueData);
            createdVenues.push({ id: docRef.id, ...venueData });
            logger.log(`Created Venue: ${name} [${category}]`);
        }
        return createdVenues;
    },

    // --- SEED CATEGORIES (NEW) ---
    seedCategories: async (venueId: string) => {
        guardProd('seedCategories');
        const categoriesRef = collection(db, 'categories');
        const sections = ["Entradas", "Platos Fuertes", "Bebidas", "Postres", "Promociones"];
        const createdCategories = [];

        for (const sectionName of sections) {
            const catData = {
                venueId,
                name: sectionName,
                createdAt: Timestamp.now()
            };
            const docRef = await addDoc(categoriesRef, catData);
            createdCategories.push({ id: docRef.id, name: sectionName });
        }
        logger.log(`Created ${createdCategories.length} categories for venue ${venueId}`);
        return createdCategories;
    },

    // --- SEED PRODUCTS ---
    seedProducts: async (venueId: string, categories: any[], count: number = 10) => {
        guardProd('seedProducts');
        const productsRef = collection(db, 'products');

        for (let i = 0; i < count; i++) {
            const isSurprise = Math.random() > 0.5;
            const price = Math.floor(Math.random() * 50) + 10;

            // Pick a random category from the valid ones created for this venue
            const categoryObj = categories[Math.floor(Math.random() * categories.length)];
            const categoryName = isSurprise ? "Pack Sorpresa" : categoryObj.name;

            // Generate names relevant to category if possible (simple mock logic)
            let name = PRODUCT_NAMES[i % PRODUCT_NAMES.length];
            if (!isSurprise) {
                name = `${categoryName} - ${name} ${i + 1}`;
            }

            const productData = {
                venueId,
                name: name,
                type: isSurprise ? ProductType.SURPRISE_PACK : ProductType.SPECIFIC_DISH,
                originalPrice: price,
                discountedPrice: Math.floor(price * 0.7),
                quantity: Math.floor(Math.random() * 20) + 1,
                imageUrl: `https://picsum.photos/seed/prod_${venueId}_${i}/400/300`,
                availableUntil: new Date(Date.now() + 86400000).toISOString(),
                isDynamicPricing: false,
                category: categoryName, // Use the proper category name
                categoryId: isSurprise ? "surprise" : categoryObj.id, // Link to category Doc ID
                dietaryTags: i % 3 === 0 ? ['VEGAN'] : i % 3 === 1 ? ['GLUTEN_FREE'] : [],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await addDoc(productsRef, productData);
        }
        logger.log(`Created ${count} products for venue ${venueId}`);
    },

    // --- SEED USERS (Requires Auth Interaction) ---
    seedUsers: async (count: number = 10, role: UserRole = UserRole.CUSTOMER) => {
        guardProd('seedUsers');
        // NOTE: This runs on client side and is slow because of auth switching
        const createdUsers = [];

        for (let i = 0; i < count; i++) {
            const timestamp = Date.now();
            const email = `${role.toLowerCase()}${timestamp}_${i}@test.com`;
            const password = "password123";
            const name = `${role} Test User ${i}`;

            try {
                // Register logs in the user
                const user = await authService.register(email, password, name, role);

                // Seed initial impact for customers
                if (role === UserRole.CUSTOMER) {
                    const userId = user.id || (user as any).uid;
                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, {
                        impact: {
                            co2Saved: Math.random() * 5,
                            moneySaved: Math.floor(Math.random() * 50000),
                            totalRescues: Math.floor(Math.random() * 10),
                            points: Math.floor(Math.random() * 300),
                            level: 'NOVICE',
                            badges: []
                        }
                    });
                }

                createdUsers.push(user);

                // Must logout to continue loop
                await authService.logout();
                logger.log(`Created User: ${email}`);
            } catch (err) {
                logger.error(`Failed to create user ${email}`, err);
            }
        }
        return createdUsers;
    },

    // --- SEED VENUE OWNERS ---
    seedVenueOwners: async (venues: any[]) => {
        guardProd('seedVenueOwners');
        const createdOwners = [];
        logger.log(`Seeding ${venues.length} venue owners...`);

        for (const venue of venues) {
            // Create a consistent email for the venue
            // sanitize name for email
            const safeName = venue.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
            const email = `admin_${safeName}@test.com`;
            const password = "password123";
            const name = `Admin ${venue.name}`;

            try {
                const user = await authService.register(email, password, name, UserRole.VENUE_OWNER, { venueId: venue.id });
                createdOwners.push(user);
                await authService.logout();
                logger.log(`Created Owner: ${email} for venue ${venue.name}`);
            } catch (err: any) {
                logger.error(`Failed to create owner ${email}`, err);
            }
        }
        return createdOwners;
    },

    // --- SEED ORDERS ---
    seedOrders: async (customers: any[], venues: any[], productsMap: { [venueId: string]: any[] }, countPerCustomer: number = 3) => {
        guardProd('seedOrders');
        const ordersRef = collection(db, 'orders');
        const generatedOrders: any[] = [];

        for (const customer of customers) {
            for (let i = 0; i < countPerCustomer; i++) {
                // Pick random venue
                const venue = venues[Math.floor(Math.random() * venues.length)];
                if (!venue) continue;

                // Pick products from that venue
                const venueProducts = productsMap[venue.id] || [];
                if (venueProducts.length === 0) continue;

                const product = venueProducts[Math.floor(Math.random() * venueProducts.length)];

                // Random Status
                const statuses = Object.values(OrderStatus);
                const status = statuses[Math.floor(Math.random() * statuses.length)];

                const orderData = {
                    customerId: customer.uid || customer.id, // Handle auth user object or firestore doc
                    customerName: customer.displayName || customer.fullName || "Test Customer",
                    venueId: venue.id,
                    products: [product], // Simple 1 item order
                    totalAmount: product.discountedPrice,
                    status: status,
                    createdAt: Timestamp.fromMillis(Date.now() - Math.floor(Math.random() * 1000000000)), // Random time in past
                    pickupDeadline: new Date(Date.now() + 3600000).toISOString(),
                    paymentMethod: Math.random() > 0.5 ? 'card' : 'cash',
                    paymentStatus: 'paid', // Simplify for test
                    deliveryAddress: "Calle Falsa 123",
                    phone: "5551234567"
                };

                const orderDoc = await addDoc(ordersRef, orderData);
                generatedOrders.push({ id: orderDoc.id, ...orderData, venueName: venue.name }); // Keep metadata for next steps
            }
        }
        logger.log("Orders seeding complete.");
        return generatedOrders;
    },

    // --- SEED RATINGS ---
    seedRatings: async (orders: any[]) => {
        guardProd('seedRatings');
        const ratingsRef = collection(db, 'ratings');
        let count = 0;

        // Only rate completed orders (randomly 50% chance)
        const completedOrders = orders.filter((o: any) => o.status === OrderStatus.COMPLETED);

        for (const order of completedOrders) {
            if (Math.random() > 0.5) continue;

            const score = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars mostly

            const ratingData = {
                orderId: order.id,
                venueId: order.venueId,
                fromUserId: order.customerId,
                fromUserRole: UserRole.CUSTOMER,
                toUserId: order.venueId, // Rating the venue
                toUserRole: UserRole.VENUE_OWNER,
                score: score,
                comment: `Comida excelente! Me encantó el ${order.products[0].name}.`,
                createdAt: new Date().toISOString()
            };

            await addDoc(ratingsRef, ratingData);
            count++;
        }
        logger.log(`Created ${count} ratings.`);
    },

    // --- SEED CHATS ---
    seedChats: async (orders: any[]) => {
        guardProd('seedChats');
        // Create chats for some orders (e.g. pending or ready for pickup)
        const activeOrders = orders.filter((o: any) =>
            o.status !== OrderStatus.COMPLETED &&
            o.status !== OrderStatus.MISSED
        );

        let count = 0;

        for (const order of activeOrders) {
            if (Math.random() > 0.7) continue; // Only 30% have chats

            // Mock Chat Doc
            const chatData = {
                participants: [order.customerId, order.venueId], // Customer and Venue (ID is venueId for now)
                participantNames: {
                    [order.customerId]: order.customerName,
                    [order.venueId]: order.venueName || "Restaurante"
                },
                participantRoles: {
                    [order.customerId]: UserRole.CUSTOMER,
                    [order.venueId]: UserRole.VENUE_OWNER
                },
                orderId: order.id,
                type: 'customer-venue',
                lastMessage: {
                    text: 'Hola, ¿a qué hora puedo pasar?',
                    senderId: order.customerId,
                    timestamp: new Date().toISOString(),
                    read: false
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: {
                    customerName: order.customerName,
                    venueName: order.venueName,
                    orderNumber: order.id
                }
            };

            const chatRef = await addDoc(collection(db, 'chats'), chatData);

            // Add initial message
            await addDoc(collection(db, `chats/${chatRef.id}/messages`), {
                chatId: chatRef.id,
                senderId: order.customerId,
                senderName: order.customerName,
                senderRole: UserRole.CUSTOMER,
                text: 'Hola, ¿a qué hora puedo pasar?',
                timestamp: new Date().toISOString(),
                read: false,
                type: 'text'
            });

            count++;
        }
        logger.log(`Created ${count} chats.`);
    },

    // --- SEED DONATION CENTERS ---
    seedDonationCenters: async () => {
        guardProd('seedDonationCenters');
        const centersRef = collection(db, 'donation_centers');
        const centers = [
            {
                name: "Albergue San José",
                address: "Calle 45 #12-34",
                city: "Bogotá",
                phone: "3101234567",
                imageUrl: "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80",
                description: "Hogar permanente para adultos mayores en situación de vulnerabilidad.",
                type: 'NURSING_HOME'
            },
            {
                name: "Fundación Pies Descalzos",
                address: "Carrera 15 #85-12",
                city: "Bogotá",
                phone: "3007654321",
                imageUrl: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&q=80",
                description: "Apoyo alimentario y educativo para niños de escasos recursos.",
                type: 'FOUNDATION'
            },
            {
                name: "Refugio Animal Rescatto",
                address: "Variante Chía km 2",
                city: "Chía",
                phone: "3159876543",
                imageUrl: "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=800&q=80",
                description: "Centro de rescate y alimentación para perros y gatos abandonados.",
                type: 'SHELTER'
            },
            {
                name: "Comedor Social El Camino",
                address: "Diagonal 45 Sur #12-09",
                city: "Bogotá",
                phone: "3123456789",
                imageUrl: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80",
                description: "Servicio de alimentación diaria para personas sin hogar.",
                type: 'OTHER'
            }
        ];

        for (const center of centers) {
            await addDoc(centersRef, {
                ...center,
                createdAt: Timestamp.now()
            });
            logger.log(`Created Donation Center: ${center.name}`);
        }
    }
};
