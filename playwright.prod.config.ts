import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config para pruebas en PRODUCCIÓN (rescatto.com)
 * No inicia servidor local - apunta directamente al sitio productivo.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    forbidOnly: false,
    retries: 2,
    workers: 1,
    reporter: [
        ['line'],
        ['json', { outputFile: '/sessions/magical-ecstatic-tesla/test-results.json' }],
    ],
    use: {
        baseURL: 'https://rescatto.com',
        headless: true,
        screenshot: 'on',
        video: 'off',
        actionTimeout: 20000,
        navigationTimeout: 45000,
        trace: 'off',
    },
    projects: [
        {
            name: 'chromium-prod',
            use: { ...devices['Desktop Chrome'], headless: true },
        },
    ],
    // NO webServer — testing against production directly
});
