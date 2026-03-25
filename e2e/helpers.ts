import { Page, expect } from '@playwright/test';

/** Navigate to the app root and wait for it to be interactive. */
export async function goHome(page: Page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
}

/** Fill in and submit the login form. */
export async function loginAs(page: Page, email: string, password: string) {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/correo/i).fill(email);
    await page.getByPlaceholder(/contraseña/i).first().fill(password);
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    // Wait for redirect away from login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
}

/** Assert that the page title contains the given text. */
export async function expectHeading(page: Page, text: string | RegExp) {
    await expect(page.getByRole('heading', { name: text })).toBeVisible();
}
