import {
    collection,
    getDocs,
    doc,
    updateDoc,
    setDoc,
    getDoc,
    query,
    limit,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
    orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { UserRole, Permission, ROLE_PERMISSIONS } from '../types';
import { logger } from '../utils/logger';

export interface RoleDefinition {
    id: string; // UserRole
    name: string;
    permissions: Permission[];
    description?: string;
    isSystem: boolean; // If true, basic properties cannot be deleted (but permissions might be editable)
}

export const roleService = {
    /**
     * Get all roles from Firestore
     */
    getAllRoles: async (): Promise<RoleDefinition[]> => {
        const roles: RoleDefinition[] = [];
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMore = true;
        while (hasMore) {
            const q = lastDoc
                ? query(collection(db, 'roles'), orderBy('__name__'), startAfter(lastDoc), limit(50))
                : query(collection(db, 'roles'), orderBy('__name__'), limit(50));
            const snapshot = await getDocs(q);
            roles.push(...snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RoleDefinition[]);
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            hasMore = snapshot.docs.length === 50;
        }
        return roles;
    },

    /**
     * Update a role's permissions
     */
    updateRolePermissions: async (roleId: string, permissions: Permission[]) => {
        const roleRef = doc(db, 'roles', roleId);
        await updateDoc(roleRef, { permissions });
    },

    /**
     * Seed roles from code constants to Firestore
     * Only runs if roles collection is empty or force is true
     */
    seedRoles: async (force = false) => {
        const rolesRef = collection(db, 'roles');
        const snapshot = await getDocs(query(rolesRef, limit(1)));

        if (!snapshot.empty && !force) {
            logger.log('Roles already exist in database');
            return;
        }

        const roleNames: Record<UserRole, string> = {
            [UserRole.SUPER_ADMIN]: 'Super Administrador',
            [UserRole.ADMIN]: 'Administrador',
            [UserRole.VENUE_OWNER]: 'Dueño de Sede',
            [UserRole.KITCHEN_STAFF]: 'Personal de Cocina',
            [UserRole.DRIVER]: 'Domiciliario',
            [UserRole.CUSTOMER]: 'Cliente',
            [UserRole.CITY_ADMIN]: 'Admin Regional',
        };

        const batchPromises = Object.values(UserRole).map(async (role) => {
            const roleData: RoleDefinition = {
                id: role,
                name: roleNames[role],
                permissions: ROLE_PERMISSIONS[role] || [],
                description: `Default permissions for ${roleNames[role]}`,
                isSystem: true
            };

            // Use setDoc to overwrite or create with specific ID
            await setDoc(doc(db, 'roles', role), roleData);
        });

        await Promise.all(batchPromises);
        logger.log('Roles seeded successfully permissions');
    },

    /**
     * Get specific role
     */
    getRole: async (roleId: string): Promise<RoleDefinition | null> => {
        const docRef = doc(db, 'roles', roleId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as RoleDefinition;
        } else {
            return null;
        }
    }
};
