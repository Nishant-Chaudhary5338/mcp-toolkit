#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateZodSchema } from './core.js';

class ZodSchemaGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'zod-schema-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_zod_schema',
      'Generate a Zod schema and its inferred TypeScript type from a FieldSchema (produced by infer-fields). Returns TS code enforcing validation at the boundary — used by form-generator and api-client-generator.',
      {
        type: 'object',
        properties: {
          schema: {
            type: 'object',
            description: 'A FieldSchema object from infer-fields (or a JSON string of one).',
          },
        },
        required: ['schema'],
      },
      async (args) => {
        const { schema } = (args ?? {}) as { schema?: unknown };
        if (schema === undefined || schema === null) {
          return this.error(new Error('Missing required argument "schema".'));
        }
        const outcome = generateZodSchema(schema);
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.success({ ...outcome.result });
      },
    );
  }
}

new ZodSchemaGeneratorServer().run().catch(console.error);
