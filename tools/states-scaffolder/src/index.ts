#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateStates } from './core.js';

class StatesScaffolderServer extends McpServerBase {
  constructor() {
    super({ name: 'states-scaffolder', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_states',
      'Generate loading/empty/error state components plus an <XStates> switch wrapper for a data view. Returns { code, filename, componentName }.',
      {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Resource/view name, e.g. "article" -> ArticleStates.' },
          skeletonRows: { type: 'number', description: 'How many skeleton rows the loading state renders. Default 5.' },
        },
        required: ['name'],
      },
      async (args) => {
        const { name, skeletonRows } = (args ?? {}) as { name?: string; skeletonRows?: number };
        if (!name) return this.error(new Error('Missing required argument "name".'));
        const outcome = generateStates({ name, skeletonRows });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.success({ ...outcome.result });
      },
    );
  }
}

new StatesScaffolderServer().run().catch(console.error);
