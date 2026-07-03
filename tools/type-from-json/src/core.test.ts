import { describe, it, expect } from 'vitest';
import { generateTypes } from './core.js';

describe('generateTypes', () => {
  it('maps primitives and names the root interface', () => {
    const out = generateTypes({ id: 1, title: 'Hi', active: true }, 'Article');
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('export interface Article {');
    expect(out.result.code).toContain('id: number;');
    expect(out.result.code).toContain('title: string;');
    expect(out.result.code).toContain('active: boolean;');
    expect(out.result.filename).toBe('Article.types.ts');
  });

  it('extracts nested objects into their own interfaces', () => {
    const out = generateTypes({ title: 'x', author: { id: 1, name: 'A' } }, 'Post');
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('author: Author;');
    expect(out.result.code).toContain('export interface Author {');
  });

  it('handles arrays and marks nulls optional', () => {
    const out = generateTypes({ tags: ['a', 'b'], meta: null }, 'Doc');
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('tags: string[];');
    expect(out.result.code).toContain('meta?: unknown;');
  });

  it('uses the first element of a top-level array', () => {
    const out = generateTypes([{ a: 1 }], 'Row');
    expect(out.ok && out.result.code).toContain('a: number;');
  });

  it('rejects invalid JSON and non-objects', () => {
    expect(generateTypes('not json').ok).toBe(false);
    expect(generateTypes(42).ok).toBe(false);
  });

  it('produces a valid identifier for a root name with a leading digit (QA fuzz regression)', () => {
    // Found fuzzing this tool: its local pascal() only stripped non-alnum
    // characters from the tail of each word (never the first character) and
    // had no leading-digit guard, so a root name like "2fast2furious" (a
    // plausible JSON key, e.g. a numeric-prefixed API resource name)
    // produced an invalid TS identifier.
    const out = generateTypes({ id: 1 }, '2fast2furious');
    if (!out.ok) throw new Error(out.error);
    expect(out.result.rootName).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
  });
});
