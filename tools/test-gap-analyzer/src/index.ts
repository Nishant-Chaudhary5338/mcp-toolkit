#!/usr/bin/env node
import { McpServerBase, safeReadFile } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface ExportInfo {
  name: string;
  type: 'function' | 'component' | 'hook' | 'class' | 'constant' | 'type';
  line: number;
}

interface EdgeCase {
  category: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

// ============================================================================
// SOURCE ANALYSIS
// ============================================================================

export function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const directMatch = line.match(/export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface)\s+(\w+)/);
    if (directMatch) {
      const name = directMatch[1];
      let type: ExportInfo['type'] = 'constant';
      if (line.includes('function') || line.includes('async')) type = 'function';
      else if (line.includes('class')) type = 'class';
      else if (line.includes('type') || line.includes('interface')) type = 'type';
      if (name.startsWith('use') && name[3] === name[3]?.toUpperCase()) type = 'hook';
      else if (/^[A-Z]/.test(name) && (content.includes('React') || content.includes('jsx') || content.includes('tsx'))) type = 'component';
      exports.push({ name, type, line: i + 1 });
    }

    // Named export blocks: export { name1, name2 }
    const blockMatch = line.match(/export\s+\{([^}]+)\}/);
    if (blockMatch) {
      blockMatch[1].split(',').forEach(e => {
        const trimmed = e.trim().split(/\s+as\s+/)[0].trim();
        if (trimmed && trimmed !== 'default') {
          exports.push({ name: trimmed, type: 'constant', line: i + 1 });
        }
      });
    }
  }

  return exports;
}

export function analyzeTestFile(testContent: string): { testedFunctions: string[]; testedBehaviors: Map<string, string[]> } {
  const testedFunctions: string[] = [];
  const testedBehaviors = new Map<string, string[]>();

  const describeRegex = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = describeRegex.exec(testContent)) !== null) {
    testedFunctions.push(match[1]);
  }

  const describeBlocks = testContent.split(/describe\s*\(/);
  for (const block of describeBlocks) {
    const nameMatch = block.match(/^['"`]([^'"`]+)['"`]/);
    if (!nameMatch) continue;
    const funcName = nameMatch[1];
    const behaviors: string[] = [];
    const itRegexLocal = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let itMatch;
    while ((itMatch = itRegexLocal.exec(block)) !== null) {
      behaviors.push(itMatch[1]);
    }
    if (behaviors.length > 0) testedBehaviors.set(funcName, behaviors);
  }

  return { testedFunctions, testedBehaviors };
}

// ============================================================================
// EDGE CASE DETECTION
// ============================================================================

export function detectMissingEdgeCases(exportInfo: ExportInfo, testedBehaviors: string[]): EdgeCase[] {
  const edgeCases: EdgeCase[] = [];
  const testedLower = testedBehaviors.map(b => b.toLowerCase());

  const commonEdgeCases: Record<string, EdgeCase[]> = {
    function: [
      { category: 'null-input', description: 'Test with null/undefined arguments', severity: 'high', suggestion: 'Pass null/undefined to verify graceful handling' },
      { category: 'empty-input', description: 'Test with empty string/array/object', severity: 'high', suggestion: 'Verify behavior with empty inputs' },
      { category: 'boundary-values', description: 'Test with boundary numeric values (0, -1, MAX_SAFE_INTEGER)', severity: 'medium', suggestion: 'Test edge numeric boundaries' },
      { category: 'type-coercion', description: 'Test with unexpected types', severity: 'medium', suggestion: 'Pass wrong types to verify type safety' },
      { category: 'async-error', description: 'Test error handling for async functions', severity: 'high', suggestion: 'Mock rejected promises and verify error handling' },
    ],
    component: [
      { category: 'no-children', description: 'Test rendering without children', severity: 'high', suggestion: 'Render component with no children prop' },
      { category: 'empty-className', description: 'Test with empty className', severity: 'low', suggestion: 'Verify default styles apply without className' },
      { category: 'disabled-state', description: 'Test disabled state rendering', severity: 'high', suggestion: 'Render with disabled prop and verify behavior' },
      { category: 'ref-forwarding', description: 'Test ref forwarding', severity: 'medium', suggestion: 'Pass ref and verify it attaches correctly' },
      { category: 'event-handlers', description: 'Test all event handlers', severity: 'high', suggestion: 'Fire events and verify handler calls' },
      { category: 'a11y', description: 'Test accessibility attributes', severity: 'high', suggestion: 'Verify aria-labels, roles, and keyboard navigation' },
    ],
    hook: [
      { category: 'initial-state', description: 'Test initial return values', severity: 'high', suggestion: 'Verify hook returns expected initial state' },
      { category: 'update-cycle', description: 'Test state updates trigger re-renders', severity: 'high', suggestion: 'Use act() to update and verify new state' },
      { category: 'cleanup', description: 'Test cleanup on unmount', severity: 'high', suggestion: 'Verify useEffect cleanup and event listener removal' },
      { category: 'multiple-instances', description: 'Test multiple hook instances', severity: 'medium', suggestion: 'Render multiple hooks and verify independence' },
    ],
    class: [
      { category: 'constructor', description: 'Test constructor initialization', severity: 'high', suggestion: 'Verify instance properties are set correctly' },
      { category: 'method-params', description: 'Test methods with invalid parameters', severity: 'high', suggestion: 'Pass invalid args to each method' },
      { category: 'inheritance', description: 'Test subclass behavior', severity: 'medium', suggestion: 'Verify subclass overrides work correctly' },
      { category: 'static-methods', description: 'Test static methods independently', severity: 'medium', suggestion: 'Call static methods without instantiation' },
    ],
    constant: [
      { category: 'immutability', description: 'Test that constant is not mutated', severity: 'low', suggestion: 'Verify value remains unchanged after operations' },
    ],
    type: [],
  };

  const cases = commonEdgeCases[exportInfo.type] || [];
  for (const edgeCase of cases) {
    const caseKeywords = [edgeCase.category, ...edgeCase.description.toLowerCase().split(' ')];
    const isCovered = testedLower.some(test => caseKeywords.some(keyword => test.includes(keyword)));
    if (!isCovered) edgeCases.push(edgeCase);
  }

  return edgeCases;
}

// ============================================================================
// FILE SCANNING
// ============================================================================

function scanDirectory(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'build', 'dist', '.next', '__snapshots__', '.turbo', '.git', 'coverage'].includes(entry.name)) continue;
      files.push(...scanDirectory(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.includes('.stories.') || entry.name.includes('.types.')) continue;
      files.push(fullPath);
    }
  }
  return files;
}

function findTestFile(sourceFile: string): string | null {
  const dir = path.dirname(sourceFile);
  const ext = path.extname(sourceFile);
  const baseName = path.basename(sourceFile, ext);
  // Include JS test extensions for plain JS projects
  const testExtensions = ['.test.tsx', '.test.ts', '.spec.tsx', '.spec.ts', '.test.jsx', '.test.js', '.spec.jsx', '.spec.js'];
  for (const testExt of testExtensions) {
    const testPath = path.join(dir, `${baseName}${testExt}`);
    if (fs.existsSync(testPath)) return testPath;
  }
  // Check __tests__ sibling directory
  const testsDir = path.join(dir, '__tests__');
  if (fs.existsSync(testsDir)) {
    for (const testExt of testExtensions) {
      const testPath = path.join(testsDir, `${baseName}${testExt}`);
      if (fs.existsSync(testPath)) return testPath;
    }
  }
  // Check parent __tests__ directory (common in CRA apps)
  const parentTestsDir = path.join(dir, '..', '__tests__');
  if (fs.existsSync(parentTestsDir)) {
    for (const testExt of testExtensions) {
      const testPath = path.join(parentTestsDir, `${baseName}${testExt}`);
      if (fs.existsSync(testPath)) return testPath;
    }
  }
  return null;
}

// ============================================================================
// MAIN SERVER
// ============================================================================

class TestGapAnalyzerServer extends McpServerBase {
  constructor() {
    super({ name: 'test-gap-analyzer', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'analyze_test_gaps',
      'Compare source files to test files and identify untested exports — functions, components, hooks, and classes that have no test coverage.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Root path to scan for source files' },
          includeTypes: { type: 'boolean', description: 'Include type/interface exports in analysis (default: false)' },
        },
        required: ['path'],
      },
      (args) => this.handleAnalyzeGaps(args)
    );

    this.addTool(
      'detect_missing_edge_cases',
      'Analyze existing tests and suggest missing edge cases: null inputs, empty inputs, boundary values, error handling, accessibility tests.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Root path to scan for source files' },
          severity: { type: 'string', enum: ['high', 'medium', 'low', 'all'], description: 'Minimum severity to report (default: all)' },
        },
        required: ['path'],
      },
      (args) => this.handleDetectEdgeCases(args)
    );

    this.addTool(
      'coverage_report',
      'Generate a comprehensive test coverage report with gap analysis, grades (A-F), and actionable suggestions.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Root path to scan' },
        },
        required: ['path'],
      },
      (args) => this.handleCoverageReport(args)
    );
  }

  private async handleAnalyzeGaps(args: unknown) {
    const { path: targetPath, includeTypes = false } = args as { path: string; includeTypes?: boolean };
    try {
      const stat = fs.statSync(targetPath);
      const files = stat.isDirectory() ? scanDirectory(targetPath) : [targetPath];

      const results: unknown[] = [];
      let totalExports = 0;
      let testedExports = 0;

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        const exports = extractExports(content);
        const filteredExports = includeTypes ? exports : exports.filter(e => e.type !== 'type');
        if (filteredExports.length === 0) continue;

        const testFile = findTestFile(file);
        let testedFunctions: string[] = [];
        if (testFile) {
          const testContent = safeReadFile(testFile);
          if (testContent) {
            testedFunctions = analyzeTestFile(testContent).testedFunctions;
          }
        }

        const gaps = filteredExports.filter(e =>
          !testedFunctions.some(tf =>
            tf.toLowerCase().includes(e.name.toLowerCase()) ||
            e.name.toLowerCase().includes(tf.toLowerCase())
          )
        );

        totalExports += filteredExports.length;
        testedExports += filteredExports.length - gaps.length;

        results.push({
          sourceFile: file,
          testFile,
          totalExports: filteredExports.length,
          testedExports: filteredExports.length - gaps.length,
          gaps: gaps.map(g => ({ name: g.name, type: g.type, line: g.line })),
        });
      }

      return this.success({
        summary: {
          totalFiles: files.length,
          totalExports,
          testedExports,
          untestedExports: totalExports - testedExports,
          coveragePercent: totalExports > 0 ? Math.round((testedExports / totalExports) * 100) : 100,
        },
        gaps: results.filter((r: any) => r.gaps.length > 0),
        fullyCovered: (results.filter((r: any) => r.gaps.length === 0) as any[]).map((r: any) => r.sourceFile),
      });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleDetectEdgeCases(args: unknown) {
    const { path: targetPath, severity = 'all' } = args as { path: string; severity?: string };
    try {
      const stat = fs.statSync(targetPath);
      const files = stat.isDirectory() ? scanDirectory(targetPath) : [targetPath];

      const severityOrder = { high: 0, medium: 1, low: 2 } as const;
      const minSeverity = severityOrder[severity as keyof typeof severityOrder] ?? 2;

      const results: unknown[] = [];
      let totalEdgeCases = 0;

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        const exports = extractExports(content);
        if (exports.length === 0) continue;

        const testFile = findTestFile(file);
        let testedBehaviors = new Map<string, string[]>();
        if (testFile) {
          const testContent = safeReadFile(testFile);
          if (testContent) testedBehaviors = analyzeTestFile(testContent).testedBehaviors;
        }

        for (const exp of exports) {
          if (exp.type === 'type') continue;
          const behaviors = testedBehaviors.get(exp.name) || [];
          const edgeCases = detectMissingEdgeCases(exp, behaviors);
          const filtered = edgeCases.filter(ec => severityOrder[ec.severity] <= minSeverity);
          if (filtered.length > 0) {
            totalEdgeCases += filtered.length;
            results.push({ file, export: exp.name, type: exp.type, missingEdgeCases: filtered });
          }
        }
      }

      return this.success({ totalMissingEdgeCases: totalEdgeCases, results });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleCoverageReport(args: unknown) {
    const { path: targetPath } = args as { path: string };
    try {
      const stat = fs.statSync(targetPath);
      const files = stat.isDirectory() ? scanDirectory(targetPath) : [targetPath];

      let totalExports = 0;
      let testedExports = 0;
      let totalEdgeCases = 0;
      let coveredEdgeCases = 0;
      const fileReports: unknown[] = [];

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        const exports = extractExports(content);
        if (exports.length === 0) continue;

        const testFile = findTestFile(file);
        let testedBehaviors = new Map<string, string[]>();
        if (testFile) {
          const testContent = safeReadFile(testFile);
          if (testContent) testedBehaviors = analyzeTestFile(testContent).testedBehaviors;
        }

        const fileEdgeCases: unknown[] = [];
        for (const exp of exports) {
          if (exp.type === 'type') continue;
          totalExports++;
          const behaviors = testedBehaviors.get(exp.name) || [];
          const isTested = behaviors.length > 0 ||
            [...testedBehaviors.keys()].some(k => k.toLowerCase().includes(exp.name.toLowerCase()));
          if (isTested) testedExports++;

          const edgeCases = detectMissingEdgeCases(exp, behaviors);
          const commonCases = edgeCases.length + behaviors.length;
          totalEdgeCases += commonCases;
          coveredEdgeCases += behaviors.length;

          if (edgeCases.length > 0) {
            fileEdgeCases.push({ export: exp.name, type: exp.type, missing: edgeCases });
          }
        }

        fileReports.push({
          file,
          testFile,
          exports: exports.length,
          hasTests: !!testFile,
          coverage: exports.length > 0 ? Math.round(((exports.length - fileEdgeCases.length) / exports.length) * 100) : 100,
          gaps: fileEdgeCases,
        });
      }

      const overallCoverage = totalExports > 0 ? Math.round((testedExports / totalExports) * 100) : 100;
      const edgeCaseCoverage = totalEdgeCases > 0 ? Math.round((coveredEdgeCases / totalEdgeCases) * 100) : 100;

      return this.success({
        overall: {
          totalFiles: files.length,
          filesWithTests: (fileReports as any[]).filter(f => f.hasTests).length,
          totalExports,
          testedExports,
          exportCoveragePercent: overallCoverage,
          edgeCaseCoveragePercent: edgeCaseCoverage,
          grade: overallCoverage >= 90 ? 'A' : overallCoverage >= 80 ? 'B' : overallCoverage >= 70 ? 'C' : overallCoverage >= 60 ? 'D' : 'F',
        },
        files: fileReports,
      });
    } catch (error) {
      return this.error(error);
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new TestGapAnalyzerServer().run().catch(console.error);
