#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { improviseComponent } from './core.js';

class ComponentImproverServer extends McpServerBase {
  constructor() {
    super({ name: 'component-improver', version: '2.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'improve',
      'Improve a React component directory with extended tests, Storybook stories, and variant coverage. Rewrites the test and story files with comprehensive cases.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the component directory to improve (e.g. packages/ui/components/Button).' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: componentPath } = (args ?? {}) as { path?: string };
        if (!componentPath) return this.error(new Error('Missing required argument "path".'));
        try {
          if (!fs.existsSync(componentPath)) throw new Error(`Component path does not exist: ${componentPath}`);
          const componentName = path.basename(componentPath);
          const result = improviseComponent(componentPath, componentName);
          return this.successWithDashboard('Component Improver', {
            component: componentName,
            improvements: { enhanced: result.enhanced, added: result.added },
            message: result.enhanced.length > 0 ? `Enhanced ${result.enhanced.length} file(s)` : 'No improvements needed',
          });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new ComponentImproverServer().run().catch(console.error);
