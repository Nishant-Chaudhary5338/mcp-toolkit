import { describe, it, expect } from 'vitest';
import { generateStates } from './core.js';

describe('generateStates', () => {
  it('generates loading, empty, error, and a switch wrapper', () => {
    const out = generateStates({ name: 'article' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain('export function ArticleLoading()');
    expect(code).toContain('export function ArticleEmpty(');
    expect(code).toContain('export function ArticleError(');
    expect(code).toContain('export function ArticleStates(');
    expect(code).toContain('if (isLoading) return <ArticleLoading />;');
    expect(code).toContain("role=\"status\"");
    expect(code).toContain("role=\"alert\"");
    expect(out.result.componentName).toBe('ArticleStates');
    expect(out.result.filename).toBe('ArticleStates.tsx');
  });

  it('respects skeletonRows', () => {
    const out = generateStates({ name: 'x', skeletonRows: 8 });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('Array.from({ length: 8 })');
  });

  it('rejects a missing name', () => {
    expect(generateStates({ name: '' }).ok).toBe(false);
  });
});
