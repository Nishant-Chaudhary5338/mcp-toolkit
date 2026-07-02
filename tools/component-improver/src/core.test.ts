import { describe, it, expect } from 'vitest';
import { isVoidElement, generateExtendedTestCode, generateExtendedStoriesCode } from './core.js';

describe('isVoidElement', () => {
  it('recognizes void components', () => {
    expect(isVoidElement('input')).toBe(true);
    expect(isVoidElement('img')).toBe(true);
    expect(isVoidElement('Button')).toBe(false);
  });
});

describe('generateExtendedTestCode', () => {
  it('emits a Vitest + RTL test suite for the component', () => {
    const code = generateExtendedTestCode('Button', 'Button');
    expect(code).toContain('describe(');
    expect(code).toContain('Button');
    expect(code).toMatch(/import .*render.*@testing-library\/react/);
  });

  it('renders void components without children', () => {
    const code = generateExtendedTestCode('Input', 'input');
    expect(code).toContain('Input');
    // void elements are self-closed, not given children
    expect(code).not.toContain('>children<');
  });
});

describe('generateExtendedStoriesCode', () => {
  it('emits a Storybook stories file', () => {
    const code = generateExtendedStoriesCode('Button', 'Button');
    expect(code).toContain('Meta');
    expect(code).toContain('Button');
    expect(code).toContain('export default');
  });
});
