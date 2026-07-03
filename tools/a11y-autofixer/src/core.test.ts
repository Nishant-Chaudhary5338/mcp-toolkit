import { describe, it, expect } from 'vitest';
import { fixA11y } from './core.js';

describe('fixA11y', () => {
  it('adds alt="" to images missing alt', () => {
    const r = fixA11y('<img src="x.png" />');
    expect(r.code).toContain('alt=""');
    expect(r.fixes[0]?.rule).toBe('img-alt');
    expect(r.count).toBe(1);
  });

  it('does not touch images that already have alt', () => {
    const r = fixA11y('<img src="x.png" alt="A cat" />');
    expect(r.count).toBe(0);
  });

  it('adds rel to target=_blank links', () => {
    const r = fixA11y('<a href="/x" target="_blank">Go</a>');
    expect(r.code).toContain('rel="noopener noreferrer"');
  });

  it('renames for-> htmlFor and tabindex-> tabIndex', () => {
    const r = fixA11y('<label for="email">Email</label>\n<div tabindex="0" />');
    expect(r.code).toContain('htmlFor="email"');
    expect(r.code).toContain('tabIndex="0"');
    expect(r.count).toBe(2);
  });
});
