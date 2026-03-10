import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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
    <App />
  </React.StrictMode>
);