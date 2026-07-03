#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { applyCodemod, resolveRule, BUILTIN_RULES } from './core.js';

const SKIP = new Set(['node_modules', 'build', 'dist', '.git', '.next']);
function collect(target: string): string[] {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const out: string[] = [];
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...collect(path.join(target, e.name))); }
    else if (/\.(tsx?|jsx?|css|html)$/.test(e.name)) out.push(path.join(target, e.name));
  }
  return out;
}

class CodemodRunnerServer extends McpServerBase {
  constructor() {
    super({ name: 'codemod-runner', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'list_builtins',
      'List the built-in named codemods (e.g. cra-env-to-vite, jest-fn-to-vi, react-render-to-createroot).',
      { type: 'object', properties: {}, required: [] },
      async () => this.successWithDashboard('Codemod Runner', { builtins: Object.keys(BUILTIN_RULES) }),
    );
    this.addTool(
      'run_codemod',
      'Apply a codemod across a file or directory — a named built-in `rule`, or an explicit `find`/`replace` (regex with $1 backrefs). Dry-run by default (reports per-file match counts without writing). Set dryRun:false to write. Returns { dryRun, totalMatches, files: [{ file, matches }] }.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File or directory to transform.' },
          rule: { type: 'string', description: 'Built-in rule name (see list_builtins).' },
          find: { type: 'string', description: 'Regex to find (when not using a built-in).' },
          replace: { type: 'string', description: 'Replacement string (supports $1 backrefs).' },
          flags: { type: 'string', description: 'Regex flags. "g" is always added.' },
          dryRun: { type: 'boolean', description: 'Preview without writing. Default true.' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: target, rule, find, replace, flags, dryRun = true } = (args ?? {}) as { path?: string; rule?: string; find?: string; replace?: string; flags?: string; dryRun?: boolean };
        if (!target) return this.error(new Error('Missing required argument "path".'));
        const resolved = resolveRule({ rule, find, replace, flags });
        if ('error' in resolved) return this.error(new Error(resolved.error));
        try {
          if (!fs.existsSync(target)) throw new Error(`Path does not exist: ${target}`);
          const results: { file: string; matches: number }[] = [];
          let total = 0;
          for (const file of collect(target)) {
            const src = fs.readFileSync(file, 'utf8');
            const { code, count } = applyCodemod(src, resolved);
            if (count > 0) {
              results.push({ file, matches: count });
              total += count;
              if (!dryRun) fs.writeFileSync(file, code, 'utf8');
            }
          }
          return this.successWithDashboard('Codemod Runner', { dryRun, totalMatches: total, files: results });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new CodemodRunnerServer().run().catch(console.error);
