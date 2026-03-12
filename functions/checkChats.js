const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "rescatto-c8d2b"
    });
}
const db = admin.firestore();

async function checkChats() {
    try {
        console.log("Fetching recent chats...");
        const snap = await db.collection("chats").orderBy("updatedAt", "desc").limit(5).get();
        if (snap.empty) {
             console.log("No chats found.");
             return;
        }

        for (const doc of snap.docs) {
             const data = doc.data();
             console.log(`\nChat ID: ${doc.id}`);
             console.log(`Type: ${data.type}`);
             console.log(`Participants:`, data.participants);
             console.log(`Participant Names:`, JSON.stringify(data.participantNames));
             console.log(`Participant Roles:`, JSON.stringify(data.participantRoles));
             console.log(`Order ID: ${data.orderId || data.metadata?.orderNumber}`);
             
             // Try to fetch messages
             const msgSnap = await db.collection(`chats/${doc.id}/messages`).orderBy("timestamp", "desc").limit(1).get();
             if (!msgSnap.empty) {
                 console.log("Last message in DB:", msgSnap.docs[0].data().text);
             } else {
                 console.log("No messages found in subcollection.");
             }
        }

    } catch (err) {
        console.error("Test Failed:", err.message);
    }
}

checkChats();
