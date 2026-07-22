import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { Toaster } from 'sileo';
import App from './App';
import './index.css';
import { HelmetProvider } from 'react-helmet-async';
import './i18n';
import { validateEnv } from './utils/envValidation';

validateEnv();

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  // PII scrubbing: nunca enviar email/teléfono/dirección a Sentry
  const PII_KEYS = ['email', 'phone', 'address', 'fullName', 'shippingAddress'];
  function scrubPII(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!obj) return obj;
    const clean = { ...obj };
    for (const key of PII_KEYS) delete clean[key];
    return clean;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) event.user = { id: event.user.id };
      event.breadcrumbs = event.breadcrumbs?.map((b) => ({ ...b, data: scrubPII(b.data) }));
      if (event.request) delete event.request.cookies;
      return event;
    },
  });
}

// Cuando el Service Worker se actualiza y toma control, recargar la página
// para evitar que chunks JS del caché anterior queden inconsistentes.
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true;
      window.location.reload();
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
    <Toaster position="top-right" />
  </React.StrictMode>
);