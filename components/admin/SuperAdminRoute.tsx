import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { LoadingScreen } from '../customer/common/Loading';

interface SuperAdminRouteProps {
  children: React.ReactElement;
}

const SuperAdminRoute: React.FC<SuperAdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Verificando acceso administrativo..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdminOrAdmin = hasRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);

  if (!isSuperAdminOrAdmin) {
    // Si no es admin, redirigir al home de cliente/negocio según corresponda
    return <Navigate to="/" replace />;
  }

  return children;
};

export default SuperAdminRoute;
