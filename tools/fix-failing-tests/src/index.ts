#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import { runTests, detectTestRunner, generateFix, findSourceForTest } from './core.js';

interface RunArgs {
  projectRoot: string;
  testPath?: string;
}

const RUN_SCHEMA = {
  type: 'object' as const,
  properties: {
    projectRoot: { type: 'string', description: 'Absolute path to the project root (where package.json lives).' },
    testPath: { type: 'string', description: 'Optional path or pattern to limit which tests run.' },
  },
  required: ['projectRoot'],
};

class FixFailingTestsServer extends McpServerBase {
  constructor() {
    super({ name: 'fix-failing-tests', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'run_tests',
      'Run the project test suite (auto-detects Vitest or Jest) and return a pass/fail summary with the list of failures.',
      RUN_SCHEMA,
      async (args) => {
        const { projectRoot, testPath } = (args ?? {}) as RunArgs;
        if (!projectRoot) return this.error(new Error('Missing required argument "projectRoot".'));
        try {
          const result = runTests(projectRoot, testPath);
          return this.successWithDashboard('Fix Failing Tests', {
            allPassing: result.failed === 0,
            runner: detectTestRunner(projectRoot),
            passed: result.passed,
            failed: result.failed,
            skipped: result.skipped,
            duration: result.duration,
            failures: result.failures.map((f) => ({ testName: f.testName, file: f.file, errorType: f.errorType, error: f.error.slice(0, 300) })),
          });
        } catch (err) {
          return this.error(err);
        }
      },
    );

    this.addTool(
      'analyze_failures',
      'Run the tests and classify each failure by root cause (import, type, assertion, timeout, runtime) with a targeted suggestion.',
      RUN_SCHEMA,
      async (args) => {
        const { projectRoot, testPath } = (args ?? {}) as RunArgs;
        if (!projectRoot) return this.error(new Error('Missing required argument "projectRoot".'));
        try {
          const result = runTests(projectRoot, testPath);
          if (result.failed === 0) return this.successWithDashboard('Fix Failing Tests', { allPassing: true, passed: result.passed });
          return this.successWithDashboard('Fix Failing Tests', {
            totalFailures: result.failed,
            errorBreakdown: {
              assertion: result.failures.filter((f) => f.errorType === 'assertion').length,
              import: result.failures.filter((f) => f.errorType === 'import').length,
              type: result.failures.filter((f) => f.errorType === 'type').length,
              runtime: result.failures.filter((f) => f.errorType === 'runtime').length,
              timeout: result.failures.filter((f) => f.errorType === 'timeout').length,
            },
            analyses: result.failures.map((f) => ({ testName: f.testName, file: f.file, errorType: f.errorType, error: f.error, line: f.line, column: f.column, suggestion: f.suggestion, fixCode: f.fixCode })),
          });
        } catch (err) {
          return this.error(err);
        }
      },
    );

    this.addTool(
      'auto_fix',
      'Run the tests and generate targeted fix code for each failure (import path corrections, act() wrappers, mocks, assertion updates).',
      RUN_SCHEMA,
      async (args) => {
        const { projectRoot, testPath } = (args ?? {}) as RunArgs;
        if (!projectRoot) return this.error(new Error('Missing required argument "projectRoot".'));
        try {
          const result = runTests(projectRoot, testPath);
          if (result.failed === 0) return this.successWithDashboard('Fix Failing Tests', { message: 'All tests passing — no fixes needed', passed: result.passed });
          const fixes = result.failures.map((f) => {
            const sourceFile = findSourceForTest(f.file);
            const sourceContent = sourceFile ? fs.readFileSync(sourceFile, 'utf-8') : '';
            return { testName: f.testName, file: f.file, errorType: f.errorType, suggestion: f.suggestion, fixCode: generateFix(f, sourceContent) };
          });
          return this.successWithDashboard('Fix Failing Tests', { totalFixes: fixes.length, fixes });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new FixFailingTestsServer().run().catch(console.error);
