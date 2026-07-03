// jest-to-vitest-migrator CORE — pure logic (no MCP transport).
//
// Migrate existing Jest test files to Vitest: jest.* → vi.* (with the
// requireActual→importActual rename), add the vitest import, and flag
// vi.mock factories whose hoisting/semantics need a human check.

export interface TestMigration {
  code: string;
  count: number;
  addedImport: boolean;
  needsReview: { line: number; reason: string }[];
}

const JEST_METHODS = 'fn|mock|unmock|doMock|spyOn|clearAllMocks|resetAllMocks|restoreAllMocks|resetModules|useFakeTimers|useRealTimers|advanceTimersByTime|runAllTimers|runOnlyPendingTimers|setSystemTime|mocked|isMockFunction';

// CRA's setupTests.ts/.js isn't named *.test.*/*.spec.*, but it's exactly where
// `import '@testing-library/jest-dom'` lives and needs the /vitest subpath
// rewrite — found dogfooding the real cra-to-vite "apply" path, where this
// file was never scanned at all before.
const SETUP_FILE_RE = /^setupTests\.(tsx?|jsx?)$/;

/** True if this filename should be scanned/migrated by jest-to-vitest-migrator. */
export function isMigratableTestFile(filename: string): boolean {
  return /\.(test|spec)\.(tsx?|jsx?)$/.test(filename) || SETUP_FILE_RE.test(filename);
}

export function migrateTest(code: string): TestMigration {
  let count = 0;
  let out = code;

  // @testing-library/jest-dom's bare import only auto-extends Jest's global
  // expect. Under Vitest (a separate, Chai-based expect), the matchers must be
  // registered via the dedicated /vitest subpath, or every custom matcher
  // (toBeInTheDocument, etc.) throws "Invalid Chai property" — found dogfooding
  // the real cra-to-vite "apply" path against a genuine create-react-app fixture.
  out = out.replace(/(\bfrom\s+|\bimport\s+)(['"])@testing-library\/jest-dom\2/g, (_m, kw: string, q: string) => { count += 1; return `${kw}${q}@testing-library/jest-dom/vitest${q}`; });

  // requireActual has a different name in Vitest
  out = out.replace(/\bjest\.requireActual\b/g, () => { count += 1; return 'vi.importActual'; });
  // the rest map 1:1 onto vi.*
  out = out.replace(new RegExp(`\\bjest\\.(${JEST_METHODS})\\b`, 'g'), (_m, x: string) => { count += 1; return `vi.${x}`; });

  // Import only the globals this file actually references — a fixed subset
  // previously missed `test` (CRA's own default test template uses `test(...)`,
  // not `it(...)`) and `beforeAll`/`afterAll`, producing a file that throws
  // `ReferenceError` under Vitest without `globals: true`. Found dogfooding
  // the real "apply" path against a genuine create-react-app fixture.
  //
  // Scan a comment-stripped copy, not the real output: CRA's own setupTests.ts
  // template has `// expect(element).toHaveTextContent(...)` in a comment —
  // scanning raw text matched "expect" there and injected an unused import,
  // which trips noUnusedLocals under the scaffolded strict tsconfig. Also
  // found dogfooding the real "apply" path.
  const withoutComments = out.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const VITEST_GLOBALS = ['describe', 'it', 'test', 'expect', 'vi', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'] as const;
  const usedGlobals = VITEST_GLOBALS.filter((g) => new RegExp(`\\b${g}\\b`).test(withoutComments));
  const hasVitestImport = /from ['"]vitest['"]/.test(out);
  let addedImport = false;
  if (usedGlobals.length > 0 && !hasVitestImport) {
    out = `import { ${usedGlobals.join(', ')} } from 'vitest';\n${out}`;
    addedImport = true;
  }

  const needsReview: { line: number; reason: string }[] = [];
  out.split('\n').forEach((raw, i) => {
    if (/vi\.mock\([^)]*,\s*(\(\)|async\s*\(\))\s*=>/.test(raw)) {
      needsReview.push({ line: i + 1, reason: 'vi.mock factory — Vitest hoists differently; verify importActual and module references.' });
    }
  });

  return { code: out, count, addedImport, needsReview };
}
