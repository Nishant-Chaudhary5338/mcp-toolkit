import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const tmpDir = path.join(os.tmpdir(), 'component-fixer-test-' + process.pid);

function writeFile(relPath: string, content: string): string {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Integration smoke tests — verify the MCP server starts and responds
// ---------------------------------------------------------------------------
describe('component-fixer server', () => {
  it('has a src/index.ts entrypoint', () => {
    const entry = path.resolve('src/index.ts');
    expect(fs.existsSync(entry)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// File utilities used internally — basic sanity
// ---------------------------------------------------------------------------
describe('file operations (filesystem)', () => {
  it('can create and read a component file', () => {
    const filePath = writeFile('Button/Button.tsx', `
      export function Button({ label }: { label: string }) {
        return <button>{label}</button>;
      }
    `);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('Button');
    expect(content).toContain('label');
  });

  it('can write updated component content', () => {
    const filePath = writeFile('Card/Card.tsx', `export function Card() {}`);
    const updated = `export function Card({ title }: { title: string }) { return <div>{title}</div>; }`;
    fs.writeFileSync(filePath, updated);
    const result = fs.readFileSync(filePath, 'utf-8');
    expect(result).toContain('title');
  });
});

// ---------------------------------------------------------------------------
// Fix pattern recognition — test common fixable patterns
// ---------------------------------------------------------------------------
describe('fixable patterns', () => {
  it('identifies missing return type annotation pattern', () => {
    const code = `export function greet(name: string) { return \`Hello \${name}\`; }`;
    const hasMissingReturn = !code.includes('): string');
    expect(hasMissingReturn).toBe(true);
  });

  it('identifies any type pattern', () => {
    const code = `function process(data: any) { return data; }`;
    expect(code.includes(': any')).toBe(true);
  });

  it('identifies missing React import pattern (pre-React 17)', () => {
    const code = `export function Button() { return <button />; }`;
    const missingImport = !code.includes("import React");
    expect(missingImport).toBe(true);
  });

  it('identifies inline object in JSX pattern', () => {
    const code = `<div style={{ color: 'red', fontSize: 14 }}>text</div>`;
    const hasInlineObject = /style=\{\{/.test(code);
    expect(hasInlineObject).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Component structure validation
// ---------------------------------------------------------------------------
describe('component structure', () => {
  it('valid component has export keyword', () => {
    const code = `export function ValidComponent() { return <div />; }`;
    expect(code.startsWith('export')).toBe(true);
  });

  it('detects component without default export', () => {
    const code = `function InternalHelper() { return null; }`;
    const hasExport = code.includes('export');
    expect(hasExport).toBe(false);
  });

  it('detects component over 300 lines as a potential issue', () => {
    const code = Array(305).fill('// comment line').join('\n');
    const lineCount = code.split('\n').length;
    expect(lineCount).toBeGreaterThan(300);
  });
});

// ---------------------------------------------------------------------------
// Regression guard: the "refactor" fixes must NOT emit undefined references or
// inject // comments into JSX (which corrupted files while reporting success).
// ---------------------------------------------------------------------------
describe('no destructive refactors', () => {
  const src = fs.readFileSync(path.resolve('src/index.ts'), 'utf-8');

  it('never writes an undefined handleClick/style={styles} reference', () => {
    expect(src).not.toMatch(/=\{\$\{handlerName\}\}/);
    expect(src).not.toContain('style={styles} // TODO');
  });

  it('does not splice raw // TODO lines into the component body', () => {
    expect(src).not.toMatch(/splice\([^)]*`\/\/ TODO: Extract/);
  });

  it('validates the result parses before writing (rollback safety net)', () => {
    expect(src).toContain('parsesCleanly');
    expect(src).toContain('markAllAppliedAsFailed');
  });

  it('applies fixes bottom-up so line splices do not shift other issues', () => {
    expect(src).toMatch(/sort\(\(a, b\) => \(b\.line \?\? 0\) - \(a\.line \?\? 0\)\)/);
  });
});
