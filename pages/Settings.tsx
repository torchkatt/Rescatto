import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import { Save, Zap, Building, Clock, Loader2, Store, Lock, Truck } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Venue } from '../types';
import { logger } from '../utils/logger';

const Settings: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [venue, setVenue] = useState<Venue | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Estado de Configuración - Sincronizado con el Comercio o valores por defecto locales
    const [dynamicPricingEnabled, setDynamicPricingEnabled] = useState(true);
    const [discountRate, setDiscountRate] = useState(30);
    const [triggerTime, setTriggerTime] = useState(30);

    // Estado del Formulario
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        closingTime: '',
        phone: ''
    });

    // Estado de configuración de domicilios
    const [deliveryConfig, setDeliveryConfig] = useState({
        isEnabled: false,
        baseFee: 3000,
        pricePerKm: 500,
        maxDistance: 10,
        freeDeliveryThreshold: 0,
        minOrderAmount: 0,
    });

    const [password, setPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    const handleChangePassword = async () => {
        if (!password || password.length < 6) {
            showToast('error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setChangingPassword(true);
        try {
            await authService.changePassword(password);
            showToast('success', 'Contraseña actualizada correctamente');
            setPassword('');
        } catch (error: any) {
            logger.error(error);
            showToast('error', `Error: ${error.message}`);
        } finally {
            setChangingPassword(false);
        }
    };

    useEffect(() => {
        if (user?.venueId) {
            loadVenue(user.venueId);
        }
    }, [user]);

    const loadVenue = async (venueId: string) => {
        setLoading(true);
        try {
            const data = await dataService.getVenue(venueId);
            if (data) {
                setVenue(data);
                setFormData({
                    name: data.name,
                    address: data.address,
                    city: data.city || '',
                    closingTime: data.closingTime,
                    phone: data.phone || ''
                });
                // Cargar configuración de domicilio si existe
                if (data.deliveryConfig) {
                    setDeliveryConfig({
                        isEnabled: data.deliveryConfig.isEnabled ?? false,
                        baseFee: data.deliveryConfig.baseFee ?? 3000,
                        pricePerKm: data.deliveryConfig.pricePerKm ?? 500,
                        maxDistance: data.deliveryConfig.maxDistance ?? 10,
                        freeDeliveryThreshold: data.deliveryConfig.freeDeliveryThreshold ?? 0,
                        minOrderAmount: data.deliveryConfig.minOrderAmount ?? 0,
                    });
                }
            }
        } catch (error) {
            logger.error('Error loading venue:', error);
            showToast('error', 'Error al cargar datos del comercio');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!venue || !user?.venueId) return;

        setIsSaving(true);
        try {
            await dataService.updateVenue(user.venueId, {
                name: formData.name,
                address: formData.address,
                city: formData.city,
                closingTime: formData.closingTime,
                phone: formData.phone,
                deliveryConfig: {
                    isEnabled: deliveryConfig.isEnabled,
                    baseFee: deliveryConfig.baseFee,
                    pricePerKm: deliveryConfig.pricePerKm,
                    maxDistance: deliveryConfig.maxDistance,
                    freeDeliveryThreshold: deliveryConfig.freeDeliveryThreshold || undefined,
                    minOrderAmount: deliveryConfig.minOrderAmount || undefined,
                },
            });
            showToast('success', 'Configuración guardada correctamente');
            // Recargar para asegurar la sincronización
            loadVenue(user.venueId);
        } catch (error) {
            logger.error('Error saving settings:', error);
            showToast('error', 'Error al guardar cambios');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center  h-96">
                <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
        );
    }

    if (!venue) {
        return (
            <div className="text-center p-12">
                <Store size={48} className="mx-auto text-gray-300 mb-4" />
                <h2 className="text-xl font-bold text-gray-700">No se encontró información del comercio</h2>
                <p className="text-gray-500">Contacta a soporte si crees que es un error.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuración del Comercio</h1>
                <p className="text-gray-500">Gestiona tus preferencias de venta y automatización.</p>
            </div>

            {/* Motor de Precios Dinámicos - Configuración de Característica Estrella */}
            <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Zap size={24} className="text-yellow-300" />
                        </div>
                        <h2 className="text-xl font-bold">Dynamic Pricing Engine (IA)</h2>
                    </div>
                    <p className="text-purple-100 text-sm max-w-2xl">
                        Nuestro algoritmo ajusta automáticamente los precios de tus productos excedentes basándose en la hora de cierre para maximizar la venta y reducir el desperdicio a cero.
                    </p>
                </div>

                <div className="p-8 space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-bold text-gray-900 block">Activar Precios Dinámicos</label>
                            <p className="text-sm text-gray-500">Permitir que Rescatto reduzca precios automáticamente.</p>
                        </div>
                        <button
                            onClick={() => setDynamicPricingEnabled(!dynamicPricingEnabled)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all active:scale-95 ${dynamicPricingEnabled ? 'bg-purple-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${dynamicPricingEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {dynamicPricingEnabled && (
                        <div className="bg-purple-50 rounded-xl p-6 space-y-6 border border-purple-100">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold text-gray-700">Descuento Agresivo (%)</label>
                                    <span className="text-sm font-bold text-purple-700">{discountRate}% OFF</span>
                                </div>
                                <input
                                    type="range" min="10" max="70" value={discountRate}
                                    onChange={(e) => setDiscountRate(Number(e.target.value))}
                                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                                <p className="text-xs text-gray-500 mt-1">Porcentaje extra de descuento sobre el precio ya rebajado.</p>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold text-gray-700">Activación (Minutos antes del cierre)</label>
                                    <span className="text-sm font-bold text-purple-700">{triggerTime} min</span>
                                </div>
                                <input
                                    type="range" min="15" max="120" step="15" value={triggerTime}
                                    onChange={(e) => setTriggerTime(Number(e.target.value))}
                                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                                <p className="text-xs text-gray-500 mt-1">Cuándo debe activarse el descuento agresivo.</p>
                            </div>

                            <div className="flex items-start gap-2 text-xs text-purple-800 bg-white p-3 rounded border border-purple-100">
                                <Clock size={14} className="mt-0.5" />
                                <p>
                                    <strong>Simulación:</strong> Si cierras a las {formData.closingTime}, a las <strong>{new Date(new Date().setHours(21, 30)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> tus productos bajarán un {discountRate}% adicional.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Configuración General */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                    <Building className="text-gray-400" />
                    <h2 className="text-lg font-bold text-gray-900">Perfil del Comercio</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Local</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Física</label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                        <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none font-medium"
                            placeholder="Ej. Bogotá"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Cierre (Corte)</label>
                        <input
                            type="time"
                            value={formData.closingTime}
                            onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                            className="w-full border border-gray-100 bg-gray-50 appearance-none rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono Contacto</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Configuración de Domicilios */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Truck size={24} className="text-white" />
                        </div>
                        <h2 className="text-xl font-bold">Configuración de Domicilios</h2>
                    </div>
                    <p className="text-blue-100 text-sm max-w-2xl">
                        Activa el servicio de domicilio para que los clientes puedan recibir sus pedidos a domicilio. Configura tarifas y radio de entrega.
                    </p>
                </div>

                <div className="p-8 space-y-6">
                    {/* Toggle principal */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-bold text-gray-900 block">Activar Domicilios</label>
                            <p className="text-sm text-gray-500">Permite a los clientes elegir entrega a domicilio.</p>
                        </div>
                        <button
                            onClick={() => setDeliveryConfig(d => ({ ...d, isEnabled: !d.isEnabled }))}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all active:scale-95 ${deliveryConfig.isEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${deliveryConfig.isEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {deliveryConfig.isEnabled && (
                        <div className="bg-blue-50 rounded-xl p-6 space-y-5 border border-blue-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Tarifa Base (COP)</label>
                                    <input
                                        type="number" min="0" step="500"
                                        value={deliveryConfig.baseFee}
                                        onChange={e => setDeliveryConfig(d => ({ ...d, baseFee: Number(e.target.value) }))}
                                        className="w-full border border-blue-200 bg-white rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Costo fijo base del domicilio.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Precio por km (COP)</label>
                                    <input
                                        type="number" min="0" step="100"
                                        value={deliveryConfig.pricePerKm}
                                        onChange={e => setDeliveryConfig(d => ({ ...d, pricePerKm: Number(e.target.value) }))}
                                        className="w-full border border-blue-200 bg-white rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Costo adicional por cada kilómetro.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Radio Máximo (km)</label>
                                    <input
                                        type="number" min="1" max="50"
                                        value={deliveryConfig.maxDistance}
                                        onChange={e => setDeliveryConfig(d => ({ ...d, maxDistance: Number(e.target.value) }))}
                                        className="w-full border border-blue-200 bg-white rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Distancia máxima de entrega desde el negocio.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">
                                        Envío Gratis desde (COP) <span className="font-normal text-gray-400">(opcional)</span>
                                    </label>
                                    <input
                                        type="number" min="0" step="1000"
                                        value={deliveryConfig.freeDeliveryThreshold}
                                        onChange={e => setDeliveryConfig(d => ({ ...d, freeDeliveryThreshold: Number(e.target.value) }))}
                                        className="w-full border border-blue-200 bg-white rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium"
                                        placeholder="0 = sin umbral"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Pedidos sobre este monto tienen domicilio gratis (0 = desactivado).</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">
                                        Pedido Mínimo (COP) <span className="font-normal text-gray-400">(opcional)</span>
                                    </label>
                                    <input
                                        type="number" min="0" step="1000"
                                        value={deliveryConfig.minOrderAmount}
                                        onChange={e => setDeliveryConfig(d => ({ ...d, minOrderAmount: Number(e.target.value) }))}
                                        className="w-full border border-blue-200 bg-white rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-medium"
                                        placeholder="0 = sin mínimo"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Monto mínimo de pedido para aplicar domicilio (0 = sin mínimo).</p>
                                </div>
                            </div>

                            {/* Simulación */}
                            <div className="flex items-start gap-2 text-xs text-blue-800 bg-white p-3 rounded border border-blue-100">
                                <Truck size={14} className="mt-0.5 shrink-0" />
                                <p>
                                    <strong>Simulación:</strong> Para un cliente a 3km, el domicilio costaría{' '}
                                    <strong>${(deliveryConfig.baseFee + deliveryConfig.pricePerKm * 3).toLocaleString('es-CO')} COP</strong>.
                                    {deliveryConfig.freeDeliveryThreshold > 0 && (
                                        <> Envío gratis si el pedido supera <strong>${deliveryConfig.freeDeliveryThreshold.toLocaleString('es-CO')} COP</strong>.</>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {!deliveryConfig.isEnabled && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-500 flex items-center gap-3">
                            <Truck size={18} className="text-gray-300" />
                            <p>Los domicilios están desactivados. Los clientes solo podrán elegir <strong>Recoger en tienda</strong> o <strong>Donar</strong>.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Configuración de Seguridad */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                    <Lock className="text-gray-400" />
                    <h2 className="text-lg font-bold text-gray-900">Seguridad</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="flex-1 border border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none font-medium"
                            />
                            <button
                                onClick={handleChangePassword}
                                disabled={!password || changingPassword}
                                className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all whitespace-nowrap active:scale-95 shadow-md shadow-gray-200"
                            >
                                {changingPassword ? 'Actualizando...' : 'Actualizar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-center sm:justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 active:scale-95 text-lg"
                >
                    {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
        </div>
    );
};

export default Settings;