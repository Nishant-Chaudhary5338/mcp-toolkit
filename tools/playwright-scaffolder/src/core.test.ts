import { describe, it, expect } from 'vitest';
import { generatePlaywrightScaffold } from './core.js';

describe('generatePlaywrightScaffold', () => {
  it('emits config, base page, and fixtures by default (with auth)', () => {
    const r = generatePlaywrightScaffold();
    const paths = r.files.map((f) => f.path);
    expect(paths).toContain('playwright.config.ts');
    expect(paths).toContain('e2e/pages/BasePage.ts');
    expect(paths).toContain('e2e/fixtures.ts');
    expect(paths).toContain('e2e/auth.setup.ts');
    expect(r.count).toBe(4);
  });

  it('wires baseURL and the webServer into the config', () => {
    const r = generatePlaywrightScaffold({ baseUrl: 'http://localhost:3000' });
    const config = r.files.find((f) => f.path === 'playwright.config.ts')!;
    expect(config.code).toContain("'http://localhost:3000'");
    expect(config.code).toContain('webServer:');
    expect(config.code).toContain("import { defineConfig, devices } from '@playwright/test'");
  });

  it('omits auth when includeAuth is false', () => {
    const r = generatePlaywrightScaffold({ includeAuth: false });
    const paths = r.files.map((f) => f.path);
    expect(paths).not.toContain('e2e/auth.setup.ts');
    expect(r.files.find((f) => f.path === 'playwright.config.ts')!.code).not.toContain('storageState');
  });

  it('respects a custom testDir', () => {
    const r = generatePlaywrightScaffold({ testDir: './tests-e2e' });
    expect(r.files.some((f) => f.path === 'tests-e2e/fixtures.ts')).toBe(true);
  });
});
