#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateMock } from './core.js';

class MswMockGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: "msw-mock-generator", version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      "generate_mock",
      "Generate MSW handlers (GET list, GET :id, POST, PUT, DELETE) plus an in-memory seed array from a FieldSchema. Returns { code, filename, seedCount, handlerCount }.",
      {
            "type": "object",
            "properties": {
                  "schema": {
                        "type": "object",
                        "description": "A FieldSchema object from infer-fields (or a JSON string)."
                  },
                  "count": {
                        "type": "number",
                        "description": "How many seed records to generate. Defaults to 3."
                  }
            },
            "required": [
                  "schema"
            ]
      },
      async (args) => {
        const { schema, count } = (args ?? {}) as { schema?: unknown; count?: number };
        if (schema === undefined || schema === null) return this.error(new Error('Missing required argument "schema".'));
        const outcome = generateMock(schema, { count });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.successWithDashboard('Msw Mock Generator', { ...outcome.result });
      },
    );
  }
}

new MswMockGeneratorServer().run().catch(console.error);
