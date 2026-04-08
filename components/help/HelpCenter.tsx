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

  const handleDownload = () => {
    if (!manual) return;
    const a = document.createElement('a');
    a.href = manual.url;
    a.download = `rescatto-manual-${roleKey}.pdf`;
    a.click();
  };

  const handleOpenOnline = () => {
    if (!manual) return;
    setPdfOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <BookOpen size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900 dark:text-white text-base leading-tight">Centro de ayuda</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">{roleLabel}</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Hero + descarga */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <BookOpen size={24} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg leading-tight">Manual de {roleLabel}</h2>
              <p className="text-emerald-100 text-sm mt-1 leading-relaxed">
                Guía completa para sacar el máximo provecho de Rescatto según tu rol.
              </p>
              {manual && (
                <p className="text-emerald-200 text-xs mt-2">
                  v{manual.version} · {manual.sizeKB > 0 ? `${manual.sizeKB} KB` : 'Disponible'}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={handleDownload}
              disabled={loading || !manual}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-emerald-700 font-semibold text-sm rounded-xl hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Descargar PDF
            </button>
            <button
              onClick={handleOpenOnline}
              disabled={loading || !manual}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 text-white font-semibold text-sm rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ExternalLink size={16} />
              Ver en línea
            </button>
          </div>

          {loading && (
            <p className="text-emerald-200 text-xs mt-3 text-center">Cargando manual...</p>
          )}
          {!loading && !manual && (
            <p className="text-yellow-200 text-xs mt-3 text-center">
              El manual aún no está generado. Ejecuta <code className="bg-white/10 px-1 rounded">pnpm docs:pdf</code> para crearlo.
            </p>
          )}
        </div>

        {/* Vista en línea (iframe) */}
        {pdfOpen && manual && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <span className="font-medium text-sm text-gray-700 dark:text-slate-300">Vista previa del manual</span>
              <button
                onClick={() => setPdfOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <iframe
              ref={iframeRef}
              src={manual.url}
              title={`Manual ${roleLabel}`}
              className="w-full h-[500px]"
              onError={() => {
                // Safari bloquea iframes PDF — abre en pestaña nueva
                window.open(manual.url, '_blank', 'noopener,noreferrer');
                setPdfOpen(false);
              }}
            />
            <p className="text-xs text-gray-400 text-center py-2">
              Si el documento no carga,{' '}
              <button
                onClick={() => { window.open(manual.url, '_blank', 'noopener,noreferrer'); setPdfOpen(false); }}
                className="text-emerald-600 underline"
              >
                ábrelo en una nueva pestaña
              </button>.
            </p>
          </div>
        )}

        {/* FAQ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-gray-900 dark:text-white">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">¿Necesitas más ayuda?</h2>
          <div className="space-y-3">
            <a
              href="https://wa.me/573000000000?text=Hola%2C%20necesito%20ayuda%20con%20Rescatto"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group"
            >
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <MessageCircle size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">WhatsApp</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Respuesta rápida · Lunes a sábado</p>
              </div>
              <ExternalLink size={14} className="ml-auto text-gray-400" />
            </a>
            <a
              href="mailto:soporte@rescatto.com?subject=Soporte%20Rescatto"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group"
            >
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Mail size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">soporte@rescatto.com</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Para casos formales y reclamos</p>
              </div>
              <ExternalLink size={14} className="ml-auto text-gray-400" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
