import { useAuth } from '../context/AuthContext';
import { Permission, ROLE_PERMISSIONS } from '../types';

/**
 * Hook to check user permissions
 * @returns Object with permission checking functions
 */
export const usePermissions = () => {
    const { user, roles } = useAuth();

    /**
     * Check if user has a specific permission
     */
    const hasPermission = (permission: Permission): boolean => {
        if (!user) return false;

        // If user has specific permissions override, use that
        if (user.permissions) {
            return user.permissions.includes(permission);
        }

        // Fallback to role-based permissions from DB (or code constant if DB not ready)
        const roleDef = roles.find(r => r.id === user.role);
        const rolePermissions = roleDef ? roleDef.permissions : ROLE_PERMISSIONS[user.role];

        return rolePermissions?.includes(permission) || false;
    };

    /**
     * Check if user has ANY of the provided permissions
     */
    const hasAnyPermission = (permissions: Permission[]): boolean => {
        if (!user) return false;

        return permissions.some(permission => hasPermission(permission));
    };

    /**
     * Check if user has ALL of the provided permissions
     */
    const hasAllPermissions = (permissions: Permission[]): boolean => {
        if (!user) return false;

        return permissions.every(permission => hasPermission(permission));
    };

    /**
     * Get all permissions for current user
     */
    const getUserPermissions = (): Permission[] => {
        if (!user) return [];

        if (user.permissions) {
            return user.permissions;
        }

        const roleDef = roles.find(r => r.id === user.role);
        return roleDef ? roleDef.permissions : ROLE_PERMISSIONS[user.role] || [];
    };

    return {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        getUserPermissions,
    };
};
