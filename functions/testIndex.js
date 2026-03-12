const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "rescatto-c8d2b"
    });
}
const db = admin.firestore();

async function testIndex() {
    try {
        console.log("Testing role + venueId index...");
        await db.collection("users")
            .where("role", "==", "VENUE_OWNER")
            .where("venueId", "==", "test")
            .limit(1)
            .get();
        console.log("role + venueId SUCCESS");

        console.log("Testing role + venueIds index...");
        await db.collection("users")
            .where("role", "==", "VENUE_OWNER")
            .where("venueIds", "array-contains", "test")
            .limit(1)
            .get();
        console.log("role + venueIds SUCCESS");
    } catch (err) {
        console.error("Index Test Failed:", err.message);
    }
}

testIndex();
