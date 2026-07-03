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

export function migrateTest(code: string): TestMigration {
  let count = 0;
  let out = code;

  // requireActual has a different name in Vitest
  out = out.replace(/\bjest\.requireActual\b/g, () => { count += 1; return 'vi.importActual'; });
  // the rest map 1:1 onto vi.*
  out = out.replace(new RegExp(`\\bjest\\.(${JEST_METHODS})\\b`, 'g'), (_m, x: string) => { count += 1; return `vi.${x}`; });

  const usesGlobals = /\b(describe|it|test|expect|vi|beforeEach|afterEach|beforeAll|afterAll)\b/.test(out);
  const hasVitestImport = /from ['"]vitest['"]/.test(out);
  let addedImport = false;
  if (usesGlobals && !hasVitestImport) {
    out = `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';\n${out}`;
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
