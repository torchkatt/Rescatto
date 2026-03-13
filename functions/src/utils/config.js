"use strict";

const IS_PROD = process.env.NODE_ENV === "production";

const ALLOWED_ORIGINS = IS_PROD
    ? [
        "https://rescatto.com",
        "https://app.rescatto.com",
        "https://rescatto-c8d2b.web.app",
        "https://rescatto-c8d2b.firebaseapp.com",
    ]
    : true;

const CONFIG = {
    platformCommissionRate: 0.10, // 10%
    deliveryFee: 5000, // COP flat fallback
    sendgrid: {
        from: process.env.SENDGRID_FROM || "noreply@rescatto.com",
    },
};

module.exports = { IS_PROD, ALLOWED_ORIGINS, CONFIG };
