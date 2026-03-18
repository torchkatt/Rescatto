import { describe, it, expect } from 'vitest';
import es from '../locales/es.json';
import en from '../locales/en.json';
import i18n from '../i18n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all keys from a flat JSON object */
function getKeys(obj: Record<string, string>): string[] {
  return Object.keys(obj).sort();
}

/** Extract all {{placeholder}} tokens from a string */
function extractPlaceholders(value: string): string[] {
  const matches = value.match(/\{\{(\w+)\}\}/g);
  return matches ? matches.sort() : [];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('i18n — translation files', () => {
  const esKeys = getKeys(es);
  const enKeys = getKeys(en);

  // 1. Both files exist and are valid JSON (importable)
  it('ES translation file is a valid object with keys', () => {
    expect(es).toBeDefined();
    expect(typeof es).toBe('object');
    expect(esKeys.length).toBeGreaterThan(0);
  });

  it('EN translation file is a valid object with keys', () => {
    expect(en).toBeDefined();
    expect(typeof en).toBe('object');
    expect(enKeys.length).toBeGreaterThan(0);
  });

  // 2. Both files have the same number of keys
  it('both files have the same number of keys', () => {
    expect(esKeys.length).toBe(enKeys.length);
  });

  // 3. Every key in ES exists in EN
  it('every key in ES exists in EN (no missing English translations)', () => {
    const missingInEn = esKeys.filter((k) => !(k in en));
    expect(missingInEn).toEqual([]);
  });

  // 4. Every key in EN exists in ES
  it('every key in EN exists in ES (no missing Spanish translations)', () => {
    const missingInEs = enKeys.filter((k) => !(k in es));
    expect(missingInEs).toEqual([]);
  });

  // 5. No empty string values in either file
  it('no empty string values in ES', () => {
    const emptyKeys = esKeys.filter((k) => (es as Record<string, string>)[k].trim() === '');
    expect(emptyKeys).toEqual([]);
  });

  it('no empty string values in EN', () => {
    const emptyKeys = enKeys.filter((k) => (en as Record<string, string>)[k].trim() === '');
    expect(emptyKeys).toEqual([]);
  });

  // 6. Specific critical translations exist
  describe('critical translations exist', () => {
    const criticalKeys = [
      'app_name',
      'login_btn_login',
      'checkout_btn_confirm',
      'rescue_now',
      'cart_checkout',
      'orders_title',
      'impact_title',
      'nav_home',
      'nav_explore',
      'nav_cart',
      'nav_orders',
      'nav_profile',
      'logout',
      'loading',
    ];

    for (const key of criticalKeys) {
      it(`ES has critical key "${key}"`, () => {
        expect((es as Record<string, string>)[key]).toBeDefined();
        expect((es as Record<string, string>)[key].length).toBeGreaterThan(0);
      });

      it(`EN has critical key "${key}"`, () => {
        expect((en as Record<string, string>)[key]).toBeDefined();
        expect((en as Record<string, string>)[key].length).toBeGreaterThan(0);
      });
    }
  });

  // 7. Interpolation placeholders match between languages
  describe('interpolation placeholders match between ES and EN', () => {
    const allKeys = [...new Set([...esKeys, ...enKeys])];

    for (const key of allKeys) {
      const esValue = (es as Record<string, string>)[key];
      const enValue = (en as Record<string, string>)[key];

      if (!esValue || !enValue) continue;

      const esPlaceholders = extractPlaceholders(esValue);
      const enPlaceholders = extractPlaceholders(enValue);

      if (esPlaceholders.length > 0 || enPlaceholders.length > 0) {
        it(`"${key}" has matching placeholders`, () => {
          expect(enPlaceholders).toEqual(esPlaceholders);
        });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// i18n initialization
// ---------------------------------------------------------------------------

describe('i18n — initialization', () => {
  it('i18n initializes with fallbackLng "es"', () => {
    expect(i18n.options.fallbackLng).toContain('es');
  });

  it('i18n has ES and EN resources loaded', () => {
    expect(i18n.hasResourceBundle('es', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
  });

  it('i18n resolves a known key using the ES bundle', () => {
    const value = i18n.t('app_name', { lng: 'es' });
    expect(value).toBe('Rescatto');
  });

  it('i18n resolves a known key using the EN bundle', () => {
    const value = i18n.t('app_name', { lng: 'en' });
    expect(value).toBe('Rescatto');
  });

  it('i18n correctly interpolates placeholders', () => {
    const esResult = i18n.t('hello', { lng: 'es', name: 'Ana' });
    expect(esResult).toBe('¡Hola, Ana!');

    const enResult = i18n.t('hello', { lng: 'en', name: 'Ana' });
    expect(enResult).toBe('Hello, Ana!');
  });

  it('i18n falls back to ES for unknown language', () => {
    const value = i18n.t('app_name', { lng: 'fr' });
    expect(value).toBe('Rescatto');
  });
});
