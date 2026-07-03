#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { migrateSource, migrateEnvFile, shouldSkipEnvRewrite } from './core.js';

const SKIP_DIRS = new Set(['node_modules', 'build', 'dist', '.git']);
function collectSrc(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) out.push(...collectSrc(full)); }
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !shouldSkipEnvRewrite(e.name)) out.push(full);
  }
  return out;
}

class EnvVarMigratorServer extends McpServerBase {
  constructor() {
    super({ name: 'env-var-migrator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'migrate_env',
      'Migrate CRA env usage to Vite across a project: rewrite process.env.REACT_APP_X -> import.meta.env.VITE_X in src, rename REACT_APP_ keys in .env* files, and flag dynamic process.env[...] access. Dry-run by default. Returns { dryRun, sourceFiles, envFiles, totalRewrites, dynamicAccess }.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'CRA project root.' },
          dryRun: { type: 'boolean', description: 'Preview without writing. Default true.' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: root, dryRun = true } = (args ?? {}) as { path?: string; dryRun?: boolean };
        if (!root) return this.error(new Error('Missing required argument "path".'));
        try {
          if (!fs.existsSync(root)) throw new Error(`Path does not exist: ${root}`);
          let totalRewrites = 0;
          const sourceFiles: { file: string; rewrites: number }[] = [];
          const dynamicAccess: { file: string; line: number; text: string }[] = [];
          for (const file of collectSrc(path.join(root, 'src'))) {
            const r = migrateSource(fs.readFileSync(file, 'utf8'));
            if (r.count > 0 || r.dynamicAccess.length > 0) {
              if (r.count > 0) { sourceFiles.push({ file: path.relative(root, file), rewrites: r.count }); totalRewrites += r.count; if (!dryRun) fs.writeFileSync(file, r.code, 'utf8'); }
              for (const d of r.dynamicAccess) dynamicAccess.push({ file: path.relative(root, file), line: d.line, text: d.text });
            }
          }
          const envFiles: { file: string; renamed: number }[] = [];
          for (const name of ['.env', '.env.local', '.env.development', '.env.production', '.env.test']) {
            const p = path.join(root, name);
            if (fs.existsSync(p)) {
              const r = migrateEnvFile(fs.readFileSync(p, 'utf8'));
              if (r.count > 0) { envFiles.push({ file: name, renamed: r.count }); if (!dryRun) fs.writeFileSync(p, r.text, 'utf8'); }
            }
          }
          return this.successWithDashboard('Env Var Migrator', { dryRun, sourceFiles, envFiles, totalRewrites, dynamicAccess });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new EnvVarMigratorServer().run().catch(console.error);
