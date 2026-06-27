#!/usr/bin/env node
import { McpServerBase, safeReadJson, safeReadFile } from '@mcp-showcase/shared';
import type { ToolResult } from '@mcp-showcase/shared';
import { renderReportHTML } from '@mcp-showcase/ui-kit';
import { toHealthReport } from './health-report.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { calculateGrade } from './utils.js';
import type { PipelineStage } from './utils.js';

// ============================================================================
// TYPES
// ============================================================================

interface PipelineResult {
  overallStatus: 'pass' | 'fail' | 'warn';
  grade: string;
  totalDuration: number;
  stages: PipelineStage[];
  timestamp: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function scanDirectory(dir: string, exts: string[], skipDirs = ['node_modules', 'build', 'dist', '.next', '.turbo', 'coverage', 'out', '.git', '.cache']): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name)) continue;
      files.push(...scanDirectory(fullPath, exts, skipDirs));
    } else if (exts.some(e => entry.name.endsWith(e))) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Read a source file, skipping generated/test/stories files */
function readSourceFiles(dir: string, exts: string[]): Array<{ file: string; content: string; lines: string[] }> {
  return scanDirectory(dir, exts)
    .filter(f => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('.stories.') && !f.includes('__tests__'))
    .flatMap(file => {
      const content = safeReadFile(file);
      if (content === null) return [];
      return [{ file, content, lines: content.split('\n') }];
    });
}

// ============================================================================
// STAGE: TESTS
// ============================================================================

function runTestStage(projectRoot: string): PipelineStage {
  const start = Date.now();

  const hasVitest = fs.existsSync(path.join(projectRoot, 'vitest.config.ts'))
    || fs.existsSync(path.join(projectRoot, 'vitest.config.js'))
    || fs.existsSync(path.join(projectRoot, 'vitest.config.mts'));
  const hasJest = fs.existsSync(path.join(projectRoot, 'jest.config.js'))
    || fs.existsSync(path.join(projectRoot, 'jest.config.ts'))
    || fs.existsSync(path.join(projectRoot, 'jest.config.cjs'));
  const hasPlaywright = fs.existsSync(path.join(projectRoot, 'playwright.config.ts'))
    || fs.existsSync(path.join(projectRoot, 'playwright.config.js'))
    || fs.existsSync(path.join(projectRoot, 'playwright.config.mts'));

  if (!hasVitest && !hasJest) {
    if (hasPlaywright) {
      return {
        name: 'Tests',
        status: 'skip',
        duration: 0,
        summary: 'Playwright e2e tests detected — unit test runner (vitest/jest) not found',
        details: { runner: 'playwright', note: 'Run `npx playwright test` separately for e2e coverage' },
      };
    }
    // Check package.json test script as last resort
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return { name: 'Tests', status: 'skip', duration: 0, summary: 'No test runner found', details: {} };
    }
    const pkg = safeReadJson<{ scripts?: { test?: string } }>(pkgPath);
    const testScript = pkg?.scripts?.test ?? '';
    if (!testScript) {
      return { name: 'Tests', status: 'skip', duration: 0, summary: 'No test script in package.json', details: {} };
    }
    // If the test script invokes playwright, treat as e2e-only
    if (testScript.includes('playwright')) {
      return {
        name: 'Tests',
        status: 'skip',
        duration: 0,
        summary: 'Playwright e2e tests detected via package.json — unit test runner not found',
        details: { runner: 'playwright' },
      };
    }
  }

  try {
    if (hasVitest) {
      // Vitest JSON reporter writes to a file — use --outputFile
      const outFile = path.join(os.tmpdir(), `vitest-result-${Date.now()}.json`);
      try {
        execSync(
          `npx vitest run --reporter=json --outputFile=${outFile}`,
          { cwd: projectRoot, encoding: 'utf-8', timeout: 120000, stdio: 'pipe' }
        );
      } catch {
        // vitest exits non-zero when tests fail — that's fine, result file still written
      }
      if (fs.existsSync(outFile)) {
        const data = safeReadJson<{ numPassedTests?: number; numFailedTests?: number; numPendingTests?: number }>(outFile);
        fs.unlinkSync(outFile);
        if (!data) {
          return { name: 'Tests', status: 'warn', duration: Date.now() - start, summary: 'Could not parse vitest output', details: {} };
        }
        const passed = data.numPassedTests ?? 0;
        const failed = data.numFailedTests ?? 0;
        const skipped = data.numPendingTests ?? 0;
        return {
          name: 'Tests',
          status: failed > 0 ? 'fail' : 'pass',
          duration: Date.now() - start,
          summary: `${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`,
          details: { passed, failed, skipped, runner: 'vitest' },
        };
      }
      // fallback: vitest binary not available or output file not written — check binary first
      const vitestBin = path.join(projectRoot, 'node_modules', '.bin', 'vitest');
      if (!fs.existsSync(vitestBin)) {
        return { name: 'Tests', status: 'skip', duration: Date.now() - start, summary: 'vitest not installed in project', details: {} };
      }
      let output = '';
      try {
        output = execSync(`npx vitest run 2>&1 || true`, { cwd: projectRoot, encoding: 'utf-8', timeout: 120000 });
      } catch { /* ignore */ }
      const passMatch = output?.match(/(\d+)\s+passed/);
      const failMatch = output?.match(/(\d+)\s+failed/);
      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      return {
        name: 'Tests',
        status: failed > 0 ? 'fail' : passed > 0 ? 'pass' : 'warn',
        duration: Date.now() - start,
        summary: passed + failed > 0 ? `${passed} passed, ${failed} failed` : 'Could not parse test output',
        details: { passed, failed, runner: 'vitest' },
      };
    }

    if (hasJest) {
      const output = execSync(
        `npx jest --json 2>&1 || true`,
        { cwd: projectRoot, encoding: 'utf-8', timeout: 120000, maxBuffer: 20 * 1024 * 1024 }
      );
      const jsonStart = output.indexOf('{');
      if (jsonStart !== -1) {
        try {
          const data = JSON.parse(output.slice(jsonStart));
          const passed = data.numPassedTests ?? 0;
          const failed = data.numFailedTests ?? 0;
          return {
            name: 'Tests',
            status: failed > 0 ? 'fail' : 'pass',
            duration: Date.now() - start,
            summary: `${passed} passed, ${failed} failed`,
            details: { passed, failed, runner: 'jest' },
          };
        } catch { /* fall through */ }
      }
    }

    return { name: 'Tests', status: 'warn', duration: Date.now() - start, summary: 'Test output could not be parsed', details: {} };
  } catch (error) {
    return {
      name: 'Tests',
      status: 'fail',
      duration: Date.now() - start,
      summary: `Test execution error: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`,
      details: { error: true },
    };
  }
}

// ============================================================================
// STAGE: PERFORMANCE
// ============================================================================

const HEAVY_IMPORTS: Record<string, string> = {
  'moment': '~300KB — use date-fns or dayjs instead',
  'lodash': '~70KB — import specific methods or use native JS',
  'jquery': '~90KB — use native DOM APIs',
  'underscore': '~60KB — use native JS',
  'ramda': '~50KB — use native JS',
  'rxjs': '~100KB — use if already in deps, avoid adding fresh',
  'immutable': '~60KB — use structuredClone or immer',
  'ant-design': 'Very large — ensure tree-shaking is configured',
  '@material-ui/core': 'Large — ensure tree-shaking is configured',
  'xlsx': '~800KB — consider server-side or async chunk',
  'pdfjs-dist': 'Large — always lazy-load',
  'three': 'Very large — always lazy-load',
};

function runPerformanceStage(projectRoot: string): PipelineStage {
  const start = Date.now();
  try {
    const sources = readSourceFiles(projectRoot, ['.ts', '.tsx', '.js', '.jsx']);
    const heavyImports: Array<{ file: string; lib: string; advice: string }> = [];
    const memoryLeaks: Array<{ file: string; line: number; type: string }> = [];
    const consoleLogs: Array<{ file: string; line: number }> = [];
    const largeFunctions: Array<{ file: string; line: number; lines: number }> = [];

    for (const { file, content, lines } of sources) {
      const rel = path.relative(projectRoot, file);

      // Heavy imports
      for (const [lib, advice] of Object.entries(HEAVY_IMPORTS)) {
        if (
          new RegExp(`from ['"]${lib}['"]`).test(content) ||
          new RegExp(`require\\(['"]${lib}['"]\\)`).test(content)
        ) {
          heavyImports.push({ file: rel, lib, advice });
        }
      }

      // Memory leaks: scan full useEffect block (up to 50 lines)
      for (let i = 0; i < lines.length; i++) {
        if (/useEffect\s*\(/.test(lines[i])) {
          const block = lines.slice(i, Math.min(i + 50, lines.length)).join('\n');
          if (/addEventListener/.test(block) && !/removeEventListener/.test(block)) {
            memoryLeaks.push({ file: rel, line: i + 1, type: 'missing removeEventListener' });
          }
          if (/setInterval/.test(block) && !/clearInterval/.test(block)) {
            memoryLeaks.push({ file: rel, line: i + 1, type: 'missing clearInterval' });
          }
          if (/setTimeout/.test(block) && !/clearTimeout/.test(block) && /\[/.test(block)) {
            // Only flag if there's a dependency array (re-runs on change)
            memoryLeaks.push({ file: rel, line: i + 1, type: 'possible clearTimeout missing' });
          }
        }

        // console.log/debug (not in test files, already filtered)
        if (/console\.(log|debug|info)\s*\(/.test(lines[i])) {
          consoleLogs.push({ file: rel, line: i + 1 });
        }
      }

      // Large functions (>60 lines between function declaration and closing)
      const funcMatches = [...content.matchAll(/\n(export\s+)?(async\s+)?function\s+\w+/g)];
      for (const match of funcMatches) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        let depth = 0, end = match.index ?? 0;
        for (let j = match.index ?? 0; j < content.length; j++) {
          if (content[j] === '{') depth++;
          else if (content[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
        }
        const funcLines = content.slice(match.index ?? 0, end).split('\n').length;
        if (funcLines > 60) largeFunctions.push({ file: rel, line: lineNum, lines: funcLines });
      }
    }

    const critical = heavyImports.length + memoryLeaks.length;
    const warnings = consoleLogs.length + largeFunctions.length;

    return {
      name: 'Performance',
      status: critical > 0 ? 'fail' : warnings > 5 ? 'warn' : 'pass',
      duration: Date.now() - start,
      summary: `${critical} critical issues, ${warnings} warnings across ${sources.length} files`,
      details: {
        filesScanned: sources.length,
        heavyImports,
        memoryLeaks,
        consoleLogs: consoleLogs.slice(0, 10),
        consoleLogCount: consoleLogs.length,
        largeFunctions,
      },
    };
  } catch (error) {
    return {
      name: 'Performance',
      status: 'warn',
      duration: Date.now() - start,
      summary: `Performance analysis error: ${error instanceof Error ? error.message.slice(0, 100) : String(error)}`,
      details: { error: true },
    };
  }
}

// ============================================================================
// STAGE: ACCESSIBILITY
// ============================================================================

function runAccessibilityStage(projectRoot: string): PipelineStage {
  const start = Date.now();
  try {
    const sources = readSourceFiles(projectRoot, ['.tsx', '.jsx', '.html']);
    const issues: Array<{ file: string; line: number; rule: string; impact: 'critical' | 'serious' | 'moderate'; detail?: string }> = [];

    for (const { file, content, lines } of sources) {
      const rel = path.relative(projectRoot, file);

      // Use full content for multiline patterns
      // 1. <img> without alt
      for (const m of content.matchAll(/<img\b([^>]*?)\/?>|<img\b([^>]*?)>[\s\S]*?<\/img>/g)) {
        const attrs = m[1] ?? m[2] ?? '';
        if (!attrs.includes('alt=') && !attrs.includes('aria-label=') && !attrs.includes('aria-hidden=')) {
          const lineNum = content.slice(0, m.index).split('\n').length;
          issues.push({ file: rel, line: lineNum, rule: 'image-alt', impact: 'critical', detail: 'img element missing alt attribute' });
        }
      }

      // 2. Buttons with no text content (multiline aware)
      for (const m of content.matchAll(/<button\b([^>]*?)>([\s\S]*?)<\/button>/g)) {
        const attrs = m[1] ?? '';
        const inner = (m[2] ?? '').trim().replace(/<[^>]+>/g, '').trim();
        if (!inner && !attrs.includes('aria-label=') && !attrs.includes('aria-labelledby=') && !attrs.includes('title=')) {
          const lineNum = content.slice(0, m.index).split('\n').length;
          issues.push({ file: rel, line: lineNum, rule: 'button-name', impact: 'critical', detail: 'Button has no accessible text' });
        }
      }

      // 3. <input> without label association (multiline aware)
      for (const m of content.matchAll(/<input\b([^>]*?)\/?>|<input\b([^>]*?)>/g)) {
        const attrs = m[1] ?? m[2] ?? '';
        if (attrs.includes('type="hidden"') || attrs.includes("type='hidden'")) continue;
        if (!attrs.includes('aria-label=') && !attrs.includes('aria-labelledby=') && !attrs.includes('id=')) {
          const lineNum = content.slice(0, m.index).split('\n').length;
          issues.push({ file: rel, line: lineNum, rule: 'input-label', impact: 'critical', detail: 'Input has no accessible label' });
        }
      }

      // 4. Positive tabindex
      for (const m of content.matchAll(/tabIndex=\{?["']?([1-9]\d*)["']?\}?/g)) {
        const lineNum = content.slice(0, m.index).split('\n').length;
        issues.push({ file: rel, line: lineNum, rule: 'tabindex', impact: 'serious', detail: `tabIndex="${m[1]}" disrupts keyboard navigation` });
      }

      // 5. onClick without onKeyDown/onKeyPress on non-interactive elements
      for (const m of content.matchAll(/<(div|span|p|li|td|section|article)\b([^>]*?)onClick=/g)) {
        const attrs = m[2] ?? '';
        const lineNum = content.slice(0, m.index).split('\n').length;
        // Only flag if no keyboard handler or role
        const surroundingBlock = content.slice(Math.max(0, m.index! - 10), (m.index ?? 0) + 200);
        if (!surroundingBlock.includes('onKeyDown') && !surroundingBlock.includes('onKeyPress') && !surroundingBlock.includes('role=')) {
          issues.push({ file: rel, line: lineNum, rule: 'click-events-have-key-events', impact: 'serious', detail: `<${m[1]}> has onClick but no keyboard handler or role` });
        }
      }

      // 6. Missing lang attribute on <html>
      if (file.endsWith('.html') && !content.includes('lang=')) {
        issues.push({ file: rel, line: 1, rule: 'html-has-lang', impact: 'serious', detail: '<html> missing lang attribute' });
      }

      // 7. Heading hierarchy — h1 usage
      const h1Count = (content.match(/<h1[\s>]/g) ?? []).length;
      if (h1Count > 1) {
        issues.push({ file: rel, line: 1, rule: 'heading-order', impact: 'moderate', detail: `${h1Count} <h1> elements — only one per page` });
      }

      // 8. autoFocus (can cause confusion for screen reader users)
      if (content.includes('autoFocus') || content.includes('autofocus')) {
        const m = content.match(/autoFocus|autofocus/);
        const lineNum = m ? content.slice(0, content.indexOf(m[0])).split('\n').length : 1;
        issues.push({ file: rel, line: lineNum, rule: 'no-autofocus', impact: 'moderate', detail: 'autoFocus can disorient screen reader users' });
      }
    }

    const critical = issues.filter(i => i.impact === 'critical').length;
    const serious = issues.filter(i => i.impact === 'serious').length;
    const moderate = issues.filter(i => i.impact === 'moderate').length;

    return {
      name: 'Accessibility',
      status: critical > 0 ? 'fail' : serious > 0 ? 'warn' : moderate > 2 ? 'warn' : 'pass',
      duration: Date.now() - start,
      summary: `${issues.length} issues — ${critical} critical, ${serious} serious, ${moderate} moderate`,
      details: {
        filesScanned: sources.length,
        totalIssues: issues.length,
        critical,
        serious,
        moderate,
        issues: issues.slice(0, 25),
      },
    };
  } catch (error) {
    return {
      name: 'Accessibility',
      status: 'warn',
      duration: Date.now() - start,
      summary: `A11y analysis error: ${error instanceof Error ? error.message.slice(0, 100) : String(error)}`,
      details: { error: true },
    };
  }
}

// ============================================================================
// STAGE: DESIGN TOKENS
// ============================================================================

function runDesignTokensStage(projectRoot: string): PipelineStage {
  const start = Date.now();
  try {
    const sources = readSourceFiles(projectRoot, ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']);
    const violations: Array<{ file: string; line: number; type: string; value: string }> = [];

    for (const { file, lines } of sources) {
      const rel = path.relative(projectRoot, file);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments and pure imports
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ')) continue;
        // Skip token definition files themselves
        if (file.includes('token') || file.includes('theme') || file.includes('variable') || file.includes('design-system')) continue;
        // Skip CSS variable declarations (they're defining tokens, not using hardcoded values)
        if (/--[\w-]+\s*:/.test(line)) continue;

        // Hardcoded hex colors (but not in CSS variable usage)
        const hexMatches = [...line.matchAll(/#([0-9a-fA-F]{3,8})\b/g)];
        for (const m of hexMatches) {
          // Skip if it's being assigned to a CSS variable or is part of a token file import
          if (!line.includes('var(--') && !line.includes('tokens.')) {
            violations.push({ file: rel, line: i + 1, type: 'color', value: m[0] });
          }
        }

        // ANY hardcoded pixel value in style props / CSS — use regex not whitelist
        const pxMatches = [...line.matchAll(/(?<![a-zA-Z'"`])(\d+(?:\.\d+)?px)(?!['"`]?\s*[,)]?\s*\/\*\s*token)/g)];
        for (const m of pxMatches) {
          const val = parseFloat(m[1]);
          // Skip 0px, 1px (borders), 100%, and very large px (likely not spacing)
          if (val === 0 || val === 1 || val > 200) continue;
          // Only flag inside style/css-like contexts
          if (line.includes('style=') || line.includes('padding') || line.includes('margin') ||
              line.includes('gap') || line.includes('width') || line.includes('height') ||
              line.includes('top:') || line.includes('left:') || line.includes('bottom:') ||
              line.includes('right:') || line.includes('font-size') || line.includes('fontSize') ||
              file.endsWith('.css') || file.endsWith('.scss')) {
            violations.push({ file: rel, line: i + 1, type: val > 30 ? 'spacing' : 'spacing-sm', value: m[1] });
          }
        }

        // Hardcoded font families
        const fontFamilyMatch = line.match(/fontFamily\s*:\s*['"`]([^'"`]+)['"`]/);
        if (fontFamilyMatch && !line.includes('var(--')) {
          violations.push({ file: rel, line: i + 1, type: 'font-family', value: fontFamilyMatch[1] });
        }

        // Magic z-index values
        const zIndexMatch = line.match(/z(?:Index|-index)\s*[=:]\s*(\d{2,})/);
        if (zIndexMatch && !['100', '999', '1000', '9999'].includes(zIndexMatch[1])) {
          violations.push({ file: rel, line: i + 1, type: 'z-index', value: zIndexMatch[1] });
        }
      }
    }

    const byType = violations.reduce<Record<string, number>>((acc, v) => {
      acc[v.type] = (acc[v.type] ?? 0) + 1;
      return acc;
    }, {});

    return {
      name: 'Design Tokens',
      status: violations.length > 30 ? 'fail' : violations.length > 10 ? 'warn' : 'pass',
      duration: Date.now() - start,
      summary: `${violations.length} hardcoded values — ${byType.color ?? 0} colors, ${(byType.spacing ?? 0) + (byType['spacing-sm'] ?? 0)} spacing, ${byType['font-family'] ?? 0} fonts`,
      details: {
        filesScanned: sources.length,
        totalViolations: violations.length,
        byType,
        sample: violations.slice(0, 20),
      },
    };
  } catch (error) {
    return {
      name: 'Design Tokens',
      status: 'warn',
      duration: Date.now() - start,
      summary: `Design token analysis error: ${error instanceof Error ? error.message.slice(0, 100) : String(error)}`,
      details: { error: true },
    };
  }
}

// ============================================================================
// STAGE: TYPE SAFETY (bonus — new stage)
// ============================================================================

function runTypeSafetyStage(projectRoot: string): PipelineStage {
  const start = Date.now();
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    return { name: 'Type Safety', status: 'skip', duration: 0, summary: 'No tsconfig.json found', details: {} };
  }
  try {
    execSync('npx tsc --noEmit 2>&1', { cwd: projectRoot, encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
    return {
      name: 'Type Safety',
      status: 'pass',
      duration: Date.now() - start,
      summary: 'No TypeScript errors',
      details: { errors: 0 },
    };
  } catch (error) {
    const output = error instanceof Error && 'stdout' in error ? String((error as NodeJS.ErrnoException & { stdout: string }).stdout) : String(error);
    const errorLines = output.split('\n').filter(l => l.includes('error TS'));
    const errorCount = errorLines.length;
    const files = new Set(errorLines.map(l => l.split('(')[0])).size;
    return {
      name: 'Type Safety',
      status: errorCount > 0 ? 'fail' : 'warn',
      duration: Date.now() - start,
      summary: `${errorCount} TypeScript errors across ${files} files`,
      details: {
        errorCount,
        filesAffected: files,
        sample: errorLines.slice(0, 10).map(l => l.trim()),
      },
    };
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

class QualityPipelineServer extends McpServerBase {

  constructor() {
    super({ name: 'quality-pipeline', version: '2.0.0' });
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  protected registerTools(): void {
    this.addTool(
      'run_full_pipeline',
      'Run the complete quality pipeline: tests, type safety, performance, accessibility, design tokens',
      {
        type: 'object',
        properties: {
          projectRoot: { type: 'string', description: 'Root directory of the project to analyze' },
          skipStages: {
            type: 'array',
            items: { type: 'string', enum: ['tests', 'types', 'performance', 'accessibility', 'design'] },
            description: 'Stages to skip',
            default: [],
          },
        },
        required: ['projectRoot'],
      },
      this.handleFullPipeline.bind(this)
    );

    this.addTool(
      'run_partial_pipeline',
      'Run specific stages of the quality pipeline',
      {
        type: 'object',
        properties: {
          projectRoot: { type: 'string', description: 'Root directory of the project to analyze' },
          stages: {
            type: 'array',
            items: { type: 'string', enum: ['tests', 'types', 'performance', 'accessibility', 'design'] },
            description: 'Stages to run',
          },
        },
        required: ['projectRoot', 'stages'],
      },
      this.handlePartialPipeline.bind(this)
    );
  }

  private buildStages(projectRoot: string, skip: string[]): PipelineStage[] {
    const run = (name: string, fn: () => PipelineStage): PipelineStage =>
      skip.includes(name)
        ? { name: fn().name, status: 'skip', duration: 0, summary: 'Skipped', details: {} }
        : fn();

    return [
      run('tests',         () => runTestStage(projectRoot)),
      run('types',         () => runTypeSafetyStage(projectRoot)),
      run('performance',   () => runPerformanceStage(projectRoot)),
      run('accessibility', () => runAccessibilityStage(projectRoot)),
      run('design',        () => runDesignTokensStage(projectRoot)),
    ];
  }

  private assembleResult(stages: PipelineStage[], totalStart: number): PipelineResult {
    const active = stages.filter(s => s.status !== 'skip');
    return {
      overallStatus: active.some(s => s.status === 'fail') ? 'fail'
        : active.some(s => s.status === 'warn') ? 'warn' : 'pass',
      grade: calculateGrade(stages),
      totalDuration: Date.now() - totalStart,
      stages,
      timestamp: new Date().toISOString(),
    };
  }

  private async handleFullPipeline(args: unknown): Promise<ToolResult> {
    const { projectRoot, skipStages = [] } = args as { projectRoot: string; skipStages?: string[] };
    try {
      const totalStart = Date.now();
      const stages = this.buildStages(projectRoot, skipStages);
      const result = this.assembleResult(stages, totalStart);
      return this.successWithUI(result as unknown as Record<string, unknown>, {
        uri: 'ui://quality-pipeline/report',
        html: renderReportHTML(toHealthReport(result, new Date().toISOString().slice(0, 10))),
      });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handlePartialPipeline(args: unknown): Promise<ToolResult> {
    const { projectRoot, stages: stageNames } = args as { projectRoot: string; stages: string[] };
    try {
      const totalStart = Date.now();
      const allStages = ['tests', 'types', 'performance', 'accessibility', 'design'];
      const skip = allStages.filter(s => !stageNames.includes(s));
      const stages = this.buildStages(projectRoot, skip);
      return this.success({ result: this.assembleResult(stages, totalStart) });
    } catch (error) {
      return this.error(error);
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new QualityPipelineServer().run().catch(console.error);
