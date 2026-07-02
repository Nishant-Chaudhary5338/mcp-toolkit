import { describe, it, expect } from 'vitest';
import { classifyFailure, parseTestOutput } from './core.js';

describe('classifyFailure', () => {
  it('classifies module-not-found as an import error', () => {
    const f = classifyFailure('renders', 'a.test.tsx', "Cannot find module './Button'");
    expect(f.errorType).toBe('import');
    expect(f.suggestion).toContain('Button');
  });

  it('classifies assertion mismatches', () => {
    const f = classifyFailure('adds', 'a.test.ts', 'AssertionError: expected 2 to be 3\nExpected: 3\nReceived: 2');
    expect(f.errorType).toBe('assertion');
  });

  it('classifies type errors', () => {
    const f = classifyFailure('types', 'a.test.ts', "Type 'string' is not assignable to type 'number'");
    expect(f.errorType).toBe('type');
  });

  it('classifies timeouts', () => {
    const f = classifyFailure('async', 'a.test.ts', 'Test timeout of 5000ms exceeded');
    expect(f.errorType).toBe('timeout');
    expect(f.fixCode).toContain('act(');
  });

  it('classifies "is not a function" as runtime and suggests a mock', () => {
    const f = classifyFailure('calls', 'a.test.ts', 'api.fetch is not a function');
    expect(f.errorType).toBe('runtime');
    expect(f.fixCode).toContain('vi.mock');
  });

  it('extracts line/column when present', () => {
    const f = classifyFailure('x', 'a.test.ts', 'Error at file.ts:42:7');
    expect(f.line).toBe(42);
    expect(f.column).toBe(7);
  });
});

describe('parseTestOutput', () => {
  it('returns a structured result object', () => {
    const r = parseTestOutput('Tests  2 passed (2)', 'vitest', 100);
    expect(r).toHaveProperty('failures');
    expect(Array.isArray(r.failures)).toBe(true);
  });
});
