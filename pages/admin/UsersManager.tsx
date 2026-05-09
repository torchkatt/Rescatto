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
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
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

    useEffect(() => {
        loadUsers();
        loadVenues();
        // loadUsers y loadVenues son estables al montaje; también se invocan desde handlers de formulario
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleToggleVerification = async (user: User) => {
        if (!currentUser) return;
        const newStatus = !user.isVerified;
        try {
            // Optimistic update
            setUsers(users.map(u => u.id === user.id ? {
                ...u,
                isVerified: newStatus,
                verificationDate: newStatus ? new Date().toISOString() : undefined
            } : u));

            await adminService.verifyUser(user.id, newStatus, currentUser.id);
            // addToast(`Usuario ${newStatus ? 'verificado' : 'desverificado'}`, 'success');
        } catch (error) {
            logger.error('Error toggling verification', error);
            // addToast('Error al cambiar verificación', 'error');
            loadUsers(); // Revert
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

    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadMoreLoading, setIsLoadMoreLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await adminService.getUsersPaginated(20);
            setUsers(data.data);
            setLastDoc(data.lastDoc);
            setHasMore(data.hasMore);
        } catch (error) {
            logger.error('Failed to load users', error);
        } finally {
            setLoading(false);
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
        setLoading(true);
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
            loadUsers();
        } catch (error: any) {
            logger.error('Error creating user', error);
            const message = error.code ? mapAuthError(error.code) : (error.message || 'Error desconocido');
            toast.error(`Error al crear usuario: ${message}`);
        } finally {
            setLoading(false);
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
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            logger.error('Error updating role', error);
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        const targetUser = users.find(u => u.id === userId);
        if (!targetUser || !canManageUser(currentUser, targetUser)) {
            toast.warning('No tienes permisos para modificar este usuario.');
            return;
        }

        const newStatus = !currentStatus;
        try {
            // Optimistic update
            setUsers(users.map(u => u.id === userId ? { ...u, isActive: newStatus } : u));
            await adminService.updateUser(userId, { isActive: newStatus }, currentUser?.id || 'system');
        } catch (error) {
            logger.error('Error updating status', error);
            // Revert on error
            setUsers(users.map(u => u.id === userId ? { ...u, isActive: currentStatus } : u));
            toast.error('Error al actualizar el estado del usuario');
        }
    };

    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    const confirmDelete = async () => {
        if (!userToDelete) return;

        try {
            await adminService.deleteUserDoc(userToDelete, currentUser?.id || 'system');
            setUsers(users.filter(u => u.id !== userToDelete));
            toast.success('Usuario eliminado permanentemente');
            setUserToDelete(null); // Close modal
        } catch (error) {
            logger.error('Error deleting user', error);
            toast.error('Error al eliminar usuario');
        }
    };

    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // Pagination State removed in favor of Server-Side Load More mechanism.

    // ... (existing useEffects)

    const filteredUsers = useMemo(() => users.filter(user => {
        if (currentUser?.role !== UserRole.SUPER_ADMIN) {
            const userVenues = currentUser?.venueIds || (currentUser?.venueId ? [currentUser.venueId] : []);
            const targetVenue = user.venueId;
            if (!targetVenue || !userVenues.includes(targetVenue)) return false;
        }
        const matchesSearch = (user.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        return matchesSearch;
    }), [users, searchTerm, currentUser]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
    const needsMoreData = hasMore && safePage === totalPages && filteredUsers.length > 0 && filteredUsers.length % pageSize === 0;

    const goToPage = async (page: number) => {
        const target = Math.max(1, Math.min(page, totalPages));
        if (needsMoreData && target === totalPages) {
            setIsLoadMoreLoading(true);
            try {
                const result = await adminService.getUsersPaginated(pageSize, lastDoc);
                setUsers(prev => {
                    const existingIds = new Set(prev.map(u => u.id));
                    return [...prev, ...result.data.filter(u => !existingIds.has(u.id))];
                });
                setLastDoc(result.lastDoc);
                setHasMore(result.hasMore);
            } catch (error) {
                logger.error('Error loading more users:', error);
            } finally {
                setIsLoadMoreLoading(false);
            }
        }
        setCurrentPage(target);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    const getPageNumbers = () => {
        const delta = 2;
        const pages: (number | '...')[] = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= safePage - delta && i <= safePage + delta)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }
        return pages;
    };

    const toggleSelectAll = () => {
        // Only select users that can be managed
        const manageableUsers = paginatedUsers.filter(u => canManageUser(currentUser, u));

        if (selectedUsers.size === manageableUsers.length && manageableUsers.length > 0) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(manageableUsers.map(u => u.id)));
        }
    };


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
                setUsers(users.filter(u => !selectedUsers.has(u.id)));
            } else {
                const isActive = action === 'activate';
                await Promise.all(userIds.map(id => adminService.updateUser(id, { isActive }, currentUser?.id || 'system')));
                setUsers(users.map(u => selectedUsers.has(u.id) ? { ...u, isActive } : u));
            }
            toast.success('Acción completada con éxito');
            setSelectedUsers(new Set());
        } catch (error) {
            logger.error('Error performing bulk action', error);
            toast.error('Error al realizar la acción masiva');
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

            setUsers(users.map(u => u.id === permissionUser.id ? updatedUser : u));

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

            setUsers(users.map(u => u.id === venueAssignmentUser.id ? updatedUser : u));

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

            setUsers(users.map(u => {
                if (u.id === permissionUser.id) {
                    const { permissions, ...rest } = u;
                    return rest;
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
                        onClick={() => loadUsers()}
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
                            {users.filter(u => selectedUsers.has(u.id)).some(u => u.isActive === false) && (
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
                            {users.filter(u => selectedUsers.has(u.id)).some(u => u.isActive !== false) && (
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

                        {/* Table Header */}
                        <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h3 className="font-bold text-gray-800">Usuarios</h3>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 sm:flex-none sm:w-64">
                                    <Search className="text-gray-400 shrink-0" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar usuario por nombre o email..."
                                        className="flex-1 outline-none text-gray-700 bg-transparent text-sm"
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs text-gray-500">Filas:</span>
                                    <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-emerald-400">
                                        {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Card View (Visible on small screens) */}
                        <div className="block lg:hidden">
                            {/* Mobile Select All Header */}
                            {paginatedUsers.length > 0 && (
                                <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.size === paginatedUsers.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5"
                                    />
                                    <span className="text-sm font-medium text-gray-600">
                                        Seleccionar todo ({paginatedUsers.length})
                                    </span>
                                </div>
                            )}

                            {paginatedUsers.map(user => (
                                <div
                                    key={user.id}
                                    className={`p-4 border-b border-gray-100 last:border-0 ${selectedUsers.has(user.id) ? 'bg-emerald-50/30' : ''}`}
                                    onClick={() => setPreviewUser(user)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.has(user.id)}
                                                onChange={() => toggleSelectUser(user.id)}
                                                disabled={!canManageUser(currentUser, user)}
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5"
                                                onClick={e => e.stopPropagation()}
                                            />
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getRoleColor(user.role)}`}>
                                                {user.fullName?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{user.fullName || 'Sin Nombre'}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                        </div>

                                        <PermissionGate requires={Permission.EDIT_USERS} fallback={
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                                {user.isActive !== false ? 'Activo' : 'Inactivo'}
                                            </span>
                                        }>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleStatus(user.id, user.isActive !== false); }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.isActive !== false ? 'bg-emerald-600' : 'bg-gray-200'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.isActive !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </PermissionGate>
                                    </div>

                                    <div className="flex flex-wrap gap-3 mt-3 pl-8">
                                        {/* Role Selector (Mobile/Card View - Highly Polished) */}
                                        <div className="w-full mt-2">
                                            <PermissionGate requires={Permission.MANAGE_USER_ROLES} fallback={
                                                <div className={`w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold border shadow-sm ${getRoleColor(user.role)}`}>
                                                    {getRoleLabel(user.role)}
                                                </div>
                                            }>
                                                <div className="relative w-full group">
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => { e.stopPropagation(); handleRoleChange(user.id, e.target.value as UserRole); }}
                                                        disabled={!canManageUser(currentUser, user)}
                                                        className={`appearance-none block w-full outline-none cursor-pointer pl-4 pr-10 py-2.5 rounded-xl text-sm font-semibold shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed
                                                            ${user.role === UserRole.SUPER_ADMIN ? 'bg-purple-50 text-purple-900 border-purple-200/60' :
                                                                user.role === UserRole.VENUE_OWNER ? 'bg-blue-50 text-blue-900 border-blue-200/60' :
                                                                    user.role === UserRole.CUSTOMER ? 'bg-green-50 text-green-900 border-green-200/60' :
                                                                        'bg-gray-50 text-gray-900 border-gray-200/60'}`}
                                                        style={{ WebkitAppearance: 'none', MozAppearance: 'none', WebkitTapHighlightColor: 'transparent' }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onTouchStart={(e) => e.stopPropagation()}
                                                    >
                                                        {Object.values(UserRole)
                                                            .filter(role => {
                                                                if (role === user.role) return true;
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

                                                    {/* Custom Floating Icon Container */}
                                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                                                        <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors
                                                            ${user.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-600' :
                                                                user.role === UserRole.VENUE_OWNER ? 'bg-blue-100 text-blue-600' :
                                                                    user.role === UserRole.CUSTOMER ? 'bg-green-100 text-green-600' :
                                                                        'bg-gray-200 text-gray-500'}`}>
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            </PermissionGate>
                                        </div>

                                        {/* Verification Toggle (Mobile) */}
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <Tooltip text={user.isVerified ? `Verificado el ${new Date(user.verificationDate || '').toLocaleDateString()}` : 'No verificado'}>
                                                <button
                                                    onClick={() => handleToggleVerification(user)}
                                                    disabled={!canManageUser(currentUser, user)}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${user.isVerified
                                                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                        : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                                                        } ${!canManageUser(currentUser, user) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <CheckCircle2 size={12} />
                                                    {user.isVerified ? 'Verificado' : 'Verificar'}
                                                </button>
                                            </Tooltip>
                                        </div>

                                        {/* Additional Info (Venues & Date) */}
                                        <div className="w-full text-xs text-gray-500 space-y-1 mt-1 border-t border-gray-50 pt-2">
                                            {/* Venues */}
                                            {(user.venueId || (user.venueIds && user.venueIds.length > 0)) && (
                                                <div className="flex items-start gap-1">
                                                    <span className="font-medium text-gray-600">Sedes:</span>
                                                    <span className="truncate max-w-[200px]">
                                                        {user.role === UserRole.SUPER_ADMIN ? (
                                                            <span className="text-purple-600 font-medium">Todas</span>
                                                        ) : (
                                                            <>
                                                                {user.venueId && (
                                                                    <span>{venues.find(v => v.id === user.venueId)?.name || 'Sede Principal'}</span>
                                                                )}
                                                                {user.venueIds && user.venueIds.length > 0 && (
                                                                    <span className="ml-1 text-gray-400">
                                                                        (+{user.venueIds.length} más)
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Registration Date */}
                                            <div className="flex items-center gap-1">
                                                <span className="font-medium text-gray-600">Registrado:</span>
                                                <span>
                                                    {user.createdAt
                                                        ? new Date(user.createdAt).toLocaleDateString()
                                                        : <span className="text-gray-300 italic">Fecha desconocida</span>}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View (Hidden on small screens) */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className={`w-full text-left border-collapse ${showPreview ? 'min-w-[1000px]' : ''}`}>
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                        <th className="p-4 w-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                        </th>
                                        <th className="p-4">Usuario</th>
                                        <th className="p-4 text-sm font-medium text-gray-500">Rol</th>
                                        <th className="p-4">Email</th>
                                        <th className="p-4 text-center">Verificado</th>
                                        <th className="p-4">Estado</th>
                                        <th className="p-4 text-sm font-medium text-gray-500 xl:table-cell">Sedes</th>
                                        <th className="p-4 text-sm font-medium text-gray-500 xl:table-cell">Fecha Registro</th>
                                        <th className="p-4 text-sm font-medium text-gray-500 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedUsers.map(user => (
                                        <tr
                                            key={user.id}
                                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedUsers.has(user.id) ? 'bg-emerald-50/30' : ''} ${previewUser?.id === user.id ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => setPreviewUser(user)}
                                        >
                                            <td className="p-4" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.has(user.id)}
                                                    onChange={() => toggleSelectUser(user.id)}
                                                    disabled={!canManageUser(currentUser, user)}
                                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="p-4 font-medium text-gray-800">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getRoleColor(user.role)}`}>
                                                        {user.fullName?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm">{user.fullName || 'Sin Nombre'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4" onClick={e => e.stopPropagation()}>
                                                <PermissionGate requires={Permission.MANAGE_USER_ROLES} fallback={
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                                                        {getRoleLabel(user.role)}
                                                    </span>
                                                }>
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                                        disabled={!canManageUser(currentUser, user)}
                                                        className={`text-xs border-gray-200 rounded-md py-1 px-2 cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed
                                                        ${user.role === UserRole.SUPER_ADMIN ? 'bg-purple-50 text-purple-800 border-purple-100' :
                                                                user.role === UserRole.VENUE_OWNER ? 'bg-blue-50 text-blue-800 border-blue-100' :
                                                                    user.role === UserRole.CUSTOMER ? 'bg-green-50 text-green-800 border-green-100' :
                                                                        'bg-gray-50 text-gray-800 border-gray-100'}`}
                                                    >
                                                        {Object.values(UserRole)
                                                            .filter(role => {
                                                                if (role === user.role) return true;
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
                                                {user.permissions && (
                                                    <div className="mt-1 text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                                        <Shield size={10} /> Personalizado
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-gray-500 text-sm">{user.email}</td>
                                            <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                <Tooltip text={user.isVerified ? `Verificado el ${new Date(user.verificationDate || '').toLocaleDateString()}` : 'No verificado'}>
                                                    <button
                                                        onClick={() => handleToggleVerification(user)}
                                                        disabled={!canManageUser(currentUser, user)}
                                                        className={`p-1 rounded-full transition-colors ${user.isVerified
                                                            ? 'text-blue-500 hover:bg-blue-50'
                                                            : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50'
                                                            } ${!canManageUser(currentUser, user) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        <CheckCircle2 size={20} fill={user.isVerified ? "currentColor" : "none"} />
                                                    </button>
                                                </Tooltip>
                                            </td>

                                            <td className="p-4" onClick={e => e.stopPropagation()}>
                                                <PermissionGate requires={Permission.EDIT_USERS} fallback={
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${user.isActive !== false
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {user.isActive !== false ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                }>
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id, user.isActive !== false)}
                                                        disabled={!canManageUser(currentUser, user)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${user.isActive !== false ? 'bg-emerald-600' : 'bg-gray-200'
                                                            }`}
                                                        role="switch"
                                                        aria-checked={user.isActive !== false}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.isActive !== false ? 'translate-x-6' : 'translate-x-1'
                                                                }`}
                                                        />
                                                    </button>
                                                </PermissionGate>
                                            </td>

                                            <td className="p-4 text-gray-500 text-sm xl:table-cell" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate max-w-[100px]">
                                                        {user.role === UserRole.SUPER_ADMIN ? (
                                                            <span className="text-gray-400 italic">Todas</span>
                                                        ) : (
                                                            user.venueIds && user.venueIds.length > 0
                                                                ? `${user.venueIds.length} sedes`
                                                                : (user.venueId && venues.find(v => v.id === user.venueId)?.name || '1 sede')
                                                        )}
                                                    </span>
                                                    {canManageUser(currentUser, user) &&
                                                        user.role !== UserRole.SUPER_ADMIN &&
                                                        user.role !== UserRole.CUSTOMER &&
                                                        user.role !== UserRole.DRIVER && (
                                                            <button
                                                                onClick={() => openVenueEditor(user)}
                                                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                                                title="Gestionar Sedes"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                        )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-400 text-sm hidden xl:table-cell">
                                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2 items-center" onClick={e => e.stopPropagation()}>
                                                {/* Permission Button */}
                                                <PermissionGate requires={Permission.MANAGE_USER_ROLES}>
                                                    {canManageUser(currentUser, user) && (
                                                        <Tooltip text="Gestionar Permisos Personalizados">
                                                            <button
                                                                onClick={() => openPermissionEditor(user)}
                                                                className="text-gray-400 hover:text-emerald-600 p-1 transition-colors"
                                                            >
                                                                <Shield size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}
                                                </PermissionGate>

                                                <PermissionGate requires={Permission.DELETE_USERS}>
                                                    {canManageUser(currentUser, user) && (
                                                        <Tooltip text="Eliminar este usuario definitivamente">
                                                            <button
                                                                onClick={() => setUserToDelete(user.id)}
                                                                className="text-red-400 hover:text-red-600 p-1"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}
                                                </PermissionGate>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {filteredUsers.length > 0 && (
                            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <p className="text-xs text-gray-500 shrink-0">
                                    {isLoadMoreLoading ? 'Cargando...' : (
                                        <>Mostrando <span className="font-semibold text-gray-700">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredUsers.length)}</span> de <span className="font-semibold text-gray-700">{filteredUsers.length}{hasMore ? '+' : ''}</span> usuarios</>
                                    )}
                                </p>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => goToPage(1)} disabled={safePage === 1 || isLoadMoreLoading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsLeft size={16} /></button>
                                    <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1 || isLoadMoreLoading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                                    {getPageNumbers().map((page, idx) =>
                                        page === '...' ? <span key={`e-${idx}`} className="px-2 text-gray-400 text-sm select-none">…</span> : (
                                            <button key={page} onClick={() => goToPage(page as number)} disabled={isLoadMoreLoading} className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${page === safePage ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>{page}</button>
                                        )
                                    )}
                                    <button onClick={() => goToPage(safePage + 1)} disabled={(safePage >= totalPages && !hasMore) || isLoadMoreLoading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                                    <button onClick={() => goToPage(totalPages)} disabled={(safePage >= totalPages && !hasMore) || isLoadMoreLoading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsRight size={16} /></button>
                                </div>
                            </div>
                        )}
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