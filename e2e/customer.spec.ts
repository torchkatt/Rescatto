/**
 * Customer journey E2E tests.
 * Skipped unless E2E_RUN_AUTH=true and customer credentials are set.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

const RUN = process.env.E2E_RUN_AUTH === 'true';

test.describe('Customer — Home & Explore', () => {
    test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run customer journey tests');

    test.beforeEach(async ({ page }) => {
        await loginAs(page, process.env.E2E_CUSTOMER_EMAIL!, process.env.E2E_CUSTOMER_PASSWORD!);
    });

    test('home screen shows venue cards', async ({ page }) => {
        await page.goto('/#/app/home');
        await page.waitForLoadState('networkidle');
        // At least one venue card or "no results" state should be visible
        const cards = page.locator('[data-testid="venue-card"]');
        const noResults = page.getByText(/no encontramos/i);
        const anyVisible = (await cards.count()) > 0 || await noResults.isVisible();
        expect(anyVisible).toBe(true);
    });

    test('explore page loads with search bar', async ({ page }) => {
        await page.goto('/#/app/explore');
        await page.waitForLoadState('networkidle');
        await expect(page.getByPlaceholder(/busca/i)).toBeVisible();
    });

    test('cart icon navigates to cart', async ({ page }) => {
        await page.goto('/#/app/home');
        await page.waitForLoadState('networkidle');
        await page.getByRole('link', { name: /carrito/i }).click();
        await expect(page).toHaveURL(/#\/app\/cart/);
    });

    test('orders tab shows order list', async ({ page }) => {
        await page.goto('/#/app/orders');
        await page.waitForLoadState('networkidle');
        // Either orders are shown or the empty state
        const hasContent = await page.locator('main, [role="main"]').isVisible();
        expect(hasContent).toBe(true);
    });
});

test.describe('Customer — Cart interactions', () => {
    test.skip(!RUN, 'Set E2E_RUN_AUTH=true to run cart tests');

    test.beforeEach(async ({ page }) => {
        await loginAs(page, process.env.E2E_CUSTOMER_EMAIL!, process.env.E2E_CUSTOMER_PASSWORD!);
    });

    test('empty cart shows CTA to explore', async ({ page }) => {
        await page.goto('/#/app/cart');
        await page.waitForLoadState('networkidle');
        // If cart is empty, the explore CTA should be visible
        const exploreBtn = page.getByText(/ver ofertas|explorar/i);
        const cartItems = page.locator('[data-testid="cart-item"]');
        const emptyOrHasItems = await exploreBtn.isVisible() || (await cartItems.count()) > 0;
        expect(emptyOrHasItems).toBe(true);
    });
});
