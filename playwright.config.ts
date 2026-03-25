import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Rescatto.
 * Tests run against the Vite preview server (npm run build && npm run preview).
 *
 * Setup:
 *   npx playwright install chromium firefox
 *   npm run e2e
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['line'],
    ],
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
        },
    ],
    webServer: {
        command: 'npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
