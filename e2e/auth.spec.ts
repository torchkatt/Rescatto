/**
 * Authentication flow E2E tests.
 * These tests use environment variables for test credentials.
 * Set E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD etc. in .env.test.local
 *
 * NOTE: These tests require a running Firebase emulator or test project.
 *       They are skipped in CI unless E2E_RUN_AUTH=true is set.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

const RUN_AUTH = process.env.E2E_RUN_AUTH === 'true';

test.describe('Auth — Login / Logout', () => {
    test.skip(!RUN_AUTH, 'Set E2E_RUN_AUTH=true and provide credentials to run auth tests');

    test('customer can log in and see the home screen', async ({ page }) => {
        const email = process.env.E2E_CUSTOMER_EMAIL!;
        const password = process.env.E2E_CUSTOMER_PASSWORD!;

        await loginAs(page, email, password);
        // After login, customer should land on the app shell
        await expect(page.getByText(/explorar/i)).toBeVisible({ timeout: 10_000 });
    });

    test('invalid credentials show an error message', async ({ page }) => {
        await page.goto('/#/login');
        await page.waitForLoadState('networkidle');

        await page.getByPlaceholder(/correo/i).fill('invalid@example.com');
        await page.getByPlaceholder(/contraseña/i).first().fill('wrongpassword');
        await page.getByRole('button', { name: /iniciar sesión/i }).click();

        // An error toast or inline message should appear
        const errorMessage = page.getByText(/contraseña|correo|inválid/i);
        await expect(errorMessage).toBeVisible({ timeout: 8_000 });
    });

    test('customer can log out', async ({ page }) => {
        const email = process.env.E2E_CUSTOMER_EMAIL!;
        const password = process.env.E2E_CUSTOMER_PASSWORD!;

        await loginAs(page, email, password);

        // Open profile / sidebar and click logout
        await page.getByLabel(/abrir menú|menú/i).click().catch(() => {});
        await page.getByRole('button', { name: /cerrar sesión/i }).click();

        // Should redirect back to login
        await expect(page).toHaveURL(/#\/login/, { timeout: 10_000 });
    });
});

test.describe('Auth — Registration form validation', () => {
    test('register tab shows the registration form', async ({ page }) => {
        await page.goto('/#/login');
        await page.waitForLoadState('networkidle');

        // Switch to register mode
        const registerLink = page.getByRole('link', { name: /regístrate/i });
        if (await registerLink.isVisible()) {
            await registerLink.click();
        }

        await expect(page.getByPlaceholder(/nombre completo/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /crear cuenta/i })).toBeVisible();
    });

    test('password mismatch shows inline error', async ({ page }) => {
        await page.goto('/#/login');
        await page.waitForLoadState('networkidle');

        const registerLink = page.getByRole('link', { name: /regístrate/i });
        if (await registerLink.isVisible()) await registerLink.click();

        await page.getByPlaceholder(/nombre completo/i).fill('Test User');
        await page.getByPlaceholder(/nombre@empresa/i).fill('test@example.com');
        await page.getByPlaceholder(/contraseña/i).first().fill('password123');

        const confirmField = page.getByPlaceholder(/confirmar|repetir/i);
        if (await confirmField.isVisible()) {
            await confirmField.fill('differentpassword');
            await confirmField.blur();
            await expect(page.getByText(/no coinciden/i)).toBeVisible({ timeout: 3_000 });
        }
    });
});
