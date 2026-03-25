const REQUIRED_ENV_VARS = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_WOMPI_PUBLIC_KEY',
    'VITE_API_URL',
] as const;

export function validateEnv(): void {
    if (!import.meta.env.PROD) return;

    const missing = REQUIRED_ENV_VARS.filter(key => !import.meta.env[key]);

    if (missing.length > 0) {
        throw new Error(
            `[Rescatto] Missing required environment variables in production:\n${missing.map(k => `  - ${k}`).join('\n')}`
        );
    }
}
