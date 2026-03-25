/**
 * Smoke tests — verify the app loads and critical public pages are reachable.
 * These run without authentication and cover the most common failure modes.
 */
import { test, expect } from '@playwright/test';
import { goHome } from './helpers';

test.describe('Smoke — Public pages', () => {
    test('home page loads and shows Rescatto branding', async ({ page }) => {
        await goHome(page);
        await expect(page).toHaveTitle(/Rescatto/i);
    });

    test('login page is reachable and shows login form', async ({ page }) => {
        await page.goto('/#/login');
        await page.waitForLoadState('networkidle');
        await expect(page.getByPlaceholder(/correo/i)).toBeVisible();
        await expect(page.getByPlaceholder(/contraseña/i).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
    });

    test('login page shows register toggle', async ({ page }) => {
        await page.goto('/#/login');
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('link', { name: /regístrate/i })).toBeVisible();
    });

    test('unknown route redirects to a valid page', async ({ page }) => {
        await page.goto('/#/does-not-exist-404');
        await page.waitForLoadState('networkidle');
        // Should not show a white blank page — assert something is rendered
        const body = await page.locator('body').innerText();
        expect(body.trim().length).toBeGreaterThan(0);
    });
});

test.describe('Smoke — CSP & security headers', () => {
    test('Content-Security-Policy header is present', async ({ page, request }) => {
        const response = await request.get('/');
        const csp = response.headers()['content-security-policy'];
        expect(csp).toBeTruthy();
        expect(csp).not.toContain("'unsafe-eval'");
    });

    test('X-Frame-Options header is present', async ({ request }) => {
        const response = await request.get('/');
        const xfo = response.headers()['x-frame-options'];
        expect(xfo).toBeTruthy();
    });
});
