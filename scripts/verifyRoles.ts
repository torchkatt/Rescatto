
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import * as dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyRoles() {
    console.log("Checking roles collection...");
    try {
        const querySnapshot = await getDocs(collection(db, "roles"));
        if (querySnapshot.empty) {
            console.log("❌ No roles found in 'roles' collection.");
            console.log("Please click 'Iniciar Migración a Base de Datos' in the Users Manager UI.");
        } else {
            console.log(`✅ Found ${querySnapshot.size} roles in database:`);
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                console.log(`- ${data.name} (${doc.id}): ${data.permissions?.length || 0} permissions`);
            });
            console.log("\nMigration verification PASSED.");
        }
    } catch (error) {
        console.error("Error accessing Firestore:", error);
    }
}

verifyRoles();
