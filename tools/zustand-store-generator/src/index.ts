#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateStore, type StoreField } from './core.js';

class ZustandStoreGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'zustand-store-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_store',
      'Generate a typed Zustand store from a state shape: the state, a setter per field, a reset, and optional persist/devtools middleware. Returns { code, filename, hookName }.',
      {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Store name, e.g. "filter" -> useFilter.' },
          state: { type: 'array', description: 'State fields, each { name, type }.', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string', description: 'TS type string, e.g. "string", "number", "string[]".' } } } },
          persist: { type: 'boolean', description: 'Wrap with persist middleware (localStorage). Default false.' },
          devtools: { type: 'boolean', description: 'Wrap with devtools middleware. Default true.' },
        },
        required: ['name', 'state'],
      },
      async (args) => {
        const { name, state, persist, devtools } = (args ?? {}) as { name?: string; state?: StoreField[]; persist?: boolean; devtools?: boolean };
        if (!name || !state) return this.error(new Error('Missing required arguments "name" and "state".'));
        const outcome = generateStore({ name, state, persist, devtools });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.success({ ...outcome.result });
      },
    );
  }
}

new ZustandStoreGeneratorServer().run().catch(console.error);
