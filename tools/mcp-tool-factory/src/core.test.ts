import { describe, it, expect } from 'vitest';
import { scaffold, wirePackageJson, wireBinCli, validateToolName, type ToolSpec } from './core.js';

const spec: ToolSpec = {
  name: 'demo-tool',
  description: 'A demo tool.',
  actions: [
    { name: 'do_thing', description: 'Does the thing.', properties: { path: { type: 'string', description: 'A path' } }, required: ['path'] },
  ],
};

describe('validateToolName', () => {
  it('accepts kebab-case and rejects other shapes', () => {
    expect(validateToolName('review-gate')).toBe(true);
    expect(validateToolName('Review_Gate')).toBe(false);
    expect(validateToolName('1tool')).toBe(false);
    expect(validateToolName('has space')).toBe(false);
  });
});

describe('scaffold', () => {
  it('emits the five standard files', () => {
    const out = scaffold(spec);
    if (!out.ok) throw new Error(out.error);
    expect(out.files.map((f) => f.path)).toEqual(['package.json', 'tsconfig.json', 'src/core.ts', 'src/index.ts', 'src/core.test.ts']);
  });

  it('names the package and server from the tool name', () => {
    const out = scaffold(spec);
    if (!out.ok) throw new Error(out.error);
    const pkg = out.files.find((f) => f.path === 'package.json')!;
    const index = out.files.find((f) => f.path === 'src/index.ts')!;
    expect(pkg.content).toContain('"@mcp-showcase/demo-tool"');
    expect(index.content).toContain('class DemoToolServer extends McpServerBase');
    expect(index.content).toContain("super({ name: \"demo-tool\", version: '1.0.0' })");
  });

  it('registers each action and imports its core function', () => {
    const out = scaffold(spec);
    if (!out.ok) throw new Error(out.error);
    const index = out.files.find((f) => f.path === 'src/index.ts')!;
    const core = out.files.find((f) => f.path === 'src/core.ts')!;
    expect(index.content).toContain('this.addTool(');
    expect(index.content).toContain('"do_thing"');
    expect(index.content).toContain("import { doThing } from './core.js'");
    expect(core.content).toContain('export function doThing(args: unknown)');
  });

  it('rejects bad specs', () => {
    expect(scaffold({ ...spec, name: 'Bad Name' }).ok).toBe(false);
    expect(scaffold({ ...spec, actions: [] }).ok).toBe(false);
    expect(scaffold({ ...spec, actions: [{ name: 'Bad', description: 'x' }] }).ok).toBe(false);
  });
});

describe('wirePackageJson', () => {
  const pkgText = JSON.stringify({
    workspaces: ['tools/shared', 'tools/json-viewer'],
    scripts: {
      build: 'npm run build -w tools/json-viewer && npm run build -w server',
      test: 'npm run test -w tools/json-viewer',
    },
  }, null, 2);

  it('inserts workspace + build/test after prev', () => {
    const out = wirePackageJson(pkgText, 'my-tool', 'json-viewer');
    const pkg = JSON.parse(out);
    expect(pkg.workspaces).toContain('tools/my-tool');
    expect(pkg.scripts.build).toContain('npm run build -w tools/json-viewer && npm run build -w tools/my-tool');
    expect(pkg.scripts.test).toContain('npm run test -w tools/my-tool');
  });

  it('is idempotent', () => {
    const once = wirePackageJson(pkgText, 'my-tool', 'json-viewer');
    const twice = wirePackageJson(once, 'my-tool', 'json-viewer');
    expect(twice).toBe(once);
  });
});

describe('wireBinCli', () => {
  const bin = '  "json-viewer",\n];\n';
  it('inserts the tool into the TOOLS array', () => {
    expect(wireBinCli(bin, 'my-tool', 'json-viewer')).toContain('  "json-viewer",\n  "my-tool",\n];');
  });
  it('is idempotent', () => {
    const once = wireBinCli(bin, 'my-tool', 'json-viewer');
    expect(wireBinCli(once, 'my-tool', 'json-viewer')).toBe(once);
  });
});
