import { z } from 'zod';

/**
 * Zod schemas for validating Firestore document shapes at runtime.
 * Use these when reading documents to catch schema drift early.
 */

export const VenueWalletSchema = z.object({
    venueId: z.string(),
    balance: z.number(),
    updatedAt: z.string().optional(),
});

export const WalletTransactionSchema = z.object({
    id: z.string().optional(),
    venueId: z.string(),
    orderId: z.string().optional(),
    type: z.enum(['CREDIT', 'DEBIT']),
    amount: z.number(),
    description: z.string(),
    createdAt: z.string(),
    referenceType: z.enum(['ORDER_ONLINE', 'ORDER_CASH', 'PAYOUT', 'DEBT_PAYMENT']),
});

export const UserProfileSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.string(),
    points: z.number().optional(),
    venueId: z.string().optional(),
    venueIds: z.array(z.string()).optional(),
});

export const ProductSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number(),
    originalPrice: z.number().optional(),
    quantity: z.number(),
    venueId: z.string(),
    imageUrl: z.string().optional(),
    availableUntil: z.string().optional(),
    isActive: z.boolean().optional(),
});

export const VenueSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    imageUrl: z.string().optional(),
    category: z.string().optional(),
    isActive: z.boolean().optional(),
});

/**
 * Safely parse a Firestore document against a schema.
 * Returns the parsed data or null if validation fails (logs the error).
 */
export function safeParse<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown,
    context?: string
): z.infer<T> | null {
    const result = schema.safeParse(data);
    if (!result.success) {
        if (import.meta.env.DEV) {
            console.warn(
                `[Firestore schema mismatch]${context ? ` in ${context}` : ''}:`,
                result.error.issues
            );
        }
        return null;
    }
    return result.data;
}
