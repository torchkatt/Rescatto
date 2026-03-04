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
  sendEmailVerification,
  signInAnonymously,
  sendPasswordResetEmail,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import app, { auth, db, functions } from './firebase';
import { User, UserRole, AdditionalUserData } from '../types';
import { initializeApp } from 'firebase/app';
import { logger } from '../utils/logger';

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
    // @ts-ignore - delete existe en FirebaseApp pero puede faltar en algunas definiciones de tipo
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
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
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
  }
};

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return mapFirebaseUserToAppUser(userCredential.user);
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
    return mapFirebaseUserToAppUser(userCredential.user);
  },

  loginAsGuest: async (): Promise<User> => {
    logger.log('authService: loginAsGuest iniciando...');
    const userCredential = await signInAnonymously(auth);
    await createUserDocument(userCredential.user, { fullName: 'Invitado', role: UserRole.CUSTOMER });
    return mapFirebaseUserToAppUser(userCredential.user);
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
    logger.log('authService: loginWithGoogle iniciando...');
    try {
      const provider = new GoogleAuthProvider();
      logger.log('authService: llamando a signInWithPopup...');
      const userCredential = await signInWithPopup(auth, provider);
      logger.log('authService: éxito en signInWithPopup:', userCredential.user.email);
      await createUserDocument(userCredential.user);
      return mapFirebaseUserToAppUser(userCredential.user);
    } catch (error: any) {
      logger.error('authService: ERROR en loginWithGoogle:', error.code, error.message);
      if (error.code === 'auth/network-request-failed') {
        logger.error('authService: Posible problema de conexión con el dominio de manejo de auth de Firebase.');
      }
      throw error;
    }
  },

  loginWithApple: async (): Promise<User> => {
    const provider = new OAuthProvider('apple.com');
    const userCredential = await signInWithPopup(auth, provider);
    await createUserDocument(userCredential.user);
    return mapFirebaseUserToAppUser(userCredential.user);
  },

  loginWithFacebook: async (): Promise<User> => {
    const provider = new FacebookAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    await createUserDocument(userCredential.user);
    return mapFirebaseUserToAppUser(userCredential.user);
  },

  logout: async (): Promise<void> => {
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