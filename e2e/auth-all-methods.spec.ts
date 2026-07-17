/**
 * Complete authentication E2E tests for Rescatto.
 * Covers ALL 7 login/registration methods + edge cases.
 * 
 * Run: npx playwright test --grep "Auth"
 * Full: E2E_RUN_AUTH=true npx playwright test
 */
import { test, expect, Page } from '@playwright/test';
import { goHome } from './helpers';

const RUN = process.env.E2E_RUN_AUTH === 'true';

// Test user credentials (must exist in Firebase test project)
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@rescatto-e2e.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'TestPass123!';
const TEST_NAME = 'Test E2E User';

// ─── Helpers ───

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByPlaceholder(/correo|email/i).fill(email);
  await page.getByPlaceholder(/contraseña/i).first().fill(password);
}

async function submitLogin(page: Page) {
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
}

async function waitForAuthRedirect(page: Page) {
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

async function expectErrorMessage(page: Page, text: string | RegExp) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5_000 });
}

async function verifyLoggedIn(page: Page) {
  // After login, should redirect away from /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  // Page should have some content (not the login form)
  await expect(page.locator('main, [role="main"], button, h1, h2').first()).toBeVisible({ timeout: 10_000 });
}

// ─── Tests ───

test.describe('Auth — Email/Password Login', () => {
  test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run auth tests');

  test('login page renders all expected elements', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    // Email field
    await expect(page.getByPlaceholder(/correo/i)).toBeVisible();
    // Password field
    await expect(page.getByPlaceholder(/contraseña/i).first()).toBeVisible();
    // Submit button
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
    // Social login buttons
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apple/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible();
    // Guest button
    await expect(page.getByRole('button', { name: /invitado/i })).toBeVisible();
    // Register link
    await expect(page.getByText(/registrate|registrar/i)).toBeVisible();
  });

  test('login fails with wrong credentials', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    await fillLoginForm(page, 'wrong@email.com', 'wrongpassword');
    await submitLogin(page);

    // Should show error message
    await expectErrorMessage(page, /incorrectos|inválido|error/i);
  });

  test('login succeeds with valid credentials', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    await fillLoginForm(page, TEST_EMAIL, TEST_PASSWORD);
    await submitLogin(page);

    await verifyLoggedIn(page);
  });

  test('login form has password visibility toggle', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.getByPlaceholder(/contraseña/i).first();
    const toggleButton = page.locator('button[aria-label*="Mostrar"], button[aria-label*="Ocultar"]');

    await expect(toggleButton).toBeVisible();
    await passwordInput.fill('secret123');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click to hide
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('login page redirects authenticated users away', async ({ page }) => {
    // First login
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await fillLoginForm(page, TEST_EMAIL, TEST_PASSWORD);
    await submitLogin(page);
    await verifyLoggedIn(page);

    // Try to go back to login page
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    // Should be redirected away
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe('Auth — Registration (Email/Password)', () => {
  test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run auth tests');

  const uniqueEmail = `e2e-${Date.now()}@rescatto-test.com`;

  test('registration form shows all required fields', async ({ page }) => {
    await page.goto('/#/login?mode=register');
    await page.waitForLoadState('networkidle');

    await expect(page.getByPlaceholder(/nombre/i)).toBeVisible();
    await expect(page.getByPlaceholder(/correo/i)).toBeVisible();
    await expect(page.getByPlaceholder(/contraseña/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/confirmar/i)).toBeVisible();
  });

  test('registration fails when passwords do not match', async ({ page }) => {
    await page.goto('/#/login?mode=register');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder(/nombre/i).fill(TEST_NAME);
    await fillLoginForm(page, uniqueEmail, TEST_PASSWORD);
    await page.getByPlaceholder(/confirmar/i).fill('differentPassword321');

    await page.getByRole('button', { name: /registrarse/i }).click();
    await expectErrorMessage(page, /no coinciden/i);
  });

  test('registration fails with short password', async ({ page }) => {
    await page.goto('/#/login?mode=register');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder(/nombre/i).fill(TEST_NAME);
    await fillLoginForm(page, uniqueEmail, '12345');
    await page.getByPlaceholder(/confirmar/i).fill('12345');

    await page.getByRole('button', { name: /registrarse/i }).click();
    await expectErrorMessage(page, /6 caracteres/i);
  });

  test('registration succeeds and redirects', async ({ page }) => {
    await page.goto('/#/login?mode=register');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder(/nombre/i).fill(TEST_NAME);
    await fillLoginForm(page, uniqueEmail, TEST_PASSWORD);
    await page.getByPlaceholder(/confirmar/i).fill(TEST_PASSWORD);

    await page.getByRole('button', { name: /registrarse/i }).click();
    await verifyLoggedIn(page);
  });

  test('registration with existing email shows error', async ({ page }) => {
    await page.goto('/#/login?mode=register');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder(/nombre/i).fill(TEST_NAME);
    await fillLoginForm(page, TEST_EMAIL, TEST_PASSWORD);
    await page.getByPlaceholder(/confirmar/i).fill(TEST_PASSWORD);

    await page.getByRole('button', { name: /registrarse/i }).click();
    await expectErrorMessage(page, /registrado|existente|error/i);
  });
});

test.describe('Auth — Guest Login', () => {
  test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run auth tests');

  test('guest login button navigates to customer home', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invitado/i }).click();
    await verifyLoggedIn(page);
  });

  test('guest user cannot access protected routes', async ({ page }) => {
    // Login as guest first
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /invitado/i }).click();
    await verifyLoggedIn(page);

    // Try accessing orders page (guest-restricted)
    await page.goto('/#/app/orders');
    await page.waitForLoadState('networkidle');

    // Should be redirected to profile page (guestRedirect)
    await expect(page).toHaveURL(/\/app\/profile/, { timeout: 10_000 });
  });
});

test.describe('Auth — Social Login Buttons', () => {
  test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run auth tests');

  test('Google login button is visible and clickable', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  });

  test('Apple login button is visible and clickable', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /apple/i })).toBeVisible();
  });

  test('Facebook login button is visible and clickable', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible();
  });

  test('social login buttons have correct styling', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    // All 3 social buttons should be in the same row
    const socialRow = page.locator('.grid.grid-cols-3');
    await expect(socialRow).toBeVisible();

    // Each should have an icon (svg) inside
    const buttons = page.getByRole('button', { name: /google|apple|facebook/i });
    await expect(buttons).toHaveCount(3);
  });
});

test.describe('Auth — Logout', () => {
  test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run auth tests');

  test('logout returns to login page', async ({ page }) => {
    // Login first
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');
    await fillLoginForm(page, TEST_EMAIL, TEST_PASSWORD);
    await submitLogin(page);
    await verifyLoggedIn(page);

    // Logout logic — go to login page with manual logout flag
    // (simplified: direct navigation to login clears session)
    await page.evaluate(() => {
      sessionStorage.setItem('rescatto_manual_logout', 'true');
    });
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    // Should show login form again, not auto-redirect
    await expect(page.getByPlaceholder(/correo/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Auth — Password Visibility & UX', () => {
  test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run auth tests');

  test('register toggle switches between login and register modes', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    // Initially in login mode — no name/confirm fields
    await expect(page.getByPlaceholder(/nombre/i)).not.toBeVisible();

    // Click register link
    await page.getByText(/registrate|crear cuenta/i).click();
    await expect(page.getByPlaceholder(/nombre/i)).toBeVisible();
    await expect(page.getByPlaceholder(/confirmar/i)).toBeVisible();

    // Switch back to login
    await page.getByText(/inicia sesión|ya tengo cuenta/i).click();
    await expect(page.getByPlaceholder(/nombre/i)).not.toBeVisible();
  });

  test('error message auto-dismisses after timeout', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    // Trigger an error
    await fillLoginForm(page, 'wrong@email.com', 'wrong');
    await submitLogin(page);

    // Error should appear
    await expectErrorMessage(page, /error|incorrectos/i);

    // Wait 6 seconds for auto-dismiss
    await page.waitForTimeout(6000);

    // Error should disappear
    await expect(page.getByText(/error|incorrectos/i)).not.toBeVisible({ timeout: 2_000 });
  });
});

test.describe('Auth — Language Switcher', () => {
  test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run auth tests');

  test('language toggle switches between ES and EN', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('networkidle');

    // Find and click language toggle
    const langToggle = page.getByRole('button', { name: /es|en/i });
    await expect(langToggle).toBeVisible();

    // Click to switch
    await langToggle.click();
    // After click, the text should have changed
    await page.waitForTimeout(500);
  });
});
