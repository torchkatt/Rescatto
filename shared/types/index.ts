export enum ProductType {
  SURPRISE_PACK = 'SURPRISE_PACK',
  SPECIFIC_DISH = 'SPECIFIC_DISH',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  READY_PICKUP = 'READY_PICKUP',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
  DISPUTED = 'DISPUTED',
}

// --- NEW AUTH TYPES ---
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',     // Dueños de la plataforma Rescatto
  VENUE_OWNER = 'VENUE_OWNER',     // Dueño del restaurante (Acceso total al venue)
  KITCHEN_STAFF = 'KITCHEN_STAFF', // Personal de cocina (Solo ve KDS/Pedidos)
  CUSTOMER = 'CUSTOMER',           // Usuario final (App Cliente)
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  venueId?: string; // Link to the specific restaurant they work for
  avatarUrl?: string;
}
// ----------------------

export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  closingTime: string; // HH:mm format
  rating: number;
}

export interface Product {
  id: string;
  venueId: string;
  name: string;
  type: ProductType;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
  imageUrl: string;
  availableUntil: string; // ISO String
  isDynamicPricing: boolean;
}

export interface Order {
  id: string;
  customerName: string;
  products: Product[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  pickupDeadline: string;
}

export interface AnalyticsData {
  revenue: number;
  wasteSavedKg: number;
  mealsSaved: number;
  chartData: { name: string; sales: number; waste: number }[];
}