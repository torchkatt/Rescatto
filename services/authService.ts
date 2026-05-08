import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  User as FirebaseUser,
  getAuth,
  signOut,
  signInAnonymously,
  sendPasswordResetEmail,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import app, { auth, db, functions } from './firebase';
import { User, UserRole, AdditionalUserData } from '../types';
import { initializeApp } from 'firebase/app';
import { logger } from '../utils/logger';
import { loggerService } from './loggerService';

// Ayudante para crear usuario sin cerrar sesión del administrador actual
const createSecondaryUser = async (email: string, password: string) => {
  // 1. Inicializar una instancia secundaria de la app con la misma configuración
  const secondaryApp = initializeApp(app.options, 'SecondaryApp');
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // 2. Crear el usuario en la instancia de autenticación secundaria
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

    // 3. Cerrar sesión inmediatamente de la autenticación secundaria para evitar confusión de estado
    await signOut(secondaryAuth);

    return userCredential.user;
  } finally {
    // 4. Eliminar la app secundaria para liberar recursos
    // Nota: delete() es una promesa pero no necesitamos bloquear la UI estrictamente
    // @ts-expect-error - delete existe en FirebaseApp pero puede faltar en algunas definiciones de tipo
    if (secondaryApp.delete) await secondaryApp.delete();
  }
};

// Convertir Usuario de Firebase a Usuario de la App
const mapFirebaseUserToAppUser = async (firebaseUser: FirebaseUser): Promise<User> => {
  // Obtener datos adicionales del usuario desde Firestore
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const userDoc = await getDoc(userDocRef);

  const userData = userDoc.exists() ? userDoc.data() : {};

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    fullName: userData.fullName || firebaseUser.displayName || 'Usuario',
    role: userData.role || UserRole.CUSTOMER,
    venueId: userData.venueId || undefined,
    venueIds: userData.venueIds || [],
    avatarUrl: userData.avatarUrl || firebaseUser.photoURL,
    isGuest: firebaseUser.isAnonymous,
    address: userData.address,
    city: userData.city,
    phone: userData.phone,
    isVerified: userData.isVerified,
    impact: userData.impact,
    createdAt: userData.createdAt || firebaseUser.metadata.creationTime,
    activeMembershipId: userData.activeMembershipId, // [V2]
  };
};

// Generador de Código de Referidos (6 caracteres alfanuméricos en mayúscula)
const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Crear o actualizar documento de usuario en Firestore
const createUserDocument = async (firebaseUser: FirebaseUser, additionalData: AdditionalUserData = {}) => {
  logger.log('createUserDocument: Iniciando para', firebaseUser.uid);
  try {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      logger.log('createUserDocument: El documento no existe, creando...');
      const defaultReferralCode = generateReferralCode();

      // Crear nuevo documento de usuario
      await setDoc(userDocRef, {
        fullName: additionalData.fullName || firebaseUser.displayName || 'Usuario',
        email: firebaseUser.email,
        role: additionalData.role || UserRole.CUSTOMER,
        createdAt: new Date().toISOString(),
        referralCode: additionalData.referralCode || defaultReferralCode,
        ...additionalData,
      });
      logger.log('createUserDocument: Perfil base creado');

      // --- V2 Architecture Migration ---
      try {
        const membershipData = {
          userId: firebaseUser.uid,
          role: additionalData.role || UserRole.CUSTOMER,
          venueId: additionalData.venueId || null,
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        
        const membershipRef = await addDoc(collection(db, 'memberships'), membershipData);
        await setDoc(userDocRef, { activeMembershipId: membershipRef.id }, { merge: true });
        logger.log('createUserDocument: Membresía V2 vinculada');
      } catch (error) {
        logger.error('createUserDocument: Error en Membresía V2 (no bloqueante):', error);
      }
    } else {
      logger.log('createUserDocument: El usuario ya tiene perfil');
    }
  } catch (error) {
    logger.error('createUserDocument: ERROR FATAL:', error);
    throw error; // Re-lanzar para que loginAsGuest lo capture
  }
};

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const appUser = await mapFirebaseUserToAppUser(userCredential.user);
    
    // Registrar acción en auditoría
    await loggerService.logAction('LOGIN', appUser.id, appUser.id, 'users', {
      method: 'email',
      email: appUser.email
    });

    return appUser;
  },

  register: async (email: string, password: string, name: string, role: UserRole, additionalData: AdditionalUserData = {}): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Redirigir para usar nuestro Email Profesional de SendGrid
    try {
      await authService.sendVerificationEmail(email);
    } catch (err) {
      logger.error("Error no bloqueante enviando email inicial:", err);
    }

    await createUserDocument(userCredential.user, { fullName: name, role, ...additionalData });
    const appUser = await mapFirebaseUserToAppUser(userCredential.user);

    // Registrar acción en auditoría
    await loggerService.logAction('USER_CREATED', appUser.id, appUser.id, 'users', {
      role: appUser.role,
      email: appUser.email
    });

    return appUser;
  },

  loginAsGuest: async (): Promise<User> => {
    logger.log('authService: loginAsGuest iniciando...');
    const userCredential = await signInAnonymously(auth);
    logger.log('authService: loginAsGuest signInAnonymously éxito', userCredential.user.uid);
    await createUserDocument(userCredential.user, { fullName: 'Invitado', role: UserRole.CUSTOMER });
    logger.log('authService: loginAsGuest createUserDocument éxito');
    const appUser = await mapFirebaseUserToAppUser(userCredential.user);

    // Registrar acción en auditoría
    await loggerService.logAction('LOGIN', appUser.id, appUser.id, 'users', {
      method: 'guest'
    });

    return appUser;
  },

  /**
   * Convierte una sesión anónima en cuenta permanente con email/contraseña.
   * Firebase preserva el uid y todos los datos asociados (pedidos, puntos, etc.).
   */
  convertGuestToUser: async (email: string, password: string, fullName: string): Promise<User> => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.isAnonymous) {
      throw new Error('No hay sesión de invitado activa para convertir.');
    }
    const credential = EmailAuthProvider.credential(email, password);
    const linked = await linkWithCredential(currentUser, credential);
    // Upgrade the Firestore doc: set real name, email, remove guest status
    const userDocRef = doc(db, 'users', linked.user.uid);
    await setDoc(userDocRef, { fullName, email, isGuest: false }, { merge: true });
    
    // Registrar acción en auditoría
    await loggerService.logAction('USER_CONVERTED', linked.user.uid, linked.user.uid, 'users', {
      email,
      fullName
    });

    return mapFirebaseUserToAppUser(linked.user);
  },

  // Función de administrador para crear usuario sin iniciar sesión como ellos
  createUser: async (email: string, password: string, userData: AdditionalUserData): Promise<void> => {
    // 1. Crear Usuario de Autenticación
    const firebaseUser = await createSecondaryUser(email, password);

    // 2. Crear Documento en Firestore (usando la db de la app principal, donde el Admin está autenticado)
    // Pasamos firebaseUser que tiene el nuevo uid
    await createUserDocument(firebaseUser, userData);
  },

  loginWithGoogle: async (): Promise<User> => {
    logger.log('authService: loginWithGoogle iniciando popup...');
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    await createUserDocument(userCredential.user);
    const appUser = await mapFirebaseUserToAppUser(userCredential.user);
    
    // Registrar acción en auditoría
    await loggerService.logAction('LOGIN', appUser.id, appUser.id, 'users', {
      method: 'google',
      email: appUser.email
    });

    return appUser;
  },

  handleGoogleRedirectResult: async (): Promise<boolean> => {
    // Compatibilidad en caso de que alguien siga atrapado en un flujo antiguo
    return false;
  },

  loginWithApple: async (): Promise<User> => {
    const provider = new OAuthProvider('apple.com');
    const userCredential = await signInWithPopup(auth, provider);
    await createUserDocument(userCredential.user);
    const appUser = await mapFirebaseUserToAppUser(userCredential.user);

    // Registrar acción en auditoría
    await loggerService.logAction('LOGIN', appUser.id, appUser.id, 'users', {
      method: 'apple',
      email: appUser.email
    });

    return appUser;
  },

  loginWithFacebook: async (): Promise<User> => {
    const provider = new FacebookAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    await createUserDocument(userCredential.user);
    const appUser = await mapFirebaseUserToAppUser(userCredential.user);

    // Registrar acción en auditoría
    await loggerService.logAction('LOGIN', appUser.id, appUser.id, 'users', {
      method: 'facebook',
      email: appUser.email
    });

    return appUser;
  },

  logout: async (): Promise<void> => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await loggerService.logAction('LOGOUT', currentUser.uid, currentUser.uid, 'users', {});
    }
    await firebaseSignOut(auth);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return mapFirebaseUserToAppUser(currentUser);
    }
    return null;
  },

  changePassword: async (newPassword: string): Promise<void> => {
    const user = auth.currentUser;
    if (user) {
      await firebaseUpdatePassword(user, newPassword);
    } else {
      throw new Error('No autenticado');
    }
  },

  reauthenticate: async (password: string): Promise<void> => {
    const user = auth.currentUser;
    if (user && user.email) {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } else {
      throw new Error('No autenticado o sin email');
    }
  },

  sendVerificationEmail: async (email?: string): Promise<void> => {
    const sendFn = httpsCallable(functions, 'sendVerificationEmail');
    await sendFn({ email });
  },

  resetPassword: async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  },
};