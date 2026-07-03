#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import { analyzeCompiler, stripMemoization } from './core.js';

class ReactCompilerMigratorServer extends McpServerBase {
  constructor() {
    super({ name: 'react-compiler-migrator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'analyze_compiler_readiness',
      'Analyze a component file for React 19 Compiler readiness: flag redundant useMemo/useCallback/React.memo to remove and rules-of-hooks blockers. Returns { hints, redundantMemoization, blockers, compilerReady }.',
      { type: 'object', properties: { path: { type: 'string', description: 'Path to a .tsx/.ts component file.' } }, required: ['path'] },
      async (args) => {
        const { path: p } = (args ?? {}) as { path?: string };
        if (!p) return this.error(new Error('Missing required argument "path".'));
        try { return this.success({ ...analyzeCompiler(fs.readFileSync(p, 'utf8'), p) }); }
        catch (err) { return this.error(err); }
      },
    );
    this.addTool(
      'strip_memoization',
      'Best-effort strip of the auto-fixable useMemo/useCallback wrappers in a file (single-expression cases). Returns { code } — review before writing. Complex cases and React.memo are reported by analyze, not auto-stripped.',
      { type: 'object', properties: { path: { type: 'string', description: 'Path to a .tsx/.ts component file.' } }, required: ['path'] },
      async (args) => {
        const { path: p } = (args ?? {}) as { path?: string };
        if (!p) return this.error(new Error('Missing required argument "path".'));
        try { return this.success({ code: stripMemoization(fs.readFileSync(p, 'utf8')) }); }
        catch (err) { return this.error(err); }
      },
    );
  }
}

new ReactCompilerMigratorServer().run().catch(console.error);
