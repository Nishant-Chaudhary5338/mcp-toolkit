#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateViteProject } from './core.js';

class ViteProjectScaffolderServer extends McpServerBase {
  constructor() {
    super({ name: 'vite-project-scaffolder', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'scaffold_vite',
      'Generate the Vite project shell for a CRA migration: vite.config.ts (react + optional svgr, envPrefix VITE_, @ alias, proxy, base), root index.html, src/main.tsx (createRoot), strict tsconfig + tsconfig.node, and vite-env.d.ts. Returns { files: [{ path, code }], count }.',
      {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'App name for index.html <title>. Default "App".' },
          srcAlias: { type: 'boolean', description: "Alias '@' -> ./src. Default true." },
          svgr: { type: 'boolean', description: 'Add vite-plugin-svgr (SVG-as-component imports).' },
          proxyTarget: { type: 'string', description: 'Dev-server proxy target for /api (from CRA proxy).' },
          homepage: { type: 'string', description: 'CRA homepage -> Vite base path.' },
          entry: { type: 'string', description: "Entry component import. Default './App'." },
        },
        required: [],
      },
      async (args) => {
        const opts = (args ?? {}) as Record<string, unknown>;
        try { return this.success({ ...generateViteProject(opts) }); }
        catch (err) { return this.error(err); }
      },
    );
  }
}

new ViteProjectScaffolderServer().run().catch(console.error);
