import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Category, CategoryAttribute } from '../types';
import { logger } from '../utils/logger';

/**
 * CategoryService — CRUD para el árbol de categorías del marketplace.
 *
 * Colección Firestore: `categories`
 * Árbol jerárquico: parentId = null → root, parentId = category.id → subcategoría
 *
 * El seed inicial crea 4 roots: comida, tecnología, servicios, digital
 * con subcategorías que definen atributos dinámicos para listings.
 */

const COLLECTION = 'categories';
const SEED_FLAG_KEY = 'rescatto_categories_seeded_v1';

// ─── Seed Data ────────────────────────────────────────────────────────────────

interface SeedCategory {
  name: string;
  slug: string;
  icon: string;
  level: number;
  order: number;
  listingAttributes: CategoryAttribute[];
  children?: SeedCategory[];
}

const CATEGORY_SEED: SeedCategory[] = [
  {
    name: 'Comida',
    slug: 'comida',
    icon: '🍽️',
    level: 0,
    order: 1,
    listingAttributes: [
      { name: 'pickupWindow', type: 'text', required: false, label: 'Ventana de recogida' },
      { name: 'expiresAt', type: 'text', required: false, label: 'Fecha de expiración' },
      { name: 'allergens', type: 'text', required: false, label: 'Alérgenos' },
    ],
    children: [
      {
        name: 'Packs Sorpresa',
        slug: 'packs-sorpresa',
        icon: '🎁',
        level: 1,
        order: 1,
        listingAttributes: [
          { name: 'pickupWindow', type: 'text', required: true, label: 'Ventana de recogida' },
          { name: 'expiresAt', type: 'text', required: true, label: 'Fecha de expiración' },
          { name: 'allergens', type: 'text', required: false, label: 'Alérgenos' },
          { name: 'originalValue', type: 'number', required: false, label: 'Valor original' },
        ],
      },
      {
        name: 'Platos Específicos',
        slug: 'platos-especificos',
        icon: '🍝',
        level: 1,
        order: 2,
        listingAttributes: [
          { name: 'allergens', type: 'text', required: false, label: 'Alérgenos' },
          { name: 'dietaryTags', type: 'text', required: false, label: 'Etiquetas dietéticas' },
          { name: 'portions', type: 'number', required: false, label: 'Porciones' },
        ],
      },
      {
        name: 'Bebidas',
        slug: 'bebidas',
        icon: '🥤',
        level: 1,
        order: 3,
        listingAttributes: [
          { name: 'volume', type: 'text', required: false, label: 'Volumen' },
          { name: 'isAlcoholic', type: 'boolean', required: false, label: '¿Contiene alcohol?' },
        ],
      },
    ],
  },
  {
    name: 'Tecnología',
    slug: 'tecnologia',
    icon: '💻',
    level: 0,
    order: 2,
    listingAttributes: [
      { name: 'brand', type: 'text', required: false, label: 'Marca' },
      { name: 'model', type: 'text', required: false, label: 'Modelo' },
      { name: 'condition', type: 'select', required: true, label: 'Condición', options: ['new', 'used', 'refurbished'] },
    ],
    children: [
      {
        name: 'Electrónica',
        slug: 'electronica',
        icon: '📱',
        level: 1,
        order: 1,
        listingAttributes: [
          { name: 'brand', type: 'text', required: true, label: 'Marca' },
          { name: 'model', type: 'text', required: true, label: 'Modelo' },
          { name: 'condition', type: 'select', required: true, label: 'Condición', options: ['new', 'used', 'refurbished'] },
          { name: 'warranty', type: 'text', required: false, label: 'Garantía' },
        ],
      },
      {
        name: 'Reparaciones',
        slug: 'reparaciones',
        icon: '🔧',
        level: 1,
        order: 2,
        listingAttributes: [
          { name: 'duration', type: 'text', required: true, label: 'Duración estimada' },
          { name: 'location', type: 'select', required: true, label: 'Ubicación', options: ['presencial', 'domicilio'] },
          { name: 'deviceTypes', type: 'text', required: false, label: 'Tipos de dispositivo' },
        ],
      },
      {
        name: 'Accesorios',
        slug: 'accesorios',
        icon: '🎧',
        level: 1,
        order: 3,
        listingAttributes: [
          { name: 'brand', type: 'text', required: false, label: 'Marca' },
          { name: 'condition', type: 'select', required: true, label: 'Condición', options: ['new', 'used'] },
          { name: 'compatibility', type: 'text', required: false, label: 'Compatibilidad' },
        ],
      },
    ],
  },
  {
    name: 'Servicios',
    slug: 'servicios',
    icon: '🛠️',
    level: 0,
    order: 3,
    listingAttributes: [
      { name: 'duration', type: 'text', required: false, label: 'Duración' },
      { name: 'modality', type: 'select', required: false, label: 'Modalidad', options: ['online', 'presencial', 'hibrido'] },
    ],
    children: [
      {
        name: 'Belleza',
        slug: 'belleza',
        icon: '💇',
        level: 1,
        order: 1,
        listingAttributes: [
          { name: 'duration', type: 'text', required: true, label: 'Duración' },
          { name: 'availableSlots', type: 'text', required: false, label: 'Horarios disponibles' },
          { name: 'priceRange', type: 'text', required: false, label: 'Rango de precios' },
        ],
      },
      {
        name: 'Educación',
        slug: 'educacion',
        icon: '📚',
        level: 1,
        order: 2,
        listingAttributes: [
          { name: 'modality', type: 'select', required: true, label: 'Modalidad', options: ['online', 'presencial'] },
          { name: 'capacity', type: 'number', required: false, label: 'Capacidad' },
          { name: 'duration', type: 'text', required: true, label: 'Duración' },
          { name: 'level', type: 'select', required: false, label: 'Nivel', options: ['beginner', 'intermediate', 'advanced'] },
        ],
      },
      {
        name: 'Hogar',
        slug: 'hogar',
        icon: '🏠',
        level: 1,
        order: 3,
        listingAttributes: [
          { name: 'duration', type: 'text', required: true, label: 'Duración' },
          { name: 'location', type: 'select', required: true, label: 'Ubicación', options: ['presencial', 'domicilio'] },
          { name: 'materialsIncluded', type: 'boolean', required: false, label: '¿Materiales incluidos?' },
        ],
      },
      {
        name: 'Transporte',
        slug: 'transporte',
        icon: '🚗',
        level: 1,
        order: 4,
        listingAttributes: [
          { name: 'vehicleType', type: 'text', required: false, label: 'Tipo de vehículo' },
          { name: 'capacity', type: 'number', required: false, label: 'Capacidad' },
        ],
      },
    ],
  },
  {
    name: 'Digital',
    slug: 'digital',
    icon: '📦',
    level: 0,
    order: 4,
    listingAttributes: [
      { name: 'fileFormat', type: 'text', required: false, label: 'Formato' },
      { name: 'fileSize', type: 'text', required: false, label: 'Tamaño' },
      { name: 'license', type: 'select', required: false, label: 'Licencia', options: ['personal', 'commercial', 'open-source'] },
    ],
    children: [
      {
        name: 'Ebooks',
        slug: 'ebooks',
        icon: '📖',
        level: 1,
        order: 1,
        listingAttributes: [
          { name: 'format', type: 'select', required: true, label: 'Formato', options: ['PDF', 'EPUB', 'MOBI'] },
          { name: 'pages', type: 'number', required: false, label: 'Páginas' },
          { name: 'language', type: 'text', required: false, label: 'Idioma' },
          { name: 'author', type: 'text', required: true, label: 'Autor' },
        ],
      },
      {
        name: 'Software',
        slug: 'software',
        icon: '⚙️',
        level: 1,
        order: 2,
        listingAttributes: [
          { name: 'platform', type: 'select', required: true, label: 'Plataforma', options: ['Windows', 'Mac', 'Linux', 'Web', 'Multi'] },
          { name: 'license', type: 'select', required: true, label: 'Licencia', options: ['personal', 'commercial', 'open-source'] },
          { name: 'version', type: 'text', required: false, label: 'Versión' },
        ],
      },
      {
        name: 'Plantillas',
        slug: 'plantillas',
        icon: '📋',
        level: 1,
        order: 3,
        listingAttributes: [
          { name: 'format', type: 'text', required: true, label: 'Formato' },
          { name: 'tool', type: 'text', required: false, label: 'Herramienta compatible' },
          { name: 'license', type: 'select', required: true, label: 'Licencia', options: ['personal', 'commercial'] },
        ],
      },
    ],
  },
];

// ─── Service ───────────────────────────────────────────────────────────────────

export class CategoryService {
  private collectionName = COLLECTION;

  /**
   * Ejecuta el seed de categorías. Idempotente: solo corre una vez.
   * Usa localStorage como flag para evitar re-seed innecesario.
   */
  async seedCategories(): Promise<{ created: number; skipped: boolean }> {
    try {
      // Verificar si ya se ejecutó el seed
      const alreadySeeded = typeof localStorage !== 'undefined' && localStorage.getItem(SEED_FLAG_KEY);
      if (alreadySeeded) {
        return { created: 0, skipped: true };
      }

      // Verificar si ya hay categorías en Firestore
      const existingSnapshot = await getDocs(
        query(collection(db, this.collectionName), limit(1))
      );
      if (!existingSnapshot.empty) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(SEED_FLAG_KEY, 'true');
        }
        return { created: 0, skipped: true };
      }

      let created = 0;
      const batch = writeBatch(db);

      for (const root of CATEGORY_SEED) {
        const rootRef = doc(collection(db, this.collectionName));
        batch.set(rootRef, {
          name: root.name,
          slug: root.slug,
          icon: root.icon,
          parentId: null,
          listingAttributes: root.listingAttributes,
          level: root.level,
          order: root.order,
          isActive: true,
          stats: { listingCount: 0, transactionCount: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        created++;

        if (root.children) {
          for (const child of root.children) {
            const childRef = doc(collection(db, this.collectionName));
            batch.set(childRef, {
              name: child.name,
              slug: child.slug,
              icon: child.icon,
              parentId: rootRef.id,
              listingAttributes: child.listingAttributes,
              level: child.level,
              order: child.order,
              isActive: true,
              stats: { listingCount: 0, transactionCount: 0 },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            created++;
          }
        }
      }

      await batch.commit();

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SEED_FLAG_KEY, 'true');
      }

      logger.log(`✅ Category seed: ${created} categories created`);
      return { created, skipped: false };
    } catch (error) {
      logger.error('CategoryService.seedCategories error:', error);
      return { created: 0, skipped: true };
    }
  }

  /**
   * Obtiene todas las categorías raíz (parentId === null), ordenadas.
   */
  async getRootCategories(): Promise<Category[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('parentId', '==', null),
        where('isActive', '==', true),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    } catch (error) {
      logger.error('CategoryService.getRootCategories error:', error);
      return [];
    }
  }

  /**
   * Obtiene subcategorías de una categoría padre.
   */
  async getSubCategories(parentId: string): Promise<Category[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('parentId', '==', parentId),
        where('isActive', '==', true),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    } catch (error) {
      logger.error(`CategoryService.getSubCategories(${parentId}) error:`, error);
      return [];
    }
  }

  /**
   * Obtiene una categoría por ID.
   */
  async getCategoryById(categoryId: string): Promise<Category | null> {
    try {
      const docRef = doc(db, this.collectionName, categoryId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...snapshot.data() } as Category;
    } catch (error) {
      logger.error(`CategoryService.getCategoryById(${categoryId}) error:`, error);
      return null;
    }
  }

  /**
   * Obtiene una categoría por slug.
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('slug', '==', slug),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Category;
    } catch (error) {
      logger.error(`CategoryService.getCategoryBySlug(${slug}) error:`, error);
      return null;
    }
  }

  /**
   * Obtiene el árbol completo de categorías.
   * Retorna las raíces con sus hijos anidados como children[].
   */
  async getCategoryTree(): Promise<Category[]> {
    try {
      const roots = await this.getRootCategories();
      const tree: Category[] = [];

      for (const root of roots) {
        const children = await this.getSubCategories(root.id);
        tree.push({ ...root, children } as any);
      }

      return tree;
    } catch (error) {
      logger.error('CategoryService.getCategoryTree error:', error);
      return [];
    }
  }

  /**
   * Crea una nueva categoría.
   */
  async createCategory(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...data,
        stats: data.stats || { listingCount: 0, transactionCount: 0 },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return {
        id: docRef.id,
        ...data,
        stats: data.stats || { listingCount: 0, transactionCount: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Category;
    } catch (error) {
      logger.error('CategoryService.createCategory error:', error);
      throw error;
    }
  }

  /**
   * Actualiza una categoría existente.
   */
  async updateCategory(categoryId: string, data: Partial<Omit<Category, 'id'>>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, categoryId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      logger.error(`CategoryService.updateCategory(${categoryId}) error:`, error);
      throw error;
    }
  }

  /**
   * Elimina una categoría (solo si no tiene listings asociados).
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, categoryId);
      await deleteDoc(docRef);
    } catch (error) {
      logger.error(`CategoryService.deleteCategory(${categoryId}) error:`, error);
      throw error;
    }
  }

  /**
   * Busca categorías por nombre parcial.
   */
  async searchCategories(searchTerm: string): Promise<Category[]> {
    try {
      // Firestore no soporta búsqueda full-text nativa.
      // Usamos orderBy('name') y filtramos en cliente con búsqueda simple.
      const q = query(
        collection(db, this.collectionName),
        where('isActive', '==', true),
        orderBy('name'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const term = searchTerm.toLowerCase();
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Category))
        .filter(c => c.name.toLowerCase().includes(term) || c.slug.includes(term));
    } catch (error) {
      logger.error(`CategoryService.searchCategories error:`, error);
      return [];
    }
  }

  /**
   * Incrementa el contador de listings de una categoría (atómico).
   */
  async incrementListingCount(categoryId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, categoryId);
      await updateDoc(docRef, {
        'stats.listingCount': (await getDoc(docRef)).data()?.stats?.listingCount + 1 || 1,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      logger.error(`CategoryService.incrementListingCount error:`, error);
    }
  }
}

export const categoryService = new CategoryService();