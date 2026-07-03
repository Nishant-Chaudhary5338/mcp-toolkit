#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { composeCrud } from './core.js';

class CrudComposerServer extends McpServerBase {
  constructor() {
    super({ name: 'crud-composer', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'compose_crud',
      'Wire the generated table/detail/form components into routes for a resource. router "rr7" emits a React Router route array with param wrappers; router "next" emits app/ segment page files. Returns one or more files referencing the components by their conventional names.',
      {
        type: 'object',
        properties: {
          schema: { type: 'object', description: 'A FieldSchema object from infer-fields (or a JSON string).' },
          router: { type: 'string', enum: ['rr7', 'next'], description: 'Routing target. Defaults to "rr7".' },
        },
        required: ['schema'],
      },
      async (args) => {
        const { schema, router } = (args ?? {}) as { schema?: unknown; router?: 'rr7' | 'next' };
        if (schema === undefined || schema === null) return this.error(new Error('Missing required argument "schema".'));
        const outcome = composeCrud(schema, { router });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.successWithDashboard('Crud Composer', { ...outcome.result });
      },
    );
  }
}

new CrudComposerServer().run().catch(console.error);
