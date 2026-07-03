import { describe, it, expect } from 'vitest';
import { diffContracts } from './core.js';

describe('diffContracts', () => {
  it('flags a removed field as breaking', () => {
    const r = diffContracts({ id: 1, name: 'x', legacy: true }, { id: 1, name: 'x' });
    expect(r.passed).toBe(false);
    expect(r.breaking.map((c) => c.path)).toContain('legacy');
    expect(r.breaking[0]?.kind).toBe('removed');
  });

  it('flags a type change as breaking', () => {
    const r = diffContracts({ id: 1 }, { id: 'one' });
    expect(r.passed).toBe(false);
    expect(r.breaking[0]).toMatchObject({ path: 'id', kind: 'type-changed', from: 'number', to: 'string' });
  });

  it('treats a new field as additive (non-breaking)', () => {
    const r = diffContracts({ id: 1 }, { id: 1, extra: 'y' });
    expect(r.passed).toBe(true);
    expect(r.additive.map((c) => c.path)).toContain('extra');
  });

  it('diffs nested objects by dot-path', () => {
    const r = diffContracts({ author: { id: 1, name: 'a' } }, { author: { id: 1 } });
    expect(r.breaking.map((c) => c.path)).toContain('author.name');
  });

  it('reads OpenAPI-style properties shape', () => {
    const oldC = { properties: { id: { }, title: {} } };
    // flatten of the properties objects: id/title are objects -> compare presence
    const r = diffContracts(oldC, { properties: { id: {} } });
    expect(r.passed).toBe(false);
  });
});
