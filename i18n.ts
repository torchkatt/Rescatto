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
      "login_title": "Bienvenido a Rescatto",
      "login_desc": "Salva el planeta mientras ahorras",
      "featured_deals": "Ofertas Destacadas",
      "ending_soon": "Terminando Pronto",
      "all_places": "Todos los Lugares",
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
      "login_title": "Welcome to Rescatto",
      "login_desc": "Save the planet while you save money",
      "featured_deals": "Featured Deals",
      "ending_soon": "Ending Soon",
      "all_places": "All Places",
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
