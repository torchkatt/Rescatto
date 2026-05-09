
import admin from 'firebase-admin';
try {
    admin.initializeApp({
        projectId: 'rescatto-c8d2b'
    });
    console.log('Successfully initialized with project ID!');
} catch (e) {
    console.log('Failed to initialize:', e.message);
}
