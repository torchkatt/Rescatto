import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  plugins: [
    react(),
    ...(process.env.ANALYZE === 'true' ? [visualizer({ open: true, gzipSize: true, brotliSize: true })] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Rescatto',
        short_name: 'Rescatto',
        description: 'La plataforma definitiva para gestionar tu negocio con Rescatto. Controla pedidos, inventario y métricas en tiempo real.',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        categories: ['business', 'productivity', 'food'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        screenshots: [
          {
            src: 'screenshot-desktop.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Dashboard Principal de Rescatto'
          },
          {
            src: 'screenshot-mobile.png',
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Monitorización en tiempo real'
          }
        ]
      },
      workbox: {
        // Pre-cache the app shell so it loads instantly offline
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Skip Firestore/Auth SDK files from pre-cache (too large, not useful offline)
        globIgnores: ['**/firebase/**', '**/node_modules/**'],

        runtimeCaching: [
          // 1. Firebase Firestore & Auth API → NetworkFirst: always fresh when online, fallback to cache
          {
            urlPattern: /^https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }, // 5 min — Firebase API data changes frequently
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 2. Cloud Functions API → NetworkFirst
          {
            urlPattern: /^https:\/\/us-central1-.+\.cloudfunctions\.net\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cloud-functions-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 }, // 1 h
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 3. Picsum / external images → StaleWhileRevalidate: show cached, update in background
          {
            urlPattern: /^https:\/\/picsum\.photos\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 4. Firebase Storage (product images) → CacheFirst: images don't change often
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 5. Google Fonts → CacheFirst
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, // 1 year
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          recharts: ['recharts'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react']
        }
      }
    }
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  }
});