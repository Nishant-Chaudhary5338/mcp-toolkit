// fix-failing-tests CORE — pure logic (no MCP transport).
// Detect the test runner, run tests, parse + classify failures, and generate
// targeted fix code. Reconstructed core-first during the port (the turborepo
// copy had an empty registerTools and no entry point).

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface TestFailure {
  testName: string;
  file: string;
  error: string;
  errorType: 'assertion' | 'import' | 'type' | 'runtime' | 'timeout' | 'unknown';
  line?: number;
  column?: number;
  actual?: string;
  expected?: string;
  suggestion: string;
  fixCode?: string;
}

export interface TestRunResult {
  passed: number;
  failed: number;
  skipped: number;
  failures: TestFailure[];
  duration: number;
}

// ============================================================================
// TEST RUNNER
// ============================================================================

export function detectTestRunner(projectRoot: string): 'vitest' | 'jest' | 'unknown' {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps.vitest) return 'vitest';
    if (allDeps.jest) return 'jest';
  }
  if (fs.existsSync(path.join(projectRoot, 'vitest.config.ts'))) return 'vitest';
  if (fs.existsSync(path.join(projectRoot, 'jest.config.ts'))) return 'jest';
  return 'unknown';
}

export function runTests(projectRoot: string, testPath?: string): TestRunResult {
  const runner = detectTestRunner(projectRoot);
  const startTime = Date.now();

  try {
    const cmd = runner === 'vitest'
      ? `npx vitest run ${testPath || ''} --reporter=json 2>&1 || true`
      : `npx jest ${testPath || ''} --json 2>&1 || true`;

    const output = execSync(cmd, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return parseTestOutput(output, runner, Date.now() - startTime);
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    const output = e.stdout || e.stderr || e.message || '';
    return parseTestOutput(output, runner, Date.now() - startTime);
  }
}

export function parseTestOutput(output: string, runner: string, duration: number): TestRunResult {
  const failures: TestFailure[] = [];
  let passed = 0, failed = 0, skipped = 0;

  // Try JSON parse first
  try {
    const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data.testResults) {
        for (const suite of data.testResults) {
          for (const test of suite.testResults || []) {
            if (test.status === 'passed') passed++;
            else if (test.status === 'failed') {
              failed++;
              const error = test.failureMessages?.[0] || '';
              failures.push(classifyFailure(test.fullName || test.title, suite.name, error));
            } else skipped++;
          }
        }
        return { passed, failed, skipped, failures, duration };
      }
    }
  } catch {}

  // Vitest JSON format
  try {
    const vitestMatch = output.match(/\{[\s\S]*"numPassedTests"[\s\S]*\}/);
    if (vitestMatch) {
      const data = JSON.parse(vitestMatch[0]);
      passed = data.numPassedTests || 0;
      failed = data.numFailedTests || 0;
      skipped = data.numPendingTests || 0;
      for (const suite of data.testResults || []) {
        for (const test of suite.testResults || []) {
          if (test.status === 'failed') {
            const error = test.failureMessages?.[0] || '';
            failures.push(classifyFailure(test.fullName || test.title, suite.name, error));
          }
        }
      }
      if (failed > 0 || passed > 0) return { passed, failed, skipped, failures, duration };
    }
  } catch {}

  // Fallback: parse text output
  const failRegex = /(?:FAIL|✕|×)\s+(.+)/g;
  let match;
  while ((match = failRegex.exec(output)) !== null) {
    failed++;
    failures.push(classifyFailure('test', match[1].trim(), output));
  }

  const passMatch = output.match(/(\d+)\s+passed/);
  if (passMatch) passed = parseInt(passMatch[1]);
  const failMatch = output.match(/(\d+)\s+failed/);
  if (failMatch) failed = parseInt(failMatch[1]);

  return { passed, failed, skipped, failures, duration };
}

export function classifyFailure(testName: string, file: string, error: string): TestFailure {
  let errorType: TestFailure['errorType'] = 'unknown';
  let suggestion = 'Review the test and source code for issues.';
  let fixCode: string | undefined;

  // Import/module errors
  if (error.includes('Cannot find module') || error.includes('Module not found') || error.includes('ERR_MODULE_NOT_FOUND')) {
    errorType = 'import';
    const moduleMatch = error.match(/Cannot find module ['"]([^'"]+)['"]/);
    if (moduleMatch) {
      suggestion = `Module '${moduleMatch[1]}' not found. Check import path, install the package, or verify tsconfig paths.`;
      fixCode = `// Verify: import exists at the expected path\n// Fix: npm install ${moduleMatch[1]} or correct the import path`;
    }
  }
  // Type errors
  else if (error.includes('Type "') || error.includes('is not assignable') || error.includes('Property') && error.includes('does not exist')) {
    errorType = 'type';
    suggestion = 'TypeScript type mismatch. Check prop types, generic parameters, or add type assertions.';
    fixCode = `// Fix: ensure types match between test assertions and component props`;
  }
  // Assertion errors
  else if (error.includes('Expected') || error.includes('expect(') || error.includes('AssertionError') || error.includes('toBe') || error.includes('toEqual')) {
    errorType = 'assertion';
    const expectedMatch = error.match(/Expected:\s*(.+?)(?:\n|Received)/s);
    const actualMatch = error.match(/Received:\s*(.+?)(?:\n|$)/s);
    suggestion = 'Assertion failed. The actual output does not match the expected value.';
    if (expectedMatch && actualMatch) {
      suggestion = `Expected "${expectedMatch[1].trim()}" but received "${actualMatch[1].trim()}". Update the assertion or fix the source code.`;
    }
  }
  // Timeout errors
  else if (error.includes('Timeout') || error.includes('timeout') || error.includes('exceeded')) {
    errorType = 'timeout';
    suggestion = 'Test timed out. Check for unresolved promises, missing act() wrappers, or increase timeout.';
    fixCode = `// Wrap state updates in act()\nimport { act } from '@testing-library/react';\nawait act(async () => { /* trigger update */ });`;
  }
  // Runtime errors
  else {
    errorType = 'runtime';
    if (error.includes('is not a function')) {
      const fnMatch = error.match(/(\w+)\.(\w+) is not a function/);
      if (fnMatch) {
        suggestion = `"${fnMatch[2]}" is not a function on "${fnMatch[1]}". Check if the method exists or add a mock.`;
        fixCode = `vi.mock('./${fnMatch[1]}', () => ({ ${fnMatch[2]}: vi.fn() }));`;
      }
    } else if (error.includes('Cannot read propert')) {
      suggestion = 'Cannot read property of undefined/null. Add null checks or provide required props in test.';
      fixCode = `// Ensure required props are passed:\nrender(<Component requiredProp={mockValue} />);`;
    }
  }

  // Extract line/column if present
  const lineMatch = error.match(/:(\d+):(\d+)/);

  return {
    testName,
    file,
    error: error.slice(0, 500),
    errorType,
    line: lineMatch ? parseInt(lineMatch[1]) : undefined,
    column: lineMatch ? parseInt(lineMatch[2]) : undefined,
    suggestion,
    fixCode,
  };
}

// ============================================================================
// AUTO-FIX GENERATORS
// ============================================================================

export function generateFix(failure: TestFailure, sourceContent: string): string {
  switch (failure.errorType) {
    case 'import':
      return generateImportFix(failure, sourceContent);
    case 'assertion':
      return generateAssertionFix(failure);
    case 'type':
      return generateTypeFix(failure);
    case 'timeout':
      return generateTimeoutFix(failure);
    case 'runtime':
      return generateRuntimeFix(failure, sourceContent);
    default:
      return `// Manual review needed for: ${failure.testName}\n// Error: ${failure.error.slice(0, 200)}`;
  }
}

export function generateImportFix(failure: TestFailure, sourceContent: string): string {
  const moduleMatch = failure.error.match(/Cannot find module ['"]([^'"]+)['"]/);
  if (!moduleMatch) return '// Could not determine missing module';
  const moduleName = moduleMatch[1];

  // Check if it's a relative import issue
  if (moduleName.startsWith('.')) {
    return `// The import path "${moduleName}" could not be resolved.\n// Check that the file exists and the path is correct.\n// Common fix: verify file extension (.ts vs .tsx vs .js)`;
  }

  return `// Module "${moduleName}" is not installed.\n// Run: npm install ${moduleName}\n// If it's a dev dependency: npm install -D ${moduleName}`;
}

export function generateAssertionFix(failure: TestFailure): string {
  const error = failure.error;
  if (error.includes('toBeInTheDocument')) {
    return `// Element not found in DOM. Verify:\n// 1. Component renders the expected text\n// 2. Use the correct query (getByText, getByRole, etc.)\n// 3. Wrap in act() if state updates occur`;
  }
  if (error.includes('toBe') || error.includes('toEqual')) {
    return `// Assertion mismatch. Options:\n// 1. Update expected value to match actual behavior\n// 2. Fix source code to produce expected output\n// 3. Use toMatchObject() for partial matching`;
  }
  return '// Review the assertion and update expected/actual values';
}

export function generateTypeFix(failure: TestFailure): string {
  if (failure.error.includes('not assignable')) {
    return `// Type mismatch in test. Fix options:\n// 1. Cast the value: as unknown as ExpectedType\n// 2. Update component props interface\n// 3. Use proper mock types`;
  }
  return '// Fix TypeScript types to match expected interface';
}

export function generateTimeoutFix(_failure: TestFailure): string {
  return `// Test timeout fix:\nimport { act } from '@testing-library/react';

// Wrap async state updates:
await act(async () => {
  fireEvent.click(button);
});

// Or increase timeout:
it('long test', async () => {
  // test code
}, 10000); // 10 second timeout`;
}

export function generateRuntimeFix(failure: TestFailure, sourceContent: string): string {
  if (failure.error.includes('is not a function')) {
    const fnMatch = failure.error.match(/(\w+)\.(\w+) is not a function/);
    if (fnMatch) {
      return `// Mock the missing function:\nvi.mock('${sourceContent.includes(fnMatch[1]) ? './' + fnMatch[1] : 'module'}', () => ({\n  ${fnMatch[2]}: vi.fn(),\n}));`;
    }
  }
  if (failure.error.includes('Cannot read propert')) {
    return `// Ensure required props are provided:\nconst defaultProps = {\n  // add required props here\n};\nrender(<Component {...defaultProps} />);`;
  }
  return '// Add proper mocks and test setup for this error';
}

// ============================================================================
// FILE SCANNING
// ============================================================================

export function findTestFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'build', 'dist', '.next'].includes(entry.name)) continue;
      files.push(...findTestFiles(fullPath));
    } else if (entry.name.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function findSourceForTest(testFile: string): string | null {
  const dir = path.dirname(testFile);
  const ext = path.extname(testFile);
  const baseName = path.basename(testFile, ext).replace(/\.(test|spec)$/, '');
  const sourceExts = ['.ts', '.tsx', '.js', '.jsx'] as const;
  for (const sourceExt of sourceExts) {
    const sourcePath = path.join(dir, `${baseName}${sourceExt}`);
    if (fs.existsSync(sourcePath)) return sourcePath;
  }
  return null;
}
