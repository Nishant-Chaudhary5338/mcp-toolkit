#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateForm } from './core.js';

class FormGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'form-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_form',
      'Generate a React Hook Form + Zod form component from a FieldSchema. mode "create" or "edit" (edit fetches the record and PUTs); dataLayer "rtk" or "tanstack" selects which generated mutation hooks it calls. Composes with zod-schema-generator and api-client-generator output.',
      {
        type: 'object',
        properties: {
          schema: { type: 'object', description: 'A FieldSchema object from infer-fields (or a JSON string).' },
          mode: { type: 'string', enum: ['create', 'edit'], description: 'Form mode. Defaults to "create".' },
          dataLayer: { type: 'string', enum: ['rtk', 'tanstack'], description: 'Data layer for the mutation hooks. Defaults to "rtk".' },
        },
        required: ['schema'],
      },
      async (args) => {
        const { schema, mode, dataLayer } = (args ?? {}) as {
          schema?: unknown; mode?: 'create' | 'edit'; dataLayer?: 'rtk' | 'tanstack';
        };
        if (schema === undefined || schema === null) return this.error(new Error('Missing required argument "schema".'));
        const outcome = generateForm(schema, { mode, dataLayer });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.successWithDashboard('Form Generator', { ...outcome.result });
      },
    );
  }
}

new FormGeneratorServer().run().catch(console.error);
