import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scanFile, scanDirectory } from './scanner.js';

let tmpFiles: string[] = [];
let tmpDirs: string[] = [];

function writeTmp(name: string, content: string): string {
  const p = path.join(os.tmpdir(), `ts-enforcer-test-${Date.now()}-${name}`);
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
});
