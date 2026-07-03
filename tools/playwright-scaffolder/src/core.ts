// playwright-scaffolder CORE — pure logic (no MCP transport).
//
// Emit the Playwright test harness for a React/Vite app: config, a POM fixture,
// a base Page Object, and (optionally) an auth storage-state setup. The
// Playwright sibling of the wdio scaffolder; pairs with e2e-generator's specs.

export interface ScaffoldFile {
  path: string;
  code: string;
}

export interface PlaywrightScaffoldResult {
  files: ScaffoldFile[];
  count: number;
}

export interface PlaywrightScaffoldOptions {
  baseUrl?: string;
  includeAuth?: boolean;
  testDir?: string;
}

export function generatePlaywrightScaffold(opts: PlaywrightScaffoldOptions = {}): PlaywrightScaffoldResult {
  const baseUrl = opts.baseUrl ?? 'http://localhost:5173';
  const testDir = opts.testDir ?? './e2e';
  const includeAuth = opts.includeAuth !== false;

  const files: ScaffoldFile[] = [];

  files.push({
    path: 'playwright.config.ts',
    code: `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '${testDir}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? '${baseUrl}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
${includeAuth ? `    { name: 'setup', testMatch: /.*\\.setup\\.ts/ },\n` : ''}    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome']${includeAuth ? ", storageState: 'e2e/.auth/user.json'" : ''} },
${includeAuth ? "      dependencies: ['setup'],\n" : ''}    },
    { name: 'firefox', use: { ...devices['Desktop Firefox']${includeAuth ? ", storageState: 'e2e/.auth/user.json'" : ''} }${includeAuth ? ", dependencies: ['setup']" : ''} },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.BASE_URL ?? '${baseUrl}',
    reuseExistingServer: !process.env.CI,
  },
});
`,
  });

  files.push({
    path: `${testDir.replace(/^\.\//, '')}/pages/BasePage.ts`,
    code: `import type { Page } from '@playwright/test';

/** Base Page Object — extend per route/feature. */
export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  heading(name: string | RegExp) {
    return this.page.getByRole('heading', { name });
  }
}
`,
  });

  files.push({
    path: `${testDir.replace(/^\.\//, '')}/fixtures.ts`,
    code: `import { test as base } from '@playwright/test';
import { BasePage } from './pages/BasePage';

/** Extend the base test with Page Objects. Add feature pages here. */
export const test = base.extend<{ basePage: BasePage }>({
  basePage: async ({ page }, use) => {
    await use(new BasePage(page));
  },
});

export { expect } from '@playwright/test';
`,
  });

  if (includeAuth) {
    files.push({
      path: `${testDir.replace(/^\.\//, '')}/auth.setup.ts`,
      code: `import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_USER ?? 'user@example.com');
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD ?? 'secret123');
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\\/(dashboard|home)?$/);
  await page.context().storageState({ path: authFile });
});
`,
    });
  }

  return { files, count: files.length };
}
