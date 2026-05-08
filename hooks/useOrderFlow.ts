import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLocation } from '../context/LocationContext';
import { logger } from '../utils/logger';
import { Analytics } from '../utils/analytics';
import { hasAskedForNotifications } from '../components/customer/common/NotificationPermissionModal';

interface OrderPayload {
  venueId: string;
  products: { productId: string; quantity: number }[];
  paymentMethod: 'cash' | 'card';
  deliveryMethod: 'delivery' | 'pickup' | 'donation';
  deliveryFee: number;
  address: string | null;
  city: string;
  phone: string;
  transactionId: string | null;
  isDonation: boolean;
  donationCenterId?: string;
  donationCenterName?: string;
  estimatedCo2: number;
  redemptionId: string | null;
}

export const useOrderFlow = () => {
  const navigate = useNavigate();
  const { items, clearCart, removeFromCart, getCartByVenue } = useCart();
  const { user } = useAuth();
  const { city } = useLocation();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string>('/app/orders');

  const navigateAfterOrder = (path: string) => {
    if (!user?.isGuest && !hasAskedForNotifications()) {
      setPendingNavPath(path);
      setShowNotifModal(true);
    } else {
      navigate(path);
    }
  };

  const handleUnavailableProductsError = (err: any): boolean => {
    const products = Array.isArray(err?.details?.products) ? err.details.products : [];
    if (products.length === 0) return false;

    const productIds = new Set<string>();
    const productNames: string[] = [];

    for (const product of products) {
      if (typeof product?.productId === 'string' && product.productId.length > 0) {
        productIds.add(product.productId);
      }
      if (typeof product?.name === 'string' && product.name.length > 0) {
        productNames.push(product.name);
      }
    }

    if (productIds.size === 0) return false;

    items.forEach(item => {
      if (productIds.has(item.id)) {
        removeFromCart(item.id);
      }
    });

    const uniqueNames = Array.from(new Set(productNames));
    const preview = uniqueNames.slice(0, 2).join(', ');
    const hasMore = uniqueNames.length > 2;
    toastError(`Actualizamos tu carrito: ${preview || 'algunos productos'} ya no están disponibles${hasMore ? '...' : ''}.`);
    navigate('/app/cart');
    return true;
  };

  const getRedirectPath = (orderIds: string[]) => {
    const orderId = orderIds[0] || '';
    if (user?.role === 'VENUE_OWNER' || user?.role === 'SUPER_ADMIN') {
      return `/order-management?search=${orderId}`;
    }
    return `/app/orders?orderId=${orderId}`;
  };

  const processOrder = async (params: {
    paymentMethod: 'cash' | 'card',
    deliveryMethod: 'delivery' | 'pickup' | 'donation',
    address: string,
    phoneDigits: string,
    selectedDonationCenter: any,
    estimatedCo2: number,
    selectedRedemption: any,
    calculateOrderTotals: (venueId: string, venueItems: any[]) => any,
    transactionId?: string | null
  }) => {
    const {
      paymentMethod,
      deliveryMethod,
      address,
      phoneDigits,
      selectedDonationCenter,
      estimatedCo2,
      selectedRedemption,
      calculateOrderTotals,
      transactionId = null
    } = params;

    const venueGroups = getCartByVenue();
    setLoading(true);

    try {
      const createOrderFn = httpsCallable(functions, 'createOrder');
      const venueEntries = Array.from(venueGroups.entries());

      const orderResults = await Promise.allSettled(
        venueEntries.map(async ([venueId, venueItems]) => {
          const { deliveryFee } = calculateOrderTotals(venueId, venueItems);

          const payload: OrderPayload = {
            venueId,
            products: venueItems.map(item => ({
              productId: item.id,
              quantity: item.quantity
            })),
            paymentMethod,
            deliveryMethod,
            deliveryFee,
            address: address || null,
            city: city || 'Bogotá',
            phone: phoneDigits,
            transactionId,
            isDonation: deliveryMethod === 'donation',
            donationCenterId: selectedDonationCenter?.id,
            donationCenterName: selectedDonationCenter?.name,
            estimatedCo2: estimatedCo2 / venueGroups.size,
            redemptionId: selectedRedemption?.id ?? null,
          };

          let attempt = 0;
          const maxAttempts = 3;
          while (attempt < maxAttempts) {
            try {
              const result: any = await createOrderFn(payload);
              return { orderId: result.data.orderId as string, venueId };
            } catch (err: any) {
              attempt++;
              if (attempt >= maxAttempts || err?.code === 'failed-precondition' || err?.code === 'invalid-argument') {
                throw err;
              }
              logger.warn(`Retrying order creation for ${venueId} (Attempt ${attempt}/${maxAttempts})...`);
              await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
            }
          }
          throw new Error('Fallback block reached');
        })
      );

      const succeeded = orderResults.filter((r): r is PromiseFulfilledResult<{ orderId: string; venueId: string }> => r.status === 'fulfilled');
      const failed = orderResults.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

      if (succeeded.length > 0) {
        const successVenueIds = new Set(succeeded.map(r => r.value.venueId));
        const itemsToRemove = items.filter(item => successVenueIds.has(item.venueId));
        itemsToRemove.forEach(item => removeFromCart(item.id));
      }

      if (failed.length > 0 && succeeded.length > 0) {
        const failedVenueNames = failed.map((_, i) => {
          const venueId = venueEntries[orderResults.indexOf(failed[i])]?.[0];
          const venueItems = venueGroups.get(venueId || '');
          return venueItems?.[0]?.venueName || 'un negocio';
        }).join(', ');
        toastError(`Algunos pedidos fallaron (${failedVenueNames}). Los exitosos fueron procesados. Reintenta los restantes.`);
        setLoading(false);
        return;
      }

      if (failed.length > 0 && succeeded.length === 0) {
        throw failed[0].reason;
      }

      const orderIds = succeeded.map(r => r.value.orderId);
      clearCart();
      success(paymentMethod === 'card' ? '¡Pago exitoso! Tu pedido ha sido confirmado. ✅' : '¡Pedido realizado con éxito! 🎉');

      succeeded.forEach(r => {
        const venueItems = venueGroups.get(r.value.venueId) ?? [];
        const total = venueItems.reduce((acc, item) => acc + (item.discountedPrice ?? item.originalPrice ?? 0) * (item.quantity ?? 1), 0);
        Analytics.orderCreated(r.value.orderId, r.value.venueId, total, deliveryMethod);
      });

      navigateAfterOrder(getRedirectPath(orderIds));

    } catch (err: any) {
      logger.error("Error creating order:", err);

      if (handleUnavailableProductsError(err)) return;

      // Complex Error Mapping
      let userMessage = 'Error al procesar el pedido. Intenta nuevamente.';

      switch (err.code) {
        case 'resource-exhausted':
          userMessage = 'Has realizado demasiados intentos. Por favor, espera un minuto antes de intentar de nuevo.';
          break;
        case 'permission-denied':
          userMessage = 'No tienes permisos para realizar esta acción o tu sesión ha expirado.';
          break;
        case 'failed-precondition':
          userMessage = err.message || 'No se cumplen los requisitos para completar el pedido.';
          break;
        case 'unauthenticated':
          userMessage = 'Debes iniciar sesión para continuar.';
          break;
        case 'not-found':
          userMessage = 'Uno de los productos o el restaurante ya no están disponibles.';
          break;
      }

      toastError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    processOrder,
    showNotifModal,
    setShowNotifModal,
    pendingNavPath
  };
};
