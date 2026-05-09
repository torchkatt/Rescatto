import React, { useEffect, useState, useMemo } from 'react';
import { adminService } from '../../services/adminService';
import { roleService, RoleDefinition } from '../../services/roleService';
import { User, UserRole, Permission, ROLE_PERMISSIONS } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { PermissionGate } from '../../components/PermissionGate';
import { useAuth } from '../../context/AuthContext';
import { Pencil, Trash2, Shield, User as UserIcon, Search, CheckCircle2, RotateCw, MapPin, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

import { UserProfilePreview } from '../../components/admin/UserProfilePreview';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Tooltip } from '../../components/common/Tooltip';
import { logger } from '../../utils/logger';
import MobileDrawer from '../../components/common/MobileDrawer';
import { DataTable, Column } from '../../components/common/DataTable';
import { useAdminTable } from '../../hooks/useAdminTable';

const roleNames: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Administrador',
    [UserRole.ADMIN]: 'Administrador',
    [UserRole.VENUE_OWNER]: 'Dueño de Sede',
    [UserRole.KITCHEN_STAFF]: 'Personal de Cocina',
    [UserRole.DRIVER]: 'Domiciliario',
    [UserRole.CUSTOMER]: 'Cliente',
    [UserRole.CITY_ADMIN]: 'Admin Regional',
};

const getRoleLabel = (role: UserRole) => roleNames[role] || role;

const getRoleColor = (role: UserRole) => {
    switch (role) {
        case UserRole.SUPER_ADMIN: return 'bg-purple-100 text-purple-800 border-purple-200';
        case UserRole.ADMIN: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case UserRole.VENUE_OWNER: return 'bg-blue-100 text-blue-800 border-blue-200';
        case UserRole.KITCHEN_STAFF: return 'bg-orange-100 text-orange-800 border-orange-200';
        case UserRole.DRIVER: return 'bg-amber-100 text-amber-800 border-amber-200';
        case UserRole.CUSTOMER: return 'bg-green-100 text-green-800 border-green-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const roleLevels: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 100,
    [UserRole.ADMIN]: 90,
    [UserRole.VENUE_OWNER]: 80,
    [UserRole.KITCHEN_STAFF]: 50,
    [UserRole.DRIVER]: 40,
    [UserRole.CUSTOMER]: 10,
    [UserRole.CITY_ADMIN]: 95,
};

const canManageUser = (currentUser: User | null, targetUser: User) => {
    if (!currentUser) return false;
    if (currentUser.id === targetUser.id) return false; // Cannot manage self

    // Exception: SUPER_ADMIN can manage everyone (including other SUPER_ADMINs)
    if (currentUser.role === UserRole.SUPER_ADMIN) return true;

    const currentLevel = roleLevels[currentUser.role] || 0;
    const targetLevel = roleLevels[targetUser.role] || 0;

    // For others, must have strictly higher role
    return currentLevel > targetLevel;
};

export const UsersManager: React.FC = () => {
    const toast = useToast();
    const confirm = useConfirm();
    const { user: currentUser } = useAuth();
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const showPreview = false;
    const [previewUser, setPreviewUser] = useState<User | null>(null);

    // Create User State
    const [creatingUser, setCreatingUser] = useState(false);
    const [managingRoles, setManagingRoles] = useState(false); // New state for Role Manager
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        role: UserRole.KITCHEN_STAFF,
        venueIds: [] as string[]
    });
    const [venues, setVenues] = useState<any[]>([]);

    const [roles, setRoles] = useState<RoleDefinition[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [editingRole, setEditingRole] = useState<string | null>(null); // Role ID being edited
    const [tempRolePermissions, setTempRolePermissions] = useState<Permission[]>([]);

    useEffect(() => {
        if (managingRoles) {
            loadRoles();
        }
    }, [managingRoles]);

    const loadRoles = async () => {
        setLoadingRoles(true);
        try {
            const data = await roleService.getAllRoles();
            setRoles(data);
        } catch (error) {
            logger.error('Failed to load roles', error);
        } finally {
            setLoadingRoles(false);
        }
    };

    const handleSeedRoles = async () => {
        setLoadingRoles(true);
        try {
            await roleService.seedRoles();
            await loadRoles();
        } catch (error) {
            logger.error('Error seeding roles', error);
            toast.error('Error al migrar roles');
        } finally {
            setLoadingRoles(false);
        }
    };

    const startEditingRole = (role: RoleDefinition) => {
        setEditingRole(role.id);
        setTempRolePermissions(role.permissions);
    };

    const toggleRolePermission = (permission: Permission) => {
        setTempRolePermissions(prev => {
            if (prev.includes(permission)) {
                return prev.filter(p => p !== permission);
            } else {
                return [...prev, permission];
            }
        });
    };

    const saveRolePermissions = async () => {
        if (!editingRole) return;
        setLoadingRoles(true);
        try {
            await roleService.updateRolePermissions(editingRole, tempRolePermissions);
            // Update local state
            setRoles(roles.map(r => r.id === editingRole ? { ...r, permissions: tempRolePermissions } : r));
            setEditingRole(null);
            toast.success('Permisos guardados');
        } catch (error) {
            logger.error('Error saving role permissions', error);
            toast.error('Error al guardar permisos del rol');
        } finally {
            setLoadingRoles(false);
        }
    };

    const [selectedRole, setSelectedRole] = useState<string>('');
    const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false); // Local loading for actions
    const [searchTerm, setSearchTerm] = useState(''); // Keep local for initial state or header if needed, but better to use table.searchTerm

    const table = useAdminTable<User>({
        fetchFn: (size, cursor, term) => adminService.getUsersPaginated(size, cursor, term, selectedRole),
        countFn: (term) => selectedRole ? adminService.getUsersCountByRole(selectedRole as UserRole) : adminService.getUsersCount(),
        initialPageSize: 20,
        dependencies: [selectedRole]
    });

    useEffect(() => {
        loadVenues();
        loadRoleCounts();
    }, []);

    const loadRoleCounts = async () => {
        try {
            const roles = Object.values(UserRole);
            const counts: Record<string, number> = {};
            await Promise.all(roles.map(async (role) => {
                counts[role] = await adminService.getUsersCountByRole(role);
            }));
            setRoleCounts(counts);
        } catch (error) {
            logger.error('Error loading role counts', error);
        }
    };

    const handleToggleVerification = async (user: User) => {
        if (!currentUser) return;
        const newStatus = !user.isVerified;
        try {
            // Optimistic update
            table.setData(prev => prev.map(u => u.id === user.id ? {
                ...u,
                isVerified: newStatus,
                verificationDate: newStatus ? new Date().toISOString() : undefined
            } : u));

            await adminService.verifyUser(user.id, newStatus, currentUser.id);
            // addToast(`Usuario ${newStatus ? 'verificado' : 'desverificado'}`, 'success');
        } catch (error) {
            logger.error('Error toggling verification', error);
            // addToast('Error al cambiar verificación', 'error');
            table.reload(); // Revert
        }
    };

    const loadVenues = async () => {
        try {
            const allVenues = await adminService.getAllVenues();
            if (currentUser?.role === UserRole.SUPER_ADMIN) {
                setVenues(allVenues);
            } else {
                // Filter venues to only those the ADMIN manages
                const adminVenues = currentUser?.venueIds || (currentUser?.venueId ? [currentUser.venueId] : []);
                setVenues(allVenues.filter(v => adminVenues.includes(v.id)));
            }
        } catch (error) {
            logger.error('Failed to load venues', error);
        }
    };

    const mapAuthError = (code: string) => {
        switch (code) {
            case 'auth/email-already-in-use':
                return 'Este correo electrónico ya está registrado con otro usuario.';
            case 'auth/invalid-email':
                return 'El formato del correo electrónico no es válido.';
            case 'auth/weak-password':
                return 'La contraseña es demasiado débil (mínimo 6 caracteres).';
            case 'auth/operation-not-allowed':
                return 'La creación de usuarios por email no está habilitada.';
            default:
                return 'Error inesperado al crear usuario.';
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        // table.isLoading is handled by the hook if we use table.reload()
        try {
            const { fullName, email, password, role, venueIds } = formData;
            const primaryVenueId = venueIds.length > 0 ? venueIds[0] : 'default-venue';

            await import('../../services/authService').then(mod =>
                mod.authService.createUser(email, password, {
                    fullName,
                    role,
                    venueId: primaryVenueId,
                    venueIds: venueIds
                })
            );

            setCreatingUser(false);
            setFormData({ fullName: '', email: '', password: '', role: UserRole.KITCHEN_STAFF, venueIds: [] });
            toast.success('Usuario creado exitosamente');
            table.reload();
            loadRoleCounts();
        } catch (error: any) {
            logger.error('Error creating user', error);
            const message = error.code ? mapAuthError(error.code) : (error.message || 'Error desconocido');
            toast.error(`Error al crear usuario: ${message}`);
        }
    };

    const toggleVenueSelection = (venueId: string) => {
        setFormData(prev => {
            const isSingleVenueRole = prev.role === UserRole.KITCHEN_STAFF;
            const current = prev.venueIds;

            if (isSingleVenueRole) {
                return { ...prev, venueIds: current.includes(venueId) ? [] : [venueId] };
            } else {
                if (current.includes(venueId)) {
                    return { ...prev, venueIds: current.filter(id => id !== venueId) };
                } else {
                    return { ...prev, venueIds: [...current, venueId] };
                }
            }
        });
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        try {
            await adminService.updateUser(userId, { role: newRole }, currentUser?.id || 'system');
            table.setData(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            logger.error('Error updating role', error);
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        const targetUser = table.data.find(u => u.id === userId);
        if (!targetUser || !canManageUser(currentUser, targetUser)) {
            toast.warning('No tienes permisos para modificar este usuario.');
            return;
        }

        const newStatus = !currentStatus;
        try {
            // Optimistic update
            table.setData(prev => prev.map(u => u.id === userId ? { ...u, isActive: newStatus } : u));
            await adminService.updateUser(userId, { isActive: newStatus }, currentUser?.id || 'system');
        } catch (error) {
            logger.error('Error updating status', error);
            // Revert on error
            table.setData(prev => prev.map(u => u.id === userId ? { ...u, isActive: currentStatus } : u));
            toast.error('Error al actualizar el estado del usuario');
        }
    };

    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    const confirmDelete = async () => {
        if (!userToDelete) return;

        try {
            await adminService.deleteUserDoc(userToDelete, currentUser?.id || 'system');
            table.setData(prev => prev.filter(u => u.id !== userToDelete));
            toast.success(`Usuario eliminado permanentemente`);
            setUserToDelete(null); // Close modal
        } catch (error: any) {
            logger.error('Error deleting user', error);
            const errorMsg = error.message || 'No se pudo completar la eliminación';
            toast.error(`Error al eliminar: ${errorMsg}`);
        }
    };

    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // Pagination State removed in favor of Server-Side Load More mechanism.

    // ... (existing useEffects)

    const columns = useMemo<Column<User>[]>(() => [
        {
            header: 'Usuario',
            accessor: (u) => (
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getRoleColor(u.role)}`}>
                        {u.fullName?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <div className="font-bold text-sm text-gray-900">{u.fullName || 'Sin Nombre'}</div>
                        <div className="text-[10px] text-gray-400 font-mono hidden sm:block">ID: {u.id.slice(-6)}</div>
                    </div>
                </div>
            ),
            sortable: true,
            sortKey: 'fullName'
        },
        {
            header: 'Rol',
            accessor: (u) => (
                <div onClick={e => e.stopPropagation()}>
                    <PermissionGate requires={Permission.MANAGE_USER_ROLES} fallback={
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleColor(u.role)}`}>
                            {getRoleLabel(u.role)}
                        </span>
                    }>
                        <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            disabled={!canManageUser(currentUser, u)}
                            className={`text-xs font-bold border-gray-200 rounded-lg py-1 px-2 cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed
                            ${u.role === UserRole.SUPER_ADMIN ? 'bg-purple-50 text-purple-800 border-purple-100' :
                                    u.role === UserRole.VENUE_OWNER ? 'bg-blue-50 text-blue-800 border-blue-100' :
                                        u.role === UserRole.CUSTOMER ? 'bg-green-50 text-green-800 border-green-100' :
                                            'bg-gray-50 text-gray-800 border-gray-100'}`}
                        >
                            {Object.values(UserRole)
                                .filter(role => {
                                    if (role === u.role) return true;
                                    if (currentUser?.role === UserRole.SUPER_ADMIN) return true;
                                    if (currentUser?.role === UserRole.ADMIN) {
                                        return role === UserRole.KITCHEN_STAFF || role === UserRole.DRIVER;
                                    }
                                    return (roleLevels[currentUser?.role as UserRole] || 0) > (roleLevels[role] || 0);
                                })
                                .map(role => (
                                    <option key={role} value={role}>{roleNames[role]}</option>
                                ))}
                        </select>
                    </PermissionGate>
                </div>
            ),
            sortable: true,
            sortKey: 'role'
        },
        { header: 'Email', accessor: 'email', sortable: true },
        { 
            header: 'Ciudad', 
            accessor: (u) => (
                <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                    <MapPin size={10} className="text-emerald-500" />
                    {u.city || '-'}
                </span>
            ),
            sortable: true,
            sortKey: 'city'
        },
        {
            header: 'Verificado',
            accessor: (u) => (
                <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                    <Tooltip text={u.isVerified ? `Verificado el ${new Date(u.verificationDate || '').toLocaleDateString()}` : 'No verificado'}>
                        <button
                            onClick={() => handleToggleVerification(u)}
                            disabled={!canManageUser(currentUser, u)}
                            className={`p-1.5 rounded-full transition-all ${u.isVerified
                                ? 'text-blue-500 bg-blue-50 hover:bg-blue-100'
                                : 'text-gray-300 bg-gray-50 hover:text-gray-400 hover:bg-gray-100'
                                } ${!canManageUser(currentUser, u) ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                            <CheckCircle2 size={18} fill={u.isVerified ? "currentColor" : "none"} />
                        </button>
                    </Tooltip>
                </div>
            ),
            sortable: true,
            sortKey: 'isVerified',
            className: 'text-center'
        },
        {
            header: 'Estado',
            accessor: (u) => (
                <div onClick={e => e.stopPropagation()} className="flex justify-center">
                    <PermissionGate requires={Permission.EDIT_USERS} fallback={
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.isActive !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                            }`}>
                            {u.isActive !== false ? 'Activo' : 'Inactivo'}
                        </span>
                    }>
                        <button
                            onClick={() => handleToggleStatus(u.id, u.isActive !== false)}
                            disabled={!canManageUser(currentUser, u)}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-30 disabled:cursor-not-allowed ${u.isActive !== false ? 'bg-emerald-600' : 'bg-gray-200'
                                }`}
                            role="switch"
                        >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${u.isActive !== false ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </PermissionGate>
                </div>
            ),
            sortable: true,
            sortKey: 'isActive',
            className: 'text-center'
        },
        {
            header: 'Sedes',
            accessor: (u) => (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <span className="truncate max-w-[100px] text-xs font-medium">
                        {u.role === UserRole.SUPER_ADMIN ? (
                            <span className="text-gray-400 italic">Todas</span>
                        ) : (
                            u.venueIds && u.venueIds.length > 0
                                ? `${u.venueIds.length} sedes`
                                : (u.venueId && venues.find(v => v.id === u.venueId)?.name || 'Sin sede')
                        )}
                    </span>
                    {canManageUser(currentUser, u) &&
                        u.role !== UserRole.SUPER_ADMIN &&
                        u.role !== UserRole.CUSTOMER &&
                        u.role !== UserRole.DRIVER && (
                            <button
                                onClick={() => openVenueEditor(u)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                title="Gestionar Sedes"
                            >
                                <Pencil size={12} />
                            </button>
                        )}
                </div>
            )
        },
        {
            header: 'Registro',
            accessor: (u) => (
                <span className="text-xs text-gray-500 font-medium">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                </span>
            ),
            sortable: true,
            sortKey: 'createdAt'
        },
        {
            header: '',
            accessor: (u) => (
                <div className="flex justify-end gap-2 items-center" onClick={e => e.stopPropagation()}>
                    <PermissionGate requires={Permission.MANAGE_USER_ROLES}>
                        {canManageUser(currentUser, u) && (
                            <Tooltip text="Permisos Especiales">
                                <button
                                    onClick={() => openPermissionEditor(u)}
                                    className="text-gray-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-lg transition-all"
                                >
                                    <Shield size={16} />
                                </button>
                            </Tooltip>
                        )}
                    </PermissionGate>
                    <PermissionGate requires={Permission.DELETE_USERS}>
                        {canManageUser(currentUser, u) && (
                            <Tooltip text="Eliminar permanentemente">
                                <button
                                    onClick={() => setUserToDelete(u.id)}
                                    className="text-red-300 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </Tooltip>
                        )}
                    </PermissionGate>
                </div>
            ),
            className: 'text-right'
        }
    ], [currentUser, venues]);

    // filteredUsers logic removed as it's handled by fetchFn and canManageUser



    const toggleSelectUser = (userId: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
        if (selectedUsers.size === 0) return;

        const confirmed = await confirm({
            title: 'Acción masiva',
            message: `¿Estás seguro de que deseas ${action === 'delete' ? 'eliminar' : action === 'activate' ? 'activar' : 'desactivar'} ${selectedUsers.size} usuarios?`,
            confirmLabel: action === 'delete' ? 'Eliminar' : 'Continuar',
            variant: action === 'delete' ? 'danger' : 'warning'
        });

        if (!confirmed) {
            return;
        }

        setLoading(true);
        try {
            const userIds = Array.from(selectedUsers);
            if (action === 'delete') {
                await Promise.all(userIds.map(id => adminService.deleteUserDoc(id, currentUser?.id || 'system')));
                table.setData(prev => prev.filter(u => !selectedUsers.has(u.id)));
                toast.success(`${userIds.length} usuarios eliminados permanentemente`);
            } else {
                const isActive = action === 'activate';
                await Promise.all(userIds.map(id => adminService.updateUser(id, { isActive }, currentUser?.id || 'system')));
                table.setData(prev => prev.map(u => selectedUsers.has(u.id) ? { ...u, isActive } : u));
                toast.success(`${userIds.length} usuarios ${isActive ? 'activados' : 'desactivados'} con éxito`);
            }
            setSelectedUsers(new Set());
        } catch (error: any) {
            logger.error('Error performing bulk action', error);
            const errorMsg = error.message || 'Error en la operación masiva';
            toast.error(`Error: ${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };

    const [permissionUser, setPermissionUser] = useState<User | null>(null);
    const [tempPermissions, setTempPermissions] = useState<Permission[]>([]);
    const [venueAssignmentUser, setVenueAssignmentUser] = useState<User | null>(null);
    const [tempVenueIds, setTempVenueIds] = useState<string[]>([]);

    const openPermissionEditor = (user: User) => {
        setPermissionUser(user);
        // If user has custom permissions, load them. Otherwise load default role permissions
        setTempPermissions(user.permissions || ROLE_PERMISSIONS[user.role] || []);
    };

    const openVenueEditor = (user: User) => {
        setVenueAssignmentUser(user);
        // Load existing venues
        setTempVenueIds(user.venueIds || (user.venueId ? [user.venueId] : []));
    };

    const togglePermission = (permission: Permission) => {
        setTempPermissions(prev => {
            if (prev.includes(permission)) {
                return prev.filter(p => p !== permission);
            } else {
                return [...prev, permission];
            }
        });
    };

    const toggleTempVenueSelection = (venueId: string) => {
        const targetUser = venueAssignmentUser || permissionUser; // Fallback for safety during transition
        if (!targetUser) return;

        const isSingleVenueRole = targetUser.role === UserRole.KITCHEN_STAFF;

        setTempVenueIds(prev => {
            if (isSingleVenueRole) {
                return prev.includes(venueId) ? [] : [venueId];
            } else {
                if (prev.includes(venueId)) {
                    return prev.filter(id => id !== venueId);
                } else {
                    return [...prev, venueId];
                }
            }
        });
    };

    const savePermissions = async () => {
        if (!permissionUser) return;
        setLoading(true);
        try {
            const updateData: Partial<User> = { permissions: tempPermissions };

            await adminService.updateUser(permissionUser.id, updateData, currentUser?.id || 'system');

            const updatedUser = {
                ...permissionUser,
                permissions: tempPermissions
            };

            table.setData(prev => prev.map(u => u.id === permissionUser.id ? updatedUser : u));

            // Sync preview if it's the same user
            if (previewUser?.id === permissionUser.id) {
                setPreviewUser(updatedUser);
            }

            toast.success('Usuario actualizado');
            setPermissionUser(null);
        } catch (error) {
            logger.error('Error saving permissions', error);
            toast.error('Error al guardar permisos');
        } finally {
            setLoading(false);
        }
    };

    const saveVenueAssignment = async () => {
        if (!venueAssignmentUser) return;
        setLoading(true);
        try {
            const venueIds = tempVenueIds;
            const venueId = venueIds.length > 0 ? venueIds[0] : 'default-venue';

            const updateData: Partial<User> = {
                venueIds,
                venueId
            };

            await adminService.updateUser(venueAssignmentUser.id, updateData, currentUser?.id || 'system');

            const updatedUser = {
                ...venueAssignmentUser,
                venueIds,
                venueId
            };

            table.setData(prev => prev.map(u => u.id === venueAssignmentUser.id ? updatedUser : u));

            // Sync preview if it's the same user
            if (previewUser?.id === venueAssignmentUser.id) {
                setPreviewUser(updatedUser);
            }

            toast.success('Usuario actualizado');
            setVenueAssignmentUser(null);
        } catch (error) {
            logger.error('Error saving venues', error);
            toast.error('Error al guardar sedes');
        } finally {
            setLoading(false);
        }
    };

    const resetPermissions = async () => {
        if (!permissionUser) return;
        setLoading(true);
        try {
            // We'll update with 'permissions: null' to signify removal/reset.
            // Ensure adminService handles this correctly or just accepts the partial update.
            // If this fails to actually remove the field in Firestore, it might set it to null.
            // The usePermissions hook should check if (user.permissions) which might need to handle null.
            // Ideally we delete the field, but let's send null for now as a reset signal.
            await adminService.updateUser(permissionUser.id, { permissions: null as any }, currentUser?.id || 'system');

            table.setData(prev => prev.map(u => {
                if (u.id === permissionUser.id) {
                    const { permissions, ...rest } = u;
                    return rest as User;
                }
                return u;
            }));
            setPermissionUser(null);
        } catch (error) {
            logger.error('Error resetting permissions', error);
        } finally {
            setLoading(false);
        }
    }


    if (loading && !creatingUser && !permissionUser && !venueAssignmentUser && !managingRoles) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6 overflow-x-hidden">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <UserIcon className="text-emerald-600" />
                    Gestión de Usuarios
                </h2>
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <button
                        onClick={() => table.reload()}
                        className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition shadow-sm flex items-center justify-center flex-1 lg:flex-none"
                        title="Refrescar usuarios"
                    >
                        <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {selectedUsers.size > 0 && (
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200 border border-gray-200 overflow-x-auto max-w-full">
                            <div className="px-2 text-xs font-semibold text-gray-500 border-r border-gray-300 mr-1 whitespace-nowrap">
                                {selectedUsers.size}
                            </div>

                            {/* Logic: Show 'Activate' only if there are inactive users selected */}
                            {table.data.filter(u => selectedUsers.has(u.id)).some(u => u.isActive === false) && (
                                <Tooltip text="Activar todos los seleccionados">
                                    <button
                                        onClick={() => handleBulkAction('activate')}
                                        className="bg-white text-emerald-600 px-3 py-1.5 rounded-md hover:bg-emerald-50 transition text-xs font-bold shadow-sm border border-gray-200 flex items-center gap-1"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Activar
                                    </button>
                                </Tooltip>
                            )}

                            {/* Logic: Show 'Deactivate' only if there are active users selected */}
                            {table.data.filter(u => selectedUsers.has(u.id)).some(u => u.isActive !== false) && (
                                <Tooltip text="Desactivar todos los seleccionados">
                                    <button
                                        onClick={() => handleBulkAction('deactivate')}
                                        className="bg-white text-amber-600 px-3 py-1.5 rounded-md hover:bg-amber-50 transition text-xs font-bold shadow-sm border border-gray-200 flex items-center gap-1"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div> Desactivar
                                    </button>
                                </Tooltip>
                            )}

                            <div className="w-px h-4 bg-gray-300 mx-1"></div>

                            <button
                                onClick={() => handleBulkAction('delete')}
                                className="bg-white text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50 transition text-xs font-bold shadow-sm border border-gray-200 flex items-center gap-1"
                                title="Eliminar seleccionados"
                            >
                                <Trash2 size={12} /> Eliminar
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setManagingRoles(true)}
                        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 font-medium shadow-sm flex-1 lg:flex-none justify-center whitespace-nowrap"
                    >
                        <Shield size={18} className="text-gray-500" /> <span className="hidden sm:inline">Roles y Permisos</span><span className="inline sm:hidden">Roles</span>
                    </button>
                    <button
                        onClick={() => setCreatingUser(true)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm flex-1 lg:flex-none justify-center whitespace-nowrap"
                    >
                        <UserIcon size={18} /> <span className="hidden sm:inline">Crear Usuario</span><span className="inline sm:hidden">Crear</span>
                    </button>
                </div>
            </div>


            {/* Current User Info Banner */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-lg">
                        {currentUser?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <p className="text-sm text-emerald-800 font-medium">Sesión Actual</p>
                        <h3 className="text-lg font-bold text-gray-900">{currentUser?.fullName}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-700 font-mono">
                                {roleNames[currentUser?.role as UserRole] || currentUser?.role}
                            </span>
                            {currentUser?.venueId && (
                                <span className="flex items-center gap-1">
                                    • Sede: <span className="font-medium text-gray-700">
                                        {venues.find(v => v.id === currentUser.venueId)?.name || currentUser.venueId}
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content with Split View */}
            <div className="flex gap-6 items-start">
                <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <DataTable
                            data={table.data}
                            columns={columns}
                            placeholder="Busca por nombre, email, rol, ciudad o cualquier campo..."

                            headerSlot={
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={() => setSelectedRole('')}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                            !selectedRole 
                                                ? 'bg-gray-900 text-white border-gray-900 shadow-md' 
                                                : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50'
                                        }`}
                                    >
                                        Todos {roleCounts && Object.values(roleCounts).reduce((a, b) => a + b, 0) > 0 && (
                                            <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${!selectedRole ? 'bg-white/20' : 'bg-gray-100'}`}>
                                                {Object.values(roleCounts).reduce((a, b) => a + b, 0)}
                                            </span>
                                        )}
                                    </button>
                                    {Object.values(UserRole).map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setSelectedRole(selectedRole === role ? '' : role)}
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border flex items-center gap-1.5 ${
                                                selectedRole === role 
                                                    ? 'bg-gray-900 text-white border-gray-900 shadow-md' 
                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50'
                                            }`}
                                        >
                                            {roleNames[role as UserRole]}
                                            {(roleCounts[role] ?? 0) > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                                    selectedRole === role ? 'bg-white/20' : 'bg-gray-100'
                                                }`}>
                                                    {roleCounts[role]}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            }
                        selectable
                        selectedIds={selectedUsers}
                        onSelectToggle={toggleSelectUser}
                        onSelectAll={() => {
                            const manageableInView = table.data.filter(u => canManageUser(currentUser, u));
                            if (selectedUsers.size === manageableInView.length) {
                                setSelectedUsers(new Set());
                            } else {
                                setSelectedUsers(new Set(manageableInView.map(u => u.id)));
                            }
                        }}
                        isItemSelectable={(u) => canManageUser(currentUser, u)}
                        onRowClick={(u) => setPreviewUser(u)}
                        isLoading={table.isLoading}
                        initialPageSize={table.pageSize}
                        manualPagination
                        totalItems={table.totalItems}
                        currentPage={table.currentPage}
                        onPageChange={table.onPageChange}
                        onPageSizeChange={table.onPageSizeChange}
                        searchTerm={table.searchTerm}
                        onSearchChange={table.setSearchTerm}
                        isSearching={table.isSearching}
                        exportable
                        exportFilename="rescatto_usuarios"
                        exportTransformer={(u) => ({
                            fullName: u.fullName || '',
                            email: u.email || '',
                            role: roleNames[u.role as UserRole] || u.role,
                            city: u.city || '',
                            isActive: u.isActive ? 'Activo' : 'Inactivo',
                            isVerified: u.isVerified ? 'Verificado' : 'Sin verificar',
                            createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CO') : '',
                        })}
                    />
                    </div>
                </div>

                {/* Preview Panel */}
                {showPreview && (
                    <div className="hidden lg:block w-80 shrink-0 sticky top-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-gray-900 rounded-t-xl p-3 text-white text-center text-xs font-bold tracking-wider uppercase">
                            PERFIL DE USUARIO
                        </div>
                        <div className="bg-white rounded-b-xl p-6 border border-gray-200 shadow-xl min-h-[500px] flex flex-col items-center justify-start">
                            {previewUser ? (
                                <div className="space-y-6 w-full">
                                    <UserProfilePreview user={previewUser} venues={venues} />

                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-gray-800 mb-2 text-sm">Acciones de Administración</h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {canManageUser(currentUser, previewUser) && (
                                                <button
                                                    onClick={() => openPermissionEditor(previewUser)}
                                                    className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition flex items-center justify-center gap-2"
                                                >
                                                    <Shield size={14} /> Gestionar Rol/Permisos
                                                </button>
                                            )}
                                            {canManageUser(currentUser, previewUser) && (
                                                <button
                                                    onClick={() => setUserToDelete(previewUser.id)}
                                                    className="w-full bg-red-50 text-red-700 border border-red-100 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 size={14} /> Eliminar Usuario
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 mt-20">
                                    <UserIcon size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-sm font-medium">Selecciona un usuario de la lista</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>


            {/* Mobile Preview Drawer */}
            <MobileDrawer
                isOpen={!!previewUser}
                onClose={() => setPreviewUser(null)}
                title="Perfil de Usuario"
            >
                {previewUser && (
                    <div className="space-y-6">
                        <UserProfilePreview user={previewUser} venues={venues} />
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="font-bold text-gray-800 mb-2 text-sm">Acciones de Administración</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {canManageUser(currentUser, previewUser) && (
                                    <button
                                        onClick={() => { setPreviewUser(null); openPermissionEditor(previewUser); }}
                                        className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition flex items-center justify-center gap-2"
                                    >
                                        <Shield size={14} /> Gestionar Rol/Permisos
                                    </button>
                                )}
                                {canManageUser(currentUser, previewUser) && (
                                    <button
                                        onClick={() => { setPreviewUser(null); setUserToDelete(previewUser.id); }}
                                        className="w-full bg-red-50 text-red-700 border border-red-100 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={14} /> Eliminar Usuario
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </MobileDrawer>

            {/* Permission Editor Modal */}
            {
                permissionUser && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden"
                        onClick={() => setPermissionUser(null)}
                    >
                        <div
                            className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-5 sm:p-6 animate-in fade-in zoom-in duration-200 cursor-default max-h-[85vh] overflow-y-auto flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Permisos de Usuario</h3>
                                    <p className="text-sm text-gray-500">
                                        Editando permisos para <span className="font-semibold text-gray-800">{permissionUser.fullName}</span>
                                    </p>
                                </div>
                                <button onClick={() => setPermissionUser(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800 flex items-start gap-2">
                                <Shield size={14} className="mt-0.5 shrink-0" />
                                <p>
                                    Al guardar, estos permisos <strong>sobrescribirán</strong> los permisos predeterminados del rol {roleNames[permissionUser.role]}.
                                    El usuario solo tendrá acceso a lo que marques aquí.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
                                {/* Group permissions logically */}
                                {Object.entries({
                                    'Usuarios': [Permission.VIEW_USERS, Permission.CREATE_USERS, Permission.EDIT_USERS, Permission.DELETE_USERS, Permission.MANAGE_USER_ROLES],
                                    'Sedes': [Permission.VIEW_VENUES, Permission.CREATE_VENUES, Permission.EDIT_VENUES, Permission.DELETE_VENUES, Permission.EDIT_OWN_VENUE],
                                    'Productos': [Permission.VIEW_PRODUCTS, Permission.CREATE_PRODUCTS, Permission.EDIT_PRODUCTS, Permission.DELETE_PRODUCTS, Permission.VIEW_ALL_PRODUCTS],
                                    'Pedidos': [Permission.VIEW_ORDERS, Permission.CREATE_ORDERS, Permission.MANAGE_ORDERS, Permission.CANCEL_ORDERS, Permission.VIEW_ALL_ORDERS],
                                    'Analíticas': [Permission.VIEW_ANALYTICS, Permission.VIEW_GLOBAL_ANALYTICS, Permission.EXPORT_REPORTS],
                                    'Configuración': [Permission.MANAGE_SETTINGS, Permission.MANAGE_PLATFORM_SETTINGS],
                                    'Domicilios': [Permission.VIEW_DELIVERIES, Permission.ACCEPT_DELIVERIES, Permission.MANAGE_DELIVERIES],
                                }).map(([category, perms]) => (
                                    <div key={category} className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-1">{category}</h4>
                                        <div className="space-y-2">
                                            {perms.map(perm => (
                                                <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded -ml-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={tempPermissions.includes(perm)}
                                                        onChange={() => togglePermission(perm)}
                                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-xs text-gray-600 font-mono">{perm}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 border-t border-gray-100 flex justify-between gap-3">
                                <button
                                    onClick={resetPermissions}
                                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors text-sm"
                                >
                                    Restaurar Defaults del Rol
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setPermissionUser(null)}
                                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={savePermissions}
                                        className="px-4 py-2 bg-emerald-600 rounded-lg text-white font-medium hover:bg-emerald-700 transition-colors"
                                    >
                                        Guardar Personalización
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Modal */}
            {
                userToDelete && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setUserToDelete(null)}
                    >
                        <div
                            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200 cursor-default"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                                    <Trash2 size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar Usuario?</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Esta acción eliminará los datos del usuario de la base de datos.
                                    <br />
                                    <span className="font-semibold text-red-500">Esta acción no se puede deshacer.</span>
                                </p>
                                <div className="flex w-full gap-3">
                                    <button
                                        onClick={() => setUserToDelete(null)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-white font-medium hover:bg-red-700 transition-colors"
                                    >
                                        Sí, Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Create User Modal */}
            {
                creatingUser && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden"
                        onClick={() => setCreatingUser(false)}
                    >
                        <div
                            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 sm:p-6 animate-in fade-in zoom-in duration-200 cursor-default max-h-[85vh] overflow-y-auto no-scrollbar flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Crear Nuevo Usuario</h3>
                                <button onClick={() => setCreatingUser(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>

                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                                    <input
                                        required
                                        type="text"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                                        value={formData.fullName}
                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input
                                        required
                                        type="email"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                                    <input
                                        required
                                        type="password"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Rol</label>
                                    <select
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                                        value={formData.role}
                                        onChange={e => {
                                            const newRole = e.target.value as UserRole;
                                            setFormData(prev => ({
                                                ...prev,
                                                role: newRole,
                                                venueIds: (newRole === UserRole.VENUE_OWNER || newRole === UserRole.KITCHEN_STAFF || newRole === UserRole.ADMIN)
                                                    ? prev.venueIds
                                                    : []
                                            }));
                                        }}
                                    >
                                        {Object.values(UserRole)
                                            .filter(role => {
                                                if (currentUser?.role === UserRole.SUPER_ADMIN) return true;
                                                // ADMIN can only create roles lower than their own
                                                return (roleLevels[currentUser?.role as UserRole] || 0) > (roleLevels[role] || 0);
                                            })
                                            .map(role => (
                                                <option key={role} value={role}>{roleNames[role]}</option>
                                            ))}
                                    </select>
                                </div>

                                {(formData.role === UserRole.VENUE_OWNER || formData.role === UserRole.KITCHEN_STAFF || formData.role === UserRole.ADMIN) && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Asignar Sede(s)</label>
                                        <div className="border rounded-md p-2 space-y-1">
                                            {venues.map(venue => (
                                                <label key={venue.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.venueIds.includes(venue.id)}
                                                        onChange={() => toggleVenueSelection(venue.id)}
                                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{venue.name}</span>
                                                </label>
                                            ))}
                                            {venues.length === 0 && <p className="text-xs text-gray-500 italic">No hay sedes disponibles</p>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Selecciona uno o más negocios para este usuario.</p>
                                    </div>
                                )}

                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCreatingUser(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 bg-emerald-600 rounded-lg text-white font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                                    >
                                        {loading ? <LoadingSpinner size="sm" /> : <UserIcon size={18} />}
                                        Crear Usuario
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Role Manager Modal */}
            {
                managingRoles && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 animate-in fade-in zoom-in duration-200 h-[85vh] flex flex-col">
                            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <Shield className="text-emerald-600" />
                                        Gestión de Roles y Permisos
                                    </h3>
                                    <p className="text-sm text-gray-500">Configura qué puede hacer cada rol en la plataforma.</p>
                                </div>
                                <button onClick={() => setManagingRoles(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition">✕</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-1">
                                {/* Migration Prompt */}
                                {roles.length === 0 && !loadingRoles && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center mb-8 animate-in fade-in zoom-in">
                                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Shield size={32} />
                                        </div>
                                        <h4 className="text-lg font-bold text-blue-900 mb-2">Configuración Avanzada de Roles</h4>
                                        <p className="text-blue-700 max-w-lg mx-auto leading-relaxed mb-6">
                                            Actualmente los permisos están definidos por código (Hardcoded). <br />
                                            Para editar esto dinámicamente, necesitamos migrar la configuración a la base de datos.
                                        </p>
                                        <button
                                            onClick={handleSeedRoles}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
                                        >
                                            Iniciar Migración a Base de Datos
                                        </button>
                                    </div>
                                )}

                                {/* Loading State */}
                                {loadingRoles && (
                                    <div className="flex justify-center p-12">
                                        <LoadingSpinner />
                                    </div>
                                )}

                                {/* Roles List */}
                                {roles.length > 0 && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {roles.map(role => (
                                            <div key={role.id} className={`border rounded-xl overflow-hidden transition bg-white flex flex-col ${editingRole === role.id ? 'ring-2 ring-emerald-500 shadow-lg' : 'border-gray-200 hover:shadow-md'}`}>
                                                <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{role.name}</h4>
                                                        <span className="text-xs font-mono text-gray-400">{role.id}</span>
                                                    </div>
                                                    {editingRole === role.id ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setEditingRole(null)}
                                                                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={saveRolePermissions}
                                                                className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded hover:bg-emerald-700 transition shadow-sm"
                                                            >
                                                                Guardar
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => startEditingRole(role)}
                                                            className="text-gray-400 hover:text-emerald-600 p-1.5 hover:bg-emerald-50 rounded-lg transition"
                                                            title="Editar Permisos"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="p-4 flex-1 overflow-y-auto max-h-[400px] no-scrollbar">
                                                    {editingRole === role.id ? (
                                                        <div className="space-y-4">
                                                            {Object.entries({
                                                                'Usuarios': [Permission.VIEW_USERS, Permission.CREATE_USERS, Permission.EDIT_USERS, Permission.DELETE_USERS, Permission.MANAGE_USER_ROLES],
                                                                'Sedes': [Permission.VIEW_VENUES, Permission.CREATE_VENUES, Permission.EDIT_VENUES, Permission.DELETE_VENUES, Permission.EDIT_OWN_VENUE],
                                                                'Productos': [Permission.VIEW_PRODUCTS, Permission.CREATE_PRODUCTS, Permission.EDIT_PRODUCTS, Permission.DELETE_PRODUCTS, Permission.VIEW_ALL_PRODUCTS],
                                                                'Pedidos': [Permission.VIEW_ORDERS, Permission.CREATE_ORDERS, Permission.MANAGE_ORDERS, Permission.CANCEL_ORDERS, Permission.VIEW_ALL_ORDERS],
                                                                'Analíticas': [Permission.VIEW_ANALYTICS, Permission.VIEW_GLOBAL_ANALYTICS, Permission.EXPORT_REPORTS],
                                                                'Configuración': [Permission.MANAGE_SETTINGS, Permission.MANAGE_PLATFORM_SETTINGS],
                                                                'Domicilios': [Permission.VIEW_DELIVERIES, Permission.ACCEPT_DELIVERIES, Permission.MANAGE_DELIVERIES],
                                                            }).map(([category, perms]) => (
                                                                <div key={category}>
                                                                    <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{category}</h5>
                                                                    <div className="space-y-2 pl-1">
                                                                        {perms.map(perm => (
                                                                            <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded -ml-1">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={tempRolePermissions.includes(perm)}
                                                                                    onChange={() => toggleRolePermission(perm)}
                                                                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                                                />
                                                                                <span className="text-xs text-gray-600 font-mono">{perm}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            {role.permissions.slice(0, 8).map(perm => (
                                                                <div key={perm} className="flex items-center gap-2 text-xs text-gray-600">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    <span className="truncate" title={perm}>{perm}</span>
                                                                </div>
                                                            ))}
                                                            {role.permissions.length > 8 && (
                                                                <div className="text-xs text-gray-400 italic pl-3.5">
                                                                    + {role.permissions.length - 8} permisos más...
                                                                </div>
                                                            )}
                                                            {role.permissions.length === 0 && (
                                                                <p className="text-xs text-gray-400 italic">Sin permisos asignados.</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Venue Assignment Modal */}
            {
                venueAssignmentUser && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden"
                        onClick={() => setVenueAssignmentUser(null)}
                    >
                        <div
                            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 sm:p-6 animate-in fade-in zoom-in duration-200 cursor-default max-h-[85vh] overflow-y-auto flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <MapPin size={20} className="text-emerald-600" />
                                    Gestionar Sedes
                                </h3>
                                <button onClick={() => setVenueAssignmentUser(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>

                            <div className="mb-6">
                                <p className="text-sm text-gray-500 mb-4">
                                    Asigna las sedes donde <strong>{venueAssignmentUser.fullName}</strong> podrá operar.
                                </p>

                                <div className="bg-white border border-gray-200 rounded-xl p-4">
                                    <h4 className="font-bold text-gray-800 mb-3 text-xs uppercase tracking-wider">
                                        Sedes Disponibles
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
                                        {venues.map(v => (
                                            <label key={v.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100">
                                                <input
                                                    type="checkbox"
                                                    checked={tempVenueIds.includes(v.id)}
                                                    onChange={() => toggleTempVenueSelection(v.id)}
                                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-xs font-medium text-gray-700 truncate">{v.name}</span>
                                            </label>
                                        ))}
                                        {venues.length === 0 && (
                                            <p className="text-xs text-gray-400 italic col-span-2 text-center py-4">No hay sedes configuradas para tu acceso.</p>
                                        )}
                                    </div>
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                                        <Shield size={14} className="text-blue-600 mt-0.5 shrink-0" />
                                        <p className="text-[10px] text-blue-700 leading-relaxed">
                                            {venueAssignmentUser.role === UserRole.KITCHEN_STAFF
                                                ? "REGLA: El Personal de Cocina está limitado a una única sede operativa por seguridad."
                                                : "INFO: Este rol permite la gestión de múltiples sedes simultáneamente."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setVenueAssignmentUser(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveVenueAssignment}
                                    disabled={loading}
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-shadow shadow-md disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? <LoadingSpinner size="sm" /> : <MapPin size={16} />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};