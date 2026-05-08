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
    reactHooksPlugin.configs.flat['recommended-latest'],
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
                // Other browser globals
                google: 'readonly',
                confirm: 'readonly',
                alert: 'readonly',
                prompt: 'readonly',
                // Node/build globals
                process: 'readonly',
                NodeJS: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            security: securityPlugin,
            'unused-imports': unusedImports,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            // TypeScript handles prop types — disable redundant rule
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
            'react-hooks/rules-of-hooks': 'error',
            // exhaustive-deps genera falsos positivos con refs estables (navigate, user.id, toast, etc.)
            'react-hooks/exhaustive-deps': 'off',
            // React 19 Compiler rules — demasiado estrictas para React 18
            'react-hooks/react-compiler': 'off',
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/static-components': 'off',
            'react-hooks/purity': 'off',
            'react-hooks/immutability': 'off',
            // any es necesario para Firebase data, event handlers y código legacy
            '@typescript-eslint/no-explicit-any': 'off',
            // unused-imports auto-elimina imports no usados en --fix
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'warn',
            // Variables no usadas en destructuring son patrones válidos — TypeScript las verifica en compilación
            'unused-imports/no-unused-vars': 'off',
            // console.* está controlado por el logger custom del proyecto
            'no-console': 'off',
            // Seguridad: solo errores críticos reales
            'security/detect-eval-with-expression': 'error',
            'security/detect-unsafe-regex': 'error',
            // detect-object-injection genera demasiados falsos positivos en acceso normal a objetos
            'security/detect-object-injection': 'off',
            'security/detect-non-literal-regexp': 'off',
            'security/detect-non-literal-require': 'off',
            'security/detect-possible-timing-attacks': 'off',
        },
        settings: {
            react: { version: 'detect' },
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
