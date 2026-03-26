import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Settings as SettingsIcon, Percent, Save, RotateCw, CheckCircle } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { logger } from '../../../utils/logger';

interface PlatformSettings {
    commissionPct: number;
    deliveryCommissionPct: number;
    searchRadiusKm: number;
    maxPickupMinutes: number;
}

const DEFAULTS: PlatformSettings = {
    commissionPct: 10,
    deliveryCommissionPct: 5,
    searchRadiusKm: 5,
    maxPickupMinutes: 30,
};

const SETTINGS_DOC = 'settings/platform';

export const AdminSettings: React.FC = () => {
    const toast = useToast();
    const [form, setForm] = useState<PlatformSettings>(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, SETTINGS_DOC));
                if (snap.exists()) {
                    setForm({ ...DEFAULTS, ...snap.data() } as PlatformSettings);
                }
            } catch (err) {
                logger.error('Error loading platform settings:', err);
                toast.error('Error al cargar la configuración');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, SETTINGS_DOC), { ...form, updatedAt: new Date().toISOString() }, { merge: true });
            setSaved(true);
            toast.success('Configuración guardada correctamente');
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            logger.error('Error saving platform settings:', err);
            toast.error('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) =>
        setForm(f => ({ ...f, [k]: v }));

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 w-64 bg-gray-200 rounded-lg" />
                <div className="h-48 bg-gray-100 rounded-xl" />
                <div className="h-48 bg-gray-100 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <SettingsIcon className="text-emerald-600" />
                    Configuración de Plataforma
                </h2>
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                    Documento: {SETTINGS_DOC}
                </span>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-5 flex items-center gap-2 text-gray-800">
                    <Percent size={20} className="text-emerald-600" />
                    Tasas y Comisiones
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Comisión por Venta (%)
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={form.commissionPct}
                            onChange={e => set('commissionPct', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-1">Porcentaje que Rescatto retiene de cada venta</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Comisión por Entrega (%)
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={form.deliveryCommissionPct}
                            onChange={e => set('deliveryCommissionPct', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-1">Porcentaje adicional sobre el costo de domicilio</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-5 text-gray-800">Parámetros Generales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="font-medium text-gray-800 text-sm">Radio de búsqueda (km)</p>
                            <p className="text-xs text-gray-500">Kilómetros para mostrar negocios cercanos</p>
                        </div>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            step={0.5}
                            value={form.searchRadiusKm}
                            onChange={e => set('searchRadiusKm', parseFloat(e.target.value) || 5)}
                            className="w-20 sm:w-24 px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-xl text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="font-medium text-gray-800 text-sm">Tiempo máximo de recogida (min)</p>
                            <p className="text-xs text-gray-500">Minutos después de confirmar la orden</p>
                        </div>
                        <input
                            type="number"
                            min={5}
                            max={120}
                            step={5}
                            value={form.maxPickupMinutes}
                            onChange={e => set('maxPickupMinutes', parseInt(e.target.value) || 30)}
                            className="w-20 sm:w-24 px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-xl text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => setForm(DEFAULTS)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                    <RotateCw size={15} />
                    Restaurar defaults
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-60"
                >
                    {saved ? (
                        <><CheckCircle size={16} /> Guardado</>
                    ) : saving ? (
                        <><RotateCw size={16} className="animate-spin" /> Guardando...</>
                    ) : (
                        <><Save size={16} /> Guardar Cambios</>
                    )}
                </button>
            </div>
        </div>
    );
};
