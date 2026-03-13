"use strict";

const { z } = require("zod");

// ─── Shared Schemas ─────────────────────────────────────────────────────────
const POSITIVE_INT = z.number().int().positive();

// ─── createNotification ─────────────────────────────────────────────────────
const CreateNotificationSchema = z.object({
  userId: z.string().trim().min(1, "userId is required.").max(128),
  title: z.string().trim().min(1, "title is required.").max(120, "title must be 120 chars or less."),
  message: z.string().trim().min(1, "message is required.").max(500, "message must be 500 chars or less."),
  type: z.enum(["info", "success", "warning", "error"]).default("info"),
  link: z
    .string()
    .trim()
    .max(300, "link must be 300 chars or less.")
    .refine((v) => !v || v.startsWith("/"), { message: "link must start with /" })
    .optional()
    .nullable(),
}).strict();

// ─── generateWompiSignature ─────────────────────────────────────────────────
const GenerateWompiSignatureSchema = z.object({
  reference: z.string().trim().min(1, "reference is required.").max(200),
  amount: z.number().positive("amount must be > 0").max(10_000_000, "amount exceeds maximum"),
  currency: z.enum(["COP"]).default("COP"),
}).strict();

// ─── createOrder ────────────────────────────────────────────────────────────
const OrderProductSchema = z.object({
  productId: z.string().min(1, "productId is required.").max(128),
  quantity: z.number().int().positive("quantity must be > 0").max(50, "Max 50 per product"),
}).strict();

const CreateOrderSchema = z.object({
  venueId: z.string().min(1, "venueId is required.").max(128),
  products: z.array(OrderProductSchema).min(1, "At least one product is required.").max(20, "Max 20 different products per order"),
  paymentMethod: z.enum(["card", "cash"], { errorMap: () => ({ message: "Invalid payment method. Use 'card' or 'cash'." }) }),
  deliveryMethod: z.enum(["delivery", "pickup", "donation"], { errorMap: () => ({ message: "Invalid delivery method." }) }),
  address: z.string().trim().min(5, "Address too short.").max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().default("Bogotá"),
  phone: z.string().trim().max(30).optional().default(""),
  transactionId: z.string().trim().min(1).max(200).optional().nullable(),
  isDonation: z.boolean().optional().default(false),
  donationCenterId: z.string().trim().min(1).max(128).optional().nullable(),
  donationCenterName: z.string().trim().max(200).optional().nullable(),
  estimatedCo2: z.number().min(0).max(10).optional().default(0),
  deliveryFee: z.number().int().min(0).max(50_000).optional().nullable(),
  redemptionId: z.string().trim().min(1).max(128).optional().nullable(),
}).strict();

// ─── wompiWebhook ───────────────────────────────────────────────────────────
const WompiTransactionSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  reference: z.string().optional().nullable(),
  amount_in_cents: z.number().optional().nullable(),
}).passthrough();

const WompiWebhookSchema = z.object({
  event: z.string().min(1),
  data: z.object({
    transaction: WompiTransactionSchema,
  }).passthrough(),
  sent_at: z.string().optional(),
}).passthrough();

// ─── resolveVenueChatTarget ─────────────────────────────────────────────────
const ResolveVenueChatTargetSchema = z.object({
  orderId: z.string().trim().min(1, "orderId is required.").max(128),
}).strict();

// ─── redeemPoints ───────────────────────────────────────────────────────────
const RedeemPointsSchema = z.object({
  rewardId: z.string().trim().min(1, "rewardId is required.").max(128),
  pointsCost: POSITIVE_INT,
}).strict();

// ─── sendVerificationEmail ───────────────────────────────────────────────
const SendVerificationEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required.").max(320),
}).strict();

// ─── deleteUserAccount ──────────────────────────────────────────────────
const DeleteUserAccountSchema = z.object({
  uid: z.string().trim().min(1, "UID is required.").max(128),
}).strict();

// ─── getFinanceStats ────────────────────────────────────────────────────
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const GetFinanceStatsSchema = z.object({
  startDate: z.string().regex(isoDateRegex, "startDate must be YYYY-MM-DD.").optional().nullable(),
  endDate: z.string().regex(isoDateRegex, "endDate must be YYYY-MM-DD.").optional().nullable(),
}).strict();

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
