import { describe, it, expect } from 'vitest';
import { extractExports, analyzeTestFile, detectMissingEdgeCases } from './index.js';

// ---------------------------------------------------------------------------
// extractExports
// ---------------------------------------------------------------------------
describe('extractExports', () => {
  it('finds named function exports', () => {
    const code = `export function formatDate(date: Date): string { return ''; }`;
    const exports = extractExports(code);
    expect(exports.some(e => e.name === 'formatDate')).toBe(true);
  });

  it('marks functions with the function type', () => {
    const code = `export async function fetchUser(id: string) { return null; }`;
    const exports = extractExports(code);
    const fn = exports.find(e => e.name === 'fetchUser');
    expect(fn?.type).toBe('function');
  });

  it('marks PascalCase exports in JSX files as components', () => {
    const code = `
      import React from 'react';
      export function Button() { return <button />; }
    `;
    const exports = extractExports(code);
    const btn = exports.find(e => e.name === 'Button');
    expect(btn?.type).toBe('component');
  });

  it('identifies hooks by use-prefix naming', () => {
    const code = `export function useCounter(initial: number) { return 0; }`;
    const exports = extractExports(code);
    const hook = exports.find(e => e.name === 'useCounter');
    expect(hook?.type).toBe('hook');
  });

  it('finds const exports', () => {
    const code = `export const API_BASE = 'https://api.example.com';`;
    const exports = extractExports(code);
    expect(exports.some(e => e.name === 'API_BASE')).toBe(true);
  });

  it('finds named export blocks', () => {
    const code = `
      function foo() {}
      function bar() {}
      export { foo, bar };
    `;
    const exports = extractExports(code);
    const names = exports.map(e => e.name);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
  });

  it('returns empty array for a file with no exports', () => {
    const code = `const x = 1; const y = 2;`;
    expect(extractExports(code)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeTestFile
// ---------------------------------------------------------------------------
describe('analyzeTestFile', () => {
  const testContent = `
    describe('formatDate', () => {
      it('formats a valid date correctly', () => { expect(true).toBe(true); });
      it('handles null input', () => { expect(true).toBe(true); });
    });

    describe('parseISO', () => {
      it('parses ISO string', () => { expect(true).toBe(true); });
    });
  `;

  it('extracts describe block names as tested functions', () => {
    const { testedFunctions } = analyzeTestFile(testContent);
    expect(testedFunctions).toContain('formatDate');
    expect(testedFunctions).toContain('parseISO');
  });

  it('maps behaviors to describe blocks', () => {
    const { testedBehaviors } = analyzeTestFile(testContent);
    const behaviors = testedBehaviors.get('formatDate') ?? [];
    expect(behaviors.some(b => b.includes('valid date'))).toBe(true);
    expect(behaviors.some(b => b.includes('null input'))).toBe(true);
  });

  it('returns empty collections for empty test file', () => {
    const { testedFunctions, testedBehaviors } = analyzeTestFile('');
    expect(testedFunctions).toHaveLength(0);
    expect(testedBehaviors.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// detectMissingEdgeCases
// ---------------------------------------------------------------------------
describe('detectMissingEdgeCases', () => {
  it('suggests null-input edge case for untested function', () => {
    const exportInfo = { name: 'parseUser', type: 'function' as const, line: 1 };
    const edgeCases = detectMissingEdgeCases(exportInfo, []);
    expect(edgeCases.some(e => e.category === 'null-input')).toBe(true);
  });

  it('suggests empty-input edge case for untested function', () => {
    const exportInfo = { name: 'filterItems', type: 'function' as const, line: 1 };
    const edgeCases = detectMissingEdgeCases(exportInfo, []);
    expect(edgeCases.some(e => e.category === 'empty-input')).toBe(true);
  });

  it('does not suggest covered edge cases', () => {
    const exportInfo = { name: 'validate', type: 'function' as const, line: 1 };
    // Use category slugs directly — the matching checks if any behavior string includes the slug
    const covered = ['null-input', 'empty-input', 'boundary-values', 'type-coercion', 'async-error'];
    const edgeCases = detectMissingEdgeCases(exportInfo, covered);
    expect(edgeCases.length).toBe(0);
  });

  it('suggests component-specific edge cases', () => {
    const exportInfo = { name: 'Modal', type: 'component' as const, line: 1 };
    const edgeCases = detectMissingEdgeCases(exportInfo, []);
    const categories = edgeCases.map(e => e.category);
    expect(categories).toContain('event-handlers');
    expect(categories).toContain('a11y');
  });

  it('suggests hook-specific edge cases', () => {
    const exportInfo = { name: 'useAuth', type: 'hook' as const, line: 1 };
    const edgeCases = detectMissingEdgeCases(exportInfo, []);
    const categories = edgeCases.map(e => e.category);
    expect(categories).toContain('initial-state');
    expect(categories).toContain('cleanup');
  });
});
