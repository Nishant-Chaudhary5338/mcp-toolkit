import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { analyzeContent, scanPath, filterBySeverity, gradeViolations } from './core.js';

describe('analyzeContent', () => {
  it('flags a known hardcoded hex color as high severity', () => {
    const v = analyzeContent('const c = "#ffffff";', 'a.tsx');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ type: 'hardcoded-color', severity: 'high' });
  });

  it('flags an unknown 6-digit hex as medium', () => {
    const v = analyzeContent('const c = "#123456";', 'a.tsx');
    expect(v[0]?.severity).toBe('medium');
  });

  it('flags hardcoded spacing and border radius', () => {
    const v = analyzeContent('style={{ padding: "16px", borderRadius: "9999px" }}', 'a.tsx');
    const types = v.map((x) => x.type);
    expect(types).toContain('hardcoded-spacing');
    expect(types).toContain('hardcoded-border-radius');
  });

  it('flags rgb colors, font-family, z-index, and box-shadow', () => {
    expect(analyzeContent('color: rgb(1, 2, 3)', 'a.css').some((v) => v.type === 'hardcoded-color')).toBe(true);
    expect(analyzeContent("font-family: 'Arial'", 'a.css').some((v) => v.type === 'hardcoded-font-family')).toBe(true);
    expect(analyzeContent('z-index: 999', 'a.css').some((v) => v.type === 'hardcoded-z-index')).toBe(true);
    expect(analyzeContent('box-shadow: 0 1px 2px black', 'a.css').some((v) => v.type === 'hardcoded-shadow')).toBe(true);
  });

  it('skips imports, comments, and token definitions', () => {
    expect(analyzeContent('import x from "#fff";', 'a.ts')).toHaveLength(0);
    expect(analyzeContent('// #ffffff', 'a.ts')).toHaveLength(0);
    expect(analyzeContent('--color-white: #ffffff;', 'a.css')).toHaveLength(0);
  });
});

describe('filterBySeverity / gradeViolations', () => {
  const v = [
    { type: 'hardcoded-color', file: 'a', line: 1, value: '#fff', tokenSuggestion: '', severity: 'high' as const },
    { type: 'hardcoded-spacing', file: 'a', line: 2, value: '16px', tokenSuggestion: '', severity: 'medium' as const },
  ];
  it('filters to only high when severity=high', () => {
    expect(filterBySeverity(v, 'high')).toHaveLength(1);
    expect(filterBySeverity(v, 'all')).toHaveLength(2);
  });
  it('grades by violation count', () => {
    expect(gradeViolations([])).toBe('A');
    expect(gradeViolations(v)).toBe('B');
  });
});

describe('scanPath', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'edt-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('scans a directory and finds violations', () => {
    writeFileSync(join(dir, 'a.tsx'), 'const c = "#ffffff"; const p = "16px";');
    const v = scanPath(dir);
    expect(v.length).toBeGreaterThanOrEqual(2);
  });

  it('throws on a missing path', () => {
    expect(() => scanPath(join(dir, 'nope'))).toThrow();
  });
});
