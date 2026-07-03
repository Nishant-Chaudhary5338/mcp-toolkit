import { describe, it, expect } from 'vitest';
import { generateToolDocs, generateApiReference } from './core.js';

const TOOL_SRC = `import { McpServerBase } from '@mcp-showcase/shared';
class DemoServer extends McpServerBase {
  constructor() { super({ name: 'demo-tool', version: '1.0.0' }); }
  protected registerTools(): void {
    this.addTool('do_thing', 'Does the thing.', {
      type: 'object',
      properties: { path: { type: 'string', description: 'a path' }, mode: { type: 'string', description: 'a mode' } },
      required: ['path'],
    }, async () => this.success({}));
  }
}
`;

describe('generateToolDocs', () => {
  it('extracts the server name, actions, and args into a README', () => {
    const r = generateToolDocs(TOOL_SRC);
    expect(r.toolName).toBe('demo-tool');
    expect(r.actions).toEqual([{ name: 'do_thing', description: 'Does the thing.' }]);
    expect(r.code).toContain('# demo-tool');
    expect(r.code).toContain('### `do_thing`');
    expect(r.code).toContain('- `path`');
    expect(r.code).toContain('- `mode`');
    expect(r.code).toContain('npx mcp-react-toolkit demo-tool');
    expect(r.filename).toBe('demo-tool.README.md');
  });

  it('does not catastrophically backtrack on many unterminated addTool( calls (QA harness regression)', () => {
    const lines: string[] = [];
    for (let i = 0; i < 50000; i++) {
      lines.push(`this.addTool('name${i}, unclosed quote description forever more text`);
    }
    const src = lines.join('\n');
    const start = Date.now();
    generateToolDocs(src);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('generateApiReference', () => {
  it('documents exported symbols with their JSDoc', () => {
    const src = `/** Adds two numbers. */\nexport function add(a: number, b: number): number { return a + b; }\nexport interface Point { x: number; y: number; }\nexport type ID = string;\n`;
    const r = generateApiReference(src, 'math.ts');
    const names = r.symbols.map((s) => s.name);
    expect(names).toEqual(['add', 'Point', 'ID']);
    expect(r.code).toContain('### `add`');
    expect(r.code).toContain('Adds two numbers.');
    expect(r.code).toContain('_interface_');
    expect(r.filename).toBe('math.api.md');
  });

  it('handles a module with no exports', () => {
    const r = generateApiReference('const x = 1;', 'empty.ts');
    expect(r.symbols).toHaveLength(0);
    expect(r.code).toContain('No exports found');
  });

  it('does not catastrophically backtrack on many unterminated /** comments (QA harness regression)', () => {
    const lines: string[] = [];
    for (let i = 0; i < 50000; i++) {
      lines.push(`/** unterminated doc comment number ${i} with no closing`);
    }
    lines.push('export function add(a, b) { return a + b; }');
    const src = lines.join('\n');
    const start = Date.now();
    generateApiReference(src, 'big.ts');
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
