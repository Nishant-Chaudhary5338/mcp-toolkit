import { describe, it, expect } from 'vitest';
import { analyzeFile, filterByImpact } from './rules.js';

describe('image-alt rule', () => {
  it('flags img without alt', () => {
    const issues = analyzeFile('test.tsx', '<img src="hero.png" />');
    expect(issues.some(i => i.rule === 'image-alt')).toBe(true);
  });

  it('passes img with alt attribute', () => {
    const issues = analyzeFile('test.tsx', '<img src="hero.png" alt="Hero image" />');
    expect(issues.some(i => i.rule === 'image-alt')).toBe(false);
  });

  it('passes img with aria-label', () => {
    const issues = analyzeFile('test.tsx', '<img src="logo.png" aria-label="Company logo" />');
    expect(issues.some(i => i.rule === 'image-alt')).toBe(false);
  });
});

describe('button-name rule', () => {
  it('flags empty button', () => {
    const issues = analyzeFile('test.tsx', '<button></button>');
    expect(issues.some(i => i.rule === 'button-name')).toBe(true);
  });

  it('flags icon-only button without aria-label', () => {
    const issues = analyzeFile('test.tsx', '<button><svg /></button>');
    expect(issues.some(i => i.rule === 'button-name')).toBe(true);
  });

  it('passes button with aria-label', () => {
    const issues = analyzeFile('test.tsx', '<button aria-label="Close"><svg /></button>');
    expect(issues.some(i => i.rule === 'button-name')).toBe(false);
  });
});

describe('tabindex rule', () => {
  it('flags positive tabindex', () => {
    const issues = analyzeFile('test.tsx', '<div tabindex="3">Focus me</div>');
    expect(issues.some(i => i.rule === 'tabindex')).toBe(true);
  });

  it('passes tabindex="0"', () => {
    const issues = analyzeFile('test.tsx', '<div tabindex="0">Focus me</div>');
    expect(issues.some(i => i.rule === 'tabindex')).toBe(false);
  });

  it('passes tabindex="-1"', () => {
    const issues = analyzeFile('test.tsx', '<div tabindex="-1">Focus me</div>');
    expect(issues.some(i => i.rule === 'tabindex')).toBe(false);
  });
});

describe('aria-roles rule', () => {
  it('flags invalid ARIA role', () => {
    const issues = analyzeFile('test.tsx', '<div role="fakeRole">Content</div>');
    expect(issues.some(i => i.rule === 'aria-roles')).toBe(true);
  });

  it('passes valid ARIA role', () => {
    const issues = analyzeFile('test.tsx', '<div role="dialog">Content</div>');
    expect(issues.some(i => i.rule === 'aria-roles')).toBe(false);
  });
});

describe('heading-order rule', () => {
  it('flags skipped heading level', () => {
    const html = '<h1>Title</h1>\n<h3>Section</h3>';
    const issues = analyzeFile('test.html', html);
    expect(issues.some(i => i.rule === 'heading-order')).toBe(true);
  });

  it('passes sequential heading levels', () => {
    const html = '<h1>Title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>';
    const issues = analyzeFile('test.html', html);
    expect(issues.some(i => i.rule === 'heading-order')).toBe(false);
  });
});

describe('filterByImpact', () => {
  it('returns only critical issues when minImpact is critical', () => {
    const issues = analyzeFile('test.tsx', '<img src="a.png" />\n<div tabindex="2">x</div>');
    const filtered = filterByImpact(issues, 'critical');
    expect(filtered.every(i => i.impact === 'critical')).toBe(true);
  });

  it('returns critical and serious when minImpact is serious', () => {
    const issues = analyzeFile('test.tsx', '<img src="a.png" />\n<div tabindex="2">x</div>');
    const filtered = filterByImpact(issues, 'serious');
    const impacts = new Set(filtered.map(i => i.impact));
    expect(impacts.has('moderate')).toBe(false);
    expect(impacts.has('minor')).toBe(false);
  });
});
