#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateApiClient } from './core.js';

class ApiClientGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'api-client-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_api_client',
      'Generate a typed CRUD data layer from a FieldSchema: an RTK Query api slice (dataLayer "rtk") or TanStack Query hooks (dataLayer "tanstack"), with list/get/create/update/delete and cache invalidation. Imports the resource type from the zod-schema-generator output.',
      {
        type: 'object',
        properties: {
          schema: {
            type: 'object',
            description: 'A FieldSchema object from infer-fields (or a JSON string of one).',
          },
          dataLayer: {
            type: 'string',
            enum: ['rtk', 'tanstack'],
            description: 'Which data layer to target. Defaults to "rtk".',
          },
        },
        required: ['schema'],
      },
      async (args) => {
        const { schema, dataLayer } = (args ?? {}) as { schema?: unknown; dataLayer?: 'rtk' | 'tanstack' };
        if (schema === undefined || schema === null) {
          return this.error(new Error('Missing required argument "schema".'));
        }
        const outcome = generateApiClient(schema, { dataLayer });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.successWithDashboard('Api Client Generator', { ...outcome.result });
      },
    );
  }
}

new ApiClientGeneratorServer().run().catch(console.error);
