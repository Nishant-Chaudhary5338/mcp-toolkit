#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import { buildBarrel } from './core.js';

class BarrelGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'barrel-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_barrel',
      'Generate an index.ts barrel that re-exports every module in a folder (skips index/test/stories/.d.ts/css). Returns { code, filename, count }. Pass named:true to emit named exports for PascalCase modules.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the folder to build a barrel for.' },
          named: { type: 'boolean', description: 'Emit `export { X } from` for PascalCase modules instead of `export *`. Default false.' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: dir, named } = (args ?? {}) as { path?: string; named?: boolean };
        if (!dir) return this.error(new Error('Missing required argument "path".'));
        try {
          if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Not a directory: ${dir}`);
          const files = fs.readdirSync(dir).filter((f) => fs.statSync(`${dir}/${f}`).isFile());
          return this.successWithDashboard('Barrel Generator', { ...buildBarrel(files, { named }) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new BarrelGeneratorServer().run().catch(console.error);
