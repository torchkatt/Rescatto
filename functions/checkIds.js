const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "rescatto-c8d2b",
        credential: admin.credential.applicationDefault()
    });
}
const db = admin.firestore();

async function checkIds() {
    try {
        console.log("=== CHECKING LATEST ORDER ===");
        const orders = await db.collection("orders").orderBy("createdAt", "desc").limit(1).get();
        if (orders.empty) {
            console.log("No orders found");
            return;
        }
        const order = orders.docs[0];
        const oData = order.data();
        console.log("Order ID:", order.id);
        console.log("Customer ID:", oData.customerId);
        console.log("Venue ID:", oData.venueId);
        console.log("Order Metadata:", oData.metadata);

        console.log("\n=== VENUE OWNER UID FROM USERS ===");
        const users = await db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", oData.venueId).get();
        users.forEach(u => console.log(`User ID: ${u.id} | Email: ${u.data().email} | Venues: ${u.data().venueIds}`));

        console.log("\n=== LATEST CHATS FOR THIS ORDER ===");
        const chats = await db.collection("chats").where("orderId", "==", order.id).get();
        if (chats.empty) {
            console.log("No chats for order", order.id);
        } else {
            chats.forEach(c => {
                 console.log(`Chat ID: ${c.id}`);
                 console.log("Participants:", c.data().participants);
            });
        }
        
        console.log("\n=== LATEST NOTIFICATIONS ===");
        const notifs = await db.collection("notifications").orderBy("createdAt", "desc").limit(3).get();
        notifs.forEach(n => console.log(`Notif to [${n.data().userId}]: ${n.data().title}`));
        
    } catch (err) {
        console.error(err);
    }
}

checkIds();
