import { cacheService } from '../services/cacheService';

/**
 * Limpia el caché de localStorage, borra los cachés del Service Worker,
 * fuerza la actualización del SW y recarga la página.
 *
 * Útil en PWA para refrescar completamente cuando hay cambios en producción.
 */
export async function clearCacheAndUpdate(): Promise<void> {
  // 1. Limpiar localStorage gestionado por cacheService
  cacheService.clearByPrefix('');

  // 2. Limpiar todos los cachés del Service Worker
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (error) {
      console.warn('Error clearing caches:', error);
    }
  }

  // 3. Actualizar el SW y esperar que tome control
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        const waiting = reg.waiting;
        if (waiting) {
          waiting.postMessage({ type: 'SKIP_WAITING' });
          // Esperar a que el nuevo SW tome control
          await new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
          });
        }
      }
    } catch (error) {
      console.warn('Error updating service worker:', error);
    }
  }

  // 4. Recargar la página
  window.location.reload();
}
