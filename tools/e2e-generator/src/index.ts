#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateE2E } from './core.js';

class E2EGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'e2e-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_e2e',
      'Generate a Playwright end-to-end CRUD flow spec from a FieldSchema: create -> list -> read -> edit -> delete, plus an @axe-core/playwright accessibility check. Returns { code, filename, routeBase }. Tests the feature the CRUD factory generates. Requires @playwright/test and @axe-core/playwright in the target project.',
      {
        type: 'object',
        properties: {
          schema: { type: 'object', description: 'A FieldSchema object from infer-fields (or a JSON string).' },
          routeBase: { type: 'string', description: 'App base path for the resource routes (defaults to the resource collection, e.g. /articles).' },
        },
        required: ['schema'],
      },
      async (args) => {
        const { schema, routeBase } = (args ?? {}) as { schema?: unknown; routeBase?: string };
        if (schema === undefined || schema === null) return this.error(new Error('Missing required argument "schema".'));
        const outcome = generateE2E(schema, { routeBase });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.success({ ...outcome.result });
      },
    );
  }
}

new E2EGeneratorServer().run().catch(console.error);
