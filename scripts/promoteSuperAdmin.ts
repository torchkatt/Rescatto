import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import dotenv from 'dotenv';
import { UserRole } from '../types'; // Adjust path if needed, or hardcode role

dotenv.config({ path: '.env' });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TARGET_EMAIL = 'superadmin1@test.com';
const PASSWORD = 'clave123';

async function promote() {
    console.log(`🚀 Promoting ${TARGET_EMAIL} to SUPER_ADMIN...`);

    try {
        // 1. Try to Login
        console.log("1. Attempting login...");
        let userCredential;
        try {
            userCredential = await signInWithEmailAndPassword(auth, TARGET_EMAIL, PASSWORD);
            console.log("   Logged in. Deleting existing user to reset permissions...");
            await deleteUser(userCredential.user);
            console.log("   User deleted.");
        } catch (e: any) {
            if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
                console.log("   User not found (or wrong pass), proceeding to create.");
            } else {
                throw e;
            }
        }

        // 2. Create Fresh User
        console.log("2. Creating fresh user...");
        const newUserCred = await createUserWithEmailAndPassword(auth, TARGET_EMAIL, PASSWORD);
        const userId = newUserCred.user.uid;
        console.log(`   User created with UID: ${userId}`);

        // 3. Set Firestore Doc with SUPER_ADMIN role
        console.log("3. Setting Firestore profile with SUPER_ADMIN role...");
        await setDoc(doc(db, 'users', userId), {
            fullName: 'Super Admin Principal',
            email: TARGET_EMAIL,
            role: 'SUPER_ADMIN', // Hardcoded enum string
            venueId: 'admin-hq',
            createdAt: new Date().toISOString()
        });

        console.log("✅ SUCCESS! User superadmin1@test.com is now a SUPER_ADMIN.");
        process.exit(0);

    } catch (error: any) {
        console.error("❌ Error:", error.code || error.message);
        process.exit(1);
    }
}

promote();
