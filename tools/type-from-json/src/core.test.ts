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
});
