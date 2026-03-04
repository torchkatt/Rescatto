import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types';

interface PermissionGateProps {
    children: React.ReactNode;
    requires?: Permission; // Permiso único
    requiresAny?: Permission[]; // Cualquiera de estos permisos
    requiresAll?: Permission[]; // Todos estos permisos
    fallback?: React.ReactNode; // Lo que se muestra si no hay permiso
}

/**
 * Componente que renderiza condicionalmente sus hijos basándose en los permisos del usuario
 * 
 * @example
 * <PermissionGate requires={Permission.DELETE_PRODUCTS}>
 *   <button onClick={handleDelete}>Delete</button>
 * </PermissionGate>
 * 
 * @example
 * <PermissionGate requiresAny={[Permission.EDIT_PRODUCTS, Permission.DELETE_PRODUCTS]}>
 *   <ProductActions />
 * </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
    children,
    requires,
    requiresAny,
    requiresAll,
    fallback = null,
}) => {
    const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

    let hasAccess = false;

    if (requires) {
        hasAccess = hasPermission(requires);
    } else if (requiresAny) {
        hasAccess = hasAnyPermission(requiresAny);
    } else if (requiresAll) {
        hasAccess = hasAllPermissions(requiresAll);
    } else {
        // No se especificó ningún permiso, denegar por defecto
        hasAccess = false;
    }

    return hasAccess ? <>{children}</> : <>{fallback}</>;
};
