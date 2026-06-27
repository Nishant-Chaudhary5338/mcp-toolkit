#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import type { ToolResult } from '@mcp-showcase/shared';
import { renderResultHTML } from '@mcp-showcase/ui-kit';
import { toResultReport } from './result-report.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// TYPES (mirrors component-reviewer types)
// ============================================================================

type IssueCategory =
  | 'type-safety'
  | 'react-patterns'
  | 'accessibility'
  | 'performance'
  | 'code-quality'
  | 'security'
  | 'styling'
  | 'testing';

interface ReviewIssue {
  id: string;
  category: IssueCategory;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  message: string;
  suggestion: string;
  fixable: boolean;
  fixType?: 'replace' | 'add' | 'remove' | 'refactor';
  fix?: Record<string, unknown>;
  docs?: string;
  wcag?: string;
}

interface ReviewResult {
  success: boolean;
  summary: {
    component: string;
    file: string;
    linesOfCode: number;
    overallScore: number;
    grade: string;
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
    estimatedFixTime: string;
    categories: Record<IssueCategory, number>;
  };
  issues: ReviewIssue[];
  metrics: Record<string, unknown>;
  patterns: Record<string, unknown>;
  quickFixes: Array<Record<string, unknown>>;
  typescriptErrors: string[];
  testResults: Record<string, unknown>;
}

interface FixResult {
  issueId: string;
  category: IssueCategory;
  line?: number;
  message: string;
  applied: boolean;
  detail: string;
}

interface FixOutput {
  success: boolean;
  component: string;
  file: string;
  summary: {
    totalFixable: number;
    applied: number;
    skipped: number;
    failed: number;
    scoreBefore?: number;
    scoreAfter?: number;
    gradeBefore?: string;
    gradeAfter?: string;
  };
  fixes: FixResult[];
  remainingIssues: ReviewIssue[];
  typescriptCheck: {
    passed: boolean;
    errors: string[];
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function writeFileContent(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
}

function findComponentFile(componentDir: string, componentName: string): string | null {
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    const filePath = path.join(componentDir, `${componentName}${ext}`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function findTsconfig(dir: string): string | null {
  let current = dir;
  while (current !== '/' && current !== '.') {
    const tsconfig = path.join(current, 'tsconfig.json');
    if (fs.existsSync(tsconfig)) return tsconfig;
    current = path.dirname(current);
  }
  return null;
}

function runTypeScriptCheck(componentDir: string): { errors: string[]; passed: boolean } {
  try {
    const tsconfigPath = findTsconfig(componentDir);
    if (!tsconfigPath) {
      return { errors: ['No tsconfig.json found'], passed: false };
    }
    execSync(`npx tsc --noEmit --project ${tsconfigPath}`, {
      cwd: componentDir,
      stdio: 'pipe',
      timeout: 30000,
    });
    return { errors: [], passed: true };
  } catch (error: unknown) {
    const err = error as { stdout?: { toString(): string }; stderr?: { toString(): string }; message: string };
    const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
    const errors = output.split('\n').filter((line: string) => line.trim().length > 0);
    return { errors: errors.slice(0, 20), passed: false };
  }
}

// ============================================================================
// FIX ENGINE - Line-based transformations
// ============================================================================

class FixEngine {
  private lines: string[];
  private modified: boolean = false;
  private fixes: FixResult[] = [];

  constructor(private content: string, private filePath: string) {
    this.lines = content.split('\n');
  }

  hasModifications(): boolean {
    return this.modified;
  }

  getFixes(): FixResult[] {
    return this.fixes;
  }

  getResult(): string {
    return this.lines.join('\n');
  }

  applyFix(issue: ReviewIssue): void {
    if (!issue.fixable || !issue.fixType) {
      this.fixes.push({
        issueId: issue.id,
        category: issue.category,
        line: issue.line,
        message: issue.message,
        applied: false,
        detail: 'Issue is not fixable or missing fixType',
      });
      return;
    }

    try {
      switch (issue.fixType) {
        case 'remove': this.applyRemove(issue); break;
        case 'replace': this.applyReplace(issue); break;
        case 'add': this.applyAdd(issue); break;
        case 'refactor': this.applyRefactor(issue); break;
        default:
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: false,
            detail: `Unknown fixType: ${issue.fixType}`,
          });
      }
    } catch (error) {
      this.fixes.push({
        issueId: issue.id,
        category: issue.category,
        line: issue.line,
        message: issue.message,
        applied: false,
        detail: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private applyRemove(issue: ReviewIssue): void {
    if (issue.category === 'code-quality' && issue.message.includes('Console statement')) {
      if (issue.line && issue.line > 0) {
        const lineIdx = issue.line - 1;
        const line = this.lines[lineIdx];
        if (line.match(/console\.(log|debug|info)\(/)) {
          this.lines.splice(lineIdx, 1);
          this.modified = true;
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: true,
            detail: `Removed console statement at line ${issue.line}`,
          });
          return;
        }
      }
    }

    this.fixes.push({
      issueId: issue.id,
      category: issue.category,
      line: issue.line,
      message: issue.message,
      applied: false,
      detail: 'Remove fix not implemented for this issue type',
    });
  }

  private applyReplace(issue: ReviewIssue): void {
    const lineIdx = issue.line ? issue.line - 1 : -1;

    if (issue.category === 'type-safety' && issue.message.includes("'any' type")) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        line = line.replace(/:\s*any\b/g, ': unknown');
        line = line.replace(/<any>/g, '<unknown>');
        line = line.replace(/\bas\s+any\b/g, 'as unknown');
        this.lines[lineIdx] = line;
        this.modified = true;
        this.fixes.push({
          issueId: issue.id,
          category: issue.category,
          line: issue.line,
          message: issue.message,
          applied: true,
          detail: `Replaced 'any' with 'unknown' at line ${issue.line}`,
        });
        return;
      }
    }

    if (issue.category === 'type-safety' && issue.message.includes('Non-null assertion')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        line = line.replace(/(\w+)!\./g, '$1?.');
        this.lines[lineIdx] = line;
        this.modified = true;
        this.fixes.push({
          issueId: issue.id,
          category: issue.category,
          line: issue.line,
          message: issue.message,
          applied: true,
          detail: `Replaced non-null assertion with optional chaining at line ${issue.line}`,
        });
        return;
      }
    }

    if (issue.category === 'accessibility' && issue.message.includes('positive tabIndex')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        line = line.replace(/tabIndex=["'][1-9]\d*["']/g, 'tabIndex={0}');
        this.lines[lineIdx] = line;
        this.modified = true;
        this.fixes.push({
          issueId: issue.id,
          category: issue.category,
          line: issue.line,
          message: issue.message,
          applied: true,
          detail: `Replaced positive tabIndex with 0 at line ${issue.line}`,
        });
        return;
      }
    }

    if (issue.category === 'accessibility' && issue.message.includes('Autoplay media')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        line = line.replace(/\s*autoPlay/, ' controls muted');
        this.lines[lineIdx] = line;
        this.modified = true;
        this.fixes.push({
          issueId: issue.id,
          category: issue.category,
          line: issue.line,
          message: issue.message,
          applied: true,
          detail: `Replaced autoplay with controls muted at line ${issue.line}`,
        });
        return;
      }
    }

    this.fixes.push({
      issueId: issue.id,
      category: issue.category,
      line: issue.line,
      message: issue.message,
      applied: false,
      detail: 'Replace fix not implemented for this issue type',
    });
  }

  private applyAdd(issue: ReviewIssue): void {
    if (issue.category === 'react-patterns' && issue.message.includes('displayName')) {
      const componentNameMatch = issue.suggestion.match(/(\w+)\.displayName/);
      const componentName = componentNameMatch ? componentNameMatch[1] : null;
      if (componentName) {
        let insertIdx = this.lines.length;
        for (let i = this.lines.length - 1; i >= 0; i--) {
          if (this.lines[i].match(/export\s*\{/) || this.lines[i].match(/export\s+default/)) {
            insertIdx = i;
            break;
          }
        }
        this.lines.splice(insertIdx, 0, '', `${componentName}.displayName = '${componentName}';`);
        this.modified = true;
        this.fixes.push({
          issueId: issue.id,
          category: issue.category,
          line: issue.line,
          message: issue.message,
          applied: true,
          detail: `Added displayName = '${componentName}'`,
        });
        return;
      }
    }

    const lineIdx = issue.line ? issue.line - 1 : -1;

    if (issue.category === 'accessibility' && issue.message.includes('Image missing alt')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        if (line.match(/<img\s[^/]*\/?\s*>/)) {
          line = line.replace(/<img\s/, '<img alt="" ');
          this.lines[lineIdx] = line;
          this.modified = true;
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: true,
            detail: `Added alt="" to image at line ${issue.line}`,
          });
          return;
        }
      }
    }

    if (issue.category === 'accessibility' && issue.message.includes('Form input missing')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        if (!line.includes('aria-label') && !line.includes('aria-labelledby')) {
          const inputTypeMatch = line.match(/type=["'](\w+)["']/);
          const placeholder = inputTypeMatch ? inputTypeMatch[1] : 'input';
          line = line.replace(/<input\s/, `<input aria-label="${placeholder}" `);
          this.lines[lineIdx] = line;
          this.modified = true;
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: true,
            detail: `Added aria-label to input at line ${issue.line}`,
          });
          return;
        }
      }
    }

    if (issue.category === 'accessibility' && issue.message.includes('Clickable div missing')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        if (line.includes('onClick') && !line.includes('role=')) {
          line = line.replace(/<div/, '<div role="button" tabIndex={0}');
          this.lines[lineIdx] = line;
          this.modified = true;
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: true,
            detail: `Added role="button" and tabIndex={0} to clickable div at line ${issue.line}`,
          });
          return;
        }
      }
    }

    if (issue.category === 'accessibility' && issue.message.includes('Icon button missing')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        if ((line.includes('<button') || line.includes('<a')) && !line.includes('aria-label')) {
          line = line.replace(/<(button|a)/, '<$1 aria-label="Button action"');
          this.lines[lineIdx] = line;
          this.modified = true;
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: true,
            detail: `Added aria-label to icon button at line ${issue.line}`,
          });
          return;
        }
      }
    }

    if (issue.category === 'accessibility' && issue.message.includes('Link element missing href')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        let line = this.lines[lineIdx];
        if (line.match(/<a\s[^>]*>/) && !line.includes('href=')) {
          line = line.replace(/<a\s/, '<a href="#" ');
          this.lines[lineIdx] = line;
          this.modified = true;
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: true,
            detail: `Added href="#" to link at line ${issue.line} (update with actual URL)`,
          });
          return;
        }
      }
    }

    this.fixes.push({
      issueId: issue.id,
      category: issue.category,
      line: issue.line,
      message: issue.message,
      applied: false,
      detail: 'Add fix not implemented for this issue type',
    });
  }

  private applyRefactor(issue: ReviewIssue): void {
    const lineIdx = issue.line ? issue.line - 1 : -1;

    if (issue.category === 'performance' && issue.message.includes('Inline arrow function')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        const line = this.lines[lineIdx];
        const handlerMatch = line.match(/(onClick|onChange|onSubmit|onFocus|onBlur)=\{([^}]+=>[^}]+)\}/);
        if (handlerMatch) {
          const eventName = handlerMatch[1];
          const handlerBody = handlerMatch[2];
          const handlerName = `handle${eventName.charAt(2).toUpperCase() + eventName.slice(3)}`;

          this.lines[lineIdx] = line.replace(
            new RegExp(`${eventName}=\\{[^}]+=>[^}]+\\}`),
            `${eventName}={${handlerName}}`
          );

          this.lines.splice(lineIdx, 0, `// TODO: Extract ${handlerName} = ${handlerBody} as a named function or useCallback`);
          this.modified = true;
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: true,
            detail: `Replaced inline ${eventName} handler with reference at line ${issue.line}`,
          });
          return;
        }
      }
    }

    if (issue.category === 'performance' && issue.message.includes('Inline object literal')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        const line = this.lines[lineIdx];
        const styleMatch = line.match(/style=\{\{([^}]+)\}\}/);
        if (styleMatch) {
          this.lines[lineIdx] = line.replace(
            /style=\{\{[^}]+\}\}/,
            'style={styles} // TODO: Extract to constant or useMemo'
          );
          this.modified = true;
          this.fixes.push({
            issueId: issue.id,
            category: issue.category,
            line: issue.line,
            message: issue.message,
            applied: true,
            detail: `Replaced inline style object with reference at line ${issue.line}`,
          });
          return;
        }
      }
    }

    if (issue.category === 'security' && issue.message.includes('innerHTML')) {
      if (lineIdx >= 0 && lineIdx < this.lines.length) {
        this.lines[lineIdx] = this.lines[lineIdx] + ' // TODO: Replace innerHTML with React declarative rendering';
        this.modified = true;
        this.fixes.push({
          issueId: issue.id,
          category: issue.category,
          line: issue.line,
          message: issue.message,
          applied: true,
          detail: `Added TODO comment for innerHTML usage at line ${issue.line}`,
        });
        return;
      }
    }

    this.fixes.push({
      issueId: issue.id,
      category: issue.category,
      line: issue.line,
      message: issue.message,
      applied: false,
      detail: 'Refactor fix not implemented for this issue type',
    });
  }
}

// ============================================================================
// MAIN FIX HANDLER
// ============================================================================

function fixFromReview(componentDir: string, componentName: string, reviewResult: ReviewResult): FixOutput {
  const componentFile = findComponentFile(componentDir, componentName);
  if (!componentFile) {
    return {
      success: false,
      component: componentName,
      file: '',
      summary: { totalFixable: 0, applied: 0, skipped: 0, failed: 0 },
      fixes: [],
      remainingIssues: [],
      typescriptCheck: { passed: false, errors: ['Component file not found'] },
    };
  }

  const content = readFileContent(componentFile);
  if (!content) {
    return {
      success: false,
      component: componentName,
      file: componentFile,
      summary: { totalFixable: 0, applied: 0, skipped: 0, failed: 0 },
      fixes: [],
      remainingIssues: [],
      typescriptCheck: { passed: false, errors: ['Could not read component file'] },
    };
  }

  const fixableIssues = reviewResult.issues.filter(i => i.fixable);
  const scoreBefore = reviewResult.summary.overallScore;
  const gradeBefore = reviewResult.summary.grade;

  const engine = new FixEngine(content, componentFile);

  for (const issue of fixableIssues) {
    engine.applyFix(issue);
  }

  if (engine.hasModifications()) {
    writeFileContent(componentFile, engine.getResult());
  }

  const tsResult = runTypeScriptCheck(componentDir);

  const fixes = engine.getFixes();
  const applied = fixes.filter(f => f.applied).length;
  const skipped = fixes.filter(f => !f.applied && !f.detail.includes('Error')).length;
  const failed = fixes.filter(f => !f.applied && f.detail.includes('Error')).length;

  const remainingIssues = reviewResult.issues.filter(i => !i.fixable);

  return {
    success: true,
    component: componentName,
    file: path.relative(process.cwd(), componentFile),
    summary: {
      totalFixable: fixableIssues.length,
      applied,
      skipped,
      failed,
      scoreBefore,
      gradeBefore,
    },
    fixes,
    remainingIssues,
    typescriptCheck: tsResult,
  };
}

// ============================================================================
// MCP SERVER
// ============================================================================

class ComponentFixerServer extends McpServerBase {
  constructor() {
    super({ name: 'component-fixer', version: '3.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'fix',
      'Comprehensive React component fixer - applies fixes from review JSON output for type-safety, accessibility, performance, security, code quality, and more',
      {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the component directory',
          },
          reviewResult: {
            type: 'object',
            description: 'Review result JSON from component-reviewer (optional - if not provided, will run reviewer internally)',
          },
        },
        required: ['path'],
      },
      this.handleFix.bind(this)
    );

    this.addTool(
      'fix_from_review',
      'Fix component issues from a pre-computed review JSON. Pass the exact output from component-reviewer.',
      {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the component directory',
          },
          reviewJson: {
            type: 'string',
            description: 'JSON string from component-reviewer output',
          },
        },
        required: ['path', 'reviewJson'],
      },
      this.handleFixFromReview.bind(this)
    );
  }

  private async handleFix(args: unknown): Promise<ToolResult> {
    const { path: componentPath, reviewResult } = args as {
      path: string;
      reviewResult?: ReviewResult;
    };

    try {
      const resolvedPath = path.resolve(componentPath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Component path does not exist: ${componentPath}`);
      }

      let componentDir: string;
      let componentName: string;

      const stat = fs.statSync(resolvedPath);
      if (stat.isFile()) {
        componentDir = path.dirname(resolvedPath);
        componentName = path.basename(resolvedPath, path.extname(resolvedPath));
      } else {
        componentDir = resolvedPath;
        componentName = path.basename(resolvedPath);
      }

      if (!reviewResult) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: 'MISSING_REVIEW',
                message: 'No reviewResult provided. Use fix_from_review with reviewJson.',
                suggestion: 'Run component-reviewer first, then pass the result to fix_from_review.',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }

      const result = fixFromReview(componentDir, componentName, reviewResult);

      return this.successWithUI(result as unknown as Record<string, unknown>, {
        uri: 'ui://component-fixer/report',
        html: renderResultHTML(toResultReport(result, new Date().toISOString().slice(0, 10))),
      });
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
              message: error instanceof Error ? error.message : String(error),
              suggestion: 'Check input parameters and ensure the component path is valid.',
              timestamp: new Date().toISOString(),
            },
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleFixFromReview(args: unknown): Promise<ToolResult> {
    const { path: componentPath, reviewJson } = args as {
      path: string;
      reviewJson: string;
    };

    try {
      const reviewResult: ReviewResult = JSON.parse(reviewJson);
      const resolvedPath = path.resolve(componentPath);

      let componentDir: string;
      let componentName: string;

      const stat = fs.statSync(resolvedPath);
      if (stat.isFile()) {
        componentDir = path.dirname(resolvedPath);
        componentName = path.basename(resolvedPath, path.extname(resolvedPath));
      } else {
        componentDir = resolvedPath;
        componentName = path.basename(resolvedPath);
      }

      const result = fixFromReview(componentDir, componentName, reviewResult);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
              message: error instanceof Error ? error.message : String(error),
              suggestion: 'Ensure reviewJson is valid JSON from component-reviewer.',
              timestamp: new Date().toISOString(),
            },
          }, null, 2),
        }],
        isError: true,
      };
    }
  }
}

new ComponentFixerServer().run().catch(console.error);
