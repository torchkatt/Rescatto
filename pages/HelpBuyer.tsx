import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingBag,
  Search,
  CreditCard,
  Calendar,
  Truck,
  HelpCircle,
  ChevronRight,
  CheckCircle2,
  MapPin,
  Heart,
  Bell,
  Star,
  Shield,
  Clock,
  MessageCircle,
  Mail,
  Zap,
  Gift,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface GuideStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets?: string[];
  tip?: string;
}

interface GuideSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  borderColor: string;
  steps: GuideStep[];
}

interface FaqEntry {
  q: string;
  a: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const BUYER_GUIDE: GuideSection[] = [
  {
    id: 'find-products',
    icon: <Search size={22} />,
    title: 'Cómo encontrar productos y servicios',
    subtitle: 'Descubre todo lo que Rescatto tiene para ofrecerte.',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    steps: [
      {
        icon: <Search size={20} />,
        title: '1. Explora la página principal',
        description: 'La página de inicio te muestra productos destacados, Flash Deals cerca de ti y negocios populares en tu ciudad.',
        bullets: [
          'Desplázate por las secciones: Categorías, Productos, Negocios',
          'Usa los filtros por tipo: Productos, Servicios, Digitales',
          'Los productos con precio dinámico se muestran en naranja',
        ],
      },
      {
        icon: <MapPin size={20} />,
        title: '2. Busca por ubicación',
        description: 'Rescatto te muestra productos y negocios según tu ubicación actual.',
        bullets: [
          'Toca el selector de ciudad en la barra superior',
          'Elige tu ciudad o permite la geolocalización',
          'Los resultados se ordenan por cercanía',
        ],
        tip: 'Activa la geolocalización para ver productos disponibles cerca de ti.',
      },
      {
        icon: <Zap size={20} />,
        title: '3. Encuentra Flash Deals',
        description: 'Los Flash Deals son ofertas de tiempo limitado con grandes descuentos.',
        bullets: [
          'Busca productos con la etiqueta "Flash Deal"',
          'Tienen un temporizador que muestra cuánto queda',
          'El precio baja a medida que se acerca el vencimiento',
          '¡Date prisa, las mejores ofertas se agotan rápido!',
        ],
      },
      {
        icon: <Heart size={20} />,
        title: '4. Guarda tus favoritos',
        description: 'Marca productos, negocios y vendedores como favoritos para encontrarlos fácilmente después.',
        bullets: [
          'Toca el corazón en cualquier producto o negocio',
          'Accede a tus favoritos desde el menú de navegación',
          'Recibe notificaciones cuando bajen de precio',
        ],
      },
    ],
  },
  {
    id: 'how-to-purchase',
    icon: <ShoppingBag size={22} />,
    title: 'Cómo comprar productos',
    subtitle: 'Del carrito al pago: así de fácil es comprar en Rescatto.',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    steps: [
      {
        icon: <ShoppingBag size={20} />,
        title: '1. Agrega productos al carrito',
        description: 'Cuando encuentres algo que te guste, agrégalo al carrito.',
        bullets: [
          'Toca el producto para ver los detalles',
          'Selecciona cantidad (si hay stock disponible)',
          'Toca "Agregar al carrito"',
          'El carrito solo admite productos de un negocio a la vez',
        ],
        tip: 'Revisa la fecha y hora límite del producto antes de comprar.',
      },
      {
        icon: <CreditCard size={20} />,
        title: '2. Ve al checkout',
        description: 'Cuando tengas todo listo, procede al pago.',
        bullets: [
          'Toca el ícono del carrito',
          'Revisa los productos, cantidades y precios',
          'Verifica el descuento aplicado si es precio dinámico',
          'Toca "Ir a pagar"',
        ],
      },
      {
        icon: <Truck size={20} />,
        title: '3. Elige método de entrega',
        description: 'Selecciona cómo quieres recibir tu pedido.',
        bullets: [
          'Recogida en el negocio (sin costo adicional)',
          'Entrega a domicilio (costo según distancia)',
          'Para productos digitales: acceso inmediato',
        ],
      },
      {
        icon: <Shield size={20} />,
        title: '4. Realiza el pago',
        description: 'Paga de forma segura a través de Wompi.',
        bullets: [
          'Elige tu método de pago: Tarjeta, PSE, Nequi',
          'Ingresa los datos de pago (encriptados)',
          'Confirma la compra',
          'Recibirás una confirmación por notificación y correo',
        ],
        tip: 'Guarda tus datos de pago para compras futuras más rápidas.',
      },
    ],
  },
  {
    id: 'book-services',
    icon: <Calendar size={22} />,
    title: 'Cómo reservar servicios',
    subtitle: 'Reserva servicios profesionales en pocos pasos.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    steps: [
      {
        icon: <Search size={20} />,
        title: '1. Encuentra el servicio que necesitas',
        description: 'Usa los filtros de tipo "Servicio" para ver todas las opciones disponibles.',
        bullets: [
          'Filtra por categoría de servicio',
          'Revisa las calificaciones y reseñas del vendedor',
          'Lee la descripción completa del servicio',
        ],
      },
      {
        icon: <Calendar size={20} />,
        title: '2. Elige fecha y hora',
        description: 'Selecciona el horario que mejor se adapte a ti.',
        bullets: [
          'Ve al detalle del servicio y toca "Reservar"',
          'Selecciona la fecha en el calendario',
          'Elige el horario disponible',
          'Algunos servicios permiten reservar sesiones recurrentes',
        ],
      },
      {
        icon: <CreditCard size={20} />,
        title: '3. Confirma y paga',
        description: 'Completa el pago para asegurar tu reserva.',
        bullets: [
          'Revisa los detalles: servicio, fecha, hora, precio',
          'Realiza el pago de forma segura',
          'Recibirás confirmación inmediata',
          'El vendedor confirmará la reserva',
        ],
        tip: 'Puedes reagendar con anticipación si surge algún imprevisto.',
      },
      {
        icon: <Bell size={20} />,
        title: '4. Recibe recordatorios',
        description: 'No te pierdas tu cita con las notificaciones automáticas.',
        bullets: [
          'Recordatorio 24 horas antes',
          'Recordatorio 1 hora antes',
          'Chat con el vendedor para coordinar detalles',
          'Califica el servicio después de completarlo',
        ],
      },
    ],
  },
  {
    id: 'transactions',
    icon: <Shield size={22} />,
    title: 'Cómo funcionan las transacciones',
    subtitle: 'Todo sobre pagos, seguridad y seguimiento de tus compras.',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    steps: [
      {
        icon: <Shield size={20} />,
        title: '1. Pagos seguros',
        description: 'Todas las transacciones están protegidas con encriptación de extremo a extremo.',
        bullets: [
          'Procesados por Wompi (pasarela certificada)',
          'Aceptamos Visa, Mastercard, American Express, PSE, Nequi',
          'Tus datos de pago nunca se almacenan en nuestros servidores',
          'Cada transacción tiene un ID único para seguimiento',
        ],
      },
      {
        icon: <Clock size={20} />,
        title: '2. Seguimiento del pedido',
        description: 'Sigue el estado de tu pedido en tiempo real desde la app.',
        bullets: [
          'Pendiente: el vendedor aún no ha aceptado',
          'Preparando: el vendedor está preparando tu pedido',
          'Listo: tu pedido está listo para recoger o en camino',
          'Entregado/Recogido: ¡pedido completado!',
        ],
        tip: 'Activa las notificaciones para recibir actualizaciones automáticas del estado.',
      },
      {
        icon: <Gift size={20} />,
        title: '3. Puntos y recompensas',
        description: 'Gana puntos con cada compra y desbloquea beneficios.',
        bullets: [
          'Acumulas puntos por cada compra completada',
          'Los puntos no tienen fecha de vencimiento',
          'Canjea puntos por descuentos en futuras compras',
          'Mantén tu racha de compras para multiplicadores',
        ],
      },
      {
        icon: <Star size={20} />,
        title: '4. Califica tu experiencia',
        description: 'Tu opinión ayuda a la comunidad y mejora la plataforma.',
        bullets: [
          'Califica al vendedor después de cada compra',
          'Deja reseñas detalladas (1-5 estrellas)',
          'Reporta problemas desde el chat del pedido',
          'Los vendedores con mejores calificaciones aparecen primero',
        ],
      },
    ],
  },
];

const BUYER_FAQ: FaqEntry[] = [
  {
    q: '¿Necesito registrarme para comprar?',
    a: 'Sí, necesitas una cuenta verificada para realizar compras. El registro es gratuito y toma menos de 2 minutos.',
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Aceptamos tarjetas de crédito/débito (Visa, Mastercard, American Express), PSE, Nequi y otros medios a través de Wompi.',
  },
  {
    q: '¿Cómo sé si un producto está disponible?',
    a: 'Los productos muestran el stock disponible en tiempo real. Si un producto está agotado, aparecerá como "Agotado" y no podrás agregarlo al carrito.',
  },
  {
    q: '¿Qué es el precio dinámico?',
    a: 'Es un sistema que reduce automáticamente el precio de ciertos productos a medida que se acerca su hora de vencimiento. Los productos con precio dinámico se identifican con un indicador naranja que muestra el descuento actual.',
  },
  {
    q: '¿Puedo cancelar un pedido?',
    a: 'Una vez que el pago es confirmado y el vendedor acepta el pedido, no es posible cancelarlo desde la app. Contacta al vendedor por el chat del pedido o al soporte de Rescatto.',
  },
  {
    q: '¿Qué hago si mi pedido no llega o no es lo que esperaba?',
    a: 'Comunícate primero con el vendedor a través del chat del pedido. Si no se resuelve, contacta al soporte de Rescatto con el número de pedido para iniciar un proceso de mediación.',
  },
  {
    q: '¿Cuánto cuesta el envío?',
    a: 'El costo de envío se calcula según la distancia entre el negocio y tu dirección de entrega. Verás el monto exacto antes de confirmar el pago. La recogida en el negocio es gratuita.',
  },
  {
    q: '¿Cómo reviso el historial de mis compras?',
    a: 'Ve a "Mis Pedidos" desde el menú de navegación. Ahí verás todas tus compras con su estado actual, detalles y la opción de volver a comprar.',
  },
  {
    q: '¿Qué son los puntos y cómo los uso?',
    a: 'Ganas puntos por cada compra completada. Los puntos se pueden canjear por descuentos en futuras compras. No tienen fecha de vencimiento.',
  },
  {
    q: '¿Qué hago si el pago fue rechazado?',
    a: 'Los rechazos generalmente son por fondos insuficientes o datos incorrectos. Verifica la información de tu tarjeta o intenta con otro método de pago. Si el problema persiste, contacta a tu banco.',
  },
  {
    q: '¿Cómo contacto al vendedor?',
    a: 'Cada pedido tiene un chat integrado. También puedes contactar al vendedor desde su perfil antes de comprar para hacer preguntas sobre el producto.',
  },
  {
    q: '¿Puedo comprar productos de diferentes vendedores al mismo tiempo?',
    a: 'El carrito solo admite productos de un vendedor a la vez. Para comprar de otro vendedor, completa tu pedido actual o vacía el carrito.',
  },
];

// ── Sub-components ──────────────────────────────────────────────────────────

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <span className="font-medium text-sm text-gray-800 dark:text-slate-200">{q}</span>
        <ChevronRight
          size={16}
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 pt-2 bg-gray-50 dark:bg-slate-700/50 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
};

const StepCard: React.FC<{ step: GuideStep }> = ({ step }) => (
  <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow">
    <div className="flex items-start gap-4">
      <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
        {step.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-900 dark:text-white mb-2">{step.title}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">{step.description}</p>
        {step.bullets && (
          <ul className="space-y-1.5 mb-3">
            {step.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle2 size={14} className="text-purple-500 shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {step.tip && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <Star size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">{step.tip}</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────

const HelpBuyer: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-bg dark:bg-neutral-900 pb-20">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-purple-600 to-violet-700">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-56 h-56 bg-purple-400/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <button
            onClick={() => navigate('/help')}
            className="inline-flex items-center gap-2 text-purple-100 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al Centro de Ayuda
          </button>

          <div className="flex items-start gap-5">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shrink-0">
              <ShoppingBag size={36} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-3xl sm:text-4xl text-white mb-2 tracking-tight">
                Guía para Compradores
              </h1>
              <p className="text-purple-100/80 text-base sm:text-lg max-w-2xl">
                Aprende a encontrar los mejores productos, hacer pedidos, reservar servicios y aprovechar al máximo tu experiencia en Rescatto.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">
        {/* ── Guide Sections ── */}
        {BUYER_GUIDE.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-xl ${section.bgColor} ${section.color} shrink-0`}>
                {section.icon}
              </div>
              <div>
                <h2 className="font-bold text-xl sm:text-2xl text-gray-900 dark:text-white">
                  {section.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{section.subtitle}</p>
              </div>
            </div>

            <div className="space-y-4">
              {section.steps.map((step, i) => (
                <StepCard key={i} step={step} />
              ))}
            </div>
          </section>
        ))}

        {/* ── FAQ ── */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0">
              <HelpCircle size={22} />
            </div>
            <div>
              <h2 className="font-bold text-xl sm:text-2xl text-gray-900 dark:text-white">
                Preguntas Frecuentes — Compradores
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Respuestas rápidas a tus dudas.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {BUYER_FAQ.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* ── CTA Support ── */}
        <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-3xl p-8 sm:p-10 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="inline-flex p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 mb-6">
              <MessageCircle size={32} />
            </div>
            <h2 className="font-bold text-2xl sm:text-3xl mb-3">¿Tienes más preguntas?</h2>
            <p className="text-purple-100/80 text-base max-w-lg mx-auto mb-8">
              Nuestro equipo de soporte está listo para ayudarte con lo que necesites.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://wa.me/573000000000?text=Hola%2C%20soy%20comprador%20y%20necesito%20ayuda%20con%20Rescatto"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-white text-purple-700 font-bold text-sm rounded-2xl hover:bg-purple-50 transition-all active:scale-[0.98] shadow-xl"
              >
                <MessageCircle size={18} />
                WhatsApp
              </a>
              <a
                href="mailto:soporte@rescatto.com?subject=Soporte%20Comprador%20Rescatto"
                className="flex items-center gap-2 px-6 py-3 bg-purple-500/30 text-white font-bold text-sm rounded-2xl hover:bg-purple-500/40 border border-white/20 backdrop-blur-md transition-all active:scale-[0.98]"
              >
                <Mail size={18} />
                Correo
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpBuyer;
