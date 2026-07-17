import { collection, query, where, getDocs, getDoc, doc, orderBy, limit, addDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from '../utils/logger';
import { isVenueOpen } from '../utils/venueAvailability';
import { isProductAvailable } from '../utils/productAvailability';
import { Product, Venue, Order, UserRole, Chat, Message } from '../types';
import type { ToolDefinition, VenueSearchResult, ProductSearchResult, OrderSearchResult } from './aiChatTypes';
import { safetyCheck, sanitizeToolInput, validateProfileField, detectPromptInjection, isAdminRole, checkWriteRateLimit, handleSecurityIncident } from './aiChatSecurity';

// ─── Knowledge Base for Rescatto Info ───

const RESCATTO_FAQ: Record<string, string> = {
  'que es rescatto': 'Rescatto es una plataforma que conecta restaurantes, panaderías y supermercados con consumidores para rescatar excedentes de comida de alta calidad a precios reducidos (40-70% de descuento). Nuestro lema es "Alta cocina, cero desperdicio".',
  'como funciona': '1. Explora restaurantes cerca de ti en la pestaña Explorar\n2. Elige un Pack Sorpresa o producto con descuento\n3. Compra desde la app (Wompi, Nequi, efectivo)\n4. Recoge en el horario indicado\n5. ¡Salvas comida y ayudas al planeta! 🌍',
  'pack sorpresa': 'El Pack Sorpresa 🎁 es una bolsa con productos deliciosos que el restaurante no vendió en el día. Llevas alta calidad con hasta 70% de descuento. ¡Cada día es una sorpresa diferente!',
  'metodos de pago': 'Aceptamos tarjetas de crédito, débito (vía Wompi), Nequi, Daviplata y efectivo contraentrega. Todo el pago se procesa seguro desde la aplicación.',
  'horarios': 'Cada restaurante establece su propia ventana de recogida, generalmente cerca del cierre del turno. Verifica el horario exacto antes de confirmar tu compra.',
  'cancelacion': 'Puedes cancelar sin recargos con al menos 2 horas de anticipación al horario de recogida. Si no reclamas a tiempo, el pedido se pierde sin reembolso.',
  'domicilio': 'Algunos restaurantes ofrecen domicilio propio o través de nuestros repartidores. En la pantalla del producto podrás ver si aplica domicilio o solo recogida en local.',
  'puntos': 'Ganas puntos verdes (💎) por cada rescate. Úsalos para canjear descuentos en futuras compras. También tienes una racha (streak) que multiplica tus puntos si pides varios días seguidos.',
  'alergias': 'El Pack Sorpresa varía cada día. Si tienes alergias alimenticias graves, te recomendamos consultar directamente con el restaurante antes de comprar.',
  'rescatto pass': 'Rescatto Pass es nuestra suscripción premium que incluye envíos gratis, ofertas exclusivas y multiplicador de puntos bonus. Pregunta en tu perfil para activarlo.',
};

function findFaqAnswer(query: string): string | null {
  const lower = query.toLowerCase();
  // Direct match
  for (const [key, answer] of Object.entries(RESCATTO_FAQ)) {
    if (lower.includes(key)) return answer;
  }
  // Fuzzy match — check if any keyword overlaps
  const words = lower.split(/\s+/);
  for (const [key] of Object.entries(RESCATTO_FAQ)) {
    const keyWords = key.split(/\s+/);
    const matchCount = keyWords.filter(kw => words.some(w => w.includes(kw) || kw.includes(w))).length;
    if (matchCount >= keyWords.length * 0.6) return RESCATTO_FAQ[key];
  }
  return null;
}

// ─── Tool Definitions (for DeepSeek) ───

export const CHAT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'searchVenues',
      description: 'Buscar restaurantes, panaderías y negocios por nombre, tipo de cocina, ciudad o categoría.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda (nombre, tipo de comida, etc.)' },
          city: { type: 'string', description: 'Ciudad para filtrar (opcional)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description: 'Buscar productos disponibles (packs sorpresa y platos) con filtros por nombre, precio máximo, tipo y ciudad.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda (nombre del producto, tipo de comida)' },
          maxPrice: { type: 'number', description: 'Precio máximo en COP (opcional)' },
          type: { type: 'string', enum: ['SURPRISE_PACK', 'SPECIFIC_DISH'], description: 'Tipo de producto (opcional)' },
          city: { type: 'string', description: 'Ciudad (opcional)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getVenueDetail',
      description: 'Obtener información detallada de un restaurante o negocio incluyendo sus productos disponibles.',
      parameters: {
        type: 'object',
        properties: {
          venueId: { type: 'string', description: 'ID del restaurante/negocio' },
        },
        required: ['venueId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUserOrders',
      description: 'Consultar los pedidos del usuario actual. Puede filtrar por estado (activos, completados, cancelados).',
      parameters: {
        type: 'object',
        properties: {
          statusFilter: {
            type: 'string',
            enum: ['active', 'completed', 'cancelled'],
            description: 'Filtro de estado (opcional, por defecto todos)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getRecommendations',
      description: 'Obtener recomendaciones personalizadas de productos para el usuario basadas en sus intereses.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Cantidad de recomendaciones (default 3)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getRescattoInfo',
      description: 'Obtener información general sobre Rescatto: cómo funciona, packs sorpresa, métodos de pago, horarios, cancelaciones, domicilios, puntos, alergias, Rescatto Pass.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Tema sobre el que quiere información',
            enum: ['que es rescatto', 'como funciona', 'pack sorpresa', 'metodos de pago', 'horarios', 'cancelacion', 'domicilio', 'puntos', 'alergias', 'rescatto pass'],
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigateTo',
      description: 'Navegar al usuario a una sección específica de la aplicación.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta a navegar: /app (home), /app/explore (explorar), /app/orders (mis pedidos), /app/profile (perfil), /app/impact (impacto), /app/favorites (favoritos)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getVenueStats',
      description: '[ADMIN] Obtener estadísticas de los negocios registrados: total, activos, inactivos, por ciudad. Solo disponible para administradores.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'Ciudad para filtrar (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUserSpending',
      description: 'Consultar cuánto ha gastado el usuario en Rescatto. Puede filtrar por período: todo el historial, año actual, mes actual, semana actual o día de hoy.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['all', 'year', 'month', 'week', 'today'],
            description: 'Período para calcular gastos (opcional, por defecto all)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUserStats',
      description: 'Obtener estadísticas generales del usuario: total de pedidos, dinero ahorrado, CO₂ salvado, puntos verdes, nivel, racha actual.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getOrderDetail',
      description: 'Obtener el detalle completo de un pedido específico: productos, cantidades, precios, estado, fechas, método de pago.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'ID del pedido a consultar' },
        },
        required: ['orderId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUnreadMessages',
      description: 'Consultar mensajes y notificaciones pendientes del usuario. Devuelve los chats con mensajes no leídos.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendMessageToVenue',
      description: 'Enviar un mensaje al restaurante/negocio de un pedido. El usuario puede preguntar sobre su pedido, avisar que va en camino, etc. Crea el chat si no existe.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'ID del pedido sobre el cual quiere contactar al negocio' },
          message: { type: 'string', description: 'Mensaje que quiere enviar al restaurante' },
        },
        required: ['orderId', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendMessageToDriver',
      description: 'Enviar un mensaje al domiciliario/repartidor asignado a un pedido.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'ID del pedido cuyo repartidor quiere contactar' },
          message: { type: 'string', description: 'Mensaje que quiere enviar al domiciliario' },
        },
        required: ['orderId', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addToCart',
      description: 'Agregar un producto al carrito de compras. Primero debe buscar el producto con searchProducts para obtener su ID y venueId.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'ID del producto a agregar' },
          venueId: { type: 'string', description: 'ID del restaurante al que pertenece el producto' },
          quantity: { type: 'number', description: 'Cantidad (default 1)' },
        },
        required: ['productId', 'venueId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'viewCart',
      description: 'Ver el contenido del carrito de compras del usuario: productos, cantidades, precios, total.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'removeFromCart',
      description: 'Eliminar un producto del carrito de compras.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'ID del producto a eliminar del carrito' },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clearCart',
      description: 'Vaciar todo el carrito de compras.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggleFavorite',
      description: 'Agregar o quitar un restaurante de la lista de favoritos.',
      parameters: {
        type: 'object',
        properties: {
          venueId: { type: 'string', description: 'ID del restaurante a marcar/desmarcar como favorito' },
        },
        required: ['venueId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateProfile',
      description: 'Actualizar los datos del perfil del usuario: nombre, dirección, ciudad, teléfono.',
      parameters: {
        type: 'object',
        properties: {
          fullName: { type: 'string', description: 'Nuevo nombre completo (opcional)' },
          address: { type: 'string', description: 'Nueva dirección (opcional)' },
          city: { type: 'string', description: 'Nueva ciudad (opcional)' },
          phone: { type: 'string', description: 'Nuevo teléfono (opcional)' },
        },
      },
    },
  },
];

// ─── Tool Executors ───

let navigateFn: ((path: string) => void) | null = null;

export function setNavigateHook(fn: (path: string) => void) {
  navigateFn = fn;
}

// --- Tool: searchVenues ---
async function executeSearchVenues(searchTerm: string, city?: string): Promise<string> {
  try {
    const venuesRef = collection(db, 'venues');
    const q = city
      ? query(venuesRef, where('city', '==', city), limit(20))
      : query(venuesRef, limit(20));
    const snapshot = await getDocs(q);
    const venues = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Venue));

    // Client-side filter by name/categories match
    const lowerQuery = searchTerm.toLowerCase();
    const filtered = venues.filter(v =>
      v.name?.toLowerCase().includes(lowerQuery) ||
      v.categories?.some(c => c.toLowerCase().includes(lowerQuery)) ||
      v.businessType?.toLowerCase().includes(lowerQuery)
    );

    if (filtered.length === 0) return 'No encontré restaurantes con ese criterio.';

    const results: VenueSearchResult[] = filtered.map(v => ({
      id: v.id,
      name: v.name,
      address: v.address,
      city: v.city,
      businessType: v.businessType,
      categories: v.categories,
      isOpen: isVenueOpen(v),
      closingTime: v.closingTime,
      rating: v.rating || 0,
      productCount: 0,
    }));

    return JSON.stringify(results);
  } catch (error) {
    logger.error('aiChat: searchVenues error', error);
    return JSON.stringify({ error: 'Error al buscar restaurantes. Intenta de nuevo.' });
  }
}

// --- Tool: searchProducts ---
async function executeSearchProducts(searchTerm: string, maxPrice?: number, type?: string, city?: string): Promise<string> {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, limit(50));
    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));

    // Get venue names
    const venueIds = [...new Set(products.map(p => p.venueId))];
    const venueDocs = await Promise.all(venueIds.map(async vid => {
      const vRef = doc(db, 'venues', vid);
      const vSnap = await getDoc(vRef);
      return { id: vid, name: vSnap.exists() ? (vSnap.data() as Venue).name : 'Desconocido' };
    }));
    const venueNames = new Map(venueDocs.map(v => [v.id, v.name]));

    // Client-side filter
    const now = Date.now();
    const lowerQuery = searchTerm.toLowerCase();
    const filtered = products.filter(p => {
      if (!isProductAvailable(p)) return false;
      if (!p.name?.toLowerCase().includes(lowerQuery) && !p.tags?.some(t => t.toLowerCase().includes(lowerQuery))) return false;
      if (maxPrice && (p.dynamicDiscountedPrice || p.discountedPrice) > maxPrice) return false;
      if (type && p.type !== type) return false;
      if (city) {
        const venue = venueDocs.find(v => v.id === p.venueId);
        if (!venue) return false;
      }
      return true;
    });

    if (filtered.length === 0) return 'No encontré productos disponibles con esos criterios.';

    const results: ProductSearchResult[] = filtered.slice(0, 15).map(p => ({
      id: p.id,
      name: p.name,
      venueId: p.venueId,
      venueName: venueNames.get(p.venueId) || 'Desconocido',
      originalPrice: p.originalPrice,
      discountedPrice: p.discountedPrice,
      dynamicDiscountedPrice: p.dynamicDiscountedPrice,
      quantity: p.quantity,
      availableUntil: p.availableUntil,
      type: p.type,
      imageUrl: p.imageUrl,
      discountPct: Math.round(((p.originalPrice - (p.dynamicDiscountedPrice || p.discountedPrice)) / p.originalPrice) * 100),
    }));

    return JSON.stringify(results);
  } catch (error) {
    logger.error('aiChat: searchProducts error', error);
    return JSON.stringify({ error: 'Error al buscar productos. Intenta de nuevo.' });
  }
}

// --- Tool: getVenueDetail ---
async function executeGetVenueDetail(venueId: string): Promise<string> {
  try {
    const vRef = doc(db, 'venues', venueId);
    const vSnap = await getDoc(vRef);
    if (!vSnap.exists()) return JSON.stringify({ error: 'No encontré ese restaurante.' });

    const venue = { id: vSnap.id, ...vSnap.data() } as Venue;

    // Get products for this venue
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('venueId', '==', venueId), limit(20));
    const pSnap = await getDocs(q);
    const products = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product))
      .filter(p => isProductAvailable(p));

    return JSON.stringify({
      venue: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        city: venue.city,
        businessType: venue.businessType,
        categories: venue.categories,
        isOpen: isVenueOpen(venue),
        openingTime: venue.openingTime,
        closingTime: venue.closingTime,
        rating: venue.rating,
        deliveryModel: venue.deliveryModel,
        imageUrl: venue.imageUrl,
        logoUrl: venue.logoUrl,
      },
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        originalPrice: p.originalPrice,
        discountedPrice: p.discountedPrice,
        dynamicDiscountedPrice: p.dynamicDiscountedPrice,
        discountPct: Math.round(((p.originalPrice - (p.dynamicDiscountedPrice || p.discountedPrice)) / p.originalPrice) * 100),
        quantity: p.quantity,
        availableUntil: p.availableUntil,
        imageUrl: p.imageUrl,
      })),
    });
  } catch (error) {
    logger.error('aiChat: getVenueDetail error', error);
    return JSON.stringify({ error: 'Error al obtener información del restaurante.' });
  }
}

// --- Tool: getUserOrders ---
async function executeGetUserOrders(userId: string, statusFilter?: string): Promise<string> {
  try {
    const ordersRef = collection(db, 'orders');
    const constraints: any[] = [where('customerId', '==', userId), orderBy('createdAt', 'desc'), limit(20)];
    const q = query(ordersRef, ...constraints);
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));

    let filtered = orders;
    if (statusFilter === 'active') {
      filtered = orders.filter(o => !['COMPLETED', 'CANCELLED', 'MISSED'].includes(o.status));
    } else if (statusFilter === 'completed') {
      filtered = orders.filter(o => o.status === 'COMPLETED');
    } else if (statusFilter === 'cancelled') {
      filtered = orders.filter(o => ['CANCELLED', 'MISSED'].includes(o.status));
    }

    if (filtered.length === 0) return 'No encontré pedidos con ese filtro.';

    // Get venue names
    const venueIds = [...new Set(filtered.map(o => o.venueId))];
    const venueDocs = await Promise.all(venueIds.map(async vid => {
      const vRef = doc(db, 'venues', vid);
      const vSnap = await getDoc(vRef);
      return { id: vid, name: vSnap.exists() ? (vSnap.data() as Venue).name : 'Desconocido' };
    }));
    const venueNames = new Map(venueDocs.map(v => [v.id, v.name]));

    const results: OrderSearchResult[] = filtered.slice(0, 10).map(o => ({
      id: o.id,
      status: o.status,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      venueName: venueNames.get(o.venueId),
      products: (o.products || []).map(p => ({ name: p.name, quantity: p.quantity })),
    }));

    return JSON.stringify(results);
  } catch (error) {
    logger.error('aiChat: getUserOrders error', error);
    return JSON.stringify({ error: 'Error al consultar tus pedidos.' });
  }
}

// --- Tool: getRecommendations ---
async function executeGetRecommendations(count: number = 3): Promise<string> {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, limit(50));
    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product))
      .filter(p => isProductAvailable(p));

    // Sort by discount percentage
    const sorted = products.sort((a, b) => {
      const aDisc = ((a.originalPrice - (a.dynamicDiscountedPrice || a.discountedPrice)) / a.originalPrice);
      const bDisc = ((b.originalPrice - (b.dynamicDiscountedPrice || b.discountedPrice)) / b.originalPrice);
      return bDisc - aDisc;
    });

    const top = sorted.slice(0, count);

    // Get venue names
    const venueIds = [...new Set(top.map(p => p.venueId))];
    const venueDocs = await Promise.all(venueIds.map(async vid => {
      const vRef = doc(db, 'venues', vid);
      const vSnap = await getDoc(vRef);
      return { id: vid, name: vSnap.exists() ? (vSnap.data() as Venue).name : 'Desconocido' };
    }));
    const venueNames = new Map(venueDocs.map(v => [v.id, v.name]));

    const results: ProductSearchResult[] = top.map(p => ({
      id: p.id,
      name: p.name,
      venueId: p.venueId,
      venueName: venueNames.get(p.venueId) || 'Desconocido',
      originalPrice: p.originalPrice,
      discountedPrice: p.discountedPrice,
      dynamicDiscountedPrice: p.dynamicDiscountedPrice,
      quantity: p.quantity,
      availableUntil: p.availableUntil,
      type: p.type,
      imageUrl: p.imageUrl,
      discountPct: Math.round(((p.originalPrice - (p.dynamicDiscountedPrice || p.discountedPrice)) / p.originalPrice) * 100),
    }));

    return JSON.stringify(results);
  } catch (error) {
    logger.error('aiChat: getRecommendations error', error);
    return JSON.stringify({ error: 'Error al generar recomendaciones.' });
  }
}

// --- Tool: getRescattoInfo ---
function executeGetRescattoInfo(topic: string): string {
  const answer = findFaqAnswer(topic);
  return answer || RESCATTO_FAQ['que es rescatto'];
}

// --- Tool: navigateTo ---
function executeNavigateTo(path: string): string {
  if (navigateFn) {
    navigateFn(path);
    return `Navegando a ${path}`;
  }
  return `Sugiero ir a: ${path}`;
}

// --- Tool: getUserSpending ---
async function executeGetUserSpending(userId: string, period?: string): Promise<string> {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('customerId', '==', userId), orderBy('createdAt', 'desc'), limit(200));
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));

    // Filter by status — only COMPLETED orders count as spending
    const completed = orders.filter(o => o.status === 'COMPLETED');

    if (completed.length === 0) {
      return JSON.stringify({ total: 0, count: 0, message: 'No tienes pedidos completados aún.' });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const filtered = completed.filter(o => {
      const d = new Date(o.createdAt);
      switch (period) {
        case 'today': return d >= startOfDay;
        case 'week':  return d >= startOfWeek;
        case 'month': return d >= startOfMonth;
        case 'year':  return d >= startOfYear;
        default:      return true;
      }
    });

    const total = filtered.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const avg = filtered.length > 0 ? Math.round(total / filtered.length) : 0;

    // Get venue names
    const venueIds = [...new Set(filtered.map(o => o.venueId))];
    const venueDocs = await Promise.all(venueIds.map(async vid => {
      const vRef = doc(db, 'venues', vid);
      const vSnap = await getDoc(vRef);
      return { id: vid, name: vSnap.exists() ? (vSnap.data() as Venue).name : 'Desconocido' };
    }));
    const venueNames = new Map(venueDocs.map(v => [v.id, v.name]));

    return JSON.stringify({
      period: period || 'all',
      total,
      formattedTotal: `$${total.toLocaleString('es-CO')}`,
      count: filtered.length,
      averagePerOrder: avg,
      formattedAverage: `$${avg.toLocaleString('es-CO')}`,
      topVenues: Object.entries(
        filtered.reduce((acc: Record<string, number>, o) => {
          const name = venueNames.get(o.venueId) || 'Desconocido';
          acc[name] = (acc[name] || 0) + (o.totalAmount || 0);
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({
        name,
        amount: `$${amount.toLocaleString('es-CO')}`,
      })),
    });
  } catch (error) {
    logger.error('aiChat: getUserSpending error', error);
    return JSON.stringify({ error: 'Error al consultar tus gastos.' });
  }
}

// --- Tool: getUserStats ---
async function executeGetUserStats(userId: string): Promise<string> {
  try {
    // Load user doc for impact stats
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    // Load orders for count
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('customerId', '==', userId), limit(200));
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));

    const completed = orders.filter(o => o.status === 'COMPLETED');
    const totalSpent = completed.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const cancelled = orders.filter(o => ['CANCELLED', 'MISSED'].includes(o.status)).length;
    const active = orders.filter(o => !['COMPLETED', 'CANCELLED', 'MISSED'].includes(o.status)).length;

    const userData = userSnap.exists() ? userSnap.data() : {};
    const impact = (userData as any).impact || {};
    const streak = (userData as any).streak || {};

    return JSON.stringify({
      totalOrders: orders.length,
      completedOrders: completed.length,
      activeOrders: active,
      cancelledOrders: cancelled,
      totalSpent: `$${totalSpent.toLocaleString('es-CO')}`,
      points: impact.points || 0,
      level: impact.level || 'NOVICE',
      co2Saved: impact.co2Saved || 0,
      moneySaved: impact.moneySaved ? `$${(impact.moneySaved as number).toLocaleString('es-CO')}` : '$0',
      totalRescues: impact.totalRescues || 0,
      streak: streak.current || 0,
      longestStreak: streak.longest || 0,
    });
  } catch (error) {
    logger.error('aiChat: getUserStats error', error);
    return JSON.stringify({ error: 'Error al consultar tus estadísticas.' });
  }
}

// --- Tool: getOrderDetail ---
async function executeGetOrderDetail(userId: string, orderId: string): Promise<string> {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return JSON.stringify({ error: 'No encontré ese pedido.' });

    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;

    // Security: only the owner or admin can see order details
    if (order.customerId !== userId) {
      return JSON.stringify({ error: 'Este pedido no te pertenece.' });
    }

    // Get venue name
    let venueName = 'Desconocido';
    if (order.venueId) {
      const vRef = doc(db, 'venues', order.venueId);
      const vSnap = await getDoc(vRef);
      if (vSnap.exists()) venueName = (vSnap.data() as Venue).name;
    }

    const statusMap: Record<string, string> = {
      'PENDING': 'Pendiente', 'PAID': 'Pagado', 'ACCEPTED': 'Aceptado',
      'IN_PREPARATION': 'En preparación', 'READY': 'Listo',
      'AWAITING_DRIVER': 'Esperando repartidor', 'DRIVER_ASSIGNED': 'Repartidor asignado',
      'IN_TRANSIT': 'En camino', 'COMPLETED': 'Entregado',
      'CANCELLED': 'Cancelado', 'MISSED': 'No recogido', 'DISPUTED': 'En disputa',
    };

    return JSON.stringify({
      id: order.id,
      status: statusMap[order.status] || order.status,
      rawStatus: order.status,
      totalAmount: `$${(order.totalAmount || 0).toLocaleString('es-CO')}`,
      venueName,
      createdAt: order.createdAt,
      deliveryMethod: order.deliveryMethod || 'pickup',
      paymentMethod: order.paymentMethod,
      products: (order.products || []).map((p: any) => ({
        name: p.name,
        quantity: p.quantity,
        price: `$${(p.price || 0).toLocaleString('es-CO')}`,
        originalPrice: p.originalPrice ? `$${p.originalPrice.toLocaleString('es-CO')}` : null,
      })),
      deliveryAddress: order.deliveryAddress,
      driverId: order.driverId,
      notes: order.deliveryNotes,
    });
  } catch (error) {
    logger.error('aiChat: getOrderDetail error', error);
    return JSON.stringify({ error: 'Error al consultar el pedido.' });
  }
}

// --- Tool: getUnreadMessages ---
async function executeGetUnreadMessages(userId: string): Promise<string> {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    const chats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chat));

    // Count unread
    const unread = chats.filter(c => {
      const lastMsg = c.lastMessage;
      return lastMsg && !lastMsg.read && lastMsg.senderId !== userId;
    });

    if (unread.length === 0) {
      return JSON.stringify({ unreadCount: 0, chats: [], message: 'No tienes mensajes pendientes 📭' });
    }

    return JSON.stringify({
      unreadCount: unread.length,
      totalChats: chats.length,
      chats: unread.slice(0, 10).map(c => ({
        chatId: c.id,
        lastMessage: c.lastMessage?.text?.slice(0, 100),
        lastSender: c.lastMessage?.senderId === userId ? 'Tú' : (c.participantNames?.[c.lastMessage?.senderId || ''] || c.lastMessage?.senderId?.slice(0, 8) || 'Alguien'),
        type: c.type,
        orderId: c.orderId,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('aiChat: getUnreadMessages error', error);
    return JSON.stringify({ error: 'Error al consultar mensajes.' });
  }
}

// --- Tool: sendMessageToVenue ---
async function executeSendMessageToVenue(
  userId: string,
  userName: string,
  userRole: UserRole,
  orderId: string,
  message: string,
): Promise<string> {
  try {
    // Get the order to find the venue
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return JSON.stringify({ error: 'No encontré ese pedido.' });
    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;

    if (order.customerId !== userId) {
      return JSON.stringify({ error: 'Este pedido no te pertenece.' });
    }

    // Get venue owner ID
    const venueRef = doc(db, 'venues', order.venueId);
    const venueSnap = await getDoc(venueRef);
    if (!venueSnap.exists()) return JSON.stringify({ error: 'No encontré el restaurante.' });
    const venue = venueSnap.data() as Venue;

    // Find or create chat
    const targetUserId = venue.ownerId;
    if (!targetUserId) return JSON.stringify({ error: 'El restaurante no tiene un contacto disponible.' });

    // L1: Sanitize message content
    const cleanMessage = sanitizeToolInput(message);

    // L5: Check for prompt injection in the message
    const injection = detectPromptInjection(cleanMessage);
    if (injection) {
      // Fire strike system — first offense = warning, second = block
      if (userId) {
        const strikeMsg = await handleSecurityIncident({
          userId,
          userName: userName || 'Usuario',
          userRole: userRole || 'CUSTOMER',
          venueId: order.venueId,
          input: cleanMessage,
          pattern: injection.pattern,
          category: injection.category,
          strikeNumber: 1,
          maxStrikes: 2,
        });
        // Don't return strikeMsg to the user through this channel — it would confuse the venue
      }
      return JSON.stringify({ error: 'El mensaje contiene contenido no permitido.' });
    }

    const chat = await findOrCreateChat(userId, userName, userRole, targetUserId, venue.name, UserRole.VENUE_OWNER, 'customer-venue', orderId);
    if (!chat) return JSON.stringify({ error: 'No se pudo crear el chat.' });

    // Send message
    await doSendMessage(chat.id, userId, userName, userRole, cleanMessage);

    return JSON.stringify({
      success: true,
      chatId: chat.id,
      sentTo: venue.name,
      message: `Mensaje enviado a ${venue.name} ✅`,
    });
  } catch (error) {
    logger.error('aiChat: sendMessageToVenue error', error);
    return JSON.stringify({ error: 'Error al enviar mensaje al restaurante.' });
  }
}

// --- Tool: sendMessageToDriver ---
async function executeSendMessageToDriver(
  userId: string,
  userName: string,
  userRole: UserRole,
  orderId: string,
  message: string,
): Promise<string> {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return JSON.stringify({ error: 'No encontré ese pedido.' });
    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;

    if (order.customerId !== userId) {
      return JSON.stringify({ error: 'Este pedido no te pertenece.' });
    }

    if (!order.driverId) {
      return JSON.stringify({ error: 'Este pedido no tiene repartidor asignado aún.' });
    }

    // Get driver name
    const driverRef = doc(db, 'users', order.driverId);
    const driverSnap = await getDoc(driverRef);
    const driverName = driverSnap.exists() ? ((driverSnap.data() as any).fullName || 'Repartidor') : 'Repartidor';

    // L1: Sanitize message content
    const cleanMessage = sanitizeToolInput(message);
    const injection = detectPromptInjection(cleanMessage);
    if (injection) {
      return JSON.stringify({ error: 'El mensaje contiene contenido no permitido.' });
    }

    // Find or create chat
    const chat = await findOrCreateChat(userId, userName, userRole, order.driverId, driverName, UserRole.DRIVER, 'customer-driver', orderId);
    if (!chat) return JSON.stringify({ error: 'No se pudo crear el chat.' });

    await doSendMessage(chat.id, userId, userName, userRole, cleanMessage);

    const venueRef = doc(db, 'venues', order.venueId);
    const venueSnap = await getDoc(venueRef);
    const venueName = venueSnap.exists() ? (venueSnap.data() as Venue).name : 'el restaurante';

    return JSON.stringify({
      success: true,
      chatId: chat.id,
      sentTo: driverName,
      message: `Mensaje enviado al repartidor de tu pedido en ${venueName} ✅`,
    });
  } catch (error) {
    logger.error('aiChat: sendMessageToDriver error', error);
    return JSON.stringify({ error: 'Error al enviar mensaje al repartidor.' });
  }
}

// ─── Chat helpers ───

async function findOrCreateChat(
  currentUserId: string,
  currentUserName: string,
  currentUserRole: UserRole,
  otherUserId: string,
  otherUserName: string,
  otherUserRole: UserRole,
  chatType: string,
  orderId?: string,
): Promise<Chat | null> {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUserId));
    const snapshot = await getDocs(q);

    const existing = snapshot.docs.find(d => {
      const data = d.data();
      return data.participants?.includes(otherUserId) && data.type === chatType && (!orderId || data.orderId === orderId);
    });

    if (existing) {
      return { id: existing.id, ...existing.data() } as Chat;
    }

    // Create new chat
    const timestamp = new Date().toISOString();
    const participants = [currentUserId, otherUserId];
    const newChat = {
      participants,
      participantNames: { [currentUserId]: currentUserName, [otherUserId]: otherUserName },
      participantRoles: { [currentUserId]: currentUserRole, [otherUserId]: otherUserRole },
      type: chatType,
      orderId: orderId || null,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastMessage: {
        text: 'Chat creado',
        senderId: currentUserId,
        timestamp,
        read: true,
      },
    };

    const docRef = await addDoc(chatsRef, newChat);
    return { id: docRef.id, ...newChat } as Chat;
  } catch (error) {
    logger.error('aiChat: findOrCreateChat error', error);
    return null;
  }
}

async function doSendMessage(
  chatId: string,
  senderId: string,
  senderName: string,
  senderRole: UserRole,
  text: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const messagesRef = collection(db, `chats/${chatId}/messages`);
  await addDoc(messagesRef, {
    chatId,
    senderId,
    senderName,
    senderRole,
    text,
    timestamp,
    read: false,
    type: 'text',
  });
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    lastMessage: { text, senderId, timestamp, read: false },
    updatedAt: timestamp,
  });
}

// --- Tool: addToCart ---
async function executeAddToCart(userId: string, productId: string, venueId: string, quantity: number = 1): Promise<string> {
  try {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) return JSON.stringify({ error: 'Producto no encontrado.' });
    const product = productSnap.data() as Product;

    // Load or create cart
    const cartRef = doc(db, 'carts', userId);
    const cartSnap = await getDoc(cartRef);
    let items: any[] = [];

    if (cartSnap.exists()) {
      items = cartSnap.data().items || [];
    }

    // Check if product already in cart
    const existingIndex = items.findIndex((i: any) => i.id === productId);
    if (existingIndex >= 0) {
      items[existingIndex].quantity = (items[existingIndex].quantity || 1) + quantity;
    } else {
      items.push({
        id: product.id,
        venueId: product.venueId,
        name: product.name,
        originalPrice: product.originalPrice,
        discountedPrice: product.discountedPrice,
        dynamicDiscountedPrice: product.dynamicDiscountedPrice,
        imageUrl: product.imageUrl,
        type: product.type,
        quantity,
        availableUntil: product.availableUntil,
      });
    }

    await setDoc(cartRef, { items, updatedAt: new Date().toISOString() });

    return JSON.stringify({
      success: true,
      productName: product.name,
      quantity: existingIndex >= 0 ? items[existingIndex].quantity : quantity,
      cartTotal: items.length,
      message: `${product.name} agregado al carrito ✅`,
    });
  } catch (error) {
    logger.error('aiChat: addToCart error', error);
    return JSON.stringify({ error: 'Error al agregar al carrito.' });
  }
}

// --- Tool: viewCart ---
async function executeViewCart(userId: string): Promise<string> {
  try {
    const cartRef = doc(db, 'carts', userId);
    const cartSnap = await getDoc(cartRef);

    if (!cartSnap.exists()) {
      return JSON.stringify({ items: [], total: 0, count: 0, message: 'Tu carrito está vacío 🛒' });
    }

    const items = cartSnap.data().items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return JSON.stringify({ items: [], total: 0, count: 0, message: 'Tu carrito está vacío 🛒' });
    }

    const total = items.reduce((sum: number, item: any) => {
      const price = item.dynamicDiscountedPrice || item.discountedPrice || item.originalPrice || 0;
      return sum + price * (item.quantity || 1);
    }, 0);

    return JSON.stringify({
      items: items.map((i: any) => ({
        name: i.name,
        quantity: i.quantity || 1,
        unitPrice: i.dynamicDiscountedPrice || i.discountedPrice || i.originalPrice,
        subtotal: ((i.dynamicDiscountedPrice || i.discountedPrice || i.originalPrice) * (i.quantity || 1)),
      })),
      total,
      formattedTotal: `$${total.toLocaleString('es-CO')}`,
      count: items.length,
      itemCount: items.reduce((s: number, i: any) => s + (i.quantity || 1), 0),
    });
  } catch (error) {
    logger.error('aiChat: viewCart error', error);
    return JSON.stringify({ error: 'Error al consultar el carrito.' });
  }
}

// --- Tool: removeFromCart ---
async function executeRemoveFromCart(userId: string, productId: string): Promise<string> {
  try {
    const cartRef = doc(db, 'carts', userId);
    const cartSnap = await getDoc(cartRef);
    if (!cartSnap.exists()) return JSON.stringify({ error: 'El carrito está vacío.' });

    const items = (cartSnap.data().items || []).filter((i: any) => i.id !== productId);
    await setDoc(cartRef, { items, updatedAt: new Date().toISOString() });

    return JSON.stringify({ success: true, remainingItems: items.length, message: 'Producto eliminado del carrito ✅' });
  } catch (error) {
    logger.error('aiChat: removeFromCart error', error);
    return JSON.stringify({ error: 'Error al eliminar del carrito.' });
  }
}

// --- Tool: clearCart ---
async function executeClearCart(userId: string): Promise<string> {
  try {
    const cartRef = doc(db, 'carts', userId);
    await setDoc(cartRef, { items: [], updatedAt: new Date().toISOString() });
    return JSON.stringify({ success: true, message: 'Carrito vaciado 🧹' });
  } catch (error) {
    logger.error('aiChat: clearCart error', error);
    return JSON.stringify({ error: 'Error al vaciar el carrito.' });
  }
}

// --- Tool: toggleFavorite ---
async function executeToggleFavorite(userId: string, venueId: string): Promise<string> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const current = userSnap.exists() ? ((userSnap.data() as any).favoriteVenueIds || []) : [];
    const isFav = current.includes(venueId);

    const venueRef = doc(db, 'venues', venueId);
    const venueSnap = await getDoc(venueRef);
    const venueName = venueSnap.exists() ? (venueSnap.data() as Venue).name : 'el restaurante';

    if (isFav) {
      await updateDoc(userRef, { favoriteVenueIds: arrayRemove(venueId) });
    } else {
      await updateDoc(userRef, { favoriteVenueIds: arrayUnion(venueId) });
    }

    return JSON.stringify({
      success: true,
      isFavorite: !isFav,
      venueName,
      message: isFav ? `${venueName} eliminado de favoritos` : `${venueName} agregado a favoritos ⭐`,
    });
  } catch (error) {
    logger.error('aiChat: toggleFavorite error', error);
    return JSON.stringify({ error: 'Error al actualizar favoritos.' });
  }
}

// --- Tool: updateProfile ---
async function executeUpdateProfile(userId: string, fields: Record<string, string>): Promise<string> {
  try {
    const updates: Record<string, any> = {};
    const allowed = ['fullName', 'address', 'city', 'phone'];
    const labels: Record<string, string> = {
      fullName: 'nombre',
      address: 'dirección',
      city: 'ciudad',
      phone: 'teléfono',
    };

    for (const key of allowed) {
      if (fields[key] !== undefined && fields[key] !== '') {
        // L1+L5: Validate and sanitize each field
        const validated = validateProfileField(key, fields[key]);
        if (validated !== null) {
          updates[key] = validated;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return JSON.stringify({ error: 'No hay campos válidos para actualizar.' });
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updates);

    const changed = Object.keys(updates).map(k => labels[k] || k).join(', ');
    return JSON.stringify({ success: true, updated: Object.keys(updates), message: `Perfil actualizado: ${changed} ✅` });
  } catch (error) {
    logger.error('aiChat: updateProfile error', error);
    return JSON.stringify({ error: 'Error al actualizar el perfil.' });
  }
}

// --- Tool: getVenueStats (admin-only) ---
async function executeGetVenueStats(userId: string, userRole: string, city?: string): Promise<string> {
  // Role gate — solo SUPER_ADMIN y ADMIN
  if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
    return JSON.stringify({ error: 'Solo los administradores pueden ver estadísticas globales de la plataforma.' });
  }

  try {
    const venuesRef = collection(db, 'venues');
    const q = city
      ? query(venuesRef, where('city', '==', city), limit(100))
      : query(venuesRef, limit(100));
    const snapshot = await getDocs(q);
    const rawVenues = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    const active = rawVenues.filter(v => v.isActive !== false);
    const inactive = rawVenues.filter(v => v.isActive === false);
    const withProducts = rawVenues.filter(v => v.stats?.totalOrders ? v.stats.totalOrders > 0 : false);

    // Total products across all venues
    let totalProducts = 0;
    for (const v of rawVenues) {
      const pRef = collection(db, 'products');
      const pQ = query(pRef, where('venueId', '==', v.id), limit(999));
      const pSnap = await getDocs(pQ);
      totalProducts += pSnap.docs.length;
    }

    // City breakdown
    const byCity: Record<string, number> = {};
    rawVenues.forEach(v => {
      const c = v.city || 'Sin ciudad';
      byCity[c] = (byCity[c] || 0) + 1;
    });

    return JSON.stringify({
      total: rawVenues.length,
      active: active.length,
      inactive: inactive.length,
      venuesWithOrders: withProducts.length,
      totalProducts,
      cities: Object.entries(byCity)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      city,
      message: city
        ? `📍 ${city}: ${active.length} negocios activos de ${rawVenues.length} totales`
        : `📊 Total: ${rawVenues.length} negocios (${active.length} activos, ${inactive.length} inactivos)`,
    });
  } catch (error) {
    logger.error('aiChat: getVenueStats error', error);
    return JSON.stringify({ error: 'Error al consultar estadísticas de negocios.' });
  }
}

// ─── Main Tool Dispatcher ───

export async function executeToolCall(
  name: string,
  args: Record<string, any>,
  userId?: string,
  userName?: string,
  userRole?: UserRole,
): Promise<string> {
  // ─── L3+L5: Safety check for ALL tools ───
  const check = safetyCheck(name, userId, userRole as string, args);
  if (!check.allowed) {
    return JSON.stringify({ error: check.reason });
  }

  // ─── L1+L3: Rate limit for write operations ───
  const writeTools = ['addToCart', 'removeFromCart', 'clearCart', 'sendMessageToVenue', 'sendMessageToDriver', 'toggleFavorite', 'updateProfile'];
  if (writeTools.includes(name) && userId && !checkWriteRateLimit(userId)) {
    return JSON.stringify({ error: 'Demasiadas operaciones. Espera un momento antes de continuar.' });
  }

  switch (name) {
    case 'searchVenues':
      return executeSearchVenues(args.query, args.city);

    case 'searchProducts':
      return executeSearchProducts(args.query, args.maxPrice, args.type, args.city);

    case 'getVenueDetail':
      return executeGetVenueDetail(args.venueId);

    case 'getUserOrders':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión para ver tus pedidos.' });
      return executeGetUserOrders(userId, args.statusFilter);

    case 'getRecommendations':
      return executeGetRecommendations(args.count);

    case 'getRescattoInfo':
      return executeGetRescattoInfo(args.topic);

    case 'navigateTo':
      return executeNavigateTo(args.path);

    case 'getUserSpending':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeGetUserSpending(userId, args.period);

    case 'getUserStats':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeGetUserStats(userId);

    case 'getOrderDetail':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeGetOrderDetail(userId, args.orderId);

    case 'getUnreadMessages':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeGetUnreadMessages(userId);

    case 'sendMessageToVenue':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeSendMessageToVenue(userId, userName || 'Usuario', userRole || UserRole.CUSTOMER, args.orderId, args.message);

    case 'sendMessageToDriver':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeSendMessageToDriver(userId, userName || 'Usuario', userRole || UserRole.CUSTOMER, args.orderId, args.message);

    case 'addToCart':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeAddToCart(userId, args.productId, args.venueId, args.quantity);

    case 'viewCart':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeViewCart(userId);

    case 'removeFromCart':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeRemoveFromCart(userId, args.productId);

    case 'clearCart':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeClearCart(userId);

    case 'toggleFavorite':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeToggleFavorite(userId, args.venueId);

    case 'updateProfile':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeUpdateProfile(userId, args);

    case 'getVenueStats':
      if (!userId) return JSON.stringify({ error: 'Debes iniciar sesión.' });
      return executeGetVenueStats(userId, userRole || 'CUSTOMER', args.city);

    default:
      return JSON.stringify({ error: `Tool "${name}" no disponible.` });
  }
}
