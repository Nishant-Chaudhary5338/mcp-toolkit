#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateEnvConfig, type EnvTarget } from './core.js';

class EnvConfigGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'env-config-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_env_config',
      'Generate a Zod-validated, typed env module from env var names or an .env.example. target "vite" (import.meta.env, VITE_ prefix) or "next" (process.env, NEXT_PUBLIC_). Returns { code, filename, names }.',
      {
        type: 'object',
        properties: {
          names: { type: 'array', items: { type: 'string' }, description: 'Env var names (with or without the prefix).' },
          envExample: { type: 'string', description: 'Contents of an .env.example file (KEY=VALUE lines).' },
          target: { type: 'string', enum: ['vite', 'next'], description: 'Framework target. Defaults to "vite".' },
        },
        required: [],
      },
      async (args) => {
        const { names, envExample, target } = (args ?? {}) as { names?: string[]; envExample?: string; target?: EnvTarget };
        const outcome = generateEnvConfig({ names, envExample, target });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.success({ ...outcome.result });
      },
    );
  }
}

new EnvConfigGeneratorServer().run().catch(console.error);
