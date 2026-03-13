import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

import { LoadingScreen } from './customer/common/Loading';
import { auditService, AuditAction } from '../services/auditService';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
  disallowGuests?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, disallowGuests }) => {
  const { isAuthenticated, isLoading, hasRole, user, isEmailVerified, isAccountVerified } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Verificando acceso..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si se deniegan invitados y el usuario actual es anónimo
  if (disallowGuests && user?.isGuest) {
    auditService.logEvent({
      action: AuditAction.UNAUTHORIZED_ACCESS,
      performedBy: user.id,
      userRole: user.role,
      details: { reason: 'GUEST_FORBIDDEN', path: window.location.pathname }
    });
    return <Navigate to="/login" replace />;
  }

  // Forzar la verificación de la cuenta (Email + isVerified en Firestore)
  if (user && !isAccountVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    // El usuario ha iniciado sesión pero no tiene permiso.
    auditService.logEvent({
      action: AuditAction.UNAUTHORIZED_ACCESS,
      performedBy: user?.id,
      userRole: user?.role,
      details: { reason: 'INSUFFICIENT_ROLE', allowedRoles, path: window.location.pathname }
    });
    // Redirigir al punto de entrada principal que maneja el enrutamiento basado en roles (Smart Redirect).
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;