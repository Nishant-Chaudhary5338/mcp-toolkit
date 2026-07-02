#!/usr/bin/env node
import { McpServerBase, safeReadFile, safeReadJson } from '@mcp-showcase/shared';
import { renderReportHTML } from '@mcp-showcase/ui-kit';
import { toHealthReport } from './health-report.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface PerformanceIssue {
  type: 'heavy-import' | 'large-bundle' | 'unnecessary-rerender' | 'unoptimized-image' | 'sync-operation' | 'memory-leak' | 'deep-nesting';
  file: string;
  line: number;
  description: string;
  severity: 'high' | 'medium' | 'low';
  impact: string;
  fix: string;
}

// ============================================================================
// ANALYSIS
// ============================================================================

function scanDirectory(dir: string, exts: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'build', 'dist', '.next', '.git', '.turbo', 'coverage'].includes(entry.name)) continue;
      files.push(...scanDirectory(fullPath, exts));
    } else if (exts.some(e => entry.name.endsWith(e))) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.includes('.stories.')) continue;
      files.push(fullPath);
    }
  }
  return files;
}

const HEAVY_LIBRARIES = [
  'moment', 'lodash', 'rxjs', 'jquery', 'three', 'chart.js', 'd3',
  '@material-ui/icons', '@mui/icons-material', 'antd', 'bootstrap',
];

export function analyzeFile(filePath: string, content: string): PerformanceIssue[] {
  const lines = content.split('\n');
  const issues: PerformanceIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heavy library imports
    for (const lib of HEAVY_LIBRARIES) {
      if (line.includes(`from '${lib}'`) || line.includes(`from "${lib}"`)) {
        issues.push({
          type: 'heavy-import',
          file: filePath,
          line: i + 1,
          description: `Heavy library '${lib}' imported. Consider lighter alternatives or tree-shaking.`,
          severity: 'high',
          impact: `Increases bundle size significantly. ${lib} may add 50KB-500KB to bundle.`,
          fix: lib === 'moment' ? "Replace with 'dayjs' or 'date-fns'" :
            lib === 'lodash' ? "Use 'lodash-es' or import specific functions: import debounce from 'lodash/debounce'" :
            `Consider lighter alternative for ${lib}`,
        });
      }
    }

    // Full lodash import
    if (line.match(/import\s+\*\s+as\s+lodash/i) || line.match(/import\s+_\s+from\s+['"]lodash['"]/)) {
      issues.push({
        type: 'heavy-import',
        file: filePath,
        line: i + 1,
        description: 'Full lodash import prevents tree-shaking.',
        severity: 'high',
        impact: 'Adds ~70KB to bundle. Only used functions should be imported.',
        fix: "Import specific functions: import debounce from 'lodash/debounce'",
      });
    }

    // Sync file operations in React components
    if (line.match(/fs\.(readFileSync|writeFileSync|readdirSync|statSync)/) && content.includes('React')) {
      issues.push({
        type: 'sync-operation',
        file: filePath,
        line: i + 1,
        description: 'Synchronous file operation in React component blocks rendering.',
        severity: 'high',
        impact: 'Blocks main thread, causes UI freezing.',
        fix: 'Use async versions or move to useEffect/use server action.',
      });
    }

    // Unoptimized images
    if (line.match(/<img\s/) && !line.includes('loading=') && !line.includes('next/image')) {
      issues.push({
        type: 'unoptimized-image',
        file: filePath,
        line: i + 1,
        description: 'Image without lazy loading or optimization.',
        severity: 'medium',
        impact: 'Loads full-size image eagerly, increasing page load time.',
        fix: 'Add loading="lazy" and use optimized image formats (WebP/AVIF).',
      });
    }

    // useEffect without cleanup (memory leaks)
    if (line.includes('useEffect(') || line.includes('useEffect (')) {
      const effectBlock = lines.slice(i, Math.min(i + 20, lines.length)).join('\n');
      if (effectBlock.includes('addEventListener') && !effectBlock.includes('removeEventListener')) {
        issues.push({
          type: 'memory-leak',
          file: filePath,
          line: i + 1,
          description: 'useEffect adds event listener without cleanup.',
          severity: 'high',
          impact: 'Memory leak: listener accumulates on each render.',
          fix: 'Return cleanup function: return () => element.removeEventListener(...)',
        });
      }
      if (effectBlock.includes('setInterval') && !effectBlock.includes('clearInterval')) {
        issues.push({
          type: 'memory-leak',
          file: filePath,
          line: i + 1,
          description: 'useEffect creates interval without cleanup.',
          severity: 'high',
          impact: 'Memory leak: interval continues after component unmount.',
          fix: 'Return cleanup: return () => clearInterval(id);',
        });
      }
      if (effectBlock.includes('setTimeout') && !effectBlock.includes('clearTimeout')) {
        issues.push({
          type: 'memory-leak',
          file: filePath,
          line: i + 1,
          description: 'useEffect creates timeout without cleanup.',
          severity: 'medium',
          impact: 'Potential memory leak if component unmounts before timeout fires.',
          fix: 'Return cleanup: return () => clearTimeout(id);',
        });
      }
    }

    // Deeply nested ternaries (ignore optional chaining `?.` and nullish coalescing `??`)
    const ternaryCount = (line.replace(/\?\./g, '').replace(/\?\?/g, '').match(/\?/g) || []).length;
    if (ternaryCount >= 3) {
      issues.push({
        type: 'deep-nesting',
        file: filePath,
        line: i + 1,
        description: `${ternaryCount} nested ternary operators reduce readability and may impact performance.`,
        severity: 'medium',
        impact: 'Hard to maintain, may cause unnecessary re-evaluations.',
        fix: 'Extract to named variables or use early returns.',
      });
    }

    // Console.log in production code
    if (line.match(/console\.(log|debug|info)\(/) && !filePath.includes('.test.') && !filePath.includes('dev')) {
      issues.push({
        type: 'large-bundle',
        file: filePath,
        line: i + 1,
        description: 'console.log statement in source code.',
        severity: 'low',
        impact: 'Adds unnecessary code to production bundle.',
        fix: 'Remove or replace with proper logging library that can be tree-shaken.',
      });
    }

    // Dynamic imports without React.lazy
    if (line.match(/import\(['"][^'"]+['"]\)/) && !line.includes('lazy') && !line.includes('Suspense')) {
      issues.push({
        type: 'large-bundle',
        file: filePath,
        line: i + 1,
        description: 'Dynamic import without lazy loading pattern.',
        severity: 'low',
        impact: 'May cause unnecessary network requests.',
        fix: 'Use React.lazy() with Suspense for code splitting.',
      });
    }
  }

  return issues;
}

function analyzePackageJson(projectRoot: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return issues;

  const pkg = safeReadJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(pkgPath);
  if (!pkg) return issues;

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const lib of HEAVY_LIBRARIES) {
    if (allDeps[lib]) {
      issues.push({
        type: 'heavy-import',
        file: pkgPath,
        line: 1,
        description: `Heavy dependency '${lib}' in package.json.`,
        severity: 'high',
        impact: 'Increases install size and bundle. Consider lighter alternatives.',
        fix: lib === 'moment' ? 'Replace with dayjs (2KB vs 70KB)' :
          lib === 'lodash' ? 'Replace with lodash-es for tree-shaking' :
          `Evaluate if ${lib} is necessary or has lighter alternative.`,
      });
    }
  }

  return issues;
}

// ============================================================================
// MAIN SERVER
// ============================================================================

class PerformanceAuditServer extends McpServerBase {
  constructor() {
    super({ name: 'performance-audit', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'audit_bundle',
      'Full performance audit: heavy imports, memory leaks, unoptimized images, sync operations, console.logs, and deep nesting.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to project directory or source file to audit' },
        },
        required: ['path'],
      },
      (args) => this.handleAuditBundle(args)
    );

    this.addTool(
      'detect_heavy_imports',
      'Find heavy library imports (moment, lodash, rxjs, etc.) that bloat your bundle size.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to project directory or source file' },
        },
        required: ['path'],
      },
      (args) => this.handleDetectHeavy(args)
    );

    this.addTool(
      'check_render_performance',
      'Find React-specific performance issues: memory leaks, sync operations, unoptimized images, deep nesting.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to project directory or source file' },
        },
        required: ['path'],
      },
      (args) => this.handleRenderPerf(args)
    );
  }

  private async handleAuditBundle(args: unknown) {
    const { path: targetPath } = args as { path: string };
    try {
      const stat = fs.statSync(targetPath);
      const isDir = stat.isDirectory();
      const projectRoot = isDir ? targetPath : path.dirname(targetPath);
      const files = isDir ? scanDirectory(targetPath) : [targetPath];

      const allIssues: PerformanceIssue[] = analyzePackageJson(projectRoot);
      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        allIssues.push(...analyzeFile(file, content));
      }

      const auditResult = {
        summary: {
          totalIssues: allIssues.length,
          high: allIssues.filter(i => i.severity === 'high').length,
          medium: allIssues.filter(i => i.severity === 'medium').length,
          low: allIssues.filter(i => i.severity === 'low').length,
          byType: {
            heavyImports: allIssues.filter(i => i.type === 'heavy-import').length,
            memoryLeaks: allIssues.filter(i => i.type === 'memory-leak').length,
            unoptimizedImages: allIssues.filter(i => i.type === 'unoptimized-image').length,
            syncOperations: allIssues.filter(i => i.type === 'sync-operation').length,
            deepNesting: allIssues.filter(i => i.type === 'deep-nesting').length,
          },
        },
        issues: allIssues,
      };
      return this.successWithUI(auditResult as unknown as Record<string, unknown>, {
        uri: 'ui://performance-audit/report',
        html: renderReportHTML(toHealthReport(auditResult, new Date().toISOString().slice(0, 10))),
      });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleDetectHeavy(args: unknown) {
    const { path: targetPath } = args as { path: string };
    try {
      const stat = fs.statSync(targetPath);
      const isDir = stat.isDirectory();
      const files = isDir ? scanDirectory(targetPath) : [targetPath];
      const issues: PerformanceIssue[] = [];

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        issues.push(...analyzeFile(file, content).filter(i => i.type === 'heavy-import'));
      }

      return this.success({ heavyImports: issues.length, issues });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleRenderPerf(args: unknown) {
    const { path: targetPath } = args as { path: string };
    try {
      const stat = fs.statSync(targetPath);
      const isDir = stat.isDirectory();
      const files = isDir ? scanDirectory(targetPath) : [targetPath];
      const issues: PerformanceIssue[] = [];

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        issues.push(...analyzeFile(file, content).filter(i => i.type !== 'heavy-import'));
      }

      return this.success({
        renderIssues: issues.length,
        byType: {
          memoryLeak: issues.filter(i => i.type === 'memory-leak').length,
          syncOperation: issues.filter(i => i.type === 'sync-operation').length,
          unoptimizedImage: issues.filter(i => i.type === 'unoptimized-image').length,
          deepNesting: issues.filter(i => i.type === 'deep-nesting').length,
        },
        issues,
      });
    } catch (error) {
      return this.error(error);
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new PerformanceAuditServer().run().catch(console.error);
