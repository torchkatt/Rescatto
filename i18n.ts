import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importaciones de traducciones (pueden moverse a archivos JSON después)
const resources = {
  es: {
    translation: {
      "app_name": "Rescatto",
      "home": "Inicio",
      "explore": "Explorar",
      "impact": "Impacto",
      "profile": "Perfil",
      "orders": "Pedidos",
      
      // Login & Auth
      "login_title_register": "Crear cuenta",
      "login_title_welcome": "Bienvenido de nuevo",
      "login_desc_register": "Elige tu tipo de cuenta para empezar.",
      "login_desc_welcome": "Accede al panel de control de tu negocio.",
      "login_role_customer": "Soy Usuario",
      "login_role_business": "Soy Negocio",
      "login_fullname": "Nombre Completo",
      "login_fullname_ph": "Ej. Ana García",
      "login_referral": "Código de Referido",
      "login_optional": "(Opcional)",
      "login_email": "Correo Electrónico",
      "login_email_ph": "nombre@empresa.com",
      "login_password": "Contraseña",
      "login_password_ph": "••••••••",
      "login_confirm_password": "Confirmar Contraseña",
      "login_forgot_pwd": "¿Olvidaste tu contraseña?",
      "login_btn_register": "Crear Cuenta",
      "login_btn_login": "Iniciar Sesión",
      "login_continue_with": "O continúa con",
      "login_btn_guest": "Explorar como invitado",
      "login_has_account_q": "¿Ya tienes una cuenta?",
      "login_no_account_q": "¿Aún no tienes cuenta?",
      "login_link_login": "Inicia Sesión",
      "login_link_register": "Regístrate aquí",
      
      // Customer Home
      "hello": "¡Hola, {{name}}!",
      "welcome": "¡Bienvenido!",
      "home_subtitle": "Descubre los mejores rescates hoy",
      "streak_days": "Días",
      "my_points": "Mis Puntos",
      "search_placeholder": "Busca tu restaurante o pack favorito...",
      
      // Categories
      "cat_all": "Todos",
      "cat_italian": "Italiana",
      "cat_japanese": "Japonesa",
      "cat_american": "Americana",
      "cat_french": "Francesa",
      "cat_healthy": "Saludable",
      "cat_bakery": "Panadería",
      
      // Sections
      "featured_deals": "Ofertas Destacadas",
      "ending_soon": "Terminando Pronto",
      "limited": "Limitado",
      "see_all": "Ver Todo",
      "all_places": "Todos los Lugares",
      "surprise_pack": "Pack Sorpresa",
      "view_pack": "Ver Pack",
      "no_places_title": "No encontramos lugares",
      "no_places_desc": "Intenta ajustar tus filtros de búsqueda o explorar otras categorías para encontrar rescates deliciosos.",

      // Others
      "checkout_title": "Finalizar Compra",
      "total_pay": "Total a Pagar",
      "confirm_order": "Confirmar Pedido",
      "impact_title": "Tu Impacto Positivo",
      "co2_saved": "CO2 Evitado",
      "money_saved": "Dinero Ahorrado",
      "settings_title": "Configuración",
      "language": "Idioma",
      "notifications": "Notificaciones",
      "logout": "Cerrar Sesión",
      "recommended_for_you": "Recomendados para ti ✨",
      "ai_selected": "IA Seleccionado"
    }
  },
  en: {
    translation: {
      "app_name": "Rescatto",
      "home": "Home",
      "explore": "Explore",
      "impact": "Impact",
      "profile": "Profile",
      "orders": "Orders",
      
      // Login & Auth
      "login_title_register": "Create account",
      "login_title_welcome": "Welcome back",
      "login_desc_register": "Choose your account type to start.",
      "login_desc_welcome": "Access your business dashboard.",
      "login_role_customer": "I'm a Customer",
      "login_role_business": "I'm a Business",
      "login_fullname": "Full Name",
      "login_fullname_ph": "e.g. John Doe",
      "login_referral": "Referral Code",
      "login_optional": "(Optional)",
      "login_email": "Email Address",
      "login_email_ph": "name@company.com",
      "login_password": "Password",
      "login_password_ph": "••••••••",
      "login_confirm_password": "Confirm Password",
      "login_forgot_pwd": "Forgot your password?",
      "login_btn_register": "Create Account",
      "login_btn_login": "Sign In",
      "login_continue_with": "Or continue with",
      "login_btn_guest": "Explore as a guest",
      "login_has_account_q": "Already have an account?",
      "login_no_account_q": "Don't have an account yet?",
      "login_link_login": "Sign In",
      "login_link_register": "Register here",
      
      // Customer Home
      "hello": "Hello, {{name}}!",
      "welcome": "Welcome!",
      "home_subtitle": "Discover the best rescues today",
      "streak_days": "Days",
      "my_points": "My Points",
      "search_placeholder": "Search your favorite restaurant or pack...",
      
      // Categories
      "cat_all": "All",
      "cat_italian": "Italian",
      "cat_japanese": "Japanese",
      "cat_american": "American",
      "cat_french": "French",
      "cat_healthy": "Healthy",
      "cat_bakery": "Bakery",
      
      // Sections
      "featured_deals": "Featured Deals",
      "ending_soon": "Ending Soon",
      "limited": "Limited",
      "see_all": "See All",
      "all_places": "All Places",
      "surprise_pack": "Surprise Pack",
      "view_pack": "View Pack",
      "no_places_title": "No places found",
      "no_places_desc": "Try adjusting your search filters or explore other categories to find delicious rescues.",

      // Others
      "checkout_title": "Checkout",
      "total_pay": "Total to Pay",
      "confirm_order": "Confirm Order",
      "impact_title": "Your Positive Impact",
      "co2_saved": "CO2 Saved",
      "money_saved": "Money Saved",
      "settings_title": "Settings",
      "language": "Language",
      "notifications": "Notifications",
      "logout": "Logout",
      "recommended_for_you": "Recommended for you ✨",
      "ai_selected": "AI Selected"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
