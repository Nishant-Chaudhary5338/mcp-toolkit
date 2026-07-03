#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { inferFields } from './core.js';

class InferFieldsServer extends McpServerBase {
  constructor() {
    super({ name: 'infer-fields', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'infer_fields',
      'Infer a typed FieldSchema (fields, types, relations, and table/form presentation defaults) from a JSON API sample response or an OpenAPI schema object. This is the data contract every CRUD/form/table/detail generator consumes.',
      {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description:
              'A JSON sample API response, an array of records, or an OpenAPI schema object — passed as a JSON string (envelopes like {data:{...}} / {items:[...]} are unwrapped automatically).',
          },
          resource: {
            type: 'string',
            description: 'Resource name override, e.g. "article". Inferred from baseEndpoint or an OpenAPI title when omitted.',
          },
          baseEndpoint: {
            type: 'string',
            description: 'REST base endpoint, e.g. "/api/articles". Defaults to /api/<plural resource>.',
          },
        },
        required: ['input'],
      },
      async (args) => {
        const { input, resource, baseEndpoint } = (args ?? {}) as {
          input?: string | Record<string, unknown> | unknown[];
          resource?: string;
          baseEndpoint?: string;
        };
        if (input === undefined || input === null) {
          return this.error(new Error('Missing required argument "input".'));
        }
        try {
          const result = inferFields({ input, resource, baseEndpoint });
          if (!result.ok) return this.error(new Error(result.error));
          return this.successWithDashboard('Infer Fields', { schema: result.schema, source: result.source, count: result.count });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new InferFieldsServer().run().catch(console.error);
