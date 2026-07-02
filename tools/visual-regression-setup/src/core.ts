// visual-regression-setup CORE — pure logic (no MCP transport).
//
// Generate Playwright visual-regression specs (toHaveScreenshot) for a set of
// routes or Storybook stories, plus the config snippet. Catches unintended
// CSS/layout drift. Pairs with playwright-scaffolder + storybook-generator.

export interface VisualRegressionResult {
  code: string;
  filename: string;
  shots: number;
}

export type VisualRegressionOutcome =
  | { ok: true; result: VisualRegressionResult }
  | { ok: false; error: string };

export interface VisualRegressionOptions {
  routes?: string[];
  /** Storybook iframe mode: shoot each story id via /iframe.html?id=... */
  storyIds?: string[];
  fullPage?: boolean;
}

function routeName(route: string): string {
  const clean = route.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'home';
}

export function generateVisualRegression(opts: VisualRegressionOptions = {}): VisualRegressionOutcome {
  const routes = opts.routes ?? ['/'];
  const stories = opts.storyIds ?? [];
  const fullPage = opts.fullPage !== false;

  if (routes.length === 0 && stories.length === 0) {
    return { ok: false, error: 'Provide at least one route or story id.' };
  }

  const routeTests = routes
    .map(
      (r) => `  test('${routeName(r)} looks unchanged', async ({ page }) => {
    await page.goto('${r}');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('${routeName(r)}.png', { fullPage: ${fullPage} });
  });`,
    )
    .join('\n\n');

  const storyTests = stories
    .map(
      (id) => `  test('story ${id} looks unchanged', async ({ page }) => {
    await page.goto('/iframe.html?id=${id}&viewMode=story');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#storybook-root')).toHaveScreenshot('${id}.png');
  });`,
    )
    .join('\n\n');

  const body = [routeTests, storyTests].filter(Boolean).join('\n\n');

  const code = `import { test, expect } from '@playwright/test';

// Visual regression. First run creates baselines; commit the __screenshots__.
// Update intentionally-changed shots with:  npx playwright test --update-snapshots
//
// Recommended config (playwright.config.ts):
//   expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } }

test.describe('Visual regression', () => {
${body}
});
`;

  return { ok: true, result: { code, filename: 'visual.spec.ts', shots: routes.length + stories.length } };
}
