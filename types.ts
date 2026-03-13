export enum ProductType {
  SURPRISE_PACK = 'SURPRISE_PACK',
  SPECIFIC_DISH = 'SPECIFIC_DISH',
}

export enum BusinessType {
  RESTAURANT = 'Restaurante',
  HOTEL = 'Hotel',
  SUPERMARKET = 'Supermercado',
  CAFE = 'Cafetería',
  BAKERY = 'Panadería',
  OTHER = 'Otro',
}

export const BUSINESS_TYPES_LIST = Object.values(BusinessType);

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  IN_PREPARATION = 'IN_PREPARATION', // [NUEVO] Cocina
  READY_PICKUP = 'READY_PICKUP',
  DRIVER_ACCEPTED = 'DRIVER_ACCEPTED', // [NUEVO] Domiciliario acepta
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  MISSED = 'MISSED',
  DISPUTED = 'DISPUTED',
}

// --- TIPOS DE AUTENTICACIÓN ---
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',     // Dueños de la plataforma Rescatto
  ADMIN = 'ADMIN',                 // Administrador (Gestiona usuarios y sedes)
  CITY_ADMIN = 'CITY_ADMIN',       // Admin de ciudad (Ve datos solo de su ciudad)
  VENUE_OWNER = 'VENUE_OWNER',     // Dueño del restaurante (Acceso total a la sede)
  KITCHEN_STAFF = 'KITCHEN_STAFF', // Personal de cocina (Solo ve KDS/Pedidos)
  DRIVER = 'DRIVER',               // Domiciliario
  CUSTOMER = 'CUSTOMER',           // Usuario final (App Cliente)
}

export type MembershipStatus = 'active' | 'pending' | 'suspended' | 'banned' | 'deleted';

export interface Membership {
  id: string;
  userId: string;
  role: UserRole;
  venueId?: string;
  permissions?: Permission[];
  status: MembershipStatus;
  createdAt: string;
  createdBy?: string;
}

export interface User {
  id: string;
  email: string;
  activeMembershipId?: string; // [V2 Multi-Role] Reference to currently active membership
  fullName: string;
  role: UserRole;
  venueId?: string; // Enlace al restaurante específico para el que trabajan
  venueIds?: string[]; // Enlace a múltiples restaurantes (para dueños/personal de múltiples sedes)
  avatarUrl?: string;
  phone?: string;
  address?: string;
  city?: string; // [NUEVO] Ciudad para filtrado
  isActive?: boolean;
  createdAt?: string;
  permissions?: Permission[]; // Sobreescritura opcional para permisos basados en roles
  // Verificación
  isVerified?: boolean;
  verificationDate?: string;
  verifiedBy?: string;
  hasSeenOnboarding?: boolean; // Para Onboarding UI
  isGuest?: boolean; // true = sesión anónima de Firebase (sin email/contraseña)
  // Crecimiento y Viralidad (Referral)
  referralCode?: string;
  invitedBy?: string;
  // Métricas de Impacto (UX V2.0)
  impact?: {
    co2Saved: number; // en kg
    moneySaved: number; // en moneda local
    totalRescues: number;
    treesEquivalent?: number;
    points: number; // Para lealtad/gamificación
    level: 'NOVICE' | 'HERO' | 'GUARDIAN';
    badges: {
      id: string;
      earnedAt: string;
      icon: string;
      name: string;
    }[];
  };
  // Racha de pedidos consecutivos
  streak?: {
    current: number;       // Días consecutivos con al menos 1 pedido
    longest: number;       // Mejor racha histórica
    lastOrderDate: string; // 'YYYY-MM-DD' del último pedido completado
    multiplier: number;    // 1.0 | 1.5 | 2.0 | 2.5 | 3.0
  };
  // Canjes de puntos pendientes de aplicar en la próxima compra
  redemptions?: ActiveRedemption[];
  // [NUEVO] Favoritos
  favoriteVenueIds?: string[];
  // [NUEVO] Rescatto Pass (Suscripciones Capa 13)
  rescattoPass?: RescattoPass;
}

export interface RescattoPass {
  isActive: boolean;
  planId: 'monthly' | 'annual';
  status: 'active' | 'expired' | 'cancelled';
  startsAt: string;
  expiresAt: string;
  autoRenew: boolean;
  paymentMethodId?: string;
  benefits: {
    freeDelivery: boolean;
    exclusiveDeals: boolean;
    multiplierBonus?: number;
  };
}

/** Un canje de puntos que ya fue procesado y aún no se ha consumido en una orden */
export interface ActiveRedemption {
  id: string;           // ID único del canje (generado por la Cloud Function)
  rewardId: string;     // 'discount_5k', 'discount_10k', 'free_pack', 'donation_meal'
  discountAmount: number; // Monto de descuento en COP (0 si es ítem gratis)
  label: string;        // Texto amigable: "5.000 COP de descuento"
  expiresAt: string;    // ISO timestamp — canjes tienen 30 días de vigencia
  usedAt?: string;      // ISO timestamp cuando fue consumido en una orden
}

export interface AuditLog {
  id: string;
  action: string; // ej., 'USER_CREATED', 'USER_VERIFIED', 'ORDER_UPDATED'
  performedBy: string; // ID de Usuario o Email
  targetId?: string; // ID del Recurso Objetivo
  targetCollection?: string; // 'users', 'orders', etc.
  details?: any; // Diferencias o metadatos
  timestamp: string;
  ipAddress?: string; // Obsoleto a favor de metadata.ip
  metadata?: {
    ip?: string;
    userAgent?: string;
    location?: string;
    device?: string; // ej., 'Macintosh', 'iPhone'
  };
}
// ----------------------

export interface Venue {
  id: string;
  name: string;
  address: string;
  city?: string; // [NUEVO] Ciudad del establecimiento
  latitude: number;
  longitude: number;
  closingTime: string; // Formato HH:mm
  phone?: string; // Contacto para conductores/clientes
  rating: number;
  imageUrl?: string;
  businessType?: string; // ej., "Restaurante", "Hotel"
  categories?: string[]; // Ahora actuando como ETIQUETAS ej., ["Italiano", "Pizza"]
  // Marca/Tematización
  logoUrl?: string;
  brandColor?: string; // Color primario (hex)
  secondaryColor?: string; // Color secundario (hex)
  coverImageUrl?: string; // Imagen de portada/banner
  dietaryTags?: string[]; // ej., ['VEGAN', 'GLUTEN_FREE']

  // Configuración de Domicilio [NUEVO]
  deliveryConfig?: {
    isEnabled: boolean;
    baseFee: number; // Tarifa base
    pricePerKm: number; // Costo por km adicional
    maxDistance: number; // Radio máximo en km
    freeDeliveryThreshold?: number; // Pedido mínimo para envío gratis
    minOrderAmount?: number; // Pedido mínimo para procesar domicilio
  };

  ownerId?: string;

  // Contadores del Dashboard [NUEVO v2]
  stats?: {
    totalRevenue: number;
    totalOrders: number;
    mealsSaved: number;
  };
}

export interface VenueCategory {
  id: string;
  name: string;
  slug?: string; // Opcional para compatibilidad
  icon?: string; // Opcional
  isActive?: boolean; // Opcional, por defecto true
}

export interface Product {
  id: string;
  venueId: string;
  name: string;
  category?: string; // ej., "Entradas", "Platos Fuertes"
  description?: string; // Descripción del producto
  type: ProductType;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
  imageUrl: string;
  availableUntil: string; // Cadena ISO
  isDynamicPricing: boolean;
  /** Set by applyDynamicPricing Cloud Function when isDynamicPricing=true. Prefer over discountedPrice. */
  dynamicDiscountedPrice?: number;
  /** Human-readable tier label, e.g. "⬇️ -30% último 1h" */
  dynamicTier?: string;
  tags?: string[]; // Descriptores extra ej., "Picante", "Sin Gluten"
  dietaryTags?: string[]; // ej., ['VEGAN', 'GLUTEN_FREE']
  isRecurring?: boolean; // [NUEVO] Si el producto se vuelve a publicar automáticamente
  recurrencyDays?: string[]; // ['MON', 'TUE', ...]
  searchKeywords?: string[]; // [NUEVO] Para búsqueda optimizada
  city?: string; // [NUEVO] Ciudad del producto (heredada de venue)
  createdAt?: any;
  updatedAt?: any;
}

export interface OrderProduct {
  productId?: string;
  name: string;
  quantity: number;
  price: number; // Este es el precio unitario al momento de la compra
  originalPrice: number;
  image?: string;
  imageUrl?: string;
  discountedPrice?: number; // soporte legado
}

export interface Order {
  id: string;
  customerName: string;
  products: OrderProduct[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  pickupDeadline: string;
  venueId: string;
  customerId: string;
  deliveryAddress: string;
  city?: string; // [NUEVO]
  phone: string;
  paymentMethod: string;
  driverId?: string;
  deliveryMethod?: 'delivery' | 'pickup'; // Nuevo campo
  metadata?: {
    orderNumber?: string;
    customerName?: string;
    venueName?: string;
    [key: string]: any;
  };
  acceptedAt?: string;
  deliveredAt?: string;
  deliveryNotes?: string;
  rated?: boolean; // Si el cliente ha calificado este pedido
  paymentStatus?: 'pending' | 'paid' | 'failed';
  transactionId?: string; // ID de PaymentIntent de Stripe

  // Desglose Financiero
  subtotal?: number;       // Costo de productos antes de tarifas
  platformFee?: number;    // Ingresos para Rescatto
  deliveryFee?: number;    // Costo del envío
  venueEarnings?: number;  // Lo que la sede realmente recibe (subtotal - comisión)

  // Donación
  isDonation?: boolean;
  donationCenterId?: string;
  donationCenterName?: string;

  // Métricas de Impacto
  estimatedCo2?: number;
  moneySaved?: number; // [NUEVO]
  pointsEarned?: number;
}

export interface DonationCenter {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  imageUrl?: string;
  description?: string;
  type: 'SHELTER' | 'NURSING_HOME' | 'FOUNDATION' | 'OTHER';
  categories?: string[];
  isActive: boolean;
  rating: number;
  reviewsCount: number;
}

// Tipos del Sistema de Calificación
export interface Rating {
  id: string;
  orderId: string;

  // Participantes
  fromUserId: string;      // Quién califica
  fromUserRole: UserRole;
  toUserId: string;        // A quién se califica (ID de dueño de sede o ID de conductor)
  toUserRole: UserRole;

  // Datos de calificación
  score: number;           // 1-5 estrellas
  comment?: string;
  createdAt: string;

  // Contexto
  venueId?: string;        // Si se califica una sede/pedido
  driverId?: string;       // Si se califica un conductor
}

// ----------------------

export interface RatingStats {
  userId: string;          // Puede ser userId o venueId dependiendo del contexto
  averageRating: number;
  totalRatings: number;
  breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  lastUpdated: string;
}

// Tipos del Sistema de Chat
export type ChatType = 'customer-venue' | 'customer-driver' | 'venue-driver' | 'admin-support';

export interface Chat {
  id: string;
  participants: string[]; // Array de IDs de usuario
  participantNames: Record<string, string>; // mapeo userId -> nombre
  participantRoles: Record<string, UserRole>; // mapeo userId -> rol
  orderId?: string;
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: string;
    read: boolean;
  };
  createdAt: string;
  updatedAt: string;
  type: ChatType;
  metadata: {
    customerName?: string;
    venueName?: string;
    driverName?: string;
    orderNumber?: string;
  };
}

export type MessageType = 'text' | 'image' | 'system' | 'location';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
  read: boolean;
  type: MessageType;
  imageUrl?: string;
  location?: { lat: number; lng: number };
}

// ─── Flash Deals ──────────────────────────────────────────────────────────────
export interface FlashDeal {
  id: string;
  title: string;            // ej: "¡Pack Sorpresa -70% por 1 hora!"
  description: string;
  venueId: string;
  venueName: string;
  productId?: string;       // Si aplica a un producto específico
  imageUrl?: string;
  extraDiscountPct: number; // Descuento adicional sobre precio con descuento
  flashPrice?: number;      // Precio final flash (calculado)
  startTime: string;        // ISO
  endTime: string;          // ISO
  isActive: boolean;
  claimsCount?: number;
  maxClaims?: number;
}

export interface AnalyticsData {
  revenue: number;
  wasteSavedKg: number;
  mealsSaved: number;
  chartData: { name: string; sales: number; waste: number }[];
}

// --- SISTEMA DE PERMISOS ---
export enum Permission {
  // Gestión de Usuarios
  VIEW_USERS = 'VIEW_USERS',
  CREATE_USERS = 'CREATE_USERS',
  EDIT_USERS = 'EDIT_USERS',
  DELETE_USERS = 'DELETE_USERS',
  MANAGE_USER_ROLES = 'MANAGE_USER_ROLES',

  // Gestión de Sedes
  VIEW_VENUES = 'VIEW_VENUES',
  CREATE_VENUES = 'CREATE_VENUES',
  EDIT_VENUES = 'EDIT_VENUES',
  DELETE_VENUES = 'DELETE_VENUES',
  EDIT_OWN_VENUE = 'EDIT_OWN_VENUE',

  // Gestión de Productos
  VIEW_PRODUCTS = 'VIEW_PRODUCTS',
  CREATE_PRODUCTS = 'CREATE_PRODUCTS',
  EDIT_PRODUCTS = 'EDIT_PRODUCTS',
  DELETE_PRODUCTS = 'DELETE_PRODUCTS',
  VIEW_ALL_PRODUCTS = 'VIEW_ALL_PRODUCTS', // Inventario global

  // Gestión de Pedidos
  VIEW_ORDERS = 'VIEW_ORDERS',
  CREATE_ORDERS = 'CREATE_ORDERS',
  MANAGE_ORDERS = 'MANAGE_ORDERS', // Cambiar estado
  CANCEL_ORDERS = 'CANCEL_ORDERS',
  VIEW_ALL_ORDERS = 'VIEW_ALL_ORDERS', // Todos los pedidos de la plataforma

  // Analíticas
  VIEW_ANALYTICS = 'VIEW_ANALYTICS', // Analíticas propias
  VIEW_GLOBAL_ANALYTICS = 'VIEW_GLOBAL_ANALYTICS', // A nivel de plataforma
  EXPORT_REPORTS = 'EXPORT_REPORTS',

  // Configuración
  MANAGE_SETTINGS = 'MANAGE_SETTINGS', // Configuración de sede propia
  MANAGE_PLATFORM_SETTINGS = 'MANAGE_PLATFORM_SETTINGS', // Config. de plataforma

  // Domicilios
  VIEW_DELIVERIES = 'VIEW_DELIVERIES',
  ACCEPT_DELIVERIES = 'ACCEPT_DELIVERIES',
  MANAGE_DELIVERIES = 'MANAGE_DELIVERIES',
}

// Mapeo de permisos para cada rol
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // Super Admin tiene TODOS los permisos
    ...Object.values(Permission)
  ],

  [UserRole.ADMIN]: [
    // Permisos de Admin (Gestión de Usuarios y Sedes)
    Permission.VIEW_USERS,
    Permission.CREATE_USERS,
    Permission.EDIT_USERS,
    Permission.DELETE_USERS,
    Permission.MANAGE_USER_ROLES,

    Permission.VIEW_VENUES,
    Permission.CREATE_VENUES,
    Permission.EDIT_VENUES,
    Permission.DELETE_VENUES,
    Permission.EDIT_OWN_VENUE,

    // Puede ver todos los productos/pedidos para gestionar el negocio
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_ORDERS,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_REPORTS,
  ],

  [UserRole.VENUE_OWNER]: [
    // Gestión de sede propia
    Permission.EDIT_OWN_VENUE,

    // Productos
    Permission.VIEW_PRODUCTS,
    Permission.CREATE_PRODUCTS,
    Permission.EDIT_PRODUCTS,
    Permission.DELETE_PRODUCTS,

    // Pedidos
    Permission.VIEW_ORDERS,
    Permission.MANAGE_ORDERS,
    Permission.CANCEL_ORDERS,

    // Analíticas y reportes
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_REPORTS,

    // Configuración
    Permission.MANAGE_SETTINGS,
  ],

  [UserRole.KITCHEN_STAFF]: [
    // Solo ver y gestionar pedidos
    Permission.VIEW_ORDERS,
    Permission.MANAGE_ORDERS,

    // Ver productos (para saber qué preparar)
    Permission.VIEW_PRODUCTS,
  ],

  [UserRole.DRIVER]: [
    // Permisos relacionados con domicilios
    Permission.VIEW_DELIVERIES,
    Permission.ACCEPT_DELIVERIES,
    Permission.MANAGE_DELIVERIES,

    // Ver pedidos asignados a ellos
    Permission.VIEW_ORDERS,
  ],

  [UserRole.CITY_ADMIN]: [
    Permission.VIEW_USERS,
    Permission.VIEW_VENUES,
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_ORDERS,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_REPORTS,
  ],

  [UserRole.CUSTOMER]: [
    // Clientes crean pedidos y ven los suyos
    Permission.CREATE_ORDERS,
    Permission.VIEW_ORDERS, // Solo los suyos

    // Navegar productos
    Permission.VIEW_PRODUCTS,
  ],
};

// --- DATOS ADICIONALES DE USUARIO ---
export interface AdditionalUserData {
  fullName?: string;
  role?: UserRole;
  venueId?: string;
  venueIds?: string[];
  phone?: string;
  address?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  createdAt?: string;
  referralCode?: string;
  invitedBy?: string;
  preferences?: {
    notifications?: {
      orderUpdates?: boolean;
    };
  };
}

// --- LOGÍSTICA & SEGUIMIENTO ---
export interface DriverLocation {
  userId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  lastUpdate: string;
  isActive: boolean;
}