#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import { translateWebpack } from './core.js';

class WebpackConfigTranslatorServer extends McpServerBase {
  constructor() {
    super({ name: 'webpack-config-translator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'translate_webpack',
      'Best-effort translate a webpack/CRACO config into Vite equivalents — extract aliases, classify plugins and loaders (native / needs-plugin / unsupported), and return an explicit manual-review list. Pass the config as text or a file path. Returns { aliases, plugins, loaders, manualReview }.',
      {
        type: 'object',
        properties: {
          config: { type: 'string', description: 'Webpack/CRACO config source text.' },
          path: { type: 'string', description: 'Path to a config file (alternative to config).' },
        },
        required: [],
      },
      async (args) => {
        const { config, path: p } = (args ?? {}) as { config?: string; path?: string };
        try {
          const text = p ? fs.readFileSync(p, 'utf8') : config;
          if (!text) return this.error(new Error('Provide "config" text or a "path".'));
          return this.successWithDashboard('Webpack Config Translator', { ...translateWebpack(text) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new WebpackConfigTranslatorServer().run().catch(console.error);
