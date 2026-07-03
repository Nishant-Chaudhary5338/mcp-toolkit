import { describe, it, expect } from 'vitest';
import { migrateTest } from './core.js';

describe('migrateTest', () => {
  it('rewrites jest.* to vi.* and requireActual to importActual', () => {
    const r = migrateTest('const m = jest.fn();\njest.spyOn(x, "y");\nconst a = jest.requireActual("z");');
    expect(r.code).toContain('vi.fn()');
    expect(r.code).toContain('vi.spyOn(x, "y")');
    expect(r.code).toContain('vi.importActual("z")');
    expect(r.count).toBe(3);
  });

  it('adds the vitest import when globals are used and none present', () => {
    const r = migrateTest('describe("x", () => { it("y", () => { expect(1).toBe(1); }); });');
    expect(r.addedImport).toBe(true);
    expect(r.code.startsWith("import { describe, it, expect, vi")).toBe(true);
  });

  it('does not add a duplicate import', () => {
    const r = migrateTest("import { describe, it, expect } from 'vitest';\ndescribe('x', () => {});");
    expect(r.addedImport).toBe(false);
  });

  it('flags vi.mock factories for review', () => {
    const r = migrateTest('jest.mock("./api", () => ({ get: jest.fn() }));');
    expect(r.needsReview.length).toBe(1);
    expect(r.code).toContain('vi.mock("./api"');
  });
});
