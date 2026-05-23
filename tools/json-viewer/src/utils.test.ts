import { describe, it, expect } from 'vitest';
import { countKeys, getMaxDepth, escapeHtml, generateId } from './utils.js';

describe('countKeys', () => {
  it('counts keys in a flat object', () => {
    expect(countKeys({ a: 1, b: 2, c: 3 })).toBe(3);
  });

  it('counts keys recursively in nested objects', () => {
    expect(countKeys({ a: 1, b: { c: 2, d: 3 } })).toBe(4);
  });

  it('counts keys inside arrays', () => {
    expect(countKeys([{ a: 1 }, { b: 2 }])).toBe(2);
  });

  it('returns 0 for primitives', () => {
    expect(countKeys(null)).toBe(0);
    expect(countKeys(42)).toBe(0);
    expect(countKeys('str')).toBe(0);
  });

  it('returns 0 for empty object', () => {
    expect(countKeys({})).toBe(0);
  });
});

describe('getMaxDepth', () => {
  it('returns 0 for a primitive', () => {
    expect(getMaxDepth(42)).toBe(0);
    expect(getMaxDepth(null)).toBe(0);
  });

  it('returns 1 for a flat object', () => {
    expect(getMaxDepth({ a: 1, b: 2 })).toBe(1);
  });

  it('returns 3 for three levels of nesting', () => {
    expect(getMaxDepth({ a: { b: { c: 1 } } })).toBe(3);
  });

  it('handles arrays correctly', () => {
    expect(getMaxDepth([{ a: { b: 1 } }])).toBe(3);
  });
});

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('generateId', () => {
  it('includes a sanitized label', () => {
    const id = generateId('my-label');
    expect(id).toMatch(/^my-label-/);
  });

  it('replaces unsafe characters with hyphens', () => {
    const id = generateId('hello world!');
    expect(id).toMatch(/^hello-world--/);
  });

  it('truncates labels longer than 50 characters', () => {
    const longLabel = 'a'.repeat(60);
    const id = generateId(longLabel);
    const labelPart = id.split('-').slice(0, -6).join('-');
    expect(labelPart.length).toBeLessThanOrEqual(50);
  });
});
