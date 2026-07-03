#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateTable } from './core.js';

class TableGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'table-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_table',
      'Generate a TanStack Table data table from a FieldSchema — sortable headers, global filter, and pagination. paginationMode "client" or "server"; dataLayer "rtk" or "tanstack" selects the list hook. Columns come from table-visible fields. Composes with api-client-generator and zod-schema-generator output.',
      {
        type: 'object',
        properties: {
          schema: { type: 'object', description: 'A FieldSchema object from infer-fields (or a JSON string).' },
          paginationMode: { type: 'string', enum: ['client', 'server'], description: 'Client-side or server-side pagination. Defaults to "client".' },
          dataLayer: { type: 'string', enum: ['rtk', 'tanstack'], description: 'Data layer for the list hook. Defaults to "rtk".' },
        },
        required: ['schema'],
      },
      async (args) => {
        const { schema, paginationMode, dataLayer } = (args ?? {}) as {
          schema?: unknown; paginationMode?: 'client' | 'server'; dataLayer?: 'rtk' | 'tanstack';
        };
        if (schema === undefined || schema === null) return this.error(new Error('Missing required argument "schema".'));
        const outcome = generateTable(schema, { paginationMode, dataLayer });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.successWithDashboard('Table Generator', { ...outcome.result });
      },
    );
  }
}

new TableGeneratorServer().run().catch(console.error);
