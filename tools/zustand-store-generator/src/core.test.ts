import { describe, it, expect } from 'vitest';
import { generateStore } from './core.js';

describe('generateStore', () => {
  it('generates a typed store with setters, reset, and devtools', () => {
    const out = generateStore({ name: 'filter', state: [{ name: 'query', type: 'string' }, { name: 'page', type: 'number' }] });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { create } from 'zustand'");
    expect(code).toContain("import { devtools } from 'zustand/middleware'");
    expect(code).toContain('interface FilterState {');
    expect(code).toContain('query: string;');
    expect(code).toContain('setQuery: (query: string) => void;');
    expect(code).toContain('setQuery: (query) => set({ query }),');
    expect(code).toContain('reset: () => set(initial),');
    expect(code).toContain('export const useFilter = create<FilterState>()(');
    expect(out.result.hookName).toBe('useFilter');
  });

  it('uses sensible initial values per type', () => {
    const out = generateStore({ name: 's', state: [{ name: 'q', type: 'string' }, { name: 'n', type: 'number' }, { name: 'b', type: 'boolean' }, { name: 'tags', type: 'string[]' }] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("q: '',");
    expect(out.result.code).toContain('n: 0,');
    expect(out.result.code).toContain('b: false,');
    expect(out.result.code).toContain('tags: [],');
  });

  it('adds persist middleware when requested', () => {
    const out = generateStore({ name: 'prefs', state: [{ name: 'theme', type: 'string' }], persist: true });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('persist');
    expect(out.result.code).toContain("{ name: 'prefs' }");
  });

  it('rejects missing name or empty state', () => {
    expect(generateStore({ name: '', state: [{ name: 'a', type: 'string' }] }).ok).toBe(false);
    expect(generateStore({ name: 'x', state: [] }).ok).toBe(false);
  });

  it('produces a valid identifier for a store name with special characters (QA fuzz regression)', () => {
    // Found fuzzing this tool: it had its own local pascal()/cap() duplicate
    // instead of importing the shared, sanitizing helper, so it inherited the
    // identifier-unsafety bug independently of the fix already applied there.
    const out = generateStore({ name: "thing's-2.0!", state: [{ name: 'q', type: 'string' }] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.hookName).toMatch(/^use[A-Za-z0-9_$]*$/);
  });

  it('rejects a field name that is not a valid identifier instead of emitting broken code (QA fuzz regression)', () => {
    // Found fuzzing this tool: field.name is interpolated as a bare
    // identifier (interface key, setter arg, `set({ name })`) with zero
    // sanitization — "first name" broke every generated line that used it.
    const out = generateStore({ name: 'filter', state: [{ name: 'first name', type: 'string' }] });
    expect(out.ok).toBe(false);
  });
});
