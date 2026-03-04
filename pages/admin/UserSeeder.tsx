import React, { useState } from 'react';
import { authService } from '../../services/authService';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { deleteDoc, doc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { UserRole } from '../../types';
import { Loader2, CheckCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { logger } from '../../utils/logger';
import { Navigate } from 'react-router-dom';

const UserSeeder: React.FC = () => {
    // SECURITY GUARD: Prevent rendering in production unless explicitly demo
    if (import.meta.env.PROD && !window.location.hostname.includes('demo')) {
        return <Navigate to="/login" replace />;
    }

    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const ROLES_CONFIG = [
        { role: UserRole.SUPER_ADMIN, prefix: 'superadmin', count: 1 },
        { role: UserRole.VENUE_OWNER, prefix: 'admin', count: 1 }, // 'admin' usualmente implica dueño del local en este contexto
        { role: UserRole.CUSTOMER, prefix: 'cliente', count: 1 },
        { role: UserRole.DRIVER, prefix: 'domicilio', count: 1 },
        { role: UserRole.KITCHEN_STAFF, prefix: 'cocina', count: 1 },
    ];

    const [actionType, setActionType] = useState<'SEED' | 'CLEANUP' | null>(null);

    const handleSeed = async () => {
        // La validación se movió al estado de la UI

        setLoading(true);
        setLogs([]);
        addLog('🚀 Iniciando proceso de siembra...');

        try {
            // Necesitamos cerrar sesión primero para evitar conflictos si ya hay un usuario autenticado
            await authService.logout();

            // Fetch venues first to assign a real venueId
            let realVenueId = 'default-venue';
            try {
                const venuesSnapshot = await getDocs(collection(db, 'venues'));
                if (!venuesSnapshot.empty) {
                    realVenueId = venuesSnapshot.docs[0].id;
                    addLog(`📍 Sede asignada para personal: ${venuesSnapshot.docs[0].data().name} (${realVenueId})`);
                } else {
                    addLog('⚠️ No se encontraron sedes. Se usará "default-venue".');
                }
            } catch (err) {
                logger.error("Error fetching venues:", err);
            }

            for (const config of ROLES_CONFIG) {
                addLog(`\n--- Creando ${config.count} usuarios para rol: ${config.role} ---`);

                for (let i = 1; i <= config.count; i++) {
                    const email = `${config.prefix}${i}@test.com`;
                    const password = 'clave123';
                    const name = `${config.prefix.toUpperCase()} ${i}`;

                    // Assign venueId only to relevant roles
                    const additionalData: any = { isVerified: true };

                    if (config.role === UserRole.VENUE_OWNER || config.role === UserRole.KITCHEN_STAFF) {
                        additionalData.venueId = realVenueId;
                        additionalData.venueIds = [realVenueId]; // Also set array for compatibility
                    }

                    try {
                        addLog(`Creating ${email}...`);
                        await authService.register(email, password, name, config.role, additionalData);
                        addLog(`✅ Created: ${email}`);

                        // Cerrar sesión inmediatamente para preparar el siguiente usuario
                        await authService.logout();

                    } catch (error: any) {
                        logger.error(error);
                        if (error.code === 'auth/email-already-in-use') {
                            addLog(`⚠️ Ya existe: ${email}`);
                        } else {
                            addLog(`❌ Error creating ${email}: ${error.code}`);
                        }
                    }

                    // Añadir retraso para prevenir límites de tasa (auth/too-many-requests)
                    await new Promise(resolve => setTimeout(resolve, 3500));
                }
            }

            addLog('\n✨ Proceso finalizado.');

        } catch (error: any) {
            addLog(`❌ Error general: ${error.message}`);
        } finally {
            setLoading(false);
            setActionType(null); // Reset action
        }
    };

    // NUEVA FUNCIÓN DE LIMPIEZA
    const handleCleanup = async () => {
        setLoading(true);
        setLogs([]);
        addLog('🧹 Iniciando limpieza COMPLETA...');

        try {
            // 1. ELIMINAR SOLO USUARIOS DE PRUEBA DE FIRESTORE
            addLog('\n🔥 Eliminando usuarios de prueba (@test.com) en Firestore...');
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);

            if (snapshot.empty) {
                addLog('⚠️ No se encontraron usuarios en la base de datos.');
            } else {
                let deletedCount = 0;
                const deletePromises = snapshot.docs.map(async (docSnap) => {
                    const userData = docSnap.data();
                    const email = userData.email || '';

                    // CHEQUEO DE SEGURIDAD: SOLO ELIMINAR SI EL EMAIL TERMINA EN @test.com
                    if (email.endsWith('@test.com')) {
                        await deleteDoc(doc(db, 'users', docSnap.id));
                        deletedCount++;
                        return docSnap.id;
                    }
                    return null;
                });

                await Promise.all(deletePromises);
                addLog(`✅ ${deletedCount} perfiles de prueba eliminados (se conservaron ${snapshot.size - deletedCount} reales).`);

                if (deletedCount === 0) {
                    addLog('ℹ️ No había usuarios de prueba para borrar.');
                }
            }

            // 2. ELIMINAR CUENTAS DE AUTH (Solo Usuarios de Prueba)
            addLog('\n🔐 Eliminando cuentas de Autenticación (Solo Test)...');
            await authService.logout();

            for (const config of ROLES_CONFIG) {
                for (let i = 1; i <= config.count; i++) {
                    const email = `${config.prefix}${i}@test.com`;
                    const password = 'clave123';

                    try {
                        // Iniciar sesión como el usuario
                        const userCredential = await signInWithEmailAndPassword(auth, email, password);
                        // Eliminar el usuario de Auth
                        await userCredential.user.delete();
                        addLog(`🗑️ Auth Deleted: ${email}`);
                    } catch (error: any) {
                        // Ignorar si el usuario no existe (ya fue borrado o nunca existió)
                        if (error.code !== 'auth/user-not-found' && error.code !== 'auth/invalid-credential') {
                            addLog(`⚠️ Auth Error (${email}): ${error.code}`);
                        }
                    }
                }
            }
            addLog('\n✨ Limpieza finalizada.');
        } catch (error: any) {
            logger.error(error);
            addLog(`❌ Error crítico: ${error.message}`);
        } finally {
            setLoading(false);
            setActionType(null); // Reset action
        }
    };

    const executeAction = () => {
        if (actionType === 'SEED') {
            handleSeed();
        } else if (actionType === 'CLEANUP') {
            handleCleanup();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-mono text-sm">
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gray-900 px-6 py-4 flex justify-between items-center text-white">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <RefreshCw /> User Seeder Utility (v1.1)
                    </h1>
                </div>

                <div className="p-6">
                    <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div className="flex">
                            <AlertCircle className="h-5 w-5 text-yellow-400" />
                            <div className="ml-3">
                                <p className="text-sm text-yellow-700">
                                    <strong>Precaución:</strong> Esta herramienta crea 5 usuarios de prueba.
                                    <br />
                                    La contraseña por defecto será: <code>clave123</code>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-6">
                        {!actionType ? (
                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={() => setActionType('SEED')}
                                    disabled={loading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md active:scale-95"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <RefreshCw size={20} />}
                                    {loading ? 'Creando Usuarios...' : 'Iniciar Siembra de Usuarios'}
                                </button>

                                <button
                                    onClick={() => setActionType('CLEANUP')}
                                    disabled={loading}
                                    className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Trash2 size={20} />}
                                    Limpiar Usuarios de Prueba
                                </button>
                            </div>
                        ) : (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center animate-fadeIn w-full">
                                <h3 className="text-lg font-bold text-red-800 mb-2">
                                    {actionType === 'SEED' ? '¿Iniciar Siembra?' : '¿Eliminar TODO?'}
                                </h3>
                                <p className="text-red-600 mb-6 text-sm">
                                    {actionType === 'SEED'
                                        ? 'Esto cerrará tu sesión actual y creará 5 usuarios nuevos.'
                                        : 'ESTO ELIMINARÁ PERMANENTEMENTE TODAS LAS CUENTAS DE PRUEBA.'}
                                    <br />
                                    {actionType === 'SEED' ? 'Asegúrate de haber borrado los usuarios antiguos.' : 'Esta acción no se puede deshacer.'}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    <button
                                        onClick={() => setActionType(null)}
                                        className="w-full sm:w-auto px-8 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all active:scale-95 order-2 sm:order-1"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={executeAction}
                                        className="w-full sm:w-auto px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg active:scale-95 order-1 sm:order-2"
                                    >
                                        {actionType === 'SEED' ? 'Sí, ¡DALE! 🚀' : 'Sí, ELIMINAR TODO 🗑️'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs">
                        {logs.length === 0 ? (
                            <p className="text-gray-500 italic">Esperando iniciar...</p>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className={`${log.includes('✅') ? 'text-green-400' : log.includes('❌') ? 'text-red-400' : 'text-gray-300'} mb-1`}>
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserSeeder;
