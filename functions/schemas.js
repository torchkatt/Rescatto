"use strict";

const { z } = require("zod");

// ─── createNotification ─────────────────────────────────────────────────────
const CreateNotificationSchema = z.object({
  userId: z.string().trim().min(1, "userId is required."),
  title: z.string().trim().min(1, "title is required.").max(120, "title must be 120 chars or less."),
  message: z.string().trim().min(1, "message is required.").max(500, "message must be 500 chars or less."),
  type: z.enum(["info", "success", "warning", "error"]).default("info"),
  link: z
    .string()
    .trim()
    .max(300, "link must be 300 chars or less.")
    .refine((v) => v.startsWith("/"), { message: "link must start with /" })
    .optional()
    .nullable(),
});

// ─── generateWompiSignature ─────────────────────────────────────────────────
const GenerateWompiSignatureSchema = z.object({
  reference: z.string().trim().min(1, "reference is required.").max(200),
  amount: z.number().positive("amount must be > 0").max(100000000, "amount exceeds maximum"),
  currency: z.enum(["COP"]).default("COP"),
});

// ─── createOrder ────────────────────────────────────────────────────────────
const OrderProductSchema = z.object({
  productId: z.string().min(1, "productId is required."),
  quantity: z.number().int().positive("quantity must be > 0").max(100, "Max 100 per product"),
});

const CreateOrderSchema = z.object({
  venueId: z.string().min(1, "venueId is required."),
  products: z.array(OrderProductSchema).min(1, "At least one product is required.").max(50, "Max 50 products per order"),
  paymentMethod: z.enum(["card", "cash"], { message: "Invalid payment method." }),
  deliveryMethod: z.enum(["delivery", "pickup", "donation"], { message: "Invalid delivery method." }),
  address: z.string().min(1).max(500).optional().nullable(),
  phone: z.string().max(30).optional().default(""),
  transactionId: z.string().min(1).max(200).optional().nullable(),
  isDonation: z.boolean().optional().default(false),
  donationCenterId: z.string().min(1).optional().nullable(),
  donationCenterName: z.string().max(200).optional().nullable(),
  estimatedCo2: z.number().min(0).max(10).optional().default(0),
  deliveryFee: z.number().min(0).max(25000).optional().nullable(),
  redemptionId: z.string().trim().min(1).max(200).optional().nullable(),
});

// ─── wompiWebhook ───────────────────────────────────────────────────────────
const WompiTransactionSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
}).passthrough();

const WompiWebhookSchema = z.object({
  event: z.string().min(1),
  data: z.object({
    transaction: WompiTransactionSchema,
  }).passthrough(),
}).passthrough();

// ─── resolveVenueChatTarget ─────────────────────────────────────────────────
const ResolveVenueChatTargetSchema = z.object({
  orderId: z.string().trim().min(1, "orderId is required."),
});

// ─── ensureReferralCode ─────────────────────────────────────────────────────
// No input needed (uses auth uid)

// ─── redeemPoints ───────────────────────────────────────────────────────────
const RedeemPointsSchema = z.object({
  rewardId: z.string().min(1, "rewardId is required."),
  pointsCost: z.number().int().positive("pointsCost must be > 0"),
});

// ─── sendVerificationEmail ───────────────────────────────────────────────
const SendVerificationEmailSchema = z.object({
  email: z.string().email("Valid email is required.").max(320),
});

// ─── deleteUserAccount ──────────────────────────────────────────────────
const DeleteUserAccountSchema = z.object({
  uid: z.string().min(1, "UID is required.").max(128),
});

// ─── getFinanceStats ────────────────────────────────────────────────────
const isoDateRegex = /^\d{4}-\d{2}-\d{2}/;
const GetFinanceStatsSchema = z.object({
  startDate: z.string().regex(isoDateRegex, "startDate must be ISO format.").optional().nullable(),
  endDate: z.string().regex(isoDateRegex, "endDate must be ISO format.").optional().nullable(),
});

module.exports = {
  CreateNotificationSchema,
  GenerateWompiSignatureSchema,
  CreateOrderSchema,
  WompiWebhookSchema,
  ResolveVenueChatTargetSchema,
  RedeemPointsSchema,
  SendVerificationEmailSchema,
  DeleteUserAccountSchema,
  GetFinanceStatsSchema,
};
