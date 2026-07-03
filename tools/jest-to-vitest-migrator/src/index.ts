#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { migrateTest } from './core.js';

const SKIP = new Set(['node_modules', 'build', 'dist', '.git']);
function collectTests(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...collectTests(full)); }
    else if (/\.(test|spec)\.(tsx?|jsx?)$/.test(e.name)) out.push(full);
  }
  return out;
}

class JestToVitestMigratorServer extends McpServerBase {
  constructor() {
    super({ name: 'jest-to-vitest-migrator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'migrate_tests',
      'Migrate Jest test files (**/*.test|spec.*) under a directory to Vitest: jest.* -> vi.*, add the vitest import, and flag vi.mock factories needing review. Dry-run by default. Returns { dryRun, files, totalRewrites, needsReview }.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory (or file) of test files.' },
          dryRun: { type: 'boolean', description: 'Preview without writing. Default true.' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: target, dryRun = true } = (args ?? {}) as { path?: string; dryRun?: boolean };
        if (!target) return this.error(new Error('Missing required argument "path".'));
        try {
          if (!fs.existsSync(target)) throw new Error(`Path does not exist: ${target}`);
          const files = fs.statSync(target).isFile() ? [target] : collectTests(target);
          const results: { file: string; rewrites: number; addedImport: boolean }[] = [];
          const needsReview: { file: string; line: number; reason: string }[] = [];
          let totalRewrites = 0;
          for (const file of files) {
            const r = migrateTest(fs.readFileSync(file, 'utf8'));
            if (r.count > 0 || r.addedImport) {
              results.push({ file: path.relative(target, file) || file, rewrites: r.count, addedImport: r.addedImport });
              totalRewrites += r.count;
              if (!dryRun) fs.writeFileSync(file, r.code, 'utf8');
            }
            for (const n of r.needsReview) needsReview.push({ file: path.relative(target, file) || file, ...n });
          }
          return this.successWithDashboard('Jest To Vitest Migrator', { dryRun, files: results, totalRewrites, needsReview });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new JestToVitestMigratorServer().run().catch(console.error);
