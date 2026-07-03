import { describe, it, expect } from 'vitest';
import { migrateTest, isMigratableTestFile } from './core.js';

describe('migrateTest', () => {
  it('rewrites jest.* to vi.* and requireActual to importActual', () => {
    const r = migrateTest('const m = jest.fn();\njest.spyOn(x, "y");\nconst a = jest.requireActual("z");');
    expect(r.code).toContain('vi.fn()');
    expect(r.code).toContain('vi.spyOn(x, "y")');
    expect(r.code).toContain('vi.importActual("z")');
    expect(r.count).toBe(3);
  });

  it('adds the vitest import with only the globals actually used, when none present', () => {
    const r = migrateTest('describe("x", () => { it("y", () => { expect(1).toBe(1); }); });');
    expect(r.addedImport).toBe(true);
    expect(r.code.startsWith('import { describe, it, expect } from \'vitest\';')).toBe(true);
  });

  it('does not add a duplicate import', () => {
    const r = migrateTest("import { describe, it, expect } from 'vitest';\ndescribe('x', () => {});");
    expect(r.addedImport).toBe(false);
  });

  it('imports `test` (not `it`) when the file uses CRA/plain Jest\'s test() global (QA harness regression)', () => {
    // Found dogfooding the real "apply" path against a genuine create-react-app
    // fixture: its default App.test.tsx uses `test(...)`, not `it(...)`. The
    // old fixed import list `{ describe, it, expect, vi, beforeEach, afterEach }`
    // never included `test`, producing a ReferenceError under Vitest without
    // `globals: true`.
    const r = migrateTest('test("renders", () => { expect(1).toBe(1); });');
    expect(r.addedImport).toBe(true);
    expect(r.code).toContain("import { test, expect } from 'vitest';");
    expect(r.code).not.toContain(', it,');
  });

  it('includes beforeAll/afterAll when used, and only the globals actually referenced', () => {
    const r = migrateTest('beforeAll(() => {});\nafterAll(() => {});\nit("x", () => { expect(1).toBe(1); });');
    expect(r.code).toContain("import { it, expect, beforeAll, afterAll } from 'vitest';");
  });

  it('flags vi.mock factories for review', () => {
    const r = migrateTest('jest.mock("./api", () => ({ get: jest.fn() }));');
    expect(r.needsReview.length).toBe(1);
    expect(r.code).toContain('vi.mock("./api"');
  });

  it('does not treat a global name mentioned only in a comment as "used" (QA harness regression)', () => {
    // Found dogfooding the real cra-to-vite "apply" path: CRA's own
    // setupTests.ts has `// expect(element).toHaveTextContent(...)` in a
    // comment. Scanning raw text matched "expect" and injected an unused
    // `import { expect } from 'vitest'`, which trips noUnusedLocals under the
    // scaffolded strict tsconfig — the same class of bug as the React import.
    const r = migrateTest("// expect(element).toHaveTextContent(/react/i)\nimport '@testing-library/jest-dom';\n");
    expect(r.addedImport).toBe(false);
    expect(r.code).not.toContain('import { expect }');
  });

  it('rewrites @testing-library/jest-dom to its /vitest subpath (QA harness regression)', () => {
    // Found dogfooding the real cra-to-vite "apply" path: the bare import only
    // auto-extends Jest's global expect. Under Vitest's separate, Chai-based
    // expect, every custom matcher (toBeInTheDocument, etc.) throws "Invalid
    // Chai property" unless registered via this dedicated subpath.
    const r = migrateTest("import '@testing-library/jest-dom';\n");
    expect(r.code).toContain("import '@testing-library/jest-dom/vitest';");
    expect(r.count).toBe(1);
  });
});

describe('isMigratableTestFile', () => {
  it('matches .test./.spec. files', () => {
    expect(isMigratableTestFile('App.test.tsx')).toBe(true);
    expect(isMigratableTestFile('util.spec.ts')).toBe(true);
  });

  it("matches CRA's setupTests.ts/js — not named *.test.*, but where the jest-dom import lives (QA harness regression)", () => {
    expect(isMigratableTestFile('setupTests.ts')).toBe(true);
    expect(isMigratableTestFile('setupTests.js')).toBe(true);
  });

  it('does not match ordinary application source', () => {
    expect(isMigratableTestFile('App.tsx')).toBe(false);
  });
});
