import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { analyzeSource, gradeIssues, runReview } from './core.js';

describe('analyzeSource', () => {
  it('flags <img> without alt as an error', () => {
    const issues = analyzeSource('<img src="x.png" />', 'a.tsx');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 'a11y', severity: 'error', line: 1 });
  });

  it('does not flag <img> that has alt', () => {
    expect(analyzeSource('<img src="x.png" alt="x" />', 'a.tsx')).toHaveLength(0);
  });

  it('warns on any, console.log, and hardcoded hex colors', () => {
    const issues = analyzeSource('const x: any = 1;\nconsole.log(x);\nconst c = "#ff0000";', 'a.tsx');
    const rules = issues.map((i) => i.rule).sort();
    expect(rules).toEqual(['quality', 'tokens', 'types']);
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
  });

  it('flags unfilled scaffold stubs as errors', () => {
    const issues = analyzeSource("throw new Error('foo not implemented');", 'a.ts');
    expect(issues[0]).toMatchObject({ rule: 'stub', severity: 'error' });
  });
});

describe('gradeIssues', () => {
  it('grades clean code A', () => {
    expect(gradeIssues([])).toBe('A');
  });
  it('grades 1-2 warns B, 3+ warns C', () => {
    expect(gradeIssues([{ file: 'a', line: 1, rule: 'types', severity: 'warn', message: '' }])).toBe('B');
    expect(gradeIssues(Array.from({ length: 3 }, () => ({ file: 'a', line: 1, rule: 'types' as const, severity: 'warn' as const, message: '' })))).toBe('C');
  });
  it('grades 1 error D, 2+ errors F', () => {
    expect(gradeIssues([{ file: 'a', line: 1, rule: 'a11y', severity: 'error', message: '' }])).toBe('D');
    expect(gradeIssues([
      { file: 'a', line: 1, rule: 'a11y', severity: 'error', message: '' },
      { file: 'a', line: 2, rule: 'stub', severity: 'error', message: '' },
    ])).toBe('F');
  });
});

describe('runReview', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'review-gate-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('grades a directory and passes clean code', () => {
    writeFileSync(join(dir, 'ok.tsx'), 'export const A = () => <img src="x" alt="x" />;');
    const r = runReview({ path: dir });
    expect(r.grade).toBe('A');
    expect(r.passed).toBe(true);
    expect(r.fileCount).toBe(1);
  });

  it('fails a directory with an error and reports issues', () => {
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'bad.tsx'), '<img src="x" />');
    const r = runReview({ path: dir });
    expect(r.passed).toBe(false);
    expect(r.errorCount).toBe(1);
    expect(r.issues[0]?.rule).toBe('a11y');
  });

  it('throws on missing path or nonexistent target', () => {
    expect(() => runReview({})).toThrow();
    expect(() => runReview({ path: join(dir, 'nope') })).toThrow();
  });
});
