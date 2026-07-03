#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateVisualRegression } from './core.js';

class VisualRegressionSetupServer extends McpServerBase {
  constructor() {
    super({ name: 'visual-regression-setup', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_visual_regression',
      'Generate a Playwright visual-regression spec (toHaveScreenshot) for a set of routes and/or Storybook story ids, with the recommended config snippet. Returns { code, filename, shots }. Requires @playwright/test in the target project.',
      {
        type: 'object',
        properties: {
          routes: { type: 'array', items: { type: 'string' }, description: 'App routes to screenshot, e.g. ["/", "/articles"]. Defaults to ["/"].' },
          storyIds: { type: 'array', items: { type: 'string' }, description: 'Storybook story ids to screenshot via /iframe.html?id=...' },
          fullPage: { type: 'boolean', description: 'Full-page screenshots for routes. Default true.' },
        },
        required: [],
      },
      async (args) => {
        const { routes, storyIds, fullPage } = (args ?? {}) as { routes?: string[]; storyIds?: string[]; fullPage?: boolean };
        const outcome = generateVisualRegression({ routes, storyIds, fullPage });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.successWithDashboard('Visual Regression Setup', { ...outcome.result });
      },
    );
  }
}

new VisualRegressionSetupServer().run().catch(console.error);
