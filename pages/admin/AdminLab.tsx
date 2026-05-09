
import React, { useState, useEffect } from 'react';
import { 
    collection, 
    getDocs, 
    doc, 
    deleteDoc, 
    writeBatch, 
    setDoc, 
    serverTimestamp,
    query,
    where,
    limit,
    orderBy,
    onSnapshot
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserRole, Product, Venue } from '../../types';
import { 
    Beaker, 
    Zap, 
    Trash2, 
    Database, 
    Users, 
    Store, 
    Truck, 
    AlertTriangle, 
    RefreshCw, 
    ShieldAlert,
    Terminal as TerminalIcon,
    ChevronRight,
    Play,
    CheckCircle2,
    XCircle,
    Info
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Button } from '../../components/customer/common/Button';
import { logger } from '../../utils/logger';

// --- CONFIGURACIÓN DE SIEMBRA ---
const CITIES = ['Bucaramanga', 'Bogotá', 'Medellín'];
const CATEGORIES = [
    { name: 'Restaurantes', subcategories: ['Corrientazo', 'Gourmet', 'Comida Rápida', 'Vegetariano'] },
    { name: 'Panadería', subcategories: ['Panes', 'Postres', 'Cafetería'] },
    { name: 'Mercados', subcategories: ['Frutas y Verduras', 'Lácteos', 'Carnes'] }
];

const AdminLab: React.FC = () => {
    const toast = useToast();
    const confirm = useConfirm();
    const [loading, setLoading] = useState(false);
    const [isEmergencyMode, setIsEmergencyMode] = useState(false);
    const [logs, setLogs] = useState<{msg: string, type: 'info' | 'success' | 'error' | 'warn'}[]>([]);
    const [stats, setStats] = useState({
        users: 0,
        venues: 0,
        products: 0,
        orders: 0
    });

    // Escuchar estadísticas e interruptor de emergencia
    useEffect(() => {
        const unsubUsers = onSnapshot(collection(db, 'users'), s => setStats(prev => ({ ...prev, users: s.size })));
        const unsubVenues = onSnapshot(collection(db, 'venues'), s => setStats(prev => ({ ...prev, venues: s.size })));
        const unsubProducts = onSnapshot(collection(db, 'products'), s => setStats(prev => ({ ...prev, products: s.size })));
        const unsubOrders = onSnapshot(collection(db, 'orders'), s => setStats(prev => ({ ...prev, orders: s.size })));
        
        const unsubLab = onSnapshot(doc(db, 'settings', 'lab'), (s) => {
            if (s.exists()) {
                setIsEmergencyMode(s.data().emergencyDeleteMode || false);
            }
        });

        return () => {
            unsubUsers();
            unsubVenues();
            unsubProducts();
            unsubOrders();
            unsubLab();
        };
    }, []);

    const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
        setLogs(prev => [{ msg, type }, ...prev].slice(0, 50));
    };

    const runSurgicalCleanup = async () => {
        if (!isEmergencyMode) {
            toast.error('Acceso denegado: Primero debes abrir la bóveda de seguridad.');
            addLog('⚠️ Intento de limpieza fallido: Bóveda cerrada.', 'error');
            return;
        }

        const isConfirmed = await confirm({
            title: '☢️ OPERACIÓN QUIRÚRGICA: LIMPIEZA TOTAL',
            message: '¿Estás ABSOLUTAMENTE seguro? Se borrarán todos los negocios, productos, pedidos, chats y personal. Esta acción es irreversible.',
            confirmLabel: 'SÍ, EJECUTAR LIMPIEZA',
            variant: 'danger'
        });

        if (!isConfirmed) return;

        setLoading(true);
        addLog('🚀 Iniciando limpieza quirúrgica...', 'warn');

        try {
            const collections = [
                'venues', 'products', 'orders', 'chats', 'notifications', 
                'flash_deals', 'wallets', 'wallet_transactions', 'audit_logs'
            ];

            for (const colName of collections) {
                const snap = await getDocs(collection(db, colName));
                addLog(`Eliminando ${snap.size} documentos de "${colName}"...`);
                
                const chunks = [];
                for (let i = 0; i < snap.docs.length; i += 500) {
                    chunks.push(snap.docs.slice(i, i + 500));
                }

                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
            }

            // Limpieza selectiva de usuarios
            const usersSnap = await getDocs(collection(db, 'users'));
            let deletedUsers = 0;
            const userBatch = writeBatch(db);
            usersSnap.docs.forEach(d => {
                const role = d.data().role;
                if (role !== 'CUSTOMER' && role !== 'SUPER_ADMIN') {
                    userBatch.delete(d.ref);
                    deletedUsers++;
                }
            });
            await userBatch.commit();
            
            // AUTO-CERRAR BÓVEDA
            await setDoc(doc(db, 'settings', 'lab'), { emergencyDeleteMode: false }, { merge: true });
            
            addLog(`✅ Limpieza completada. ${deletedUsers} usuarios eliminados. Bóveda cerrada.`, 'success');
            toast.success('Limpieza completada y seguridad restablecida');
        } catch (error: any) {
            addLog(`❌ Error: ${error.message}`, 'error');
            toast.error('Error durante la limpieza');
        } finally {
            setLoading(false);
        }
    };

    const toggleEmergencyMode = async () => {
        try {
            const newValue = !isEmergencyMode;
            await setDoc(doc(db, 'settings', 'lab'), { emergencyDeleteMode: newValue }, { merge: true });
            addLog(`🔐 Bóveda de seguridad ${newValue ? 'ABIERTA' : 'CERRADA'}.`, newValue ? 'warn' : 'info');
            toast.success(newValue ? 'Modo Emergencia ACTIVADO' : 'Modo Emergencia DESACTIVADO');
        } catch (err: any) {
            toast.error('No tienes permiso para cambiar la seguridad.');
        }
    };

    const runDemoSeed = async () => {
        setLoading(true);
        addLog('🌱 Iniciando siembra de datos de prueba (15 negocios, 150 productos, 9 domiciliarios)...', 'info');

        try {
            // 1. Crear categorías base
            for (const cat of CATEGORIES) {
                await setDoc(doc(db, 'product_categories', cat.name.toLowerCase()), {
                    name: cat.name,
                    subcategories: cat.subcategories,
                    isActive: true,
                    createdAt: serverTimestamp()
                });
            }

            for (const city of CITIES) {
                const citySlug = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                addLog(`📍 Procesando ciudad: ${city}...`);

                // 2. Crear 3 Drivers por ciudad
                for (let i = 1; i <= 3; i++) {
                    const driverId = `driver.${citySlug}.${i}`;
                    const email = `${driverId}@rescatto.com`;
                    await setDoc(doc(db, 'users', driverId), {
                        fullName: `Driver ${city} ${i}`,
                        email,
                        role: 'DRIVER',
                        city,
                        status: 'active',
                        isVerified: true,
                        verificationDate: serverTimestamp(),
                        createdAt: serverTimestamp()
                    });
                }

                // 3. Crear 5 Venues por ciudad
                for (let v = 1; v <= 5; v++) {
                    const venueId = `sede.${citySlug}.${v}`;
                    const ownerId = `dueno.${citySlug}.${v}`;
                    const ownerEmail = `${ownerId}@rescatto.com`;
                    
                    // Dueño
                    await setDoc(doc(db, 'users', ownerId), {
                        fullName: `Dueño ${city} ${v}`,
                        email: ownerEmail,
                        role: 'VENUE_OWNER',
                        venueId,
                        venueIds: [venueId],
                        status: 'active',
                        isVerified: true,
                        verificationDate: serverTimestamp(),
                        createdAt: serverTimestamp()
                    });

                    // Sede
                    const catIndex = (CITIES.indexOf(city) + v) % CATEGORIES.length;
                    const categoryObj = CATEGORIES[catIndex];
                    
                    await setDoc(doc(db, 'venues', venueId), {
                        name: `${categoryObj.name.slice(0, -1)} ${city} ${v}`,
                        description: `Experiencia premium de ${categoryObj.name.toLowerCase()} en el corazón de ${city}.`,
                        city,
                        address: `Cl. ${10 + v} # ${20 + v}, ${city}`,
                        category: categoryObj.name,
                        image: `https://images.unsplash.com/photo-${1500000000000 + (v * 100)}?auto=format&fit=crop&w=800&q=80`,
                        rating: 4.0 + (Math.random()),
                        isOpen: true,
                        createdAt: serverTimestamp(),
                        settings: {
                            acceptanceTime: 10,
                            preparationTime: 20
                        }
                    });

                    // 4. Crear 10 Productos
                    const batch = writeBatch(db);
                    for (let p = 1; p <= 10; p++) {
                        const isRescue = p <= 3;
                        const productId = `${venueId}_p${p}`;
                        const subcat = categoryObj.subcategories[p % categoryObj.subcategories.length];
                        
                        batch.set(doc(db, 'products', productId), {
                            venueId,
                            name: isRescue ? `Pack Rescate: ${subcat}` : `${subcat} Premium`,
                            description: isRescue 
                                ? 'Pack sorpresa con excedentes frescos del día. ¡Salva este alimento!' 
                                : 'Nuestro producto estrella, preparado con los mejores ingredientes.',
                            price: 30000,
                            discountedPrice: isRescue ? 12000 : 30000,
                            isRescue,
                            category: categoryObj.name,
                            subcategory: subcat,
                            quantity: 15,
                            image: isRescue 
                                ? 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'
                                : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
                            isActive: true,
                            createdAt: serverTimestamp()
                        });
                    }
                    await batch.commit();
                }
            }

            addLog('✨ Siembra de datos completada con éxito.', 'success');
            toast.success('Siembra completada');
        } catch (error: any) {
            addLog(`❌ Error: ${error.message}`, 'error');
            toast.error('Error durante la siembra');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                        <Beaker size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Super Admin Lab</h1>
                        <p className="text-slate-500 font-medium">Panel de Control de Emergencia y Pruebas</p>
                    </div>
                </div>

                <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border-2 transition-all ${
                    isEmergencyMode ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-white border-slate-200'
                }`}>
                    <div className="flex flex-col items-end">
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${isEmergencyMode ? 'text-red-600' : 'text-slate-400'}`}>
                            {isEmergencyMode ? 'SEGURIDAD DESACTIVADA' : 'BÓVEDA PROTEGIDA'}
                        </span>
                        <span className="text-sm font-bold text-slate-700">Modo de Emergencia</span>
                    </div>
                    <button 
                        onClick={toggleEmergencyMode}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            isEmergencyMode ? 'bg-red-600' : 'bg-slate-200'
                        }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isEmergencyMode ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            </header>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Usuarios', value: stats.users, icon: <Users size={20} />, color: 'bg-blue-500' },
                    { label: 'Negocios', value: stats.venues, icon: <Store size={20} />, color: 'bg-emerald-500' },
                    { label: 'Productos', value: stats.products, icon: <Zap size={20} />, color: 'bg-amber-500' },
                    { label: 'Pedidos', value: stats.orders, icon: <Truck size={20} />, color: 'bg-indigo-500' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className={`${stat.color} p-3 rounded-xl text-white`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">{stat.label}</p>
                            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Control Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-6">
                            <Database className="text-indigo-600" size={24} />
                            <h2 className="text-xl font-bold text-slate-800">Gestión de Datos Maestros</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                        <Trash2 size={20} />
                                    </div>
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase">Crítico</span>
                                </div>
                                <h3 className="font-bold text-slate-800 mb-1">Limpieza Quirúrgica</h3>
                                <p className="text-sm text-slate-500 mb-4">Borra TODO excepto clientes reales y super-admins.</p>
                                <Button 
                                    variant="outline" 
                                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={runSurgicalCleanup}
                                    isLoading={loading}
                                >
                                    Ejecutar Limpieza
                                </Button>
                            </div>

                            <div className="p-5 border border-slate-200 rounded-2xl hover:border-emerald-300 transition-colors group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                        <RefreshCw size={20} />
                                    </div>
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full uppercase">Demo</span>
                                </div>
                                <h3 className="font-bold text-slate-800 mb-1">Siembra de Datos (15/150)</h3>
                                <p className="text-sm text-slate-500 mb-4">Crea negocios, productos y drivers en BGA, BOG y MED.</p>
                                <Button 
                                    variant="outline" 
                                    className="w-full border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                    onClick={runDemoSeed}
                                    isLoading={loading}
                                >
                                    Iniciar Siembra
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-6">
                            <Zap className="text-indigo-600" size={24} />
                            <h2 className="text-xl font-bold text-slate-800">Simulador de Pedidos</h2>
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center">
                            <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Play className="text-slate-400 translate-x-0.5" />
                            </div>
                            <h4 className="font-bold text-slate-700">Módulo en Construcción</h4>
                            <p className="text-sm text-slate-500 max-w-xs mx-auto">Próximamente podrás generar flujos de pedidos completos para probar notificaciones y estados.</p>
                        </div>
                    </section>
                </div>

                {/* Console Log Area */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden h-[600px] flex flex-col border border-slate-800">
                        <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700">
                            <div className="flex items-center gap-2 text-slate-300">
                                <TerminalIcon size={16} />
                                <span className="text-xs font-bold font-mono">LAB_LOG_STREAM</span>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
                            {logs.length === 0 && (
                                <div className="text-slate-600 italic">Esperando comandos...</div>
                            )}
                            {logs.map((log, i) => (
                                <div key={i} className={`mb-2 flex gap-2 ${
                                    log.type === 'error' ? 'text-red-400' :
                                    log.type === 'success' ? 'text-emerald-400' :
                                    log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                                }`}>
                                    <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                                    <span>{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 p-5 bg-amber-50 border border-amber-100 rounded-2xl flex gap-4">
                        <ShieldAlert className="text-amber-600 shrink-0" size={24} />
                        <div>
                            <h5 className="font-bold text-amber-900 text-sm">Credenciales de Prueba</h5>
                            <p className="text-xs text-amber-700 leading-normal mt-1">
                                Todos los usuarios creados usan la clave: <strong>clave123</strong>.
                                <br />Estructura: <code>dueno.ciudad.X@rescatto.com</code> y <code>driver.ciudad.X@rescatto.com</code>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLab;
