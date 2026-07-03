#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import { diffContracts } from './core.js';

function load(value: string): unknown {
  if (fs.existsSync(value)) return JSON.parse(fs.readFileSync(value, 'utf8'));
  return value;
}

class ApiContractDifferServer extends McpServerBase {
  constructor() {
    super({ name: 'api-contract-differ', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'diff_contract',
      'Diff two API contract snapshots (JSON response samples or OpenAPI schema objects; each may be a JSON string or a file path) and classify changes as breaking (removed field / type change) vs additive. Returns { changes, breaking, additive, passed }. passed=false is a CI-blockable break.',
      {
        type: 'object',
        properties: {
          old: { type: 'string', description: 'Baseline contract — JSON string or a file path.' },
          new: { type: 'string', description: 'Current contract — JSON string or a file path.' },
        },
        required: ['old', 'new'],
      },
      async (args) => {
        const { old: o, new: n } = (args ?? {}) as { old?: string; new?: string };
        if (o === undefined || n === undefined) return this.error(new Error('Both "old" and "new" contracts are required.'));
        try { return this.successWithDashboard('Api Contract Differ', { ...diffContracts(load(o), load(n)) }); }
        catch (err) { return this.error(err); }
      },
    );
  }
}

new ApiContractDifferServer().run().catch(console.error);
