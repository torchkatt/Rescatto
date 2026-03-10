import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { authService } from '../services/authService';
import { onAuthStateChanged, sendEmailVerification, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../services/firebase';
import { roleService, RoleDefinition } from '../services/roleService';
import { logger } from '../utils/logger';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  convertGuestToUser: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  roles: RoleDefinition[];
  sendVerificationEmail: () => Promise<void>;
  isEmailVerified: boolean;
  isAccountVerified: boolean;
  switchVenue: (venueId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;

    // Timeout de seguridad: si isLoading sigue en true después de 10s, forzar false
    const loadingTimeout = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) {
          logger.warn('AuthContext: timeout de carga alcanzado, forzando isLoading=false');
          return false;
        }
        return prev;
      });
    }, 10000);

    // Cargar Roles
    const loadRoles = async () => {
      try {
        const loadedRoles = await roleService.getAllRoles();
        setRoles(loadedRoles);
      } catch (error) {
        logger.error("Falló la carga de roles en AuthContext", error);
      }
    };

    // Escuchar cambios de estado de autenticación de Firebase
    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        // Limpiar listener de usuario anterior si existe
        if (userUnsubscribe) {
          userUnsubscribe();
          userUnsubscribe = null;
        }

        if (firebaseUser) {
          // Suscribirse al perfil de usuario en Firestore (Actualizaciones en tiempo real)
          const userDocRef = doc(db, 'users', firebaseUser.uid);

          userUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const role = (userData.role as UserRole) || UserRole.CUSTOMER;

              // Cargar roles solo si es admin
              if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
                loadRoles();
              }

              const isFirestoreVerified = userData.isVerified || false;
              const isAuthVerified = firebaseUser.emailVerified;

              // Sincronizar Firebase Auth -> Firestore automáticamente
              // Si el usuario validó su email pero Firestore aún dice false, actualizamos Firestore
              if (isAuthVerified && !isFirestoreVerified) {
                // Actualización asíncrona "fire and forget" para no bloquear la carga
                updateDoc(userDocRef, {
                  isVerified: true,
                  verificationDate: new Date().toISOString()
                }).catch(err => logger.error("Error auto-sincronizando isVerified", err));
              }

              // Usar el estado de Auth si es true (es la fuente de verdad)
              const finalIsVerified = isAuthVerified || isFirestoreVerified;

              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                fullName: userData.fullName || firebaseUser.displayName || 'Usuario',
                role,
                venueId: userData.venueId,
                venueIds: userData.venueIds || [],
                avatarUrl: userData.avatarUrl || firebaseUser.photoURL,
                isGuest: firebaseUser.isAnonymous,
                address: userData.address,
                city: userData.city,
                phone: userData.phone,
                isVerified: finalIsVerified,
                impact: userData.impact,
                streak: userData.streak,
                redemptions: userData.redemptions,
                hasSeenOnboarding: userData.hasSeenOnboarding,
                referralCode: userData.referralCode,
              });
            } else {
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                fullName: firebaseUser.displayName || 'Usuario',
                role: UserRole.CUSTOMER,
                avatarUrl: firebaseUser.photoURL,
                isGuest: firebaseUser.isAnonymous,
              });
            }
            setIsLoading(false);
          }, (error) => {
            logger.error("Error en tiempo real de AuthContext:", error);
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              fullName: firebaseUser.displayName || 'Usuario',
              role: UserRole.CUSTOMER,
              avatarUrl: firebaseUser.photoURL,
              isGuest: firebaseUser.isAnonymous,
            });
            setIsLoading(false);
          });
        } else {
          setUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        logger.error("Error en AuthContext cargando perfil de usuario:", error);
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      authUnsubscribe();
      if (userUnsubscribe) {
        userUnsubscribe();
      }
    };
  }, []);

  // Los métodos de login NO hacen setIsLoading(true) para evitar race conditions.
  // onAuthStateChanged es la única fuente de verdad para isLoading.
  // Solo loginAsGuest lo hace porque es la primera carga de la app (no hay sesión previa).

  const login = useCallback(async (email: string, pass: string) => {
    try {
      await authService.login(email, pass);
      // onAuthStateChanged se encargará de setIsLoading(false) y setUser
    } catch (error) {
      throw error;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      await authService.loginWithGoogle();
    } catch (error) {
      throw error;
    }
  }, []);

  const loginAsGuest = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.loginAsGuest();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, []);

  const convertGuestToUser = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      await authService.convertGuestToUser(email, password, fullName);
    } catch (error) {
      logger.error('AuthContext: convertGuestToUser error', error);
      throw error;
    }
  }, []);

  const loginWithApple = useCallback(async () => {
    try {
      await authService.loginWithApple();
    } catch (error) {
      throw error;
    }
  }, []);

  const loginWithFacebook = useCallback(async () => {
    try {
      await authService.loginWithFacebook();
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      setUser(null); // Forzar limpieza de estado inmediatamente
    } catch (error) {
      logger.error('AuthContext: error en logout', error);
      throw error;
    }
  }, []);

  // Ayudante RBAC
  const hasRole = useCallback((allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    return allowedRoles.includes(user.role);
  }, [user]);

  const sendVerificationEmail = useCallback(async () => {
    await authService.sendVerificationEmail();
  }, []);

  const isTestUser = user?.email?.endsWith('@test.com');

  // Lógica de verificación unificada
  // Un usuario está 'verificado' si:
  // 1. Es un Super Admin
  // 2. Es un Usuario de Prueba (@test.com)
  // 3. Tiene email verificado Y la bandera isVerified en Firestore
  const isAccountVerified =
    user?.role === UserRole.SUPER_ADMIN ||
    isTestUser ||
    auth.currentUser?.isAnonymous ||
    (auth.currentUser?.emailVerified && (
      user?.role === UserRole.CUSTOMER || user?.isVerified === true
    ));

  // Mantener isEmailVerified para compatibilidad hacia atrás o verificaciones específicas
  const isEmailVerified = auth.currentUser?.emailVerified || user?.role === UserRole.SUPER_ADMIN || isTestUser || false;

  const switchVenue = useCallback(async (venueId: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, { venueId }, { merge: true });
    } catch (error) {
      logger.error('Error switching venue:', error);
      throw error;
    }
  }, [user]);

  // Memoize the context value to prevent unnecessary re-renders in all consumers
  const contextValue = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginWithGoogle,
    loginWithApple,
    loginWithFacebook,
    loginAsGuest,
    convertGuestToUser,
    logout,
    hasRole,
    roles,
    sendVerificationEmail,
    isEmailVerified,
    isAccountVerified,
    switchVenue,
  }), [user, isLoading, roles, isEmailVerified, isAccountVerified,
    login, loginWithGoogle, loginWithApple, loginWithFacebook, loginAsGuest,
    convertGuestToUser, logout, hasRole, sendVerificationEmail, switchVenue]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};