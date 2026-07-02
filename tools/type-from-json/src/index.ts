#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateTypes } from './core.js';

class TypeFromJsonServer extends McpServerBase {
  constructor() {
    super({ name: 'type-from-json', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_types',
      'Generate plain TypeScript interfaces from a JSON sample. Nested objects become their own interfaces; arrays become T[]. Returns { code, filename, rootName }.',
      {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'A JSON object or array (as a JSON string).' },
          rootName: { type: 'string', description: 'Name for the root interface. Defaults to "Root".' },
        },
        required: ['input'],
      },
      async (args) => {
        const { input, rootName } = (args ?? {}) as { input?: unknown; rootName?: string };
        if (input === undefined || input === null) return this.error(new Error('Missing required argument "input".'));
        const outcome = generateTypes(input, rootName ?? 'Root');
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.success({ ...outcome.result });
      },
    );
  }
}

new TypeFromJsonServer().run().catch(console.error);
