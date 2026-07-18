import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  Package,
  ClipboardList,
  BadgeCheck,
  HelpCircle,
  ChevronRight,
  CheckCircle2,
  Image,
  Tag,
  Truck,
  Calendar,
  BarChart3,
  Wallet,
  Star,
  Users,
  Megaphone,
  Shield,
  CreditCard,
  MessageCircle,
  Mail,
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

const SELLER_GUIDE: GuideSection[] = [
  {
    id: 'seller-profile',
    icon: <Store size={22} />,
    title: 'Cómo crear tu perfil de vendedor',
    subtitle: 'Configura tu tienda y empieza a vender en minutos.',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    steps: [
      {
        icon: <CheckCircle2 size={20} />,
        title: '1. Solicita tu acceso como vendedor',
        description: 'Desde tu perfil, busca la opción "Convertirme en vendedor" o contacta al soporte de Rescatto para activar tu cuenta de vendedor. Un administrador revisará tu solicitud.',
        bullets: ['Ve a tu perfil → "Convertirme en vendedor"', 'Completa el formulario con tus datos', 'Espera la verificación (24-48 horas)'],
      },
      {
        icon: <Store size={20} />,
        title: '2. Configura la información de tu tienda',
        description: 'Una vez aprobado, accede al panel de vendedor y completa todos los campos de tu tienda.',
        bullets: ['Nombre de la tienda', 'Descripción (qué vendes, qué te hace especial)', 'Logo y foto de portada', 'Categorías principales de tus productos'],
        tip: 'Una descripción clara y honesta atrae más compradores. Incluye palabras clave que describan tus productos.',
      },
      {
        icon: <Image size={20} />,
        title: '3. Sube imágenes de alta calidad',
        description: 'Las imágenes son lo primero que ven los compradores. Usa fotos nítidas y bien iluminadas.',
        bullets: ['Logo: 400x400px mínimo, formato PNG o JPG', 'Portada: 1200x400px, muestra tu estilo', 'Mantén un estilo visual consistente'],
        tip: 'Las tiendas con imágenes profesionales venden hasta 3x más.',
      },
      {
        icon: <BadgeCheck size={20} />,
        title: '4. Verificación y distintivo',
        description: 'Después de completar tu perfil, recibirás el distintivo de "Vendedor Verificado" que genera confianza en los compradores.',
        bullets: ['Distintivo visible en tu perfil y productos', 'Mayor visibilidad en búsquedas', 'Acceso a funciones premium'],
      },
    ],
  },
  {
    id: 'create-listings',
    icon: <Package size={22} />,
    title: 'Cómo crear publicaciones',
    subtitle: 'Productos, servicios y contenido digital — publica lo que quieras.',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    steps: [
      {
        icon: <Package size={20} />,
        title: '1. Publicar un producto físico',
        description: 'Los productos físicos son artículos que requieren entrega o recogida.',
        bullets: [
          'Ve a tu panel → "Publicar producto"',
          'Selecciona "Producto" como tipo',
          'Sube al menos 3 fotos del producto',
          'Define el precio original y, opcionalmente, un precio con descuento',
          'Establece stock disponible y fecha/hora límite',
          'Agrega categoría y etiquetas para mejor visibilidad',
        ],
        tip: 'Los productos con precio dinámico (que baja automáticamente antes de vencer) atraen compradores urgentes.',
      },
      {
        icon: <Calendar size={20} />,
        title: '2. Publicar un servicio',
        description: 'Los servicios son actividades que ofreces: consultorías, clases, reparaciones, etc.',
        bullets: [
          'Ve a tu panel → "Publicar servicio"',
          'Selecciona "Servicio" como tipo',
          'Define la duración y horarios disponibles',
          'Establece el precio por sesión o paquete',
          'Los compradores reservan un horario directamente',
        ],
        tip: 'Agrega disponibilidad semanal para que los compradores vean tus horarios en tiempo real.',
      },
      {
        icon: <Tag size={20} />,
        title: '3. Publicar un producto digital',
        description: 'Productos digitales como ebooks, plantillas, cursos, música, etc.',
        bullets: [
          'Ve a tu panel → "Publicar producto digital"',
          'Selecciona "Digital" como tipo',
          'Sube el archivo o proporciona el enlace de acceso',
          'Define el precio (sin costo de envío)',
          'Entrega inmediata después del pago',
        ],
        tip: 'Los productos digitales no tienen costo de envío y se entregan instantáneamente.',
      },
      {
        icon: <Megaphone size={20} />,
        title: '4. Optimiza tus publicaciones',
        description: 'Consejos para que tus publicaciones destaquen y vendan más.',
        bullets: [
          'Títulos claros y descriptivos (máx. 80 caracteres)',
          'Descripciones detalladas con viñetas',
          'Fotos de alta calidad (mín. 800x800px)',
          'Precios competitivos revisando el mercado',
          'Responde preguntas de compradores rápidamente',
        ],
      },
    ],
  },
  {
    id: 'manage-orders',
    icon: <ClipboardList size={22} />,
    title: 'Cómo gestionar pedidos y reservas',
    subtitle: 'Administra tus ventas de forma eficiente.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    steps: [
      {
        icon: <ClipboardList size={20} />,
        title: '1. Panel de pedidos',
        description: 'Desde tu dashboard puedes ver todos los pedidos entrantes en tiempo real.',
        bullets: [
          'Pedidos nuevos aparecen con notificación sonora',
          'Acepta o rechaza pedidos en menos de 15 minutos',
          'Cambia el estado: Pendiente → Preparando → Listo → Entregado',
          'Comunícate con el comprador por chat integrado',
        ],
        tip: 'Responder rápido mejora tu calificación y posicionamiento.',
      },
      {
        icon: <Truck size={20} />,
        title: '2. Gestión de entregas',
        description: 'Coordina entregas de productos físicos de manera eficiente.',
        bullets: [
          'Define si ofreces entrega a domicilio o solo recogida',
          'Configura zonas de entrega y costos',
          'Los compradores verán el costo de envío al hacer checkout',
          'Marca el pedido como "Listo para recoger" cuando esté preparado',
        ],
      },
      {
        icon: <Calendar size={20} />,
        title: '3. Gestión de reservas (servicios)',
        description: 'Administra las reservas de tus servicios.',
        bullets: [
          'Recibe notificaciones de nuevas reservas',
          'Confirma o rechaza reservas según tu disponibilidad',
          'Los compradores pueden reagendar con anticipación',
          'Marca la sesión como completada después del servicio',
        ],
      },
      {
        icon: <BarChart3 size={20} />,
        title: '4. Historial y Analytics',
        description: 'Revisa el rendimiento de tus ventas para tomar mejores decisiones.',
        bullets: [
          'Dashboard con ventas del día, semana y mes',
          'Productos más vendidos y con mejor margen',
          'Horarios pico de compras',
          'Calificaciones y reseñas de compradores',
        ],
      },
    ],
  },
  {
    id: 'seller-pass',
    icon: <Star size={22} />,
    title: 'Cómo funciona el Seller Pass',
    subtitle: 'El programa de suscripción premium para vendedores.',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    steps: [
      {
        icon: <Star size={20} />,
        title: '1. ¿Qué es el Seller Pass?',
        description: 'Es una suscripción mensual que desbloquea beneficios premium para vendedores que quieren maximizar sus ventas en Rescatto.',
        bullets: [
          'Mayor visibilidad en búsquedas y categorías',
          'Comisión reducida en cada venta',
          'Publicaciones destacadas en la página principal',
          'Acceso a estadísticas avanzadas',
          'Soporte prioritario',
        ],
      },
      {
        icon: <CreditCard size={20} />,
        title: '2. Planes y precios',
        description: 'Ofrecemos planes flexibles según el tamaño de tu negocio.',
        bullets: [
          'Plan Básico (gratuito): publica hasta 10 productos, comisión estándar',
          'Plan Pro: publicaciones ilimitadas, comisión reducida, destacados semanales',
          'Plan Premium: todo lo de Pro + analytics avanzados, soporte prioritario, posición premium',
        ],
        tip: 'Puedes cambiar de plan en cualquier momento desde tu panel de vendedor.',
      },
      {
        icon: <Wallet size={20} />,
        title: '3. Cómo activarlo',
        description: 'Activar tu Seller Pass es fácil y rápido.',
        bullets: [
          'Ve a tu panel → "Seller Pass"',
          'Elige el plan que mejor se adapte a ti',
          'Ingresa tu método de pago',
          '¡Listo! Los beneficios se activan inmediatamente',
        ],
      },
    ],
  },
];

const SELLER_FAQ: FaqEntry[] = [
  {
    q: '¿Cuánto cuesta registrarse como vendedor?',
    a: 'El registro básico como vendedor es completamente gratuito. Solo pagas una comisión por cada venta realizada. El Seller Pass es opcional para acceder a beneficios premium.',
  },
  {
    q: '¿Cuánto tiempo tarda la verificación de vendedor?',
    a: 'El proceso de verificación toma entre 24 y 48 horas hábiles. Te notificaremos por correo cuando tu cuenta esté aprobada.',
  },
  {
    q: '¿Qué comisión cobra Rescatto por cada venta?',
    a: 'La comisión estándar se muestra en tu panel de finanzas. Con el Seller Pass, la comisión se reduce significativamente. Revisa los términos actualizados en tu panel.',
  },
  {
    q: '¿Cuándo recibo el pago de mis ventas?',
    a: 'Los pagos se procesan semanalmente. El monto acumulado (ventas menos comisiones) se transfiere a tu cuenta registrada. Puedes ver el historial en la sección Billetera.',
  },
  {
    q: '¿Puedo vender productos y servicios al mismo tiempo?',
    a: '¡Sí! Puedes publicar productos físicos, servicios y productos digitales desde la misma cuenta de vendedor. Cada tipo tiene su propio flujo de publicación.',
  },
  {
    q: '¿Cómo manejo las devoluciones o quejas?',
    a: 'Comunícate con el comprador a través del chat integrado para resolver el problema. Si no llegan a un acuerdo, el soporte de Rescatto puede mediar. Es importante mantener una buena calificación.',
  },
  {
    q: '¿Puedo pausar mis publicaciones?',
    a: 'Sí, puedes pausar productos individuales o poner tu tienda en "modo vacaciones" desde la configuración de tu perfil de vendedor.',
  },
  {
    q: '¿Cómo funciona el precio dinámico para vendedores?',
    a: 'Al publicar un producto, puedes activar el precio dinámico. El precio bajará automáticamente a medida que se acerca la hora límite. Tú defines el precio mínimo y la tasa de descuento.',
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
      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
        {step.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-900 dark:text-white mb-2">{step.title}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">{step.description}</p>
        {step.bullets && (
          <ul className="space-y-1.5 mb-3">
            {step.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
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

const HelpSeller: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-bg dark:bg-neutral-900 pb-20">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-56 h-56 bg-emerald-400/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <button
            onClick={() => navigate('/help')}
            className="inline-flex items-center gap-2 text-emerald-100 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al Centro de Ayuda
          </button>

          <div className="flex items-start gap-5">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shrink-0">
              <Store size={36} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-3xl sm:text-4xl text-white mb-2 tracking-tight">
                Guía para Vendedores
              </h1>
              <p className="text-emerald-100/80 text-base sm:text-lg max-w-2xl">
                Todo lo que necesitas saber para vender en Rescatto: desde crear tu perfil hasta gestionar pedidos y maximizar tus ganancias.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">
        {/* ── Guide Sections ── */}
        {SELLER_GUIDE.map((section) => (
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
                Preguntas Frecuentes — Vendedores
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Respuestas a las dudas más comunes.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {SELLER_FAQ.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* ── CTA Support ── */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 sm:p-10 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="inline-flex p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 mb-6">
              <MessageCircle size={32} />
            </div>
            <h2 className="font-bold text-2xl sm:text-3xl mb-3">¿Necesitas ayuda personalizada?</h2>
            <p className="text-emerald-100/80 text-base max-w-lg mx-auto mb-8">
              Nuestro equipo de soporte para vendedores está disponible para resolver tus dudas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://wa.me/573000000000?text=Hola%2C%20soy%20vendedor%20y%20necesito%20ayuda%20con%20Rescatto"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-700 font-bold text-sm rounded-2xl hover:bg-emerald-50 transition-all active:scale-[0.98] shadow-xl"
              >
                <MessageCircle size={18} />
                WhatsApp
              </a>
              <a
                href="mailto:soporte@rescatto.com?subject=Soporte%20Vendedor%20Rescatto"
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500/30 text-white font-bold text-sm rounded-2xl hover:bg-emerald-500/40 border border-white/20 backdrop-blur-md transition-all active:scale-[0.98]"
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

export default HelpSeller;
