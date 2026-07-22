import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Bell, BellOff, Mail, Globe, MessageSquare, Megaphone } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';

interface NotificationPrefs {
  pushEnabled: boolean;
  emailEnabled: boolean;
  marketingEnabled: boolean;
  orderUpdates: boolean;
  promotions: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
  emailEnabled: true,
  marketingEnabled: false,
  orderUpdates: true,
  promotions: false,
};

export const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.id));
        if (!cancelled && snap.exists()) {
          const data = snap.data();
          setPrefs({
            pushEnabled: data.pushEnabled ?? true,
            emailEnabled: data.emailEnabled ?? true,
            marketingEnabled: data.marketingEnabled ?? false,
            orderUpdates: data.orderUpdates ?? true,
            promotions: data.promotions ?? false,
          });
        }
      } catch (e) {
        logger.error('Error loading notification prefs:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const togglePref = async (key: keyof NotificationPrefs) => {
    const newValue = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newValue }));
    setSaving(true);
    try {
      if (!user?.id) return;
      await updateDoc(doc(db, 'users', user.id), { [key]: newValue });
    } catch (e) {
      logger.error('Error saving pref:', e);
      setPrefs(prev => ({ ...prev, [key]: !newValue }));
      showToast('error', 'Error al guardar preferencia.');
    } finally {
      setSaving(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const toggles: { key: keyof NotificationPrefs; icon: React.ReactNode; label: string; desc: string }[] = [
    { key: 'pushEnabled', icon: <Bell size={20} />, label: 'Notificaciones Push', desc: 'Recibe alertas en tu dispositivo sobre pedidos y ofertas.' },
    { key: 'emailEnabled', icon: <Mail size={20} />, label: 'Notificaciones por Email', desc: 'Recibe resúmenes y confirmaciones por correo.' },
    { key: 'orderUpdates', icon: <MessageSquare size={20} />, label: 'Actualizaciones de Pedidos', desc: 'Notificaciones sobre cambios en el estado de tus pedidos.' },
    { key: 'promotions', icon: <Megaphone size={20} />, label: 'Promociones y Ofertas', desc: 'Enterarte de descuentos y ofertas especiales.' },
    { key: 'marketingEnabled', icon: <BellOff size={20} />, label: 'Marketing y Novedades', desc: 'Consejos, novedades y contenido sobre la plataforma.' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Notification Toggles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6">
          <Bell size={20} className="text-emerald-500" />
          Preferencias de Notificación
        </h3>
        <div className="space-y-1">
          {toggles.map(({ key, icon, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between py-4 px-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                <div className={`mt-0.5 ${prefs[key] ? 'text-emerald-500' : 'text-gray-300'}`}>
                  {icon}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                onClick={() => togglePref(key)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                  ${prefs[key] ? 'bg-emerald-500' : 'bg-gray-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                  transition duration-200 ease-in-out ${prefs[key] ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Language Preference */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Globe size={20} className="text-emerald-500" />
          Idioma
        </h3>
        <button
          onClick={toggleLanguage}
          className="flex items-center justify-between w-full py-3 px-4 rounded-xl border border-gray-200 
            hover:border-emerald-200 hover:bg-emerald-50/30 transition-all active:scale-[0.99]"
        >
          <span className="font-medium text-gray-900 text-sm">
            {i18n.language.startsWith('es') ? 'Español' : 'English'}
          </span>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            {i18n.language.startsWith('es') ? 'ES' : 'EN'}
          </span>
        </button>
        <p className="text-xs text-gray-400 mt-2 ml-1">
          Cambia el idioma de la aplicación. Algunas secciones pueden no estar traducidas.
        </p>
      </div>
    </div>
  );
};

export default NotificationPreferences;
