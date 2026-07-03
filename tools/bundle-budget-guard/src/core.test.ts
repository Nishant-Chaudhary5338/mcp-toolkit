import { describe, it, expect } from 'vitest';
import { evaluateBudget } from './core.js';

describe('evaluateBudget', () => {
  it('flags assets over their budget', () => {
    const r = evaluateBudget([
      { path: 'assets/index.js', bytes: 300 * 1024 },
      { path: 'assets/vendor.js', bytes: 100 * 1024 },
    ], [{ pattern: '*index.js', maxKB: 200 }], 250);
    expect(r.passed).toBe(false);
    expect(r.violations.map((v) => v.path)).toEqual(['assets/index.js']);
  });

  it('passes when everything is within budget', () => {
    const r = evaluateBudget([{ path: 'a.js', bytes: 10 * 1024 }], [], 250);
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('applies the default budget when no pattern matches', () => {
    const r = evaluateBudget([{ path: 'big.css', bytes: 400 * 1024 }], [], 250);
    expect(r.violations[0]?.budgetKB).toBe(250);
    expect(r.passed).toBe(false);
  });

  it('reports total KB', () => {
    const r = evaluateBudget([{ path: 'a.js', bytes: 1024 }, { path: 'b.js', bytes: 2048 }], [], 250);
    expect(r.totalKB).toBe(3);
  });
});
