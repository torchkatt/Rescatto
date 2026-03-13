"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { withErrorHandling } = require("../utils/errorHandler");

/**
 * Gets the top rescuers for a given city and period.
 * Returns only safe/public data.
 */
exports.getLeaderboard = onCall(withErrorHandling("getLeaderboard", async (request) => {
    const { city, limit: limitCount = 10, period = "all-time" } = request.data;
    
    let sortField = "impact.totalRescues";
    if (period === "monthly") sortField = "impact.monthlyRescues";
    if (period === "weekly") sortField = "impact.weeklyRescues";

    let query = admin.firestore().collection("users")
        .where(sortField, ">", 0)
        .orderBy(sortField, "desc");

    if (city) {
        query = query.where("city", "==", city);
    }

    const snapshot = await query.limit(limitCount).get();

    const leaderboard = snapshot.docs.map(doc => {
        const data = doc.data();
        const impact = data.impact || {};
        
        return {
            userId: doc.id,
            fullName: data.fullName || "Rescatador",
            avatarUrl: data.avatarUrl,
            city: data.city,
            level: impact.level || "NOVICE",
            totalRescues: impact.totalRescues || 0,
            monthlyRescues: impact.monthlyRescues || 0,
            weeklyRescues: impact.weeklyRescues || 0,
            co2Saved: impact.co2Saved || 0,
            points: impact.points || 0,
            streak: data.streak?.current || 0
        };
    });

    return { leaderboard };
}));

/**
 * Gets the current user's rank in their city or globally.
 */
exports.getMyLeaderboardRank = onCall(withErrorHandling("getMyLeaderboardRank", async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const userId = request.auth.uid;
    const { city, period = "all-time" } = request.data;

    // 1. Get user data
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
        return { rank: 0, totalPlayers: 0 };
    }

    const userData = userDoc.data();
    let myRescues = 0;
    let sortField = "impact.totalRescues";

    if (period === "monthly") {
        sortField = "impact.monthlyRescues";
        myRescues = userData.impact?.monthlyRescues || 0;
    } else if (period === "weekly") {
        sortField = "impact.weeklyRescues";
        myRescues = userData.impact?.weeklyRescues || 0;
    } else {
        myRescues = userData.impact?.totalRescues || 0;
    }

    // 2. Count users with more rescues
    let rankRef = admin.firestore().collection("users")
        .where(sortField, ">", myRescues);
    
    let totalRef = admin.firestore().collection("users")
        .where(sortField, ">", 0);

    if (city) {
        rankRef = rankRef.where("city", "==", city);
        totalRef = totalRef.where("city", "==", city);
    }

    // Use count() for efficiency
    const [rankSnap, totalSnap] = await Promise.all([
        rankRef.count().get(),
        totalRef.count().get()
    ]);

    return {
        rank: rankSnap.data().count + 1,
        totalPlayers: totalSnap.data().count
    };
}));
