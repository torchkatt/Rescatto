import { collection, doc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { SellerPassPlan } from '../types';
import { logger } from '../utils/logger';

const COLLECTION = 'subscription_plans';

/**
 * PlanService — Lee planes de suscripción desde Firestore.
 * Sin valores quemados: todo desde la base de datos.
 */
export const planService = {
  /**
   * Obtener todos los planes activos
   */
  async getAll(): Promise<SellerPassPlan[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SellerPassPlan));
    } catch (error) {
      logger.error('planService.getAll error:', error);
      return [];
    }
  },

  /**
   * Obtener un plan por ID
   */
  async getById(id: string): Promise<SellerPassPlan | null> {
    try {
      const d = await getDoc(doc(db, COLLECTION, id));
      if (!d.exists()) return null;
      return { id: d.id, ...d.data() } as SellerPassPlan;
    } catch (error) {
      logger.error('planService.getById error:', error);
      return null;
    }
  },

  /**
   * Sembrar planes por defecto (solo si la colección está vacía)
   */
  async seedDefaults(): Promise<number> {
    try {
      const existing = await getDocs(collection(db, COLLECTION));
      if (!existing.empty) return 0;

      const plans = [
        {
          id: 'free',
          name: 'Gratuito',
          price: 0,
          features: [
            '10% comisión por venta',
            'Productos ilimitados',
            'Perfil de tienda público',
            'Estadísticas básicas',
          ],
          period: 'monthly',
          commissionRate: 0.10,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'seller_pass_monthly',
          name: 'Seller Pass Mensual',
          price: 49900,
          features: [
            '5% comisión por venta',
            'Productos destacados en búsqueda',
            'Analytics avanzados',
            'Soporte prioritario 24/7',
            'Badge de verificado',
          ],
          period: 'monthly',
          commissionRate: 0.05,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'seller_pass_annual',
          name: 'Seller Pass Anual',
          price: 499900,
          features: [
            '5% comisión por venta',
            'Todo lo de Mensual',
            'Multi-sucursal',
            'Reportes personalizados',
            'Facturación electrónica',
          ],
          period: 'annual',
          commissionRate: 0.05,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ];

      for (const p of plans) {
        await setDoc(doc(db, COLLECTION, p.id), p);
      }

      logger.info(`planService: ${plans.length} planes sembrados`);
      return plans.length;
    } catch (error) {
      logger.error('planService.seedDefaults error:', error);
      return 0;
    }
  },
};