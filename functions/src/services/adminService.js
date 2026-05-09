"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("../admin");
const { withErrorHandling, withSecurityBunker } = require("../utils/errorHandler");
const { GetFinanceStatsSchema } = require("../schemas");
const { log, error: logError } = require("../utils/logger");
const { checkRateLimit } = require("../utils/rateLimit");


/**
 * Global and per-venue stats aggregation on COMPLETED orders.
 * Optimized for cost: maintains daily and monthly summaries to avoid reading all orders for reports.
 */
const aggregateAdminStats = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newValue = event.data.after.data();
    const previousValue = event.data.before.data();

    // Solo procesar si el estado cambió a COMPLETED
    if (previousValue.status === "COMPLETED" || newValue.status !== "COMPLETED") return;

    const totalAmount = Number(newValue.totalAmount || 0);
    const subtotal = Number(newValue.subtotal || totalAmount);
    const platformFee = Number(newValue.platformFee || subtotal * 0.10);
    const venueEarnings = Number(newValue.venueEarnings || subtotal * 0.90);
    const venueId = newValue.venueId;
    const co2Saved = Number(newValue.estimatedCo2 || newValue.co2Saved || 0.5);
    
    // Determinar periodos
    const createdAt = newValue.createdAt ? new Date(newValue.createdAt) : new Date();
    const dayId = createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
    const monthId = dayId.slice(0, 7); // YYYY-MM

    const batch = db.batch();
    
    const incrementData = {
        totalRevenue: admin.firestore.FieldValue.increment(subtotal),
        totalPlatformFee: admin.firestore.FieldValue.increment(platformFee),
        totalVenueEarnings: admin.firestore.FieldValue.increment(venueEarnings),
        totalOrders: admin.firestore.FieldValue.increment(1),
        totalCO2Saved: admin.firestore.FieldValue.increment(co2Saved),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 1. Global Stats
    const globalRef = db.collection("stats").doc("global");
    batch.set(globalRef, incrementData, { merge: true });

    // 2. Daily Stats Summary
    const dailyRef = db.collection("stats_daily").doc(dayId);
    batch.set(dailyRef, incrementData, { merge: true });

    // 3. Monthly Stats Summary
    const monthlyRef = db.collection("stats_monthly").doc(monthId);
    batch.set(monthlyRef, incrementData, { merge: true });

    // 4. Per-Venue Stats
    if (venueId) {
        const venueRef = db.collection("stats_venues").doc(venueId);
        batch.set(venueRef, incrementData, { merge: true });
    }

    try {
        await batch.commit();
        log(`[Stats] Aggregated order ${event.params.orderId} for ${dayId}`);
    } catch (e) { logError(`[Stats] Aggregation error (${event.params.orderId})`, e); }
});

/**
 * Returns platform financial stats (Super Admin only).
 * Optimized: Uses summary documents instead of querying thousands of orders.
 */
const getFinanceStats = onCall(
    withSecurityBunker("getFinanceStats", async (request) => {

    const finParsed = GetFinanceStatsSchema.safeParse(request.data || {});
    if (!finParsed.success) throw new HttpsError("invalid-argument", "Rango de fechas inválido.");
    const { startDate, endDate } = finParsed.data;

    // Determinar si consultamos por días o por meses para optimizar lecturas
    // Si el rango es <= 60 días, sumamos los diarios. Si es más, sumamos los mensuales.
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    let statsSnap;
    if (diffDays <= 62) {
        // Consulta por días (Max 62 lecturas)
        statsSnap = await db.collection("stats_daily")
            .where("__name__", ">=", startDate)
            .where("__name__", "<=", endDate)
            .get();
    } else {
        // Consulta por meses (Max ~12 lecturas para un año)
        const startMonth = startDate.slice(0, 7);
        const endMonth = endDate.slice(0, 7);
        statsSnap = await db.collection("stats_monthly")
            .where("__name__", ">=", startMonth)
            .where("__name__", "<=", endMonth)
            .get();
    }

    let totalRevenue = 0, totalPlatformFee = 0, totalVenueEarnings = 0, totalOrders = 0;
    
    statsSnap.forEach(doc => {
        const data = doc.data();
        totalRevenue += (data.totalRevenue || 0);
        totalPlatformFee += (data.totalPlatformFee || 0);
        totalVenueEarnings += (data.totalVenueEarnings || 0);
        totalOrders += (data.totalOrders || 0);
    });

    // Para el desglose por negocios, seguimos necesitando consultar los stats_venues
    // pero esto ya está agregado por negocio, así que solo son N lecturas (donde N = # negocios activos)
    const venuesSnap = await db.collection("stats_venues").orderBy("totalRevenue", "desc").limit(10).get();
    const topVenues = venuesSnap.docs.map(doc => ({
        venueId: doc.id,
        revenue: doc.data().totalRevenue || 0,
        orders: doc.data().totalOrders || 0,
        platformFee: doc.data().totalPlatformFee || 0
    }));

    return {
        totalRevenue, totalPlatformFee, totalVenueEarnings, totalOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        topVenues,
        periodStart: startDate || null, periodEnd: endDate || null,
        optimized: true
    };
}, { requiredRoles: ["SUPER_ADMIN", "ADMIN"] }));


/**
 * Admin utility: migrate venueId to venueIds array.
 */
const migrateVenueIdToVenueIds = onCall(
    withSecurityBunker("migrateVenueIdToVenueIds", async (request) => {

    const allowed = await checkRateLimit(`migrate:${request.auth.uid}`, 1, 86400000);
    if (!allowed) throw new HttpsError("resource-exhausted", "Esta migración solo puede ejecutarse una vez por día.");

    const snapshot = await db.collection("users").get();
    const batch = db.batch();
    let migrated = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.venueId && (!data.venueIds || !data.venueIds.includes(data.venueId))) {
            batch.update(doc.ref, { venueIds: admin.firestore.FieldValue.arrayUnion(data.venueId) });
            migrated++;
        }
    });

    if (migrated > 0) await batch.commit();

    await db.collection("audit_logs").add({
        action: "MIGRATE_VENUE_ID_TO_VENUE_IDS",
        performedBy: request.auth.uid,
        details: { migrated },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    log(`migrateVenueIdToVenueIds: ${migrated} users migrated by ${request.auth.uid}`);
    return { migrated };
}, { requiredRoles: ["SUPER_ADMIN", "ADMIN"] }));

/**
 * Admin: registra un pago manual de comisión o liquidación a un negocio. Solo SUPER_ADMIN.
 * - type "DEBT_PAYMENT": el negocio paga su deuda a Rescatto → balance sube (deuda disminuye)
 * - type "PAYOUT": Rescatto le paga al negocio sus ganancias → balance baja
 */
const recordManualSettlement = onCall(
    withSecurityBunker("recordManualSettlement", async (request) => {

    const { venueId, amount, type, description } = request.data || {};
    if (!venueId || !amount || !type || !description) {
        throw new HttpsError("invalid-argument", "Faltan campos requeridos: venueId, amount, type, description.");
    }
    if (!["DEBT_PAYMENT", "PAYOUT"].includes(type)) {
        throw new HttpsError("invalid-argument", "type debe ser DEBT_PAYMENT o PAYOUT.");
    }
    if (typeof amount !== "number" || amount <= 0) {
        throw new HttpsError("invalid-argument", "amount debe ser un número positivo.");
    }

    await db.runTransaction(async (tx) => {
        const walletRef = db.collection("wallets").doc(venueId);
        const walletDoc = await tx.get(walletRef);
        const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;

        // DEBT_PAYMENT: negocio paga → sube balance (menos negativo / más crédito)
        // PAYOUT: Rescatto paga → baja balance
        const adjustment = type === "DEBT_PAYMENT" ? amount : -amount;
        const newBalance = currentBalance + adjustment;

        tx.set(walletRef, {
            venueId,
            balance: newBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        const txRef = db.collection("wallet_transactions").doc();
        tx.set(txRef, {
            venueId,
            type: type === "DEBT_PAYMENT" ? "CREDIT" : "DEBIT",
            amount,
            description,
            referenceType: type,
            createdAt: new Date().toISOString(),
            recordedBy: request.auth.uid,
        });
    });

    log(`Settlement recorded for venue ${venueId}: type=${type}, amount=${amount}`);
    return { success: true };
}, { requiredRoles: ["SUPER_ADMIN"] }));

/**
 * Actualiza la configuración de domicilio de un local.
 * Accesible por ADMIN, SUPER_ADMIN y el VENUE_OWNER del local.
 */
const updateVenueDeliveryConfig = onCall(
    withSecurityBunker("updateVenueDeliveryConfig", async (request) => {
    const { venueId, config } = request.data || {};
    
    if (!venueId || !config) {
        throw new HttpsError("invalid-argument", "Faltan venueId o config.");
    }

    // Verificar permisos: Admin o Dueño del local
    const callerSnap = await db.collection("users").doc(request.auth.uid).get();
    const callerData = callerSnap.data() || {};
    const callerVenueIds = callerData.venueIds || (callerData.venueId ? [callerData.venueId] : []);
    
    const isOwner = callerVenueIds.includes(venueId);
    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(callerData.role);

    if (!isOwner && !isAdmin) {
        throw new HttpsError("permission-denied", "No tienes permiso para editar este local.");
    }

    const venueRef = db.collection("venues").doc(venueId);
    
    await venueRef.update({
        "deliveryConfig.isEnabled": !!config.isEnabled,
        "deliveryConfig.maxDistance": Number(config.maxDistance) || 10,
        "deliveryConfig.baseFee": Number(config.baseFee) || 0,
        "deliveryConfig.pricePerKm": Number(config.pricePerKm) || 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    log(`Delivery config updated for venue ${venueId}`, { config });
    return { success: true };
}, { requiredRoles: ["SUPER_ADMIN", "ADMIN", "VENUE_OWNER"] }));

/**
 * [UTILITY] Seed a full testing ecosystem.
 * Creates 3 Venues, 6 Products, and 20+ Users with various roles and relationships.
 * ONLY accessible by SUPER_ADMIN.
 */
const seedFullEcosystem = onCall(withSecurityBunker("seedFullEcosystem", async (_request) => {
    log("🚀 Iniciando Siembra de Ecosistema Completo...");
    
    const cities = ["Bogotá", "Medellín", "Bucaramanga"];
    const batch = db.batch();
    const venueIds = [];

    // 1. Crear Sedes y Productos
    for (const city of cities) {
        const venueRef = db.collection("venues").doc();
        const venueData = {
            name: `Restaurante Rescatto ${city}`,
            city,
            address: `Calle Principal ${city}`,
            latitude: 4.6097,
            longitude: -74.0817,
            rating: 4.8,
            isActive: true,
            businessType: "Restaurante",
            deliveryModel: "platform_drivers",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        batch.set(venueRef, venueData);
        venueIds.push({ id: venueRef.id, city });

        // Productos para esta sede
        for (let i = 1; i <= 2; i++) {
            const productRef = db.collection("products").doc();
            batch.set(productRef, {
                name: `Pack ${i === 1 ? "Sorpresa" : "Gourmet"} ${city}`,
                venueId: venueRef.id,
                city,
                type: "SURPRISE_PACK",
                originalPrice: 25000,
                discountedPrice: 12000,
                quantity: 10,
                isActive: true,
                imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
                availableUntil: new Date(Date.now() + 86400000).toISOString(),
            });
        }
    }

    // 2. Definir Usuarios a crear
    const usersToCreate = [
        { role: "ADMIN", email: "admin@test.com", name: "Admin General" },
        { role: "CITY_ADMIN", email: "city_bogota@test.com", name: "Admin Bogotá", city: "Bogotá" },
        { role: "CITY_ADMIN", email: "city_medellin@test.com", name: "Admin Medellín", city: "Medellín" },
    ];

    // Domiciliarios
    for (let i = 1; i <= 3; i++) {
        usersToCreate.push({ role: "DRIVER", email: `domi${i}@test.com`, name: `Domiciliario ${i}` });
    }

    // Personal por sede
    venueIds.forEach((v) => {
        usersToCreate.push({ 
            role: "VENUE_OWNER", 
            email: `owner_${v.city.toLowerCase()}@test.com`, 
            name: `Dueño ${v.city}`, 
            venueId: v.id, 
            venueIds: [v.id] 
        });
        usersToCreate.push({ 
            role: "KITCHEN_STAFF", 
            email: `chef_${v.city.toLowerCase()}@test.com`, 
            name: `Chef ${v.city}`, 
            venueId: v.id, 
            venueIds: [v.id] 
        });
    });

    // Clientes
    cities.forEach(city => {
        for (let i = 1; i <= 2; i++) {
            usersToCreate.push({ role: "CUSTOMER", email: `cliente_${city.toLowerCase()}_${i}@test.com`, name: `Cliente ${i} ${city}`, city });
        }
    });

    // 3. Crear Usuarios en Auth y Firestore
    const results = [];
    for (const u of usersToCreate) {
        try {
            let uid;
            try {
                const userRecord = await admin.auth().createUser({
                    email: u.email,
                    password: "clave123",
                    displayName: u.name,
                });
                uid = userRecord.uid;
            } catch (e) {
                if (e.code === "auth/email-already-in-use") {
                    const existing = await admin.auth().getUserByEmail(u.email);
                    uid = existing.uid;
                } else throw e;
            }

            const userData = {
                id: uid,
                email: u.email,
                fullName: u.name,
                role: u.role,
                isActive: true,
                isVerified: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (u.city) userData.city = u.city;
            if (u.venueId) userData.venueId = u.venueId;
            if (u.venueIds) userData.venueIds = u.venueIds;

            batch.set(db.collection("users").doc(uid), userData, { merge: true });

            // Claims (Bunker)
            const claims = { role: u.role, isBunker: true };
            if (u.role === "ADMIN") claims.isAdmin = true;
            if (u.venueId) claims.v = [u.venueId];
            await admin.auth().setCustomUserClaims(uid, claims);

            results.push(`${u.role}: ${u.email}`);
        } catch (err) {
            logError(`Error seeding user ${u.email}`, err);
        }
    }

    await batch.commit();
    log("✨ Ecosistema de prueba sembrado con éxito.");
    
    return { 
        message: "Ecosistema sembrado", 
        usersCreated: results.length,
        venuesCreated: venueIds.length,
        users: results 
    };
}, { requiredRoles: ["SUPER_ADMIN"] }));

module.exports = { 
    aggregateAdminStats, 
    getFinanceStats, 
    migrateVenueIdToVenueIds, 
    recordManualSettlement,
    updateVenueDeliveryConfig,
    seedFullEcosystem
};
