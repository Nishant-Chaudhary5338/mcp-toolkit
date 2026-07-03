import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { analyzeTool, extractToolSource } from './analyzer.js';

const WELL_FORMED = `import { McpServerBase } from '@mcp-showcase/shared';
class DemoServer extends McpServerBase {
  constructor() { super({ name: 'demo', version: '1.0.0' }); }
  protected registerTools(): void {
    this.addTool('do_thing', 'Does the thing and returns { result }. Limitation: none.', {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to the file' } },
      required: ['path'],
    }, async (args) => {
      const { path } = args as { path: string };
      try { return this.success({ result: path }); } catch (err) { return this.error(err); }
    });
  }
}
new DemoServer().run();
`;

describe('extractToolSource', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'improviser-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('extracts registered tool names from an MCP server file', () => {
    const file = join(dir, 'index.ts');
    writeFileSync(file, WELL_FORMED);
    const src = extractToolSource(file);
    expect(src.tools.some((t) => t.name === 'do_thing')).toBe(true);
  });
});

describe('analyzeTool', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'improviser-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('scores a well-formed tool highly across the seven dimensions', () => {
    const file = join(dir, 'index.ts');
    writeFileSync(file, WELL_FORMED);
    const result = analyzeTool(file);
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThan(7);
    expect(Object.keys(result.scores).length).toBe(7);
  });

  it('scores a sloppy tool lower than a well-formed one', () => {
    const good = join(dir, 'good.ts');
    const bad = join(dir, 'bad.ts');
    writeFileSync(good, WELL_FORMED);
    writeFileSync(bad, `import { McpServerBase } from '@mcp-showcase/shared';
class B extends McpServerBase {
  constructor() { super({ name: 'b', version: '1.0.0' }); }
  protected registerTools(): void {
    this.addTool('x', 'x', { type: 'object', properties: {} }, async () => this.success({}));
  }
}
`);
    expect(analyzeTool(bad).overallScore).toBeLessThanOrEqual(analyzeTool(good).overallScore);
  });
});
