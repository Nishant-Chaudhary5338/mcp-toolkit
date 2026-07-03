#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';
import { evaluateBudget, type AssetEntry, type Budget } from './core.js';

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collect(full));
    else if (/\.(js|css)$/.test(e.name)) out.push(full);
  }
  return out;
}

class BundleBudgetGuardServer extends McpServerBase {
  constructor() {
    super({ name: 'bundle-budget-guard', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'check_budget',
      'Evaluate the gzipped size of built .js/.css assets in a dist directory against per-pattern budgets. Returns { entries, violations, totalKB, passed } — passed=false is a CI-blockable regression.',
      {
        type: 'object',
        properties: {
          distDir: { type: 'string', description: 'Path to the build output directory (e.g. dist).' },
          budgets: { type: 'array', description: 'Per-pattern budgets.', items: { type: 'object', properties: { pattern: { type: 'string' }, maxKB: { type: 'number' } } } },
          defaultMaxKB: { type: 'number', description: 'Budget for assets not matched by a pattern. Default 250.' },
        },
        required: ['distDir'],
      },
      async (args) => {
        const { distDir, budgets = [], defaultMaxKB = 250 } = (args ?? {}) as { distDir?: string; budgets?: Budget[]; defaultMaxKB?: number };
        if (!distDir) return this.error(new Error('Missing required argument "distDir".'));
        try {
          if (!fs.existsSync(distDir)) throw new Error(`Directory does not exist: ${distDir}`);
          const assets: AssetEntry[] = collect(distDir).map((f) => ({ path: path.relative(distDir, f), bytes: gzipSync(fs.readFileSync(f)).length }));
          return this.success({ ...evaluateBudget(assets, budgets, defaultMaxKB) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new BundleBudgetGuardServer().run().catch(console.error);
