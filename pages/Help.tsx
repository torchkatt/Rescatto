import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingBag,
  Store,
  CreditCard,
  UserCircle,
  ShoppingCart,
  ArrowRight,
  ChevronRight,
  BookOpen,
  MessageCircle,
  Mail,
  HelpCircle,
  Shield,
  Zap,
  Users,
  Settings,
  Globe,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface HelpCategory {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  href?: string;
}

interface HelpSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  topics: { title: string; desc: string; icon: React.ReactNode }[];
}

// ── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES: HelpCategory[] = [
  {
    id: 'compradores',
    icon: <ShoppingBag size={24} />,
    title: 'Para Compradores',
    description: 'Encuentra productos, haz pedidos, reserva servicios y más.',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    href: '/help/buyer',
  },
  {
    id: 'vendedores',
    icon: <Store size={24} />,
    title: 'Para Vendedores',
    description: 'Crea tu perfil, publica productos y gestiona tus ventas.',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    href: '/help/seller',
  },
  {
    id: 'marketplace',
    icon: <Globe size={24} />,
    title: 'Marketplace',
    description: 'Cómo funciona el marketplace, tipos de productos y servicios.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    id: 'pagos',
    icon: <CreditCard size={24} />,
    title: 'Pagos',
    description: 'Métodos de pago, reembolsos, comisiones y facturación.',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  {
    id: 'cuenta',
    icon: <UserCircle size={24} />,
    title: 'Cuenta',
    description: 'Perfil, seguridad, notificaciones y configuración.',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
  },
];

const SECTIONS: HelpSection[] = [
  {
    id: 'marketplace',
    icon: <Globe size={20} />,
    title: 'Marketplace',
    description: 'Todo sobre cómo funciona el marketplace de Rescatto.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    topics: [
      {
        title: '¿Qué es el Marketplace de Rescatto?',
        desc: 'Una plataforma que conecta compradores con vendedores locales. Puedes encontrar productos físicos, servicios y productos digitales — todos en un solo lugar.',
        icon: <ShoppingBag size={18} />,
      },
      {
        title: 'Tipos de productos disponibles',
        desc: 'Ofrecemos tres categorías principales: Productos (físicos con entrega), Servicios (reservas y contrataciones) y Digitales (descargas y accesos inmediatos).',
        icon: <Zap size={18} />,
      },
      {
        title: 'Cómo funciona el precio dinámico',
        desc: 'Los precios bajan automáticamente a medida que se acerca la hora límite del producto. Mientras más esperas, más barato — pero también más riesgo de que se agote.',
        icon: <Settings size={18} />,
      },
      {
        title: 'Verificación de vendedores',
        desc: 'Todos los vendedores pasan por un proceso de verificación antes de poder publicar. Busca el distintivo de verificado en los perfiles.',
        icon: <Shield size={18} />,
      },
    ],
  },
  {
    id: 'pagos',
    icon: <CreditCard size={20} />,
    title: 'Pagos',
    description: 'Métodos de pago, reembolsos y facturación.',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    topics: [
      {
        title: 'Métodos de pago aceptados',
        desc: 'Aceptamos tarjetas de crédito y débito (Visa, Mastercard, American Express), PSE, Nequi y otros medios a través de Wompi, nuestra pasarela de pagos segura.',
        icon: <CreditCard size={18} />,
      },
      {
        title: '¿Cómo solicitar un reembolso?',
        desc: 'Si tu pedido no fue entregado o no coincide con la descripción, puedes solicitar un reembolso contactando al soporte dentro de las 48 horas posteriores a la compra.',
        icon: <Shield size={18} />,
      },
      {
        title: 'Comisiones del marketplace',
        desc: 'Rescatto cobra una comisión transparente por cada venta. Los vendedores pueden ver el desglose exacto en su panel de finanzas.',
        icon: <Settings size={18} />,
      },
    ],
  },
  {
    id: 'cuenta',
    icon: <UserCircle size={20} />,
    title: 'Cuenta',
    description: 'Perfil, seguridad y configuración.',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    topics: [
      {
        title: 'Crear y verificar tu cuenta',
        desc: 'Regístrate con tu correo electrónico, verifica tu cuenta desde el enlace que recibirás, y completa tu perfil para empezar a comprar o vender.',
        icon: <UserCircle size={18} />,
      },
      {
        title: 'Configurar notificaciones',
        desc: 'Activa las notificaciones para recibir alertas de nuevos pedidos, Flash Deals cerca de ti, y actualizaciones de estado de tus compras.',
        icon: <Settings size={18} />,
      },
      {
        title: 'Seguridad de la cuenta',
        desc: 'Usa contraseñas seguras, activa la verificación en dos pasos si está disponible, y nunca compartas tus credenciales con terceros.',
        icon: <Shield size={18} />,
      },
    ],
  },
];

// ── FAQ data for inline sections ─────────────────────────────────────────────

const GENERAL_FAQ = [
  {
    q: '¿Necesito crear una cuenta para usar Rescatto?',
    a: 'Puedes explorar como invitado, pero necesitas una cuenta verificada para comprar, vender o reservar servicios.',
  },
  {
    q: '¿En qué ciudades está disponible Rescatto?',
    a: 'Actualmente operamos en varias ciudades de Colombia. Estamos expandiéndonos constantemente. Puedes verificar la disponibilidad en tu ciudad al iniciar la app.',
  },
  {
    q: '¿Cómo contacto al soporte?',
    a: 'Puedes escribirnos por WhatsApp Business, correo electrónico a soporte@rescatto.com, o a través del chat integrado en la plataforma.',
  },
  {
    q: '¿Rescatto tiene aplicación móvil?',
    a: 'Rescatto es una PWA (Progressive Web App). Puedes instalarla en tu celular desde el navegador tocando "Agregar a pantalla de inicio".',
  },
  {
    q: '¿Es seguro comprar en Rescatto?',
    a: 'Sí. Los pagos son procesados por Wompi con encriptación de extremo a extremo. Además, todos los vendedores son verificados antes de publicar.',
  },
  {
    q: '¿Cómo puedo convertirme en vendedor?',
    a: 'Ve a la sección "Para Vendedores" o visita /help/seller para conocer los requisitos y el proceso de registro como vendedor.',
  },
  {
    q: '¿Qué es Rescatto Pass y cómo funciona?',
    a: 'Rescatto Pass es nuestra suscripción premium que te da acceso a beneficios exclusivos: envíos gratis, descuentos especiales, prioridad en reservas y acceso anticipado a Flash Deals. Puedes adquirirlo desde la sección "Mi Pass" en tu perfil.',
  },
  {
    q: '¿Cómo funcionan los puntos de impacto?',
    a: 'Ganas puntos de impacto con cada compra que realizas en la plataforma. Puedes canjearlos por recompensas como envíos gratis, descuentos y donaciones a centros sociales. Mientras más compras, más puntos acumulas y subes de nivel (Novato → Héroe → Guardián).',
  },
  {
    q: '¿Qué es RescattoBot?',
    a: 'RescattoBot es nuestro asistente con inteligencia artificial integrado en la plataforma. Puedes hacerle preguntas sobre productos, tu carrito, pedidos, finanzas y más. Busca el ícono de chat flotante en la esquina inferior derecha de la pantalla.',
  },
  {
    q: '¿Cómo funciona el programa de referidos?',
    a: 'Comparte tu código de referido único con amigos y familiares. Cuando alguien se registra con tu código y hace su primera compra, ambos reciben puntos de impacto bonus. Puedes encontrar tu código en la sección "Referidos" de tu perfil.',
  },
  {
    q: '¿Puedo cancelar mi pedido después de pagar?',
    a: 'Sí, puedes cancelar un pedido mientras esté en estado PENDIENTE. Una vez que el vendedor lo confirma, la cancelación depende de la política del vendedor. Los reembolsos se procesan a través de Wompi y pueden tomar 3-5 días hábiles.',
  },
];

// ── Sub-components ──────────────────────────────────────────────────────────

const SearchBar: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="relative max-w-2xl mx-auto">
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
      <Search size={20} className="text-gray-400" />
    </div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Busca en el centro de ayuda..."
      className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all shadow-sm"
    />
  </div>
);

const CategoryCard: React.FC<{ cat: HelpCategory; onClick?: () => void }> = ({ cat, onClick }) => (
  <div
    onClick={onClick}
    className={`
      group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700
      bg-white dark:bg-slate-800 p-6 cursor-pointer
      hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700
      transition-all duration-300
    `}
  >
    <div className={`inline-flex p-3 rounded-xl ${cat.bgColor} mb-4 group-hover:scale-110 transition-transform duration-300`}>
      <span className={cat.color}>{cat.icon}</span>
    </div>
    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{cat.title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{cat.description}</p>
    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      Explorar <ArrowRight size={14} />
    </div>
  </div>
);

const TopicCard: React.FC<{ topic: { title: string; desc: string; icon: React.ReactNode } }> = ({ topic }) => (
  <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
        {topic.icon}
      </div>
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{topic.title}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{topic.desc}</p>
      </div>
    </div>
  </div>
);

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

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}> = ({ icon, title, description, color, bgColor }) => (
  <div className="flex items-start gap-4 mb-6">
    <div className={`p-3 rounded-xl ${bgColor} ${color} shrink-0`}>{icon}</div>
    <div>
      <h2 className="font-bold text-xl text-gray-900 dark:text-white">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────

const Help: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS;
    const q = search.toLowerCase();
    return SECTIONS
      .map((s) => ({
        ...s,
        topics: s.topics.filter(
          (t) => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.topics.length > 0 || s.title.toLowerCase().includes(q));
  }, [search]);

  const filteredFaq = useMemo(() => {
    if (!search.trim()) return GENERAL_FAQ;
    const q = search.toLowerCase();
    return GENERAL_FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [search]);

  const handleCategoryClick = (cat: HelpCategory) => {
    if (cat.href) {
      navigate(cat.href);
    } else {
      const el = document.getElementById(`section-${cat.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg dark:bg-neutral-900 pb-20">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-purple-600 to-violet-700">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-6">
              <BookOpen size={16} className="text-purple-200" />
              <span className="text-xs font-bold text-purple-100 uppercase tracking-wider">Centro de Ayuda</span>
            </div>
            <h1 className="font-bold text-3xl sm:text-4xl lg:text-5xl text-white mb-4 tracking-tight">
              ¿Cómo podemos ayudarte?
            </h1>
            <p className="text-purple-100/80 text-base sm:text-lg max-w-xl mx-auto mb-8">
              Encuentra guías, tutoriales y respuestas a tus preguntas sobre Rescatto.
            </p>
            <SearchBar value={search} onChange={setSearch} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* ── Category Cards ── */}
        {search.trim() === '' && (
          <div>
            <h2 className="font-bold text-xl text-gray-900 dark:text-white mb-6">Explora por categoría</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {CATEGORIES.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  cat={cat}
                  onClick={() => handleCategoryClick(cat)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Links: Buyer / Seller ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => navigate('/help/buyer')}
            className="group relative overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10 p-6 cursor-pointer hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <ShoppingCart size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Guía para Compradores</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Aprende a encontrar productos, hacer pedidos y reservar servicios.
                </p>
              </div>
              <ArrowRight size={20} className="text-purple-400 shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => navigate('/help/seller')}
            className="group relative overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 p-6 cursor-pointer hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Store size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Guía para Vendedores</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Crea tu perfil de vendedor, publica productos y gestiona tus ventas.
                </p>
              </div>
              <ArrowRight size={20} className="text-emerald-400 shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* ── Filtered sections (used when searching) ── */}
        {filteredSections.map((section) => (
          <section key={section.id} id={`section-${section.id}`} className="scroll-mt-24">
            <SectionHeader
              icon={section.icon}
              title={section.title}
              description={section.description}
              color={section.color}
              bgColor={section.bgColor}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.topics.map((topic, i) => (
                <TopicCard key={i} topic={topic} />
              ))}
            </div>
          </section>
        ))}

        {/* ── FAQ ── */}
        {filteredFaq.length > 0 && (
          <section>
            <SectionHeader
              icon={<HelpCircle size={20} />}
              title="Preguntas Frecuentes"
              description="Respuestas rápidas a las dudas más comunes."
              color="text-purple-600"
              bgColor="bg-purple-50 dark:bg-purple-900/20"
            />
            <div className="grid grid-cols-1 gap-3">
              {filteredFaq.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </section>
        )}

        {/* ── Still need help? ── */}
        <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-3xl p-8 sm:p-10 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="inline-flex p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 mb-6">
              <MessageCircle size={32} />
            </div>
            <h2 className="font-bold text-2xl sm:text-3xl mb-3">¿Aún necesitas ayuda?</h2>
            <p className="text-purple-100/80 text-base max-w-lg mx-auto mb-8">
              Nuestro equipo de soporte está listo para ayudarte. Contáctanos por WhatsApp o correo electrónico.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://wa.me/573000000000?text=Hola%2C%20necesito%20ayuda%20con%20Rescatto"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-white text-purple-700 font-bold text-sm rounded-2xl hover:bg-purple-50 transition-all active:scale-[0.98] shadow-xl"
              >
                <MessageCircle size={18} />
                WhatsApp
              </a>
              <a
                href="mailto:soporte@rescatto.com?subject=Soporte%20Rescatto"
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

export default Help;
