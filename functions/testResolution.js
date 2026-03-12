const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "rescatto-c8d2b",
        credential: admin.credential.applicationDefault()
    });
}
const db = admin.firestore();

async function testResolution() {
    try {
        console.log("=== LATEST ORDER ===");
        const orders = await db.collection("orders").orderBy("createdAt", "desc").limit(1).get();
        if (orders.empty) {
            console.log("No orders found");
            return;
        }
        const orderId = orders.docs[0].id;
        const venueId = orders.docs[0].data().venueId;
        console.log(`Order: ${orderId}, Venue: ${venueId}`);

        console.log("\n=== RUNNING RESOLVE_VENUE_CHAT_TARGET LOGIC ===");
        const [byVenueIds, byVenueId] = await Promise.all([
            db.collection("users")
                .where("role", "==", "VENUE_OWNER")
                .where("venueIds", "array-contains", venueId)
                .limit(1)
                .get(),
            db.collection("users")
                .where("role", "==", "VENUE_OWNER")
                .where("venueId", "==", venueId)
                .limit(1)
                .get(),
        ]);

        const ownerDoc = byVenueIds.docs[0] || byVenueId.docs[0];
        
        if (!ownerDoc) {
             console.log("No owner found via users collection queries.");
        } else {
             console.log("Resolved Owner ID:", ownerDoc.id);
             console.log("Resolved Owner Data:", JSON.stringify(ownerDoc.data(), null, 2));
        }

        console.log("\n=== CHECKING LATEST CHAT FOR THIS ORDER ===");
        const chats = await db.collection("chats").where("orderId", "==", orderId).get();
        if (chats.empty) {
             console.log("No chats for this order yet.");
        } else {
             chats.forEach(c => {
                 console.log(`Chat ID: ${c.id}`);
                 console.log("Participants:", c.data().participants);
             });
        }
    } catch (err) {
        console.error(err);
    }
}

testResolution();
