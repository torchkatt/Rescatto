import { AnalyticsData, Order, OrderProduct, OrderStatus, Product, ProductType, Venue } from '../types';

// Helper to convert a Product to an OrderProduct snapshot
const toOrderProduct = (p: Product, qty = 1): OrderProduct => ({
  productId: p.id,
  name: p.name,
  quantity: qty,
  price: p.discountedPrice,
  originalPrice: p.originalPrice,
  image: p.imageUrl,
});

export const MOCK_VENUE: Venue = {
  id: 'v1',
  name: 'Gourmet Bistro Bogota',
  address: 'Cl. 93 #11-19, Bogotá, Colombia',
  latitude: 4.678,
  longitude: -74.056,
  closingTime: '22:00',
  rating: 4.8,
  dietaryTags: ['VEGAN', 'GLUTEN_FREE'],
};

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    venueId: 'v1',
    name: 'Pack Sorpresa - Cena',
    type: ProductType.SURPRISE_PACK,
    originalPrice: 45000,
    discountedPrice: 15000,
    quantity: 5,
    imageUrl: 'https://picsum.photos/400/300',
    availableUntil: new Date(new Date().setHours(22, 0, 0, 0)).toISOString(),
    isDynamicPricing: true,
    dietaryTags: ['VEGAN'],
  },
  {
    id: 'p2',
    venueId: 'v1',
    name: 'Risotto de Champiñones',
    type: ProductType.SPECIFIC_DISH,
    originalPrice: 38000,
    discountedPrice: 12000,
    quantity: 2,
    imageUrl: 'https://picsum.photos/401/300',
    availableUntil: new Date(new Date().setHours(21, 30, 0, 0)).toISOString(),
    isDynamicPricing: false,
  },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-9921',
    customerName: 'Ana García',
    products: [toOrderProduct(MOCK_PRODUCTS[0]), toOrderProduct(MOCK_PRODUCTS[0])],
    totalAmount: 30000,
    status: OrderStatus.PAID, // Ready to prepare
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    pickupDeadline: new Date(new Date().setHours(22, 0, 0, 0)).toISOString(),
    venueId: 'v1',
    customerId: 'c1',
    deliveryAddress: 'Calle 100 #15-20, Bogotá',
    phone: '3001234567',
    paymentMethod: 'Credit Card',
  },
  {
    id: 'ORD-9922',
    customerName: 'Carlos López',
    products: [toOrderProduct(MOCK_PRODUCTS[1])],
    totalAmount: 12000,
    status: OrderStatus.READY, // Waiting for customer
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25 mins ago
    pickupDeadline: new Date(new Date().setHours(21, 30, 0, 0)).toISOString(),
    venueId: 'v1',
    customerId: 'c2',
    deliveryAddress: 'Carrera 7 #72-10, Bogotá',
    phone: '3109876543',
    paymentMethod: 'Cash',
  },
  {
    id: 'ORD-9920',
    customerName: 'Juan Pérez',
    products: [toOrderProduct(MOCK_PRODUCTS[0])],
    totalAmount: 15000,
    status: OrderStatus.COMPLETED,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    pickupDeadline: new Date(new Date().setHours(22, 0, 0, 0)).toISOString(),
    venueId: 'v1',
    customerId: 'c3',
    deliveryAddress: 'Calle 127 #45-12, Bogotá',
    phone: '3204567890',
    paymentMethod: 'Stripe',
  },
  {
    id: 'ORD-9919',
    customerName: 'Luisa Fernanda',
    products: [toOrderProduct(MOCK_PRODUCTS[1]), toOrderProduct(MOCK_PRODUCTS[0])],
    totalAmount: 27000,
    status: OrderStatus.MISSED,
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    pickupDeadline: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    venueId: 'v1',
    customerId: 'c4',
    deliveryAddress: 'Carrera 15 #85-30, Bogotá',
    phone: '3157890123',
    paymentMethod: 'Stripe',
  },
];

export const MOCK_ANALYTICS: AnalyticsData = {
  revenue: 2500000,
  wasteSavedKg: 45.5,
  mealsSaved: 120,
  chartData: [
    { name: 'Mon', sales: 400000, waste: 10 },
    { name: 'Tue', sales: 300000, waste: 8 },
    { name: 'Wed', sales: 200000, waste: 12 },
    { name: 'Thu', sales: 278000, waste: 9 },
    { name: 'Fri', sales: 589000, waste: 4 },
    { name: 'Sat', sales: 439000, waste: 5 },
    { name: 'Sun', sales: 349000, waste: 7 },
  ],
};