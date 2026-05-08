import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import securityPlugin from 'eslint-plugin-security';

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
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            security: securityPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            'no-console': 'warn',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react/react-in-jsx-scope': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            // Reglas de seguridad críticas (error) y de advertencia (warn)
            'security/detect-eval-with-expression': 'error',
            'security/detect-non-literal-regexp': 'warn',
            'security/detect-non-literal-require': 'warn',
            'security/detect-object-injection': 'warn',
            'security/detect-possible-timing-attacks': 'warn',
            'security/detect-unsafe-regex': 'error',
        },
        settings: {
            react: { version: 'detect' },
        },
    },
    {
        ignores: ['node_modules/', 'dist/', 'functions/', 'vite.config.ts', 'vitest.config.ts', 'tailwind.config.js', 'postcss.config.js'],
    },
];
