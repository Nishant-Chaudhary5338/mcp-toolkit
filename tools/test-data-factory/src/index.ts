#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateFactory } from './core.js';

class TestDataFactoryServer extends McpServerBase {
  constructor() {
    super({ name: 'test-data-factory', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_factory',
      'Generate a typed test-fixture factory from a FieldSchema: makeX(overrides), makeXs(count), and resetXSeq(). Deterministic, override-friendly data for unit tests, Storybook, and seeds. Returns { code, filename, factoryName }.',
      {
        type: 'object',
        properties: { schema: { type: 'object', description: 'A FieldSchema object from infer-fields (or a JSON string).' } },
        required: ['schema'],
      },
      async (args) => {
        const { schema } = (args ?? {}) as { schema?: unknown };
        if (schema === undefined || schema === null) return this.error(new Error('Missing required argument "schema".'));
        const outcome = generateFactory(schema);
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.successWithDashboard('Test Data Factory', { ...outcome.result });
      },
    );
  }
}

new TestDataFactoryServer().run().catch(console.error);
