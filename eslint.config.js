import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import securityPlugin from 'eslint-plugin-security';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
    js.configs.recommended,
    reactPlugin.configs.flat.recommended,
    // NO usar recommended-latest ni recommended del hooks plugin —
    // ambas configuraciones en v7 incluyen reglas del React Compiler (React 19).
    // El proyecto usa React 18, por lo que solo activamos las reglas válidas para esa versión.
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                history: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                Notification: 'readonly',
                performance: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                ResizeObserver: 'readonly',
                IntersectionObserver: 'readonly',
                MutationObserver: 'readonly',
                AbortController: 'readonly',
                FormData: 'readonly',
                Blob: 'readonly',
                File: 'readonly',
                FileReader: 'readonly',
                CustomEvent: 'readonly',
                Event: 'readonly',
                EventTarget: 'readonly',
                // DOM element types
                HTMLElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLTextAreaElement: 'readonly',
                HTMLButtonElement: 'readonly',
                HTMLDivElement: 'readonly',
                HTMLAnchorElement: 'readonly',
                HTMLImageElement: 'readonly',
                HTMLCanvasElement: 'readonly',
                HTMLVideoElement: 'readonly',
                HTMLFormElement: 'readonly',
                HTMLSelectElement: 'readonly',
                HTMLIFrameElement: 'readonly',
                HTMLSpanElement: 'readonly',
                HTMLParagraphElement: 'readonly',
                HTMLHeadingElement: 'readonly',
                HTMLUListElement: 'readonly',
                HTMLLIElement: 'readonly',
                HTMLTableElement: 'readonly',
                Element: 'readonly',
                Node: 'readonly',
                // Event types
                MessageEvent: 'readonly',
                KeyboardEvent: 'readonly',
                MouseEvent: 'readonly',
                TouchEvent: 'readonly',
                PointerEvent: 'readonly',
                InputEvent: 'readonly',
                FocusEvent: 'readonly',
                DragEvent: 'readonly',
                WheelEvent: 'readonly',
                ClipboardEvent: 'readonly',
                StorageEvent: 'readonly',
                // Web APIs
                GeolocationPosition: 'readonly',
                GeolocationPositionError: 'readonly',
                ServiceWorker: 'readonly',
                ServiceWorkerRegistration: 'readonly',
                ServiceWorkerContainer: 'readonly',
                Cache: 'readonly',
                CacheStorage: 'readonly',
                IDBDatabase: 'readonly',
                AudioContext: 'readonly',
                webkitAudioContext: 'readonly',
                crypto: 'readonly',
                indexedDB: 'readonly',
                caches: 'readonly',
                self: 'readonly',
                globalThis: 'readonly',
                queueMicrotask: 'readonly',
                structuredClone: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                // Otros
                google: 'readonly',
                confirm: 'readonly',
                alert: 'readonly',
                prompt: 'readonly',
                process: 'readonly',
                NodeJS: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooksPlugin,
            security: securityPlugin,
            'unused-imports': unusedImports,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,

            // ── React ──────────────────────────────────────────────────────────
            'react/prop-types': 'off',         // TypeScript ya valida props
            'react/react-in-jsx-scope': 'off', // React 17+ no necesita el import

            // ── React Hooks (solo reglas válidas para React 18) ────────────────
            // rules-of-hooks: la regla fundamental — los hooks siempre en el mismo orden
            'react-hooks/rules-of-hooks': 'error',
            // exhaustive-deps: útil para detectar dependencias faltantes en effects
            'react-hooks/exhaustive-deps': 'warn',
            // El resto de reglas del plugin son del React Compiler (React 19) y NO se activan.

            // ── TypeScript ────────────────────────────────────────────────────
            // any: Firebase retorna datos sin tipo, event handlers y código legacy lo requieren.
            // TypeScript verifica tipos donde se declaran explícitamente.
            '@typescript-eslint/no-explicit-any': 'off',
            // Unused vars: el plugin unused-imports se encarga con auto-fix
            '@typescript-eslint/no-unused-vars': 'off',

            // ── Imports no usados (auto-fixable con --fix) ─────────────────────
            'unused-imports/no-unused-imports': 'warn',
            'unused-imports/no-unused-vars': 'off', // TS verifica variables en compilación

            // ── Consola ───────────────────────────────────────────────────────
            // El proyecto tiene utils/logger.ts. Los console.* directos en servicios
            // deben migrarse al logger, pero en componentes React a veces son necesarios
            // para debugging. Se mantiene como off para no generar ruido.
            'no-console': 'off',

            // ── Seguridad ─────────────────────────────────────────────────────
            'security/detect-eval-with-expression': 'error',   // XSS real
            'security/detect-unsafe-regex': 'error',           // ReDoS
            'security/detect-object-injection': 'off',         // Falsos positivos en acceso normal a objetos
            'security/detect-non-literal-regexp': 'off',       // Falsos positivos
            'security/detect-non-literal-require': 'off',      // Solo aplica a Node.js puro
            'security/detect-possible-timing-attacks': 'off',  // Falsos positivos en comparaciones normales
        },
        settings: {
            react: { version: '18' },
        },
    },
    {
        ignores: [
            'node_modules/',
            'dist/',
            'functions/',
            'vite.config.ts',
            'vitest.config.ts',
            'tailwind.config.js',
            'postcss.config.js',
            'scripts/',
        ],
    },
];
