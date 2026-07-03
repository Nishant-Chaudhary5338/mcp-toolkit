#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeReduxCode, buildReport, mergeCounts, type ReduxCounts, type ReduxIssue } from './core.js';

const SKIP = new Set(['node_modules', 'build', 'dist', '.git', '.next']);
function collect(target: string): string[] {
  const st = fs.statSync(target);
  if (st.isFile()) return /\.(tsx?|jsx?)$/.test(target) ? [target] : [];
  const out: string[] = [];
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...collect(path.join(target, e.name))); }
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.(test|spec|stories)\./.test(e.name)) out.push(path.join(target, e.name));
  }
  return out;
}

class ReduxStateAnalyzerServer extends McpServerBase {
  constructor() {
    super({ name: 'redux-state-analyzer', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'analyze_redux',
      'Audit a file or directory of Redux code for shortcomings, anti-patterns, and optimization opportunities — re-render-causing selectors, direct mutations, non-serializable state, connect->hooks, createStore->configureStore, switch-reducers->createSlice, and manual thunks that should be RTK Query. Returns { style, counts, issues, migrationOpportunities, grade, filesAnalyzed }.',
      { type: 'object', properties: { path: { type: 'string', description: 'Path to a file or directory of Redux code.' } }, required: ['path'] },
      async (args) => {
        const { path: target } = (args ?? {}) as { path?: string };
        if (!target) return this.error(new Error('Missing required argument "path".'));
        try {
          if (!fs.existsSync(target)) throw new Error(`Path does not exist: ${target}`);
          const files = collect(target);
          let counts: ReduxCounts = { connect: 0, useSelector: 0, useDispatch: 0, createStore: 0, combineReducers: 0, configureStore: 0, createSlice: 0, createAsyncThunk: 0, createApi: 0, switchReducers: 0 };
          const issues: ReduxIssue[] = [];
          for (const file of files) {
            const r = analyzeReduxCode(fs.readFileSync(file, 'utf8'), path.relative(target, file) || file);
            counts = mergeCounts(counts, r.counts);
            issues.push(...r.issues);
          }
          return this.success({ ...buildReport(counts, issues, files.length) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new ReduxStateAnalyzerServer().run().catch(console.error);
