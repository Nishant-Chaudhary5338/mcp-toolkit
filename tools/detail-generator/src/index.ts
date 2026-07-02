#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateDetail } from './core.js';

class DetailGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'detail-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_detail',
      'Generate a typed detail/view component from a FieldSchema — every field as a definition row plus a delete action, wired to the generated get and delete hooks. dataLayer "rtk" or "tanstack". Composes with api-client-generator and zod-schema-generator output.',
      {
        type: 'object',
        properties: {
          schema: { type: 'object', description: 'A FieldSchema object from infer-fields (or a JSON string).' },
          dataLayer: { type: 'string', enum: ['rtk', 'tanstack'], description: 'Data layer for the get/delete hooks. Defaults to "rtk".' },
        },
        required: ['schema'],
      },
      async (args) => {
        const { schema, dataLayer } = (args ?? {}) as { schema?: unknown; dataLayer?: 'rtk' | 'tanstack' };
        if (schema === undefined || schema === null) return this.error(new Error('Missing required argument "schema".'));
        const outcome = generateDetail(schema, { dataLayer });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.success({ ...outcome.result });
      },
    );
  }
}

new DetailGeneratorServer().run().catch(console.error);
