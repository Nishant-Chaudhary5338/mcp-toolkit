import { describe, it, expect } from 'vitest';
import { extractStrings, buildCatalog } from './core.js';

const SRC = `export function C() {
  return (
    <div>
      <h1>Welcome back</h1>
      <input placeholder="Search articles" aria-label="Search" />
      <button>{label}</button>
      <span>{count}</span>
      <p>Save changes</p>
    </div>
  );
}`;

describe('extractStrings', () => {
  it('finds JSX text and translatable attributes, skips interpolations', () => {
    const hits = extractStrings(SRC, 'C.tsx');
    const texts = hits.map((h) => h.text);
    expect(texts).toContain('Welcome back');
    expect(texts).toContain('Search articles');
    expect(texts).toContain('Search');
    expect(texts).toContain('Save changes');
    expect(texts).not.toContain('{label}');
    expect(texts).not.toContain('{count}');
  });

  it('generates slug keys from text', () => {
    const hits = extractStrings('<h1>Welcome back</h1>', 'a.tsx');
    expect(hits[0]?.key).toBe('welcome_back');
  });
});

describe('buildCatalog', () => {
  it('builds a catalog and disambiguates conflicting keys', () => {
    const r = buildCatalog([
      { text: 'Save', line: 1, source: 'jsx-text', key: 'save' },
      { text: 'Save the file', line: 2, source: 'jsx-text', key: 'save' },
    ]);
    expect(r.catalog['save']).toBe('Save');
    expect(Object.keys(r.catalog)).toContain('save_2');
    expect(r.count).toBe(2);
  });
});
