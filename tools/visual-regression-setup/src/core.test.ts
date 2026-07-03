import { describe, it, expect } from 'vitest';
import { generateVisualRegression } from './core.js';

describe('generateVisualRegression', () => {
  it('generates a screenshot test per route', () => {
    const out = generateVisualRegression({ routes: ['/', '/articles'] });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { test, expect } from '@playwright/test'");
    expect(code).toContain("await page.goto('/')");
    expect(code).toContain("await page.goto('/articles')");
    expect(code).toContain("toHaveScreenshot('home.png'");
    expect(code).toContain("toHaveScreenshot('articles.png'");
    expect(out.result.shots).toBe(2);
    expect(out.result.filename).toBe('visual.spec.ts');
  });

  it('generates story screenshots for Storybook ids', () => {
    const out = generateVisualRegression({ routes: [], storyIds: ['button--primary'] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('/iframe.html?id=button--primary');
    expect(out.result.code).toContain('#storybook-root');
  });

  it('defaults to the root route', () => {
    const out = generateVisualRegression();
    expect(out.ok && out.result.shots).toBe(1);
  });

  it('rejects when both routes and stories are empty', () => {
    expect(generateVisualRegression({ routes: [], storyIds: [] }).ok).toBe(false);
  });
});
