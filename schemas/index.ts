import { z } from 'zod';

// ─── Venue ──────────────────────────────────────────────────────────────────
export const VenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  closingTime: z.string(),
  phone: z.string().optional(),
  rating: z.number().default(0),
  imageUrl: z.string().optional(),
  businessType: z.string().optional(),
  categories: z.array(z.string()).optional(),
  logoUrl: z.string().optional(),
  brandColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  coverImageUrl: z.string().optional(),
  dietaryTags: z.array(z.string()).optional(),
  ownerId: z.string().optional(),
  deliveryConfig: z.object({
    isEnabled: z.boolean(),
    baseFee: z.number(),
    pricePerKm: z.number(),
    maxDistance: z.number(),
    freeDeliveryThreshold: z.number().optional(),
    minOrderAmount: z.number().optional(),
  }).optional(),
  stats: z.object({
    totalRevenue: z.number(),
    totalOrders: z.number(),
    mealsSaved: z.number(),
  }).optional(),
}).passthrough();

// ─── Product ────────────────────────────────────────────────────────────────
export const ProductSchema = z.object({
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['SURPRISE_PACK', 'SPECIFIC_DISH']),
  originalPrice: z.number(),
  discountedPrice: z.number(),
  quantity: z.number().int().min(0),
  imageUrl: z.string().default(''),
  availableUntil: z.string(),
  isDynamicPricing: z.boolean().default(false),
  dynamicDiscountedPrice: z.number().optional(),
  dynamicTier: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dietaryTags: z.array(z.string()).optional(),
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
