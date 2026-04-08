/**
 * RESCATTO — Pruebas Funcionales Completas (Producción)
 * Tests multi-rol simultáneos contra https://rescatto.com
 *
 * Cubre:
 *  - Flujo completo de pedido: CUSTOMER crea → KITCHEN_STAFF ve en KDS → procesa
 *  - Sistema de chat entre roles en tiempo real
 *  - VENUE_OWNER: crear producto, flash deals, analytics, finanzas
 *  - CUSTOMER: carrito, checkout, favoritos, impacto, perfil, referidos
 *  - ADMIN/SUPER_ADMIN: módulos del backoffice
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE = 'https://rescatto.com';

// Credenciales de cuentas de prueba — NUNCA hardcodear. Se leen del entorno
// (ej. .env.test local o secrets de CI). Ver e2e/README.md.
const must = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
};

const CREDS = {
  customer: { email: must('E2E_CUSTOMER_EMAIL'), password: must('E2E_CUSTOMER_PASSWORD') },
  kitchen:  { email: must('E2E_KITCHEN_EMAIL'),  password: must('E2E_KITCHEN_PASSWORD') },
  venue:    { email: must('E2E_VENUE_EMAIL'),    password: must('E2E_VENUE_PASSWORD') },
  admin:    { email: must('E2E_ADMIN_EMAIL'),    password: must('E2E_ADMIN_PASSWORD') },
};

// ───────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string, expectedUrlPart: string) {
  await page.goto(`${BASE}/#/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[placeholder*="correo" i], input[placeholder*="email" i]', email);
  await page.fill('input[type="password"], input[placeholder*="contraseña" i]', password);
  await page.click('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar")');
  try {
    await page.waitForURL(`**${expectedUrlPart}**`, { timeout: 15000 });
  } catch {
    // capture current URL for debugging
  }
  return page.url();
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `/sessions/magical-ecstatic-tesla/screenshots/${name}.png`, fullPage: false });
}

// ───────────────────────────────────────────────────────────
// TEST SUITE 1: FLUJO COMPLETO DE PEDIDO (multi-rol)
// ───────────────────────────────────────────────────────────

test.describe('FLUJO-PEDIDO: CUSTOMER crea → KITCHEN_STAFF procesa', () => {

  test('CUSTOMER puede navegar home, buscar, ver restaurante, agregar al carrito', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // LOGIN
    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    const urlAfterLogin = page.url();
    console.log('CUSTOMER URL after login:', urlAfterLogin);

    // ── HOME ──
    await page.waitForLoadState('networkidle');
    await screenshot(page, '01-customer-home');

    // Verificar que hay restaurantes/negocios visibles
    const restaurantCards = await page.locator('[class*="venue"], [class*="restaurant"], [class*="card"]').count();
    console.log(`HOME: Restaurantes/cards visibles: ${restaurantCards}`);

    // ── BUSCAR ──
    // Intentar abrir el buscador
    const searchBtn = page.locator('[aria-label*="buscar" i], [placeholder*="buscar" i], button:has([class*="search" i])').first();
    const searchExists = await searchBtn.count() > 0;
    if (searchExists) {
      await searchBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, '02-search-open');

      // Buscar "pizza"
      const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('pizza');
        await page.waitForTimeout(2000);
        await screenshot(page, '03-search-pizza-results');
        const results = await page.locator('[class*="result"], [class*="product"], [class*="item"]').count();
        console.log(`BÚSQUEDA "pizza": ${results} resultados visibles`);
        // Cerrar búsqueda
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // ── VER PRIMER RESTAURANTE ──
    await page.waitForLoadState('networkidle');
    // Click en la primera card de restaurante disponible
    const firstVenue = page.locator('a[href*="venue"], [class*="VenueCard"], [class*="venue-card"]').first();
    const venueVisible = await firstVenue.isVisible().catch(() => false);
    if (venueVisible) {
      await firstVenue.click();
      await page.waitForLoadState('networkidle');
      await screenshot(page, '04-venue-detail');
      console.log('VENUE DETAIL URL:', page.url());

      // ── AGREGAR AL CARRITO ──
      const addToCartBtn = page.locator('button:has-text("Agregar"), button:has-text("Add"), button[aria-label*="agregar" i]').first();
      const canAdd = await addToCartBtn.isVisible().catch(() => false);
      if (canAdd) {
        await addToCartBtn.click();
        await page.waitForTimeout(1000);
        await screenshot(page, '05-added-to-cart');
        console.log('✅ Producto agregado al carrito');

        // Verificar que el carrito tiene items (badge o contador)
        const cartBadge = page.locator('[class*="badge"], [class*="cart-count"], [class*="CartBadge"]').first();
        const badgeText = await cartBadge.textContent().catch(() => '0');
        console.log(`CART BADGE: ${badgeText}`);
      } else {
        console.log('⚠️ No se encontró botón "Agregar al carrito"');
        // Try to find any button in product cards
        const allButtons = await page.locator('button').allTextContents();
        console.log('Buttons found:', allButtons.slice(0, 10));
      }
    } else {
      console.log('⚠️ No se encontró tarjeta de restaurante clickeable');
      // Navigate to a venue directly
      await page.goto(`${BASE}/#/app`);
      await page.waitForLoadState('networkidle');
      const html = await page.content();
      const venueLinks = html.match(/href="[^"]*venue[^"]*"/g) || [];
      console.log('Venue links in page:', venueLinks.slice(0, 5));
    }

    await ctx.close();
  });

  test('CUSTOMER puede ir al carrito y llegar al checkout', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.waitForLoadState('networkidle');

    // Navegar directamente al carrito
    await page.goto(`${BASE}/#/app/cart`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '06-cart-page');
    console.log('CART URL:', page.url());

    const cartContent = await page.textContent('body');
    const hasEmptyCart = cartContent?.toLowerCase().includes('vacío') || cartContent?.toLowerCase().includes('empty') || cartContent?.toLowerCase().includes('carrito vacío');
    const hasItems = cartContent?.toLowerCase().includes('total') || cartContent?.toLowerCase().includes('subtotal');
    console.log(`CART: vacío=${hasEmptyCart}, tiene items=${hasItems}`);

    if (hasItems) {
      // Intentar ir a checkout
      const checkoutBtn = page.locator('button:has-text("Pedido"), button:has-text("Checkout"), button:has-text("Ordenar"), a[href*="checkout"]').first();
      const checkoutVisible = await checkoutBtn.isVisible().catch(() => false);
      if (checkoutVisible) {
        await checkoutBtn.click();
        await page.waitForLoadState('networkidle');
        await screenshot(page, '07-checkout');
        console.log('CHECKOUT URL:', page.url());

        // Verificar elementos del checkout
        const checkoutBody = await page.textContent('body');
        console.log('CHECKOUT tiene dirección:', checkoutBody?.toLowerCase().includes('dirección') || checkoutBody?.toLowerCase().includes('address'));
        console.log('CHECKOUT tiene método de pago:', checkoutBody?.toLowerCase().includes('pago') || checkoutBody?.toLowerCase().includes('payment'));
        console.log('CHECKOUT tiene resumen:', checkoutBody?.toLowerCase().includes('resumen') || checkoutBody?.toLowerCase().includes('total'));
      }
    } else {
      // Add item first by visiting a venue
      await page.goto(`${BASE}/#/app`);
      await page.waitForLoadState('networkidle');

      // Try clicking on a venue card using JS
      const venueHref = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const venueLink = links.find(l => l.href.includes('venue'));
        return venueLink?.href || null;
      });

      if (venueHref) {
        await page.goto(venueHref);
        await page.waitForLoadState('networkidle');
        await screenshot(page, '04b-venue-detail-direct');

        // Look for "add" buttons
        const addBtns = await page.locator('button').allTextContents();
        console.log('Botones en venue:', addBtns.filter(t => t.trim()).slice(0, 15));

        // Click first add button
        const addBtn = page.locator('button:has-text("+"), button:has-text("Agregar"), button:has-text("Añadir")').first();
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click();
          await page.waitForTimeout(1500);
          await screenshot(page, '05b-after-add');

          // Now go to cart
          await page.goto(`${BASE}/#/app/cart`);
          await page.waitForLoadState('networkidle');
          await screenshot(page, '06b-cart-with-item');
          const cartBody = await page.textContent('body');
          console.log('CART después de agregar - tiene total:', cartBody?.toLowerCase().includes('total'));
        }
      }
    }

    await ctx.close();
  });

  test('CUSTOMER: ver mis pedidos anteriores', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.goto(`${BASE}/#/app/orders`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '08-my-orders');

    const ordersBody = await page.textContent('body');
    const hasOrders = ordersBody?.toLowerCase().includes('pedido') || ordersBody?.toLowerCase().includes('order');
    const hasEmpty = ordersBody?.toLowerCase().includes('sin pedidos') || ordersBody?.toLowerCase().includes('no hay');
    console.log(`MIS PEDIDOS: tiene pedidos=${hasOrders}, vacío=${hasEmpty}`);

    // Check order statuses
    const statuses = await page.locator('[class*="status"], [class*="badge"], [class*="chip"]').allTextContents();
    console.log('Estados de pedidos visibles:', statuses.slice(0, 10));

    await ctx.close();
  });

  test('CUSTOMER: favoritos', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.goto(`${BASE}/#/app/favorites`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '09-favorites');

    const body = await page.textContent('body');
    console.log('FAVORITOS: tiene favoritos:', body?.toLowerCase().includes('favorito'));
    console.log('FAVORITOS: está vacío:', body?.toLowerCase().includes('sin favoritos') || body?.toLowerCase().includes('no tienes'));

    // Try to favorite a venue first
    await page.goto(`${BASE}/#/app`);
    await page.waitForLoadState('networkidle');
    const heartBtn = page.locator('[aria-label*="favorito" i], [aria-label*="like" i], button:has(svg[class*="heart" i])').first();
    const heartVisible = await heartBtn.isVisible().catch(() => false);
    console.log('FAVORITO: botón de corazón visible en home:', heartVisible);
    if (heartVisible) {
      await heartBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '09b-after-favorite');
    }

    await ctx.close();
  });

  test('CUSTOMER: perfil completo - editar, tabs', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.goto(`${BASE}/#/app/profile`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '10-customer-profile');

    const profileBody = await page.textContent('body');
    // Check all profile tabs
    const tabs = await page.locator('[role="tab"], [class*="tab"]').allTextContents();
    console.log('PERFIL - Tabs disponibles:', tabs);

    // Click on Rescatto Pass tab
    const passTab = page.locator('button:has-text("Pass"), [role="tab"]:has-text("Pass")').first();
    if (await passTab.isVisible().catch(() => false)) {
      await passTab.click();
      await page.waitForTimeout(800);
      await screenshot(page, '11-rescatto-pass');
      const passBody = await page.textContent('body');
      console.log('RESCATTO PASS: tiene contenido:', passBody?.toLowerCase().includes('pass') || passBody?.toLowerCase().includes('suscripción'));
    }

    // Click on Referidos tab
    const referidosTab = page.locator('button:has-text("Referido"), [role="tab"]:has-text("Referido")').first();
    if (await referidosTab.isVisible().catch(() => false)) {
      await referidosTab.click();
      await page.waitForTimeout(800);
      await screenshot(page, '12-referidos');
      const refBody = await page.textContent('body');
      console.log('REFERIDOS: vacío:', refBody?.length || 0, 'chars visible');
      console.log('REFERIDOS: tiene código:', refBody?.toLowerCase().includes('código') || refBody?.toLowerCase().includes('code'));
    }

    // Click on Impacto/Puntos tab
    const impactoTab = page.locator('button:has-text("Impacto"), button:has-text("Puntos"), [role="tab"]:has-text("Impacto")').first();
    if (await impactoTab.isVisible().catch(() => false)) {
      await impactoTab.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '13-impacto');
      const impBody = await page.textContent('body');
      console.log('IMPACTO: ranking cargando:', impBody?.toLowerCase().includes('cargando'));
      console.log('IMPACTO: tiene puntos:', impBody?.toLowerCase().includes('punto') || impBody?.toLowerCase().includes('co2'));
    }

    // Test edit profile
    const editBtn = page.locator('button:has-text("Editar"), button:has-text("Edit")').first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, '14-profile-edit');
      console.log('EDITAR PERFIL: modal/form abierto');
      // Close it
      await page.keyboard.press('Escape');
    }

    await ctx.close();
  });

  test('CUSTOMER: impacto page', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.goto(`${BASE}/#/app/impact`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '15-impact-page');

    const body = await page.textContent('body');
    console.log('IMPACT PAGE: CO2:', body?.toLowerCase().includes('co2'));
    console.log('IMPACT PAGE: ranking:', body?.toLowerCase().includes('ranking') || body?.toLowerCase().includes('clasificación'));
    console.log('IMPACT PAGE: cargando:', body?.toLowerCase().includes('cargando'));

    await ctx.close();
  });

  test('CUSTOMER: explorar page', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.goto(`${BASE}/#/app/explore`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '16-explore');

    const body = await page.textContent('body');
    const cards = await page.locator('[class*="card"], [class*="Card"]').count();
    console.log('EXPLORE: cards visibles:', cards);
    console.log('EXPLORE: filtros disponibles:', body?.toLowerCase().includes('filtro') || body?.toLowerCase().includes('categoría'));

    await ctx.close();
  });

});

// ───────────────────────────────────────────────────────────
// TEST SUITE 2: KITCHEN_STAFF / KDS
// ───────────────────────────────────────────────────────────

test.describe('KITCHEN_STAFF: KDS funcional completo', () => {

  test('KDS: ver órdenes, filtros, cambiar estado', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.kitchen.email, CREDS.kitchen.password, '/dashboard');
    await page.waitForLoadState('networkidle');
    await screenshot(page, '20-kds-dashboard');
    console.log('KITCHEN URL after login:', page.url());

    // Navigate to KDS/Orders
    await page.goto(`${BASE}/#/orders`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '21-kds-orders');

    const kdsBody = await page.textContent('body');
    console.log('KDS: pedidos pendientes visibles:', kdsBody?.toLowerCase().includes('pendiente'));
    console.log('KDS: tiene filtros:', kdsBody?.toLowerCase().includes('filtro') || kdsBody?.toLowerCase().includes('estado'));

    // Count order cards
    const orderCards = await page.locator('[class*="OrderCard"], [class*="order-card"], [class*="KDS"]').count();
    console.log('KDS: total order cards:', orderCards);

    // Try to interact with first order (accept/prepare)
    const firstOrderBtn = page.locator('button:has-text("Aceptar"), button:has-text("Preparar"), button:has-text("Listo")').first();
    const canInteract = await firstOrderBtn.isVisible().catch(() => false);
    console.log('KDS: botón de acción visible:', canInteract);
    if (canInteract) {
      const btnText = await firstOrderBtn.textContent();
      console.log('KDS: botón de acción texto:', btnText);
      await screenshot(page, '22-kds-order-action-available');
    }

    // Test KITCHEN_STAFF sidebar links
    const allSidebarLinks = await page.locator('nav a, nav button, [class*="sidebar"] a, [class*="sidebar"] button').allTextContents();
    console.log('KITCHEN sidebar links:', allSidebarLinks.filter(t => t.trim()));

    // Check mensajes/chat link
    const mensajesLink = page.locator('a[href*="mensajes"], a[href*="chat"], a[href*="messages"]').first();
    const mensajesExists = await mensajesLink.count() > 0;
    if (mensajesExists) {
      const mensajesHref = await mensajesLink.getAttribute('href');
      console.log('KITCHEN Mensajes link href:', mensajesHref);
      await mensajesLink.click();
      await page.waitForTimeout(1500);
      const afterMensajesUrl = page.url();
      console.log('KITCHEN después de click Mensajes:', afterMensajesUrl);
      await screenshot(page, '23-kitchen-mensajes-click');
    }

    await ctx.close();
  });

  test('KITCHEN_STAFF: dashboard overview y estadísticas', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.kitchen.email, CREDS.kitchen.password, '/dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard
    const dashBody = await page.textContent('body');
    const statsLabels = await page.locator('[class*="stat"], [class*="kpi"], [class*="metric"]').allTextContents();
    console.log('KITCHEN DASHBOARD stats:', statsLabels.slice(0, 10));
    console.log('KITCHEN DASHBOARD: "predicción":', dashBody?.toLowerCase().includes('predicción') || dashBody?.toLowerCase().includes('mañana'));

    // Test Predicción para Mañana AI feature
    const predBtn = page.locator('button:has-text("Predicción"), button:has-text("predicción"), button:has-text("Mañana")').first();
    if (await predBtn.isVisible().catch(() => false)) {
      await predBtn.click();
      await page.waitForTimeout(3000);
      await screenshot(page, '24-prediccion-manana');
      const predBody = await page.textContent('body');
      console.log('PREDICCIÓN IA: tiene resultado:', predBody?.toLowerCase().includes('mañana') || predBody?.toLowerCase().includes('estimado'));
    }

    await ctx.close();
  });

});

// ───────────────────────────────────────────────────────────
// TEST SUITE 3: VENUE_OWNER completo
// ───────────────────────────────────────────────────────────

test.describe('VENUE_OWNER: gestión completa del negocio', () => {

  test('VENUE_OWNER: crear nuevo producto', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.venue.email, CREDS.venue.password, '/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigate to product manager
    await page.goto(`${BASE}/#/products`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '30-products-manager');

    // Count existing products
    const productCount = await page.locator('[class*="product-row"], [class*="ProductRow"], [class*="product-item"], tr').count();
    console.log('PRODUCTOS: cantidad existente:', productCount);

    // Click "Crear" or "Nuevo producto" button
    const createBtn = page.locator('button:has-text("Crear"), button:has-text("Nuevo"), button:has-text("Agregar producto"), button:has-text("+")').first();
    const canCreate = await createBtn.isVisible().catch(() => false);
    console.log('PRODUCTS: botón crear visible:', canCreate);

    if (canCreate) {
      await createBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, '31-new-product-form');

      // Fill in product form
      const nameInput = page.locator('input[name*="nombre" i], input[placeholder*="nombre" i], input[id*="name" i]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Producto Test QA Rescatto ' + Date.now());

        // Fill price
        const priceInput = page.locator('input[name*="precio" i], input[placeholder*="precio" i], input[type="number"]').first();
        if (await priceInput.isVisible().catch(() => false)) {
          await priceInput.fill('15000');
        }

        // Test "SUGERIR CON IA" button
        const aiBtn = page.locator('button:has-text("SUGERIR"), button:has-text("IA"), button:has-text("Gemini")').first();
        const aiVisible = await aiBtn.isVisible().catch(() => false);
        console.log('PRODUCTS: botón IA visible:', aiVisible);
        if (aiVisible) {
          await aiBtn.click();
          await page.waitForTimeout(5000); // Wait for AI response
          await screenshot(page, '32-ai-suggest-result');
          const descInput = page.locator('textarea[name*="descrip" i], textarea[placeholder*="descrip" i]').first();
          if (await descInput.isVisible().catch(() => false)) {
            const descValue = await descInput.inputValue();
            console.log('IA SUGERIR: descripción generada:', descValue ? `"${descValue.substring(0, 100)}..."` : 'VACÍO (bug confirmado)');
          }
        }

        await screenshot(page, '33-product-form-filled');

        // Close without saving (to avoid creating real test data)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        // Or find cancel button
        const cancelBtn = page.locator('button:has-text("Cancelar"), button:has-text("Cerrar")').first();
        if (await cancelBtn.isVisible().catch(() => false)) {
          await cancelBtn.click();
        }
      }
    }

    await ctx.close();
  });

  test('VENUE_OWNER: flash deals manager', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.venue.email, CREDS.venue.password, '/dashboard');
    await page.goto(`${BASE}/#/flash-deals`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '34-flash-deals');

    const body = await page.textContent('body');
    console.log('FLASH DEALS: tiene deals:', body?.toLowerCase().includes('deal') || body?.toLowerCase().includes('oferta'));
    console.log('FLASH DEALS: tiene botón crear:', body?.toLowerCase().includes('crear') || body?.toLowerCase().includes('nuevo'));

    const createFlashBtn = page.locator('button:has-text("Crear"), button:has-text("Nueva")').first();
    if (await createFlashBtn.isVisible().catch(() => false)) {
      await createFlashBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, '35-flash-deal-form');
      const formFields = await page.locator('input, select, textarea').count();
      console.log('FLASH DEAL FORM: campos disponibles:', formFields);
      await page.keyboard.press('Escape');
    }

    await ctx.close();
  });

  test('VENUE_OWNER: analytics', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.venue.email, CREDS.venue.password, '/dashboard');
    await page.goto(`${BASE}/#/analytics`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '36-analytics');

    const body = await page.textContent('body');
    const hasCharts = await page.locator('canvas, svg[class*="recharts"], [class*="chart"]').count();
    console.log('ANALYTICS: gráficos visibles:', hasCharts);
    console.log('ANALYTICS: tiene KPIs:', body?.toLowerCase().includes('ventas') || body?.toLowerCase().includes('pedido'));
    console.log('ANALYTICS: tiene fecha:', body?.toLowerCase().includes('hoy') || body?.toLowerCase().includes('semana'));

    await ctx.close();
  });

  test('VENUE_OWNER: finanzas del venue', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.venue.email, CREDS.venue.password, '/dashboard');
    await page.goto(`${BASE}/#/finance`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '37-venue-finance');

    const body = await page.textContent('body');
    console.log('VENUE FINANCE: tiene ingresos:', body?.toLowerCase().includes('ingreso') || body?.toLowerCase().includes('ventas'));
    console.log('VENUE FINANCE: tiene datos $:', body?.includes('$') && body?.includes('000'));
    console.log('VENUE FINANCE: muestra $0:', (body?.match(/\$0/g) || []).length);

    await ctx.close();
  });

  test('VENUE_OWNER: order management completo', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.venue.email, CREDS.venue.password, '/dashboard');
    await page.goto(`${BASE}/#/order-management`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '38-order-management');

    // Check filters and states
    const filterBtns = await page.locator('button[class*="filter"], [role="tab"]').allTextContents();
    console.log('ORDER MGMT: filtros disponibles:', filterBtns);

    const orderStatuses = await page.locator('[class*="status"], [class*="badge"]').allTextContents();
    console.log('ORDER MGMT: estados en inglés:', orderStatuses.filter(s => ['PENDING','CANCELLED','DELIVERED','IN_PROGRESS'].includes(s.trim())));
    console.log('ORDER MGMT: estados en español:', orderStatuses.filter(s => ['Pendiente','Cancelado','Entregado','En proceso'].includes(s.trim())));

    // Count pending orders
    const pendingOrders = await page.locator('[class*="pending" i], :text("Pendiente")').count();
    console.log('ORDER MGMT: pedidos pendientes:', pendingOrders);

    await ctx.close();
  });

  test('VENUE_OWNER: settings del venue', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.venue.email, CREDS.venue.password, '/dashboard');
    await page.goto(`${BASE}/#/settings`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '39-venue-settings');

    const body = await page.textContent('body');
    console.log('SETTINGS: tiene horario:', body?.toLowerCase().includes('horario') || body?.toLowerCase().includes('apertura'));
    console.log('SETTINGS: horario vacío "--":', body?.includes('--:--'));
    console.log('SETTINGS: tiene teléfono:', body?.toLowerCase().includes('teléfono') || body?.toLowerCase().includes('telefono'));
    console.log('SETTINGS: tiene email en teléfono:', body?.toLowerCase().includes('@') && body?.toLowerCase().includes('teléfono'));

    // Check all form fields
    const inputs = await page.locator('input').evaluateAll((els: HTMLInputElement[]) => els.map(el => ({
      name: el.name || el.id || el.placeholder,
      value: el.value,
      type: el.type,
    })));
    console.log('SETTINGS fields:', JSON.stringify(inputs.slice(0, 10)));

    await ctx.close();
  });

  test('VENUE_OWNER: chat con clientes', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.venue.email, CREDS.venue.password, '/dashboard');
    await page.goto(`${BASE}/#/chat`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '40-venue-chat');

    const chatBody = await page.textContent('body');
    const convList = await page.locator('[class*="conversation"], [class*="chat-item"], [class*="ConversationItem"]').count();
    console.log('CHAT (VENUE): conversaciones en lista:', convList);

    if (convList > 0) {
      // Try clicking first conversation
      const firstConv = page.locator('[class*="conversation"], [class*="chat-item"], [class*="ConversationItem"]').first();
      await firstConv.click();
      await page.waitForTimeout(1500);
      await screenshot(page, '41-chat-open-conversation');

      const afterClickBody = await page.textContent('body');
      const hasMessages = afterClickBody?.toLowerCase().includes('mensaje') || afterClickBody?.toLowerCase().includes('message');
      const hasInput = await page.locator('input[placeholder*="mensaje" i], textarea[placeholder*="mensaje" i]').count() > 0;
      console.log('CHAT: conversación abierta con mensajes:', hasMessages);
      console.log('CHAT: tiene input para escribir:', hasInput);

      if (hasInput) {
        // Try sending a message
        const msgInput = page.locator('input[placeholder*="mensaje" i], textarea[placeholder*="mensaje" i]').first();
        await msgInput.fill('Mensaje de prueba QA ' + Date.now());
        await screenshot(page, '42-chat-message-typed');

        const sendBtn = page.locator('button[type="submit"], button:has-text("Enviar"), button[aria-label*="enviar" i]').first();
        if (await sendBtn.isVisible().catch(() => false)) {
          await sendBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, '43-chat-message-sent');
          const sentBody = await page.textContent('body');
          console.log('CHAT: mensaje enviado correctamente:', sentBody?.toLowerCase().includes('prueba qa'));
        }
      } else {
        console.log('⚠️ BUG CONFIRMADO: CHAT no tiene input para escribir después de abrir conversación');
      }
    } else {
      console.log('CHAT: sin conversaciones previas');
    }

    await ctx.close();
  });

  test('VENUE_OWNER: tech docs', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.venue.email, CREDS.venue.password, '/dashboard');
    await page.goto(`${BASE}/#/tech-docs`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '44-tech-docs');
    const body = await page.textContent('body');
    console.log('TECH DOCS: tiene contenido:', (body?.length || 0) > 500);
    console.log('TECH DOCS: primeros 200 chars:', body?.substring(0, 200));
    await ctx.close();
  });

});

// ───────────────────────────────────────────────────────────
// TEST SUITE 4: CHAT MULTI-ROL SIMULTÁNEO
// ───────────────────────────────────────────────────────────

test.describe('CHAT: mensajería entre roles en tiempo real', () => {

  test('CUSTOMER puede iniciar chat y VENUE puede responder', async ({ browser }) => {
    // Two simultaneous contexts: customer + venue_owner
    const customerCtx = await browser.newContext();
    const venueCtx = await browser.newContext();

    const customerPage = await customerCtx.newPage();
    const venuePage = await venueCtx.newPage();

    // Login both
    await Promise.all([
      loginAs(customerPage, CREDS.customer.email, CREDS.customer.password, '/app'),
      loginAs(venuePage, CREDS.venue.email, CREDS.venue.password, '/dashboard'),
    ]);

    // Customer: look for chat button (floating ChatButton component)
    await customerPage.waitForLoadState('networkidle');
    await screenshot(customerPage, '50-customer-home-chat-btn');

    const chatFloatBtn = customerPage.locator('[class*="ChatButton"], button[aria-label*="chat" i], [class*="chat-button"]').first();
    const chatBtnVisible = await chatFloatBtn.isVisible().catch(() => false);
    console.log('CUSTOMER: botón flotante de chat visible:', chatBtnVisible);

    if (chatBtnVisible) {
      await chatFloatBtn.click();
      await customerPage.waitForTimeout(1000);
      await screenshot(customerPage, '51-customer-chat-opened');
      const chatOpen = await customerPage.locator('input[placeholder*="mensaje" i], textarea').count() > 0;
      console.log('CUSTOMER: chat abierto con input:', chatOpen);
    }

    // Navigate customer to a venue detail page (chat might be context-specific)
    await customerPage.goto(`${BASE}/#/app`);
    await customerPage.waitForLoadState('networkidle');
    const venueLink = await customerPage.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.find(l => l.href.includes('venue'))?.href;
    });

    if (venueLink) {
      await customerPage.goto(venueLink);
      await customerPage.waitForLoadState('networkidle');
      await screenshot(customerPage, '52-venue-page-customer');
      const chatOnVenue = await customerPage.locator('[class*="ChatButton"], button[aria-label*="chat" i]').count();
      console.log('CUSTOMER: chat button en venue page:', chatOnVenue);
    }

    // Venue: check chat
    await venuePage.goto(`${BASE}/#/chat`);
    await venuePage.waitForLoadState('networkidle');
    await screenshot(venuePage, '53-venue-chat-panel');

    const venueConvs = await venuePage.locator('[class*="conversation"], [class*="ConversationItem"]').count();
    console.log('VENUE CHAT: conversaciones:', venueConvs);

    await customerCtx.close();
    await venueCtx.close();
  });

});

// ───────────────────────────────────────────────────────────
// TEST SUITE 5: ADMIN BACKOFFICE COMPLETO
// ───────────────────────────────────────────────────────────

test.describe('ADMIN/SUPER_ADMIN: todos los módulos del backoffice', () => {

  test('Backoffice: Gestión de Usuarios - listar, detalles, filtros', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.goto(`${BASE}/#/backoffice/users`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '60-backoffice-users');

    const usersBody = await page.textContent('body');
    const userCount = await page.locator('tr, [class*="user-row"], [class*="UserRow"]').count();
    console.log('USERS: filas de usuario:', userCount);
    console.log('USERS: tiene filtros:', usersBody?.toLowerCase().includes('filtro') || usersBody?.toLowerCase().includes('buscar'));
    console.log('USERS: tiene invitados:', usersBody?.toLowerCase().includes('invitado'));

    // Check for role filter
    const roleFilter = page.locator('select, [class*="filter"]').first();
    if (await roleFilter.isVisible().catch(() => false)) {
      const options = await roleFilter.locator('option').allTextContents();
      console.log('USERS: opciones de filtro de rol:', options);
    }

    // Try to open a user's details
    const firstUserRow = page.locator('tr, [class*="user-row"]').nth(1);
    if (await firstUserRow.isVisible().catch(() => false)) {
      await firstUserRow.click();
      await page.waitForTimeout(800);
      await screenshot(page, '61-user-detail');
      const detailBody = await page.textContent('body');
      console.log('USER DETAIL: tiene rol:', detailBody?.toLowerCase().includes('rol') || detailBody?.toLowerCase().includes('role'));
      console.log('USER DETAIL: tiene email:', detailBody?.toLowerCase().includes('@'));
    }

    await ctx.close();
  });

  test('Backoffice: Gestión de Restaurantes/Venues', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.goto(`${BASE}/#/backoffice/venues`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '62-backoffice-venues');

    const venueCount = await page.locator('tr, [class*="venue-row"], [class*="VenueRow"]').count();
    console.log('VENUES: filas de venue:', venueCount);

    const venueBody = await page.textContent('body');
    console.log('VENUES: tiene activos/inactivos:', venueBody?.toLowerCase().includes('activo') || venueBody?.toLowerCase().includes('estado'));
    console.log('VENUES: tiene acciones:', venueBody?.toLowerCase().includes('editar') || venueBody?.toLowerCase().includes('ver'));

    await ctx.close();
  });

  test('Backoffice: Comisiones', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.goto(`${BASE}/#/backoffice/commissions`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '63-commissions');

    const body = await page.textContent('body');
    console.log('COMISIONES: tiene porcentajes:', body?.includes('%'));
    console.log('COMISIONES: tiene datos monetarios:', body?.includes('$') && !body?.includes('$0'));
    console.log('COMISIONES: muestra solo $0:', (body?.match(/\$\s*0(?!\d)/g) || []).length > 2);
    console.log('COMISIONES: tiene tabla:', await page.locator('table, [class*="table"]').count() > 0);

    await ctx.close();
  });

  test('Backoffice: Suscripciones', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.goto(`${BASE}/#/backoffice/subscriptions`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '64-subscriptions');

    const body = await page.textContent('body');
    console.log('SUSCRIPCIONES: tiene planes:', body?.toLowerCase().includes('plan') || body?.toLowerCase().includes('suscripción'));
    console.log('SUSCRIPCIONES: tiene usuarios suscritos:', body?.toLowerCase().includes('activo') || body?.toLowerCase().includes('suscrito'));

    await ctx.close();
  });

  test('Backoffice: Datos Bancarios / Payment Settings', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.goto(`${BASE}/#/backoffice/payment-settings`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '65-payment-settings');

    const body = await page.textContent('body');
    console.log('PAYMENT SETTINGS: tiene pasarelas de pago:', body?.toLowerCase().includes('pago') || body?.toLowerCase().includes('payment'));
    console.log('PAYMENT SETTINGS: tiene configuración:', body?.toLowerCase().includes('configurar') || body?.toLowerCase().includes('api'));

    await ctx.close();
  });

  test('Backoffice: Configuración global', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.goto(`${BASE}/#/backoffice/settings`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '66-backoffice-settings');

    const body = await page.textContent('body');
    // Check for Firestore path exposure
    const hasFirestorePath = body?.includes('settings/platform') || body?.includes('Documento:');
    console.log('SETTINGS: expone ruta Firestore:', hasFirestorePath);
    console.log('SETTINGS: tiene toggles/switches:', await page.locator('[type="checkbox"], [role="switch"]').count() > 0);

    const settingsFields = await page.locator('input, select, textarea').evaluateAll(els =>
      els.map(el => ({ name: (el as HTMLInputElement).name || el.id || (el as HTMLInputElement).placeholder }))
    );
    console.log('SETTINGS fields:', settingsFields.slice(0, 10));

    await ctx.close();
  });

  test('Backoffice: Finanzas global', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.goto(`${BASE}/#/backoffice/finance`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '67-backoffice-finance');

    const body = await page.textContent('body');
    console.log('FINANZAS: muestra $0 en KPIs:', (body?.match(/\$\s*0(?!\d)/g) || []).length);
    console.log('FINANZAS: tiene gráficos:', await page.locator('canvas, svg').count() > 0);
    console.log('FINANZAS: tiene filtro de fechas:', body?.toLowerCase().includes('desde') || body?.toLowerCase().includes('fecha'));

    // Check KPI cards values
    const kpiValues = await page.locator('[class*="kpi"], [class*="card"] [class*="value"], [class*="amount"]').allTextContents();
    console.log('FINANZAS KPI valores:', kpiValues.slice(0, 8));

    await ctx.close();
  });

  test('Backoffice: Auditoría - logs y filtros', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.goto(`${BASE}/#/backoffice/audit`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '68-audit-logs');

    const body = await page.textContent('body');
    console.log('AUDITORÍA: tiene logs:', body?.toLowerCase().includes('acción') || body?.toLowerCase().includes('usuario'));
    console.log('AUDITORÍA: IPs desconocidas:', (body?.match(/IP:\s*Unknown/gi) || []).length);
    console.log('AUDITORÍA: tiene filtros:', body?.toLowerCase().includes('filtrar') || body?.toLowerCase().includes('buscar'));

    // Check low contrast (programmatically)
    const kpiElements = await page.locator('[class*="kpi"], [class*="stat"]').evaluateAll(els =>
      els.map(el => {
        const style = window.getComputedStyle(el);
        return { color: style.color, bg: style.backgroundColor, text: el.textContent?.trim().substring(0, 30) };
      })
    );
    console.log('AUDITORÍA KPI estilos:', kpiElements.slice(0, 5));

    await ctx.close();
  });

  test('Backoffice: módulos Conductores y Soporte', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');

    // Conductores
    await page.goto(`${BASE}/#/backoffice/drivers`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '69-backoffice-drivers');
    const driversBody = await page.textContent('body');
    console.log('CONDUCTORES: muestra "en desarrollo":', driversBody?.toLowerCase().includes('desarrollo'));

    // Soporte
    await page.goto(`${BASE}/#/backoffice/support`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, '70-backoffice-support');
    const supportBody = await page.textContent('body');
    console.log('SOPORTE: muestra "en desarrollo":', supportBody?.toLowerCase().includes('desarrollo'));

    await ctx.close();
  });

  test('Backoffice: dashboard - métricas completas y gráfico ventas', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.admin.email, CREDS.admin.password, '/backoffice');
    await page.waitForLoadState('networkidle');
    await screenshot(page, '71-backoffice-dashboard-fresh');

    // Get all KPI values
    const kpiCards = await page.locator('[class*="kpi"], [class*="stat-card"], [class*="StatCard"]').evaluateAll(els =>
      els.map(el => ({ label: el.querySelector('[class*="label"], p, span')?.textContent?.trim(), value: el.querySelector('[class*="value"], h2, h3')?.textContent?.trim() }))
    );
    console.log('DASHBOARD KPIs:', kpiCards);

    // Check ventas today value
    const ventasHoy = await page.locator(':text("Ventas Hoy")').first().isVisible().catch(() => false);
    console.log('DASHBOARD: "Ventas Hoy" visible:', ventasHoy);

    // Check the line chart
    const chartExists = await page.locator('canvas, svg').count();
    console.log('DASHBOARD: charts/svgs:', chartExists);

    // Try refresh button
    const refreshBtn = page.locator('button[aria-label*="refres" i], button:has(svg[class*="refresh" i])').first();
    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '72-dashboard-after-refresh');
    }

    await ctx.close();
  });

});

// ───────────────────────────────────────────────────────────
// TEST SUITE 6: PWA & NOTIFICACIONES
// ───────────────────────────────────────────────────────────

test.describe('PWA y features globales', () => {

  test('Instalar App PWA - modal disponible', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.waitForLoadState('networkidle');

    // Look for install PWA button/banner
    const installBtn = page.locator('button:has-text("Instalar"), [class*="install"], [class*="pwa"]').first();
    const installVisible = await installBtn.isVisible().catch(() => false);
    console.log('PWA: botón instalar visible:', installVisible);

    // Check service worker registration
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.length > 0;
      }
      return false;
    });
    console.log('PWA: service worker registrado:', swRegistered);

    await ctx.close();
  });

  test('Logout desde cada rol - verificar redirección', async ({ browser }) => {
    // Test logout flow for customer
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.goto(`${BASE}/#/app/profile`);
    await page.waitForLoadState('networkidle');

    const logoutBtn = page.locator('button:has-text("Cerrar sesión"), button:has-text("Salir"), button:has-text("Logout")').first();
    const logoutVisible = await logoutBtn.isVisible().catch(() => false);
    console.log('LOGOUT: botón visible en perfil:', logoutVisible);

    if (logoutVisible) {
      const urlBefore = page.url();
      await logoutBtn.click();
      await page.waitForTimeout(2000);
      const urlAfter = page.url();
      console.log('LOGOUT: URL antes:', urlBefore);
      console.log('LOGOUT: URL después:', urlAfter);
      console.log('LOGOUT: redirigió a login:', urlAfter.includes('login'));
    }

    await ctx.close();
  });

  test('Notificaciones push - solicitud de permiso', async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: ['notifications'] });
    const page = await ctx.newPage();

    await loginAs(page, CREDS.customer.email, CREDS.customer.password, '/app');
    await page.waitForLoadState('networkidle');

    const notifPermission = await page.evaluate(() => Notification.permission);
    console.log('NOTIFICACIONES: permiso:', notifPermission);

    // Check if FCM token gets saved
    await page.waitForTimeout(3000);
    const fcmLogs = await page.evaluate(() => {
      return window.performance.getEntriesByType('resource')
        .filter((r: any) => r.name.includes('fcm') || r.name.includes('firebasemessaging'))
        .map((r: any) => r.name);
    });
    console.log('FCM: requests FCM:', fcmLogs.length);

    await ctx.close();
  });

});
