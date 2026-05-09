
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    deleteDoc, 
    writeBatch, 
    setDoc, 
    serverTimestamp,
    query,
    where
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CITIES = ['Bucaramanga', 'Bogotá', 'Medellín'];
const CATEGORIES = [
    { name: 'Restaurantes', subcategories: ['Corrientazo', 'Gourmet', 'Comida Rápida', 'Vegetariano'] },
    { name: 'Panadería', subcategories: ['Panes', 'Postres', 'Cafetería'] },
    { name: 'Mercados', subcategories: ['Frutas y Verduras', 'Lácteos', 'Carnes'] }
];

async function cleanup() {
    console.log('🧹 Iniciando limpieza quirúrgica...');
    
    const collectionsToDelete = [
        'venues', 'products', 'orders', 'chats', 'notifications', 
        'flash_deals', 'wallets', 'wallet_transactions', 'audit_logs', 'product_categories'
    ];

    for (const colName of collectionsToDelete) {
        const snap = await getDocs(collection(db, colName));
        console.log(`Deleting ${snap.size} docs from ${colName}...`);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }

    // Limpieza selectiva de usuarios (No borrar CUSTOMER ni SUPER_ADMIN)
    const usersSnap = await getDocs(collection(db, 'users'));
    let deletedUsers = 0;
    const userBatch = writeBatch(db);
    usersSnap.docs.forEach(d => {
        const role = d.data().role;
        if (role !== 'CUSTOMER' && role !== 'SUPER_ADMIN') {
            userBatch.delete(d.ref);
            deletedUsers++;
        }
    });
    await userBatch.commit();
    console.log(`✅ Usuarios eliminados: ${deletedUsers} (dueños, staff, drivers).`);
}

async function seed() {
    console.log('🌱 Iniciando siembra de datos...');

    // 1. Crear categorías base
    for (const cat of CATEGORIES) {
        await setDoc(doc(db, 'product_categories', cat.name.toLowerCase()), {
            name: cat.name,
            subcategories: cat.subcategories,
            isActive: true,
            createdAt: serverTimestamp()
        });
    }

    const authImportData = [];

    for (const city of CITIES) {
        console.log(`\n--- Procesando ciudad: ${city} ---`);

        // 2. Crear 3 Drivers por ciudad
        for (let i = 1; i <= 3; i++) {
            const driverId = `driver_${city.toLowerCase()}_${i}`;
            const email = `${driverId}@rescatto.com`;
            await setDoc(doc(db, 'users', driverId), {
                fullName: `Domiciliario ${city} ${i}`,
                email,
                role: 'DRIVER',
                city,
                status: 'active',
                isVerified: true,
                createdAt: serverTimestamp()
            });
            authImportData.push({ uid: driverId, email, password: 'password123' });
        }

        // 3. Crear 5 Venues por ciudad
        for (let v = 1; v <= 5; v++) {
            const venueId = `venue_${city.toLowerCase()}_${v}`;
            const ownerId = `owner_${venueId}`;
            const ownerEmail = `${ownerId}@rescatto.com`;

            // Crear Dueño
            await setDoc(doc(db, 'users', ownerId), {
                fullName: `Dueño ${venueId}`,
                email: ownerEmail,
                role: 'VENUE_OWNER',
                venueId,
                venueIds: [venueId],
                isVerified: true,
                createdAt: serverTimestamp()
            });
            authImportData.push({ uid: ownerId, email: ownerEmail, password: 'password123' });

            // Crear Sede
            const categoryObj = CATEGORIES[v % CATEGORIES.length];
            await setDoc(doc(db, 'venues', venueId), {
                name: `Restaurante ${city} ${v}`,
                description: `El mejor sabor de ${city} en la sede ${v}.`,
                city,
                address: `Carrera ${10 + v} # ${20 + v} - ${city}`,
                category: categoryObj.name,
                image: `https://images.unsplash.com/photo-${1500000000000 + v}?auto=format&fit=crop&w=800&q=80`,
                rating: 4.5,
                isOpen: true,
                createdAt: serverTimestamp()
            });

            // 4. Crear 10 Productos (3 Rescate, 7 Regular)
            for (let p = 1; p <= 10; p++) {
                const isRescue = p <= 3;
                const productId = `${venueId}_p${p}`;
                const subcat = categoryObj.subcategories[p % categoryObj.subcategories.length];
                
                await setDoc(doc(db, 'products', productId), {
                    venueId,
                    name: isRescue ? `Pack Sorpresa ${subcat} ${p}` : `Producto ${subcat} ${p}`,
                    description: isRescue 
                        ? 'Contenido sorpresa con productos frescos al final de la jornada.' 
                        : 'Producto de alta calidad preparado al momento.',
                    price: 25000,
                    discountedPrice: isRescue ? 12000 : 25000,
                    isRescue,
                    category: categoryObj.name,
                    subcategory: subcat,
                    quantity: 10,
                    image: isRescue 
                        ? 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'
                        : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
                    isActive: true,
                    createdAt: serverTimestamp()
                });
            }
            console.log(`✅ Sede ${venueId} creada con 10 productos.`);
        }
    }

    console.log('\n✨ Siembra de Firestore completada.');
    console.log('\n--- DATA PARA AUTH IMPORT (JSON) ---');
    console.log(JSON.stringify(authImportData, null, 2));
    console.log('\n⚠️ Guarda este JSON y ejecuta: npx firebase auth:import users.json --project ' + process.env.VITE_FIREBASE_PROJECT_ID);
}

async function run() {
    try {
        const auth = getAuth(app);
        console.log('🔐 Autenticando como Super Admin...');
        // Intentar con las credenciales por defecto de los scripts de test
        await signInWithEmailAndPassword(auth, 'superadmin@test.com', 'clave123');
        console.log('✅ Autenticado correctamente.');

        await cleanup();
        await seed();
        process.exit(0);
    } catch (e) {
        console.error('❌ Error en el proceso:', e);
        console.log('\n💡 Tip: Si el error es de autenticación, asegúrate de que el usuario superadmin@test.com existe con la clave clave123.');
        process.exit(1);
    }
}

run();
