import { describe, it, expect } from 'vitest';
import { applyCodemod, resolveRule, BUILTIN_RULES } from './core.js';

describe('applyCodemod', () => {
  it('applies a find/replace with backrefs and counts matches', () => {
    const r = applyCodemod('const a = 1; const b = 2;', { find: 'const (\\w+)', replace: 'let $1' });
    expect(r.code).toBe('let a = 1; let b = 2;');
    expect(r.count).toBe(2);
  });

  it('returns the source unchanged when nothing matches', () => {
    const r = applyCodemod('hello', { find: 'xyz', replace: 'q' });
    expect(r.code).toBe('hello');
    expect(r.count).toBe(0);
  });

  it('throws on an invalid regex', () => {
    expect(() => applyCodemod('x', { find: '(', replace: '' })).toThrow();
  });
});

describe('built-in rules', () => {
  it('cra-env-to-vite rewrites process.env.REACT_APP_*', () => {
    const r = applyCodemod('const u = process.env.REACT_APP_API_URL;', BUILTIN_RULES['cra-env-to-vite']!);
    expect(r.code).toContain('import.meta.env.VITE_API_URL');
  });
  it('jest-fn-to-vi rewrites jest.* mock calls', () => {
    const r = applyCodemod('jest.fn(); jest.mock("x");', BUILTIN_RULES['jest-fn-to-vi']!);
    expect(r.code).toBe('vi.fn(); vi.mock("x");');
  });
});

describe('resolveRule', () => {
  it('resolves built-ins and explicit rules, errors otherwise', () => {
    expect(resolveRule({ rule: 'jest-fn-to-vi' })).toHaveProperty('find');
    expect(resolveRule({ find: 'a', replace: 'b' })).toEqual({ find: 'a', replace: 'b', flags: undefined });
    expect(resolveRule({ rule: 'nope' })).toHaveProperty('error');
    expect(resolveRule({})).toHaveProperty('error');
  });
});
