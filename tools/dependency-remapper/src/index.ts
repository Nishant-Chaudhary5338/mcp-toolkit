#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { planRemap } from './core.js';

class DependencyRemapperServer extends McpServerBase {
  constructor() {
    super({ name: 'dependency-remapper', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'plan_remap',
      'Map CRA dependencies to a Vite plan: { remove, add: [{name, version}], unmapped }. Pass a project path (reads package.json) or an explicit deps object. Options: svgr, sass.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project root (reads package.json). Alternative to deps.' },
          deps: { type: 'object', description: 'Merged dependencies map { name: version }. Alternative to path.' },
          svgr: { type: 'boolean', description: 'Add vite-plugin-svgr (SVG-as-component imports).' },
          sass: { type: 'boolean', description: 'Add sass.' },
        },
        required: [],
      },
      async (args) => {
        const { path: root, deps, svgr, sass } = (args ?? {}) as { path?: string; deps?: Record<string, string>; svgr?: boolean; sass?: boolean };
        try {
          let merged = deps;
          if (!merged && root) {
            const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
            merged = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
          }
          if (!merged) return this.error(new Error('Provide a project "path" or a "deps" object.'));
          return this.success({ ...planRemap(merged, { svgr, sass }) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new DependencyRemapperServer().run().catch(console.error);
