import { z } from 'zod';

// ─── Venue ──────────────────────────────────────────────────────────────────
export const VenueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().optional().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  closingTime: z.string(),
  phone: z.string().optional().nullable(),
  rating: z.number().default(0),
  imageUrl: z.string().optional().nullable(),
  businessType: z.string().optional().nullable(),
  categories: z.array(z.string()).optional().default([]),
  logoUrl: z.string().optional().nullable(),
  brandColor: z.string().optional().nullable(),
  secondaryColor: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  dietaryTags: z.array(z.string()).optional().default([]),
  ownerId: z.string().optional().nullable(),
  deliveryConfig: z.object({
    isEnabled: z.boolean(),
    baseFee: z.number().min(0),
    pricePerKm: z.number().min(0),
    maxDistance: z.number().min(0),
    freeDeliveryThreshold: z.number().optional().nullable(),
    minOrderAmount: z.number().optional().nullable(),
  }).optional().nullable(),
  stats: z.object({
    totalRevenue: z.number().min(0),
    totalOrders: z.number().min(0),
    mealsSaved: z.number().min(0),
  }).optional().nullable(),
  isOpen: z.boolean().optional(),
}).passthrough();

// ─── Product ────────────────────────────────────────────────────────────────
export const ProductSchema = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  type: z.enum(['SURPRISE_PACK', 'SPECIFIC_DISH']),
  originalPrice: z.number().min(0),
  discountedPrice: z.number().min(0),
  quantity: z.number().int().min(0),
  imageUrl: z.string().default(''),
  availableUntil: z.string(),
  isDynamicPricing: z.boolean().default(false),
  dynamicDiscountedPrice: z.number().optional().nullable(),
  dynamicTier: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  dietaryTags: z.array(z.string()).optional().default([]),
}).passthrough();

// ─── Order ──────────────────────────────────────────────────────────────────
export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  venueId: z.string(),
  venueName: z.string().optional(),
  status: z.string(),
  paymentMethod: z.enum(['card', 'cash']),
  deliveryMethod: z.enum(['delivery', 'pickup', 'donation']),
  total: z.number().min(0),
  subtotal: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    quantity: z.number(),
    price: z.number(),
  })),
  deliveryFee: z.number().optional(),
  address: z.string().optional(),
  city: z.string().optional().nullable(),
}).passthrough();

// ─── User ───────────────────────────────────────────────────────────────────
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional().nullable(),
  fullName: z.string().min(1),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VENUE_OWNER', 'KITCHEN_STAFF', 'DRIVER', 'CUSTOMER']),
  venueId: z.string().optional().nullable(),
  isVerified: z.boolean().default(false),
  createdAt: z.string(),
  isGuest: z.boolean().optional(),
  city: z.string().optional().nullable(),
  favoriteVenueIds: z.array(z.string()).optional().default([]),
  rescattoPass: z.object({
    isActive: z.boolean(),
    planId: z.enum(['monthly', 'annual']),
    status: z.enum(['active', 'expired', 'cancelled']),
    startsAt: z.string(),
    expiresAt: z.string(),
    autoRenew: z.boolean(),
    paymentMethodId: z.string().optional().nullable(),
    benefits: z.object({
      freeDelivery: z.boolean(),
      exclusiveDeals: z.boolean(),
      multiplierBonus: z.number().optional().nullable(),
    }),
  }).optional().nullable(),
}).passthrough();

// ─── Audit Log ──────────────────────────────────────────────────────────────
export const AuditLogSchema = z.object({
  action: z.string(),
  performedBy: z.string(),
  timestamp: z.any(), // serverTimestamp() result
  userRole: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  path: z.string().optional(),
  userAgent: z.string().optional(),
  device: z.string().optional(),
}).passthrough();

// ─── CartItem ───────────────────────────────────────────────────────────────
export const CartItemSchema = z.object({
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
  price: z.number(),
  originalPrice: z.number(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().default(''),
  availableUntil: z.string().optional(),
});

// ─── Checkout Form ────────────────────────────────────────────────────────
export const CheckoutFormSchema = z.object({
  address: z.string().min(5, "La dirección debe tener al menos 5 caracteres").optional().nullable(),
  phone: z.string()
    .min(7, "Mínimo 7 dígitos")
    .max(15, "Máximo 15 dígitos")
    .regex(/^\d+$/, { message: "Solo números" }),
  deliveryMethod: z.enum(['delivery', 'pickup', 'donation']),
  selectedDonationCenterId: z.string().optional().nullable(),
}).refine((data) => {
  if (data.deliveryMethod === 'delivery' && !data.address) return false;
  return true;
}, {
  message: "La dirección es obligatoria para domicilios",
  path: ["address"],
}).refine((data) => {
  if (data.deliveryMethod === 'donation' && !data.selectedDonationCenterId) return false;
  return true;
}, {
  message: "Debe seleccionar un centro de acopio",
  path: ["selectedDonationCenterId"],
});

// ─── Safe parse helpers ─────────────────────────────────────────────────────
export function safeParseVenue(data: unknown) {
  return VenueSchema.safeParse(data);
}

export function safeParseProduct(data: unknown) {
  return ProductSchema.safeParse(data);
}

export function safeParseCartItem(data: unknown) {
  return CartItemSchema.safeParse(data);
}

export function safeParseOrder(data: unknown) {
  return OrderSchema.safeParse(data);
}

export function safeParseCheckoutForm(data: unknown) {
  return CheckoutFormSchema.safeParse(data);
}

export function safeParseUser(data: unknown) {
  return UserSchema.safeParse(data);
}

export function safeParseAuditLog(data: unknown) {
  return AuditLogSchema.safeParse(data);
}

// ─── Driver Location ────────────────────────────────────────────────────────
export const DriverLocationSchema = z.object({
  userId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  heading: z.number().optional(),
  speed: z.number().optional(),
  lastUpdate: z.string(),
  isActive: z.boolean(),
}).passthrough();

export function safeParseDriverLocation(data: unknown) {
  return DriverLocationSchema.safeParse(data);
}
