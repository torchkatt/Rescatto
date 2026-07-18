import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, 
  Bot, 
  CreditCard, 
  BadgeCheck, 
  BarChart3, 
  Smartphone,
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Star, 
  Zap,
  ShoppingBag,
  Package,
  TrendingUp,
  Shield,
  Globe,
  Mail,
  Phone,
  MapPin,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/common/Logo';

// ── Config ───────────────────────────────────────────────────────────────────
const BRAND = '#059669'; // Primary purple
const BRAND_LIGHT = '#34d399';
const BRAND_DARK = '#047857';

// ── Section Wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{ id?: string; className?: string; children: React.ReactNode }> = ({ 
  id, className = '', children 
}) => (
  <section id={id} className={`py-20 lg:py-28 ${className}`}>
    <div className="max-w-7xl mx-auto px-6 lg:px-8">
      {children}
    </div>
  </section>
);

// ── Glass Card ───────────────────────────────────────────────────────────────
const GlassCard: React.FC<{ className?: string; children: React.ReactNode; hover?: boolean }> = ({
  className = '', children, hover = true
}) => (
  <div className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 lg:p-8 
    ${hover ? 'hover:bg-white/10 hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300' : ''} 
    ${className}`}>
    {children}
  </div>
);

// ── Gradient Text ────────────────────────────────────────────────────────────
const GradientText: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '', children
}) => (
  <span className={`bg-gradient-to-r from-emerald-400 via-emerald-300 to-green-400 bg-clip-text text-transparent ${className}`}>
    {children}
  </span>
);

// ── Animated Pill ────────────────────────────────────────────────────────────
const Pill: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '', children
}) => (
  <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full 
    bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium 
    backdrop-blur-sm ${className}`}>
    {children}
  </span>
);

// ── CTA Button Variants ──────────────────────────────────────────────────────
const PrimaryCTA: React.FC<{ onClick?: () => void; href?: string; className?: string; children: React.ReactNode }> = ({
  onClick, href, className = '', children
}) => {
  const Comp = onClick ? 'button' : 'a';
  return (
    <Comp
      {...(onClick ? { onClick } : { href })}
      className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl 
        bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold text-base
        shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/40 
        hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ${className}`}
    >
      {children}
      <ArrowRight size={18} />
    </Comp>
  );
};

const OutlineCTA: React.FC<{ onClick?: () => void; className?: string; children: React.ReactNode }> = ({
  onClick, className = '', children
}) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl 
      border-2 border-white/20 text-white font-bold text-base
      hover:bg-white/5 hover:border-emerald-400/40 
      hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ${className}`}
  >
    {children}
  </button>
);

// ── FAQ Item ─────────────────────────────────────────────────────────────────
const FAQItem: React.FC<{ question: string; children: React.ReactNode }> = ({ question, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm bg-white/[0.02]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.05] transition-colors"
      >
        <span className="font-semibold text-white text-lg pr-4">{question}</span>
        {open ? (
          <ChevronUp size={20} className="text-emerald-400 shrink-0" />
        ) : (
          <ChevronDown size={20} className="text-emerald-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-300 leading-relaxed animate-fade-in-up">
          {children}
        </div>
      )}
    </div>
  );
};

// ── Feature Card ─────────────────────────────────────────────────────────────
const FeatureCard: React.FC<{
  icon: React.ReactNode; title: string; description: string; delay?: number;
}> = ({ icon, title, description, delay = 0 }) => (
  <GlassCard className="text-center animate-fade-in-up" hover>
    <div 
      className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 
        flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-emerald-400">
        {icon}
      </div>
    </div>
    <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
    <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
  </GlassCard>
);

// ── Step Card ────────────────────────────────────────────────────────────────
const StepCard: React.FC<{
  number: number; title: string; description: string; icon: React.ReactNode;
}> = ({ number, title, description, icon }) => (
  <div className="flex flex-col items-center text-center group">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 
      border border-emerald-500/30 flex items-center justify-center mb-5 
      group-hover:scale-110 group-hover:border-emerald-400/50 transition-all duration-300">
      <div className="text-emerald-400">
        {icon}
      </div>
    </div>
    <div className="mb-3 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 
      flex items-center justify-center text-emerald-300 font-bold text-sm">
      {number}
    </div>
    <h4 className="text-white font-bold text-lg mb-2">{title}</h4>
    <p className="text-gray-400 text-sm leading-relaxed max-w-xs">{description}</p>
  </div>
);

// ── Pricing Card ─────────────────────────────────────────────────────────────
const PricingCard: React.FC<{
  name: string; price: string; period: string; description: string; 
  features: string[]; highlighted?: boolean; ctaText?: string; onCta?: () => void;
}> = ({ name, price, period, description, features, highlighted, ctaText = 'Empezar', onCta }) => (
  <div className={`relative rounded-2xl p-8 border transition-all duration-300
    ${highlighted 
      ? 'bg-gradient-to-b from-emerald-500/20 to-emerald-900/40 border-emerald-500/40 scale-105 z-10 shadow-2xl shadow-emerald-500/20' 
      : 'backdrop-blur-xl bg-white/[0.03] border-white/10 hover:border-emerald-500/30 hover:-translate-y-1'
    }`}>
    {highlighted && (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <Pill><Star size={12} fill="currentColor" /> Más Popular</Pill>
      </div>
    )}
    <h3 className={`text-xl font-bold mb-1 ${highlighted ? 'text-emerald-200' : 'text-white'}`}>
      {name}
    </h3>
    <p className="text-gray-400 text-sm mb-6">{description}</p>
    <div className="mb-6">
      <span className={`text-5xl font-black ${highlighted ? 'text-white' : 'text-emerald-300'}`}>
        {price}
      </span>
      {period && <span className="text-gray-400 text-sm ml-1">/{period}</span>}
    </div>
    <button
      onClick={onCta}
      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.98]
        ${highlighted
          ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl'
          : 'border border-white/20 text-white hover:bg-white/5'
        }`}
    >
      {ctaText}
    </button>
    <ul className="mt-8 space-y-3">
      {features.map((f, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <Check size={16} className={`mt-0.5 shrink-0 ${highlighted ? 'text-emerald-300' : 'text-emerald-400'}`} />
          <span className="text-gray-300">{f}</span>
        </li>
      ))}
    </ul>
  </div>
);

// ── Testimonial Card ─────────────────────────────────────────────────────────
const TestimonialCard: React.FC<{
  name: string; role: string; quote: string; avatar: string;
}> = ({ name, role, quote, avatar }) => (
  <GlassCard className="text-center" hover>
    <div className="flex justify-center mb-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
      ))}
    </div>
    <p className="text-gray-300 text-sm leading-relaxed mb-5 italic">"{quote}"</p>
    <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 
      mx-auto mb-3 flex items-center justify-center text-emerald-300 font-bold text-lg">
      {avatar}
    </div>
    <p className="text-white font-bold text-sm">{name}</p>
    <p className="text-gray-400 text-xs">{role}</p>
  </GlassCard>
);

// ── Navbar ───────────────────────────────────────────────────────────────────
const Navbar: React.FC<{ onLogin: () => void; onStart: () => void }> = ({ onLogin, onStart }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 
              flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg">
              <Logo size="sm" className="brightness-0 invert" iconColor="#fff" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Rescatto</span>
          </a>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">Cómo Funciona</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">Precios</a>
            <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors font-medium">FAQ</a>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <button 
              onClick={onLogin}
              className="text-sm font-semibold text-gray-400 hover:text-white transition-colors px-4 py-2"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={onStart}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 
                text-white text-sm font-bold shadow-lg shadow-emerald-500/20 
                hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 
                active:scale-[0.98] transition-all duration-200"
            >
              Comenzar Gratis
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden text-white p-2"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-white/5 bg-black/90 backdrop-blur-xl animate-fade-in-up">
          <div className="px-6 py-4 space-y-3">
            <a href="#features" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-400 hover:text-white">Features</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-400 hover:text-white">Cómo Funciona</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-400 hover:text-white">Precios</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="block py-2 text-gray-400 hover:text-white">FAQ</a>
            <div className="pt-3 space-y-2 border-t border-white/5">
              <button onClick={onLogin} className="w-full py-3 rounded-xl border border-white/20 text-white font-bold text-sm">
                Iniciar Sesión
              </button>
              <button onClick={onStart} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold text-sm">
                Comenzar Gratis
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

// ── Footer ───────────────────────────────────────────────────────────────────
const LandingFooter: React.FC = () => (
  <footer className="bg-black/80 border-t border-white/5 py-16">
    <div className="max-w-7xl mx-auto px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center shadow-lg">
              <Logo size="sm" className="brightness-0 invert" iconColor="#fff" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Rescatto</span>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm mb-6">
            La plataforma que conecta negocios con compradores inteligentes. 
            Reduce desperdicios, aumenta ganancias y construye un futuro sostenible.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
              <Globe size={18} />
            </a>
            <a href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
              <Mail size={18} />
            </a>
            <a href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
              <Phone size={18} />
            </a>
          </div>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-white font-bold text-sm mb-4">Producto</h4>
          <ul className="space-y-2.5">
            {['Features', 'Precios', 'Seller Pass', 'Wompi Pagos', 'PWA App'].map((l) => (
              <li key={l}><a href="#" className="text-gray-400 text-sm hover:text-white transition-colors">{l}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold text-sm mb-4">Empresa</h4>
          <ul className="space-y-2.5">
            {['Sobre Nosotros', 'Blog', 'Contacto', 'Términos', 'Privacidad'].map((l) => (
              <li key={l}><a href="#" className="text-gray-400 text-sm hover:text-white transition-colors">{l}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-gray-500 text-xs">© {new Date().getFullYear()} Rescatto. Todos los derechos reservados.</p>
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <MapPin size={12} />
          <span>Colombia</span>
        </div>
      </div>
    </div>
  </footer>
);

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN LANDING COMPONENT ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const goToLogin = () => navigate('/login');
  const goToApp = () => navigate(user && !user.isGuest ? '/app' : '/login?mode=register');

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <Navbar onLogin={goToLogin} onStart={goToApp} />

      {/* ════════════════════════════════════════════════════════════
          ── HERO SECTION ───────────────────────────────────────────
          ════════════════════════════════════════════════════════════ */}
      <Section className="pt-32 lg:pt-44 pb-16 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-600/10 rounded-full blur-[150px]" />
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        </div>

        <div className="relative z-10">
          {/* Badge */}
          <div className="flex justify-center mb-8 animate-fade-in-up">
            <Pill>
              <Zap size={14} className="text-emerald-400" />
              Plataforma #1 en Colombia
            </Pill>
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6">
              Conectamos tu{' '}
              <GradientText>negocio</GradientText>
              <br />
              con compradores{' '}
              <GradientText>inteligentes</GradientText>
            </h1>
            <p className="text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
              La plataforma marketplace que transforma excedentes en ganancias. 
              Paga con Wompi, vende con Seller Pass, y crece con IA — todo en un solo lugar.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <PrimaryCTA onClick={goToApp}>
              Comenzar Gratis
            </PrimaryCTA>
            <OutlineCTA onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              Ver Features
            </OutlineCTA>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            {[
              { value: '500+', label: 'Negocios Activos' },
              { value: '50K+', label: 'Productos Vendidos' },
              { value: '₿', label: 'Pagos con Wompi' },
              { value: '4.9', label: 'Calificación Promedio' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl lg:text-4xl font-black bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-gray-500 text-xs font-medium mt-1 uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════
          ── FEATURES SECTION ──────────────────────────────────────
          ════════════════════════════════════════════════════════════ */}
      <Section id="features" className="bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent">
        <div className="text-center mb-16">
          <Pill className="mb-4"><Zap size={14} /> Features</Pill>
          <h2 className="text-4xl lg:text-5xl font-black mb-4">
            Todo lo que necesitas para{' '}
            <GradientText>vender y comprar</GradientText>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Una plataforma completa con las herramientas que tu negocio merece.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Store size={26} />}
            title="Marketplace Inteligente"
            description="Publica productos, servicios y contenido digital. Tu negocio visible para miles de compradores en Colombia."
          />
          <FeatureCard
            icon={<Bot size={26} />}
            title="RescattoBot IA"
            description="Asistente con IA que ayuda a compradores a encontrar lo que buscan y a vendedores a optimizar sus precios."
          />
          <FeatureCard
            icon={<CreditCard size={26} />}
            title="Pagos con Wompi"
            description="Procesa pagos seguros con Wompi. Tarjetas, PSE, Nequi — tus clientes pagan como prefieran."
          />
          <FeatureCard
            icon={<BadgeCheck size={26} />}
            title="Seller Pass"
            description="Suscripción premium para vendedores con analytics avanzados, productos ilimitados y soporte prioritario."
          />
          <FeatureCard
            icon={<BarChart3 size={26} />}
            title="Analytics en Tiempo Real"
            description="Dashboard con métricas de ventas, tráfico, conversión y tendencias. Toma decisiones con datos reales."
          />
          <FeatureCard
            icon={<Smartphone size={26} />}
            title="PWA Multiplataforma"
            description="Instala Rescatto en tu celular como una app nativa. Funciona offline y envía notificaciones push."
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════
          ── HOW IT WORKS ──────────────────────────────────────────
          ════════════════════════════════════════════════════════════ */}
      <Section id="how-it-works">
        <div className="text-center mb-16">
          <Pill className="mb-4"><TrendingUp size={14} /> Cómo Funciona</Pill>
          <h2 className="text-4xl lg:text-5xl font-black mb-4">
            Simple para <GradientText>todos</GradientText>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Ya sea que vendas o compres, empezar toma menos de 5 minutos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Sellers */}
          <div>
            <h3 className="text-2xl font-bold text-center mb-10">
              <span className="bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                Para Vendedores
              </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <StepCard
                number={1}
                icon={<Store size={24} />}
                title="Crea tu Tienda"
                description="Registra tu negocio en minutos. Sube productos, configura precios y elige tu ubicación."
              />
              <StepCard
                number={2}
                icon={<Package size={24} />}
                title="Publica Productos"
                description="Agrega fotos, descripciones y precios. Nuestra IA sugiere el precio óptimo para maximizar ventas."
              />
              <StepCard
                number={3}
                icon={<TrendingUp size={24} />}
                title="Vende y Crece"
                description="Recibe pedidos, procesa pagos con Wompi y accede a analytics para optimizar tu estrategia."
              />
            </div>
          </div>

          {/* Buyers */}
          <div>
            <h3 className="text-2xl font-bold text-center mb-10">
              <span className="bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                Para Compradores
              </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <StepCard
                number={1}
                icon={<MapPin size={24} />}
                title="Explora Cerca"
                description="Encuentra productos cerca de ti. Filtra por categoría, precio y distancia."
              />
              <StepCard
                number={2}
                icon={<ShoppingBag size={24} />}
                title="Compra Fácil"
                description="Agrega al carrito y paga con Wompi. Múltiples métodos de pago disponibles."
              />
              <StepCard
                number={3}
                icon={<Shield size={24} />}
                title="Recibe y Disfruta"
                description="Seguimiento de pedido en tiempo real. Califica tu experiencia y gana puntos de impacto."
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════
          ── PRICING SECTION ───────────────────────────────────────
          ════════════════════════════════════════════════════════════ */}
      <Section id="pricing" className="bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent">
        <div className="text-center mb-16">
          <Pill className="mb-4"><BadgeCheck size={14} /> Seller Pass</Pill>
          <h2 className="text-4xl lg:text-5xl font-black mb-4">
            Planes que se adaptan a{' '}
            <GradientText>tu negocio</GradientText>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Desde comenzar gratis hasta desbloquear todo el potencial de tu tienda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <PricingCard
            name="Free"
            price="$0"
            period="mes"
            description="Empieza a vender hoy, paga solo cuando vendes."
            features={[
              'Productos ilimitados',
              '10% comisión por venta',
              'Perfil de tienda público',
              'Estadísticas básicas',
              'Soporte por email',
              'Sin suscripción mensual',
            ]}
            ctaText="Comenzar Gratis"
            onCta={goToApp}
          />
          <PricingCard
            name="Seller Pass"
            price="$49.900"
            period="mes"
            description="Para vendedores que venden consistentemente."
            highlighted
            features={[
              'Todo lo de Free',
              '5% comisión por venta (ahorra 50%)',
              'Productos destacados en búsqueda',
              'Analytics avanzados',
              'Soporte prioritario 24/7',
              'Badge de verificado',
            ]}
            ctaText="Elegir Seller Pass"
            onCta={goToApp}
          />
          <PricingCard
            name="Seller Pass Anual"
            price="$499.900"
            period="año"
            description="Ahorra 2 meses al pagar el año completo."
            features={[
              'Todo lo de Seller Pass Mensual',
              '5% comisión por venta',
              'Equivale a $41.658/mes',
              'Multi-sucursal',
              'Reportes personalizados',
              'Facturación electrónica',
            ]}
            ctaText="Elegir Anual"
            onCta={goToApp}
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════
          ── TESTIMONIALS ──────────────────────────────────────────
          ════════════════════════════════════════════════════════════ */}
      <Section>
        <div className="text-center mb-16">
          <Pill className="mb-4"><Star size={14} fill="currentColor" /> Testimonios</Pill>
          <h2 className="text-4xl lg:text-5xl font-black mb-4">
            Lo que dicen nuestros{' '}
            <GradientText>usuarios</GradientText>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Negocios y compradores reales que ya transformaron su experiencia con Rescatto.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TestimonialCard
            name="María García"
            role="Dueña de Panadería"
            quote="Rescatto nos ayudó a vender el pan que nos sobraba al final del día. Ahora tenemos un 40% menos de desperdicio."
            avatar="MG"
          />
          <TestimonialCard
            name="Carlos Rodríguez"
            role="Comprador Frecuente"
            quote="Encuentro productos frescos a mitad de precio. La app es súper fácil de usar y los pagos con Wompi son inmediatos."
            avatar="CR"
          />
          <TestimonialCard
            name="Laura Martínez"
            role="Dueña de Restaurante"
            quote="Con Seller Pass Pro duplicamos nuestras ventas en 3 meses. El dashboard de analytics es increíble."
            avatar="LM"
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════
          ── CTA BANNER ────────────────────────────────────────────
          ════════════════════════════════════════════════════════════ */}
      <Section>
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-green-700 p-12 lg:p-16 text-center">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <h2 className="text-3xl lg:text-4xl font-black mb-4">
              ¿Listo para transformar tu negocio?
            </h2>
            <p className="text-emerald-100 max-w-lg mx-auto mb-8 text-lg">
              Únete a más de 500 negocios que ya están reduciendo desperdicios y aumentando sus ganancias con Rescatto.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={goToApp}
                className="px-8 py-4 rounded-xl bg-white text-emerald-700 font-bold text-base
                  shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] 
                  transition-all duration-200 inline-flex items-center gap-2"
              >
                Crear Cuenta Gratis
                <ArrowRight size={18} />
              </button>
              <button
                onClick={goToLogin}
                className="px-8 py-4 rounded-xl border-2 border-white/30 text-white font-bold text-base
                  hover:bg-white/10 hover:border-white/50 hover:-translate-y-0.5 
                  active:scale-[0.98] transition-all duration-200"
              >
                Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════
          ── FAQ SECTION ───────────────────────────────────────────
          ════════════════════════════════════════════════════════════ */}
      <Section id="faq" className="bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent">
        <div className="text-center mb-16">
          <Pill className="mb-4">FAQ</Pill>
          <h2 className="text-4xl lg:text-5xl font-black mb-4">
            Preguntas <GradientText>Frecuentes</GradientText>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Todo lo que necesitas saber sobre Rescatto.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          <FAQItem question="¿Qué es Rescatto?">
            Rescatto es una plataforma marketplace colombiana que conecta negocios locales con compradores inteligentes. 
            Los negocios pueden vender sus excedentes, productos frescos, servicios y contenido digital a precios competitivos. 
            Los compradores encuentran grandes ofertas mientras ayudan a reducir el desperdicio.
          </FAQItem>
          <FAQItem question="¿Cómo funcionan los pagos con Wompi?">
            Wompi es la pasarela de pagos oficial de Rescatto. Aceptamos tarjetas de crédito/débito, PSE, Nequi, 
            Bancolombia y otros métodos. Los pagos son procesados de forma segura y los vendedores reciben 
            sus fondos directamente en su cuenta Wompi.
          </FAQItem>
          <FAQItem question="¿Qué incluye el plan gratuito?">
            El plan Free te permite publicar hasta 10 productos activos con 1 foto cada uno, acceder a estadísticas 
            básicas de ventas, tener tu perfil de tienda público y recibir soporte por email. Es ideal para 
            probar la plataforma sin ningún compromiso.
          </FAQItem>
          <FAQItem question="¿Puedo cancelar Seller Pass en cualquier momento?">
            Sí. Todos los planes de Seller Pass se renuevan mensualmente y puedes cancelar en cualquier momento 
            desde la configuración de tu cuenta. Si cancelas, mantendrás los beneficios hasta el final del 
            período de facturación actual.
          </FAQItem>
          <FAQItem question="¿Rescatto tiene app móvil?">
            Rescatto es una PWA (Progressive Web App). Puedes instalarla en tu celular desde el navegador 
            (Chrome o Safari) y funciona como una app nativa: acceso rápido desde tu pantalla de inicio, 
            notificaciones push y funcionamiento offline básico.
          </FAQItem>
          <FAQItem question="¿Qué comisiones cobra Rescatto?">
            En el plan Free, Rescatto cobra una comisión del 10% por venta. Con Seller Pass Pro, 
            la comisión se reduce al 5%. Con Seller Pass Enterprise, no hay comisiones adicionales 
            — solo pagas la suscripción mensual.
          </FAQItem>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════
          ── FOOTER ────────────────────────────────────────────────
          ════════════════════════════════════════════════════════════ */}
      <LandingFooter />
    </div>
  );
};

export default Landing;
