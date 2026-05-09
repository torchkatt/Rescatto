import React, { useEffect, useState, useRef } from 'react';
import { BookOpen, Download, ExternalLink, MessageCircle, Mail, HelpCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { helpService, ManualEntry } from '../../services/helpService';
import { UserRole } from '../../types';

// FAQs por rol (inline, sin archivo externo)
const FAQ_BY_ROLE: Record<string, { q: string; a: string }[]> = {
  customer: [
    { q: '¿Qué pasa si no recojo el pedido a tiempo?', a: 'El pedido pasa a estado "No recogido". El monto pagado no se devuelve automáticamente; comunícate con el soporte para revisar tu caso.' },
    { q: '¿Puedo cancelar un pedido después de pagar?', a: 'Una vez confirmado y aceptado por el negocio, no es posible cancelarlo desde la app. Escríbele al negocio por el chat del pedido lo antes posible.' },
    { q: '¿Qué es el precio dinámico?', a: 'Es un sistema que baja el precio automáticamente a medida que se acerca la hora límite del producto. El precio en naranja indica el porcentaje de descuento activo.' },
    { q: '¿Por qué el pago fue rechazado?', a: 'Los rechazos los maneja Wompi. Las causas más comunes son fondos insuficientes o datos incorrectos. Intenta con otro método de pago o contacta tu banco.' },
    { q: '¿Los puntos vencen?', a: 'Los puntos no tienen fecha de vencimiento establecida actualmente.' },
    { q: '¿Cómo activo las notificaciones?', a: 'Ve a tu perfil → sección Notificaciones y activa el interruptor. Si ya las bloqueaste en el navegador, debes habilitarlas desde la configuración del navegador.' },
  ],
  'venue-owner': [
    { q: '¿Por qué no puedo activar un Flash Deal?', a: 'Los Flash Deals solo se pueden activar si el stock del producto es mayor a cero. Actualiza el stock primero.' },
    { q: '¿Cómo agrego personal de cocina?', a: 'El acceso de personal adicional lo configura el administrador de Rescatto. Contacta al soporte con el correo del nuevo integrante y el rol que necesitas.' },
    { q: '¿Puedo tener varios productos activos al mismo tiempo?', a: 'Sí, puedes tener tantos productos activos como quieras. Asegúrate de que las fechas límite y el stock sean correctos.' },
    { q: '¿Cómo calculo mis ganancias?', a: 'En Billetera verás el historial de transacciones con los montos netos (después de la comisión de Rescatto).' },
  ],
  'kitchen-staff': [
    { q: '¿Qué hago si no puedo preparar un pedido aceptado?', a: 'Informa al dueño del negocio de inmediato para que lo cancele. El personal de cocina no tiene permisos para cancelar pedidos.' },
    { q: '¿Qué pasa si la app se cierra?', a: 'Vuelve a iniciar sesión. Los pedidos activos se mantienen en el mismo estado. Instala Rescatto como PWA para recibir notificaciones en segundo plano.' },
  ],
  driver: [
    { q: '¿Qué hago si el cliente no está en la dirección?', a: 'Intenta comunicarte por el chat del pedido. Si no hay respuesta, contacta al soporte con el número del pedido.' },
    { q: '¿Cómo se calcula mi pago?', a: 'El pago por entrega varía según la distancia y el acuerdo con Rescatto. Consulta con el equipo si tienes preguntas sobre tu esquema de compensación.' },
  ],
  admin: [
    { q: '¿Cómo asigno un negocio a un dueño?', a: 'En Usuarios, abre el perfil del usuario, asigna el negocio en el campo correspondiente y guarda. Asegúrate también de que el rol sea VENUE_OWNER.' },
    { q: '¿Cuándo se actualizan las métricas de finanzas?', a: 'Las métricas se generan en tiempo real cada vez que abres la pantalla de finanzas, a través de la Cloud Function getFinanceStats.' },
    { q: '¿Cómo restablezco la contraseña de un usuario?', a: 'No es posible desde el panel admin. El usuario debe usar "Olvidé mi contraseña" desde la pantalla de login.' },
  ],
};

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  [UserRole.CUSTOMER]: 'Cliente',
  [UserRole.VENUE_OWNER]: 'Dueño de negocio',
  [UserRole.KITCHEN_STAFF]: 'Personal de cocina',
  [UserRole.DRIVER]: 'Domiciliario',
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.SUPER_ADMIN]: 'Super Administrador',
};

function getRoleKey(role?: UserRole): string {
  if (!role) return 'customer';
  if (role === UserRole.SUPER_ADMIN || role === UserRole.CITY_ADMIN) return 'admin';
  const map: Partial<Record<UserRole, string>> = {
    [UserRole.CUSTOMER]: 'customer',
    [UserRole.VENUE_OWNER]: 'venue-owner',
    [UserRole.KITCHEN_STAFF]: 'kitchen-staff',
    [UserRole.DRIVER]: 'driver',
    [UserRole.ADMIN]: 'admin',
  };
  return map[role] ?? 'customer';
}

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="font-medium text-sm text-gray-800 dark:text-slate-200">{q}</span>
        {open ? <ChevronUp size={16} className="shrink-0 text-gray-400" /> : <ChevronDown size={16} className="shrink-0 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 pt-2 bg-gray-50 dark:bg-slate-700/50 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
};

interface HelpCenterProps {
  /** Si se pasa, muestra un botón para cerrar (modo modal/overlay). */
  onClose?: () => void;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ onClose }) => {
  const { user } = useAuth();
  const role = user?.role;
  const roleKey = getRoleKey(role);
  const roleLabel = (role && ROLE_LABEL[role]) ?? 'Usuario';

  const [manual, setManual] = useState<ManualEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!role) { setLoading(false); return; }
    helpService.getManualForRole(role).then(entry => {
      setManual(entry);
      setLoading(false);
    });
  }, [role]);

  const faqs = FAQ_BY_ROLE[roleKey] ?? FAQ_BY_ROLE['customer'];

  const handleDownload = async () => {
    if (!manual) return;
    try {
      // Fetch → blob → object URL: funciona en iOS Safari, Android y escritorio
      const res = await fetch(manual.url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `rescatto-manual-${roleKey}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      // Fallback: abrir en pestaña nueva (iOS Safari no descarga, pero al menos abre el PDF)
      window.open(manual.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenOnline = () => {
    if (!manual) return;
    setPdfOpen(true);
  };

  return (
    <div className={`min-h-full bg-neutral-50 dark:bg-neutral-900 ${onClose ? 'pb-12' : 'pb-24'}`}>
      {/* Header - Solo se muestra si hay onClose (modo modal) */}
      {onClose && (
        <div className="bg-white dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <BookOpen size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900 dark:text-white text-base leading-tight">Centro de ayuda</h1>
              <p className="text-xs text-gray-500 dark:text-neutral-400">{roleLabel}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-xl transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${onClose ? 'py-6' : 'py-4'} space-y-8`}>

        {/* Hero + descarga - Full Width */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-10 text-white shadow-2xl shadow-emerald-900/20 relative overflow-hidden group">
          {/* Fondo decorativo */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-12">
            <div className="flex items-start gap-5 flex-1">
              <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner shrink-0">
                <BookOpen size={32} />
              </div>
              <div>
                <h2 className="font-bold text-2xl sm:text-3xl leading-tight tracking-tight">Manual de {roleLabel}</h2>
                <p className="text-emerald-50/80 text-base mt-2 leading-relaxed max-w-xl">
                  Guía interactiva diseñada para que domines todas las funciones de Rescatto y maximices tu impacto ambiental.
                </p>
                {manual && (
                  <div className="flex items-center gap-3 mt-4 text-[10px] font-bold text-emerald-100/60 uppercase tracking-[0.2em]">
                    <span className="bg-emerald-500/20 px-2 py-1 rounded-md border border-white/5">Versión {manual.version}</span>
                    <span>•</span>
                    <span>{manual.sizeKB > 0 ? `${manual.sizeKB} KB` : 'Formato PDF'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 shrink-0">
              <button
                onClick={handleDownload}
                disabled={loading || !manual}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-emerald-700 font-bold text-sm rounded-2xl hover:bg-emerald-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-black/10"
              >
                <Download size={18} />
                Descargar PDF
              </button>
              <button
                onClick={handleOpenOnline}
                disabled={loading || !manual}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500/20 text-white font-bold text-sm rounded-2xl hover:bg-emerald-500/30 border border-white/20 backdrop-blur-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExternalLink size={18} />
                Ver en línea
              </button>
            </div>
          </div>

          {loading && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-emerald-200/50 text-[10px] font-bold uppercase tracking-tighter">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" /> Sincronizando con el servidor...
            </div>
          )}
        </div>

        {/* Vista en línea (iframe) - Animada y con más altura */}
        {pdfOpen && manual && (
          <div className="bg-white dark:bg-neutral-800 rounded-3xl overflow-hidden border border-gray-200 dark:border-neutral-700 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-700/50 bg-gray-50/50 dark:bg-neutral-800/80 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-neutral-400">Previsualización Interactiva</span>
              </div>
              <button
                onClick={() => setPdfOpen(false)}
                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <iframe
              ref={iframeRef}
              src={manual.url}
              title={`Manual ${roleLabel}`}
              className="w-full h-[700px] border-none bg-neutral-100 dark:bg-neutral-900"
              onError={() => {
                window.open(manual.url, '_blank', 'noopener,noreferrer');
                setPdfOpen(false);
              }}
            />
            <div className="bg-white dark:bg-neutral-900/80 px-6 py-4 border-t border-gray-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] text-gray-400 font-medium">Desliza para navegar por el documento oficial.</p>
              <button
                onClick={() => { window.open(manual.url, '_blank', 'noopener,noreferrer'); setPdfOpen(false); }}
                className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                Abrir en pantalla completa <ExternalLink size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Layout de Rejilla para FAQ y Soporte */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Columna Izquierda: FAQ (Más ancha) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center gap-3 px-1">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <HelpCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="font-bold text-xl text-gray-900 dark:text-white">Preguntas frecuentes</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {faqs.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>

          {/* Columna Derecha: Soporte (Sidebar) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-gray-200 dark:border-neutral-700 p-6 sm:p-8 shadow-xl shadow-black/5 sticky top-24">
              <div className="mb-8">
                <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">¿No encuentras lo que buscas?</h2>
                <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2">Nuestro equipo de soporte técnico está disponible para ayudarte personalmente.</p>
              </div>

              <div className="space-y-4">
                <a
                  href="https://wa.me/573000000000?text=Hola%2C%20necesito%20ayuda%20con%20Rescatto"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-transparent hover:border-emerald-500/30 hover:bg-white dark:hover:bg-neutral-800 transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                    <MessageCircle size={24} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-gray-800 dark:text-neutral-200">WhatsApp Business</p>
                    <p className="text-[10px] text-gray-500 dark:text-neutral-500 font-bold uppercase tracking-wider mt-0.5">Atención Inmediata</p>
                  </div>
                  <ExternalLink size={16} className="text-neutral-300 dark:text-neutral-700 group-hover:text-emerald-500 transition-colors" />
                </a>

                <a
                  href="mailto:soporte@rescatto.com?subject=Soporte%20Rescatto"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-transparent hover:border-emerald-500/30 hover:bg-white dark:hover:bg-neutral-800 transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                    <Mail size={24} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-gray-800 dark:text-neutral-200">Correo Corporativo</p>
                    <p className="text-[10px] text-gray-500 dark:text-neutral-500 font-bold uppercase tracking-wider mt-0.5">Casos y Reclamos</p>
                  </div>
                  <ExternalLink size={16} className="text-neutral-300 dark:text-neutral-700 group-hover:text-emerald-500 transition-colors" />
                </a>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-neutral-700/50">
                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-neutral-500">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <HelpCircle size={14} />
                  </div>
                  <span>Horario: Lun - Sáb, 8:00 AM - 6:00 PM</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
