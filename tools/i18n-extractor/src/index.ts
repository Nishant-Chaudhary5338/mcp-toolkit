#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { extractStrings, buildCatalog, type StringHit } from './core.js';

const SKIP = new Set(['node_modules', 'build', 'dist', '.git', '.next']);

function collect(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) return /\.(tsx|jsx)$/.test(target) ? [target] : [];
  const out: string[] = [];
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...collect(path.join(target, e.name))); }
    else if (/\.(tsx|jsx)$/.test(e.name) && !/\.(test|spec|stories)\./.test(e.name)) out.push(path.join(target, e.name));
  }
  return out;
}

class I18nExtractorServer extends McpServerBase {
  constructor() {
    super({ name: 'i18n-extractor', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'extract_strings',
      'Scan a file or directory of JSX/TSX for hardcoded user-facing strings and build an i18n message catalog with generated keys. Returns { hits, catalog, count }.',
      {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path to a .tsx/.jsx file or a directory.' } },
        required: ['path'],
      },
      async (args) => {
        const { path: target } = (args ?? {}) as { path?: string };
        if (!target) return this.error(new Error('Missing required argument "path".'));
        try {
          if (!fs.existsSync(target)) throw new Error(`Path does not exist: ${target}`);
          const hits: StringHit[] = [];
          for (const file of collect(target)) {
            for (const h of extractStrings(fs.readFileSync(file, 'utf8'), file)) hits.push(h);
          }
          return this.successWithDashboard('I18n Extractor', { ...buildCatalog(hits) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new I18nExtractorServer().run().catch(console.error);
