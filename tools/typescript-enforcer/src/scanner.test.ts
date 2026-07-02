import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scanFile, scanDirectory } from './scanner.js';

let tmpFiles: string[] = [];
let tmpDirs: string[] = [];

function writeTmp(name: string, content: string): string {
  // Unique dir per file: Date.now() alone collides when vitest runs the compiled
  // build/*.test.js and src/*.test.ts copies concurrently against the same tmpdir.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-enforcer-file-'));
  tmpDirs.push(dir);
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, 'utf-8');
  tmpFiles.push(p);
  return p;
}

function makeTmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-enforcer-dir-'));
  tmpDirs.push(d);
  return d;
}

afterEach(() => {
  for (const f of tmpFiles) if (fs.existsSync(f)) fs.unlinkSync(f);
  for (const d of tmpDirs) if (fs.existsSync(d)) fs.rmSync(d, { recursive: true });
  tmpFiles = [];
  tmpDirs = [];
});

describe('scanFile — no-any rule', () => {
  it('detects : any annotation', () => {
    const file = writeTmp('any.ts', 'function foo(x: any) {}');
    const result = scanFile(file, { rules: ['no-any'], severity: 'error' });
    expect(result.violations.some(v => v.rule === 'no-any')).toBe(true);
  });

  it('detects as any assertion', () => {
    const file = writeTmp('as-any.ts', 'const x = value as any;');
    const result = scanFile(file, { rules: ['no-any'], severity: 'error' });
    expect(result.violations.some(v => v.current === 'as any')).toBe(true);
  });

  it('returns no violations for clean file', () => {
    const file = writeTmp('clean.ts', 'function foo(x: string): number { return x.length; }');
    const result = scanFile(file, { rules: ['no-any'], severity: 'error' });
    expect(result.violations).toHaveLength(0);
  });

  it('clean file gets score 10', () => {
    const file = writeTmp('perfect.ts', 'export const x = 42;');
    const result = scanFile(file, { rules: ['no-any'] });
    expect(result.score).toBe(10);
  });
});

describe('scanFile — severity filtering', () => {
  it('error severity hides info/warning violations', () => {
    const file = writeTmp('mixed.ts', 'let x = 1;\nfunction foo(a: any) {}');
    const allResult = scanFile(file, { severity: 'info' });
    const errorResult = scanFile(file, { severity: 'error' });
    expect(errorResult.violations.length).toBeLessThanOrEqual(allResult.violations.length);
  });

  it('summary counts match violations array', () => {
    const file = writeTmp('count.ts', 'function foo(a: any, b: any) {}');
    const result = scanFile(file, { rules: ['no-any'], severity: 'info' });
    expect(result.summary.total).toBe(result.violations.length);
    expect(result.summary.errors + result.summary.warnings + result.summary.infos).toBe(result.summary.total);
  });
});

describe('scanFile — score calculation', () => {
  it('error violations reduce score by 2 each', () => {
    const file = writeTmp('one-any.ts', 'function f(x: any) {}');
    const result = scanFile(file, { rules: ['no-any'], severity: 'error' });
    const expectedScore = Math.max(0, Math.round((10 - result.summary.errors * 2) * 10) / 10);
    expect(result.score).toBe(expectedScore);
  });
});

describe('scanDirectory', () => {
  it('returns filesScanned count', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'a.ts'), 'const x = 1;');
    fs.writeFileSync(path.join(dir, 'b.ts'), 'const y = 2;');
    const result = scanDirectory(dir, { rules: ['no-any'] });
    expect(result.filesScanned).toBe(2);
  });

  it('respects maxFiles option', () => {
    const dir = makeTmpDir();
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(dir, `f${i}.ts`), `function foo${i}(x: any) {}`);
    }
    const result = scanDirectory(dir, { rules: ['no-any'], maxFiles: 2 });
    expect(result.filesScanned).toBeLessThanOrEqual(2);
  });

  it('skips node_modules by default', () => {
    const dir = makeTmpDir();
    const nm = path.join(dir, 'node_modules');
    fs.mkdirSync(nm);
    fs.writeFileSync(path.join(nm, 'lib.ts'), 'const x: any = 1;');
    fs.writeFileSync(path.join(dir, 'main.ts'), 'const y = 1;');
    const result = scanDirectory(dir, { rules: ['no-any'] });
    expect(result.filesScanned).toBe(1);
  });

  it('byRule counts violations per rule', () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, 'any.ts'), 'function f(x: any) {}');
    const result = scanDirectory(dir, { rules: ['no-any'], severity: 'error' });
    if (result.totalViolations > 0) {
      expect(result.byRule['no-any']).toBeGreaterThan(0);
    }
  });

  it('merges a custom ignore with the built-in defaults instead of replacing them', () => {
    const dir = makeTmpDir();
    const nm = path.join(dir, 'node_modules');
    fs.mkdirSync(nm);
    fs.writeFileSync(path.join(nm, 'lib.ts'), 'const x: any = 1;');
    const skip = path.join(dir, 'skip-me');
    fs.mkdirSync(skip);
    fs.writeFileSync(path.join(skip, 'a.ts'), 'const y = 1;');
    fs.writeFileSync(path.join(dir, 'main.ts'), 'const z = 1;');

    const result = scanDirectory(dir, { rules: ['no-any'], ignore: ['skip-me'] });
    expect(result.filesScanned).toBe(1);
  });

  it('matches ignore patterns against the relative path, including simple globs', () => {
    const dir = makeTmpDir();
    const nested = path.join(dir, 'features', 'contacts', 'model');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'filters.ts'), 'const x = 1;');
    fs.writeFileSync(path.join(dir, 'App.ts'), 'const y = 1;');

    const result = scanDirectory(dir, { rules: ['no-any'], ignore: ['**/contacts/**'] });
    expect(result.filesScanned).toBe(1);
  });
});

describe('scanFile — modifiers rule as-const false positives', () => {
  it('does not suggest as const on a multiline array that already has it', () => {
    const file = writeTmp(
      'sort-options.ts',
      "export const SORT_OPTIONS = [\n  { value: 'a', label: 'A' },\n  { value: 'b', label: 'B' },\n] as const;\n"
    );
    const result = scanFile(file, { rules: ['modifiers'] });
    expect(result.violations.some(v => v.suggestion.includes('as const'))).toBe(false);
  });

  it('does not suggest as const on a return object with an explicit return type', () => {
    const file = writeTmp(
      'decode.ts',
      "interface Filters { search: string; }\nexport function decode(): Partial<Filters> {\n  return {\n    search: '',\n  };\n}\n"
    );
    const result = scanFile(file, { rules: ['modifiers'] });
    expect(result.violations.some(v => v.current === 'return { ... }')).toBe(false);
  });

  it('still suggests as const on a multiline array without it', () => {
    const file = writeTmp('colors.ts', "export const COLORS = [\n  'red',\n  'blue',\n];\n");
    const result = scanFile(file, { rules: ['modifiers'] });
    expect(result.violations.some(v => v.suggestion.includes('as const'))).toBe(true);
  });
});
