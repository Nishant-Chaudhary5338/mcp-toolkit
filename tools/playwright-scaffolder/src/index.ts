#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generatePlaywrightScaffold } from './core.js';

class PlaywrightScaffolderServer extends McpServerBase {
  constructor() {
    super({ name: 'playwright-scaffolder', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_scaffold',
      'Scaffold a Playwright test harness for a React/Vite app: playwright.config.ts, a POM fixture, a base Page Object, and (optionally) an auth storage-state setup. Returns { files: [{ path, code }], count }. Requires @playwright/test in the target project.',
      {
        type: 'object',
        properties: {
          baseUrl: { type: 'string', description: 'Dev server base URL. Defaults to http://localhost:5173.' },
          testDir: { type: 'string', description: 'Test directory. Defaults to ./e2e.' },
          includeAuth: { type: 'boolean', description: 'Include an auth storage-state setup project. Default true.' },
        },
        required: [],
      },
      async (args) => {
        const { baseUrl, testDir, includeAuth } = (args ?? {}) as { baseUrl?: string; testDir?: string; includeAuth?: boolean };
        try {
          return this.success({ ...generatePlaywrightScaffold({ baseUrl, testDir, includeAuth }) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new PlaywrightScaffolderServer().run().catch(console.error);
