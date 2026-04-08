import { UserRole } from '../types';

export interface ManualEntry {
  role: string;
  label: string;
  url: string;
  version: string;
  updatedAt: string;
  sizeKB: number;
}

interface ManualManifest {
  generatedAt: string;
  version: string;
  manuals: ManualEntry[];
}

// Mapeo de rol de usuario → clave de manual
const ROLE_TO_MANUAL_KEY: Record<UserRole, string> = {
  [UserRole.CUSTOMER]: 'customer',
  [UserRole.VENUE_OWNER]: 'venue-owner',
  [UserRole.KITCHEN_STAFF]: 'kitchen-staff',
  [UserRole.DRIVER]: 'driver',
  [UserRole.ADMIN]: 'admin',
  [UserRole.SUPER_ADMIN]: 'admin',
  [UserRole.CITY_ADMIN]: 'admin',
};

let cachedManifest: ManualManifest | null = null;

async function fetchManifest(): Promise<ManualManifest> {
  if (cachedManifest) return cachedManifest;

  const res = await fetch('/manuals/manifest.json');
  if (!res.ok) throw new Error(`No se pudo cargar el manifest de manuales: ${res.status}`);
  cachedManifest = await res.json() as ManualManifest;
  return cachedManifest;
}

export const helpService = {
  async getManualForRole(role: UserRole): Promise<ManualEntry | null> {
    try {
      const manifest = await fetchManifest();
      const key = ROLE_TO_MANUAL_KEY[role] ?? 'customer';
      return manifest.manuals.find(m => m.role === key) ?? null;
    } catch {
      return null;
    }
  },

  async getAllManuals(): Promise<ManualEntry[]> {
    try {
      const manifest = await fetchManifest();
      return manifest.manuals;
    } catch {
      return [];
    }
  },

  clearCache() {
    cachedManifest = null;
  },
};
