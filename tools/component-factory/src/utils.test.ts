import { describe, it, expect } from 'vitest';
import { validateComponentName } from './utils.js';

describe('validateComponentName', () => {
  it('accepts valid PascalCase names', () => {
    expect(validateComponentName('Button').valid).toBe(true);
    expect(validateComponentName('MyComponent').valid).toBe(true);
    expect(validateComponentName('UserCard123').valid).toBe(true);
  });

  it('rejects names starting with a lowercase letter', () => {
    const result = validateComponentName('button');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/PascalCase/);
  });

  it('rejects names with hyphens and suggests PascalCase alternative', () => {
    const result = validateComponentName('my-button');
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBe('myButton');
    expect(result.error).toContain('myButton');
  });

  it('rejects names with spaces', () => {
    const result = validateComponentName('My Component');
    expect(result.valid).toBe(false);
  });

  it('rejects empty string', () => {
    const result = validateComponentName('');
    expect(result.valid).toBe(false);
  });

  it('accepts names with numbers after the first character', () => {
    expect(validateComponentName('Card3D').valid).toBe(true);
  });
});
