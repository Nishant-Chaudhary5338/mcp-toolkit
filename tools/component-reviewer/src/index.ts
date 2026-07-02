#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import type { ToolResult } from '@mcp-showcase/shared';
import { renderReportHTML } from '@mcp-showcase/ui-kit';
import { toHealthReport } from './health-report.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ============================================================================
// PATHS (ES module compatible)
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// TYPES
// ============================================================================

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

type IssueCategory =
  | 'type-safety'
  | 'react-patterns'
  | 'accessibility'
  | 'performance'
  | 'code-quality'
  | 'security'
  | 'styling'
  | 'testing';

interface ReviewMetrics {
  linesOfCode: number;
  complexity: number;
  maintainability: number;
  dependencies: {
    internal: number;
    external: number;
    unused: string[];
  };
}

interface ReviewPatterns {
  detected: string[];
  suggested: string[];
}

interface ReviewSummary {
  component: string;
  file: string;
  linesOfCode: number;
  overallScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  estimatedFixTime: string;
  categories: Record<IssueCategory, number>;
}

interface ReviewResult {
  success: boolean;
  summary: ReviewSummary;
  issues: ReviewIssue[];
  metrics: ReviewMetrics;
  patterns: ReviewPatterns;
  quickFixes: Array<{
    id: string;
    description: string;
    issueIds: string[];
    automated: boolean;
  }>;
  typescriptErrors: string[];
  testResults: {
    passed: number;
    failed: number;
    errors: string[];
  };
}

// ============================================================================
// FILE ANALYSIS HELPERS
// ============================================================================

function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function getLines(content: string): string[] {
  return content.split('\n');
}

function findComponentFile(componentDir: string, componentName: string): string | null {
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    const filePath = path.join(componentDir, `${componentName}${ext}`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function findTestFile(componentDir: string, componentName: string): string | null {
  const patterns = [
    `${componentName}.test.tsx`,
    `${componentName}.test.ts`,
    `${componentName}.test.js`,
    `${componentName}.spec.tsx`,
    `${componentName}.spec.ts`,
    `${componentName}.spec.js`,
    `${componentName}.stories.tsx`,
  ];
  for (const pattern of patterns) {
    const filePath = path.join(componentDir, pattern);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

// ============================================================================
// TYPESCRIPT ANALYSIS
// ============================================================================

export function analyzeTypeScript(content: string, lines: string[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  let issueCounter = 0;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    const anyMatches = line.match(/:\s*any\b|<any>|\bas\s+any\b/g);
    if (anyMatches) {
      issues.push({
        id: `TS-${String(++issueCounter).padStart(3, '0')}`,
        category: 'type-safety',
        severity: 'warning',
        line: lineNum,
        code: line.trim(),
        message: "Avoid using 'any' type - it bypasses TypeScript's type checking",
        suggestion: 'Use specific types, unknown, or create a proper interface',
        fixable: true,
        fixType: 'replace',
        docs: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any',
      });
    }

    const isImportOrExportAs = /^\s*(?:import|export)\b/.test(line) && /\bas\b/.test(line);
    if (!isImportOrExportAs && line.match(/\bas\s+[A-Z]/g) && !line.includes('as const')) {
      issues.push({
        id: `TS-${String(++issueCounter).padStart(3, '0')}`,
        category: 'type-safety',
        severity: 'info',
        line: lineNum,
        code: line.trim(),
        message: 'Type assertion detected - prefer type guards or proper typing',
        suggestion: 'Use type guards (typeof, instanceof) or proper type definitions',
        fixable: false,
      });
    }

    if (line.match(/(?:const|let|function)\s+\w+\s*=?\s*(?:\([^)]*\)|\([^)]*\)\s*=>)/)) {
      const hasReturnType = line.match(/\)\s*:\s*\w+/);
      const isExported = content.includes(`export`);
      const isComponent = line.match(/[A-Z]\w*\s*=/);

      if (!hasReturnType && (isExported || isComponent)) {
        issues.push({
          id: `TS-${String(++issueCounter).padStart(3, '0')}`,
          category: 'type-safety',
          severity: 'info',
          line: lineNum,
          code: line.trim(),
          message: 'Consider adding explicit return type for better documentation',
          suggestion: 'Add return type annotation after function parameters',
          fixable: false,
        });
      }
    }

    if (line.includes('!.')) {
      issues.push({
        id: `TS-${String(++issueCounter).padStart(3, '0')}`,
        category: 'type-safety',
        severity: 'warning',
        line: lineNum,
        code: line.trim(),
        message: 'Non-null assertion operator (!) can hide runtime errors',
        suggestion: 'Use optional chaining (?.) with nullish coalescing (??) instead',
        fixable: true,
        fixType: 'replace',
      });
    }
  });

  return issues;
}

// ============================================================================
// REACT PATTERNS ANALYSIS
// ============================================================================

export function analyzeReactPatterns(content: string, lines: string[], componentName: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  let issueCounter = 0;

  // Named function/const components already show their name in DevTools, so
  // only components that lose that name (forwardRef/memo wrapping, or an
  // anonymous default export) actually benefit from an explicit displayName.
  const needsDisplayName =
    /\b(?:React\.)?(?:forwardRef|memo)\s*(?:<[^(]*>)?\s*\(/.test(content) ||
    /export\s+default\s+function\s*\(/.test(content) ||
    /export\s+default\s+\([^)]*\)\s*=>/.test(content);

  if (needsDisplayName && !content.includes('displayName')) {
    issues.push({
      id: `REACT-${String(++issueCounter).padStart(3, '0')}`,
      category: 'react-patterns',
      severity: 'info',
      message: 'Missing displayName for better React DevTools debugging',
      suggestion: `Add: ${componentName}.displayName = '${componentName}';`,
      fixable: true,
      fixType: 'add',
    });
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    if (line.match(/(?:onClick|onChange|onSubmit|onFocus|onBlur)=\{.*=>/)) {
      issues.push({
        id: `REACT-${String(++issueCounter).padStart(3, '0')}`,
        category: 'performance',
        severity: 'warning',
        line: lineNum,
        code: line.trim(),
        message: 'Inline arrow function creates new reference on each render',
        suggestion: 'Extract to useCallback or define outside JSX',
        fixable: true,
        fixType: 'refactor',
      });
    }

    if (line.match(/(?:style|className)=\{\{[^}]+\}\}/)) {
      issues.push({
        id: `REACT-${String(++issueCounter).padStart(3, '0')}`,
        category: 'performance',
        severity: 'warning',
        line: lineNum,
        code: line.trim(),
        message: 'Inline object literal creates new reference on each render',
        suggestion: 'Extract to a constant outside the component or useMemo',
        fixable: true,
        fixType: 'refactor',
      });
    }
  });

  const useStateComplexPattern = /useState\((?:\{[^}]+\}|\[[^\]]+\]|JSON\.|localStorage)/g;
  const complexStateMatches = content.match(useStateComplexPattern);
  if (complexStateMatches) {
    issues.push({
      id: `REACT-${String(++issueCounter).padStart(3, '0')}`,
      category: 'performance',
      severity: 'info',
      message: 'Complex initial state should use lazy initialization',
      suggestion: 'Use useState(() => expensiveComputation()) for expensive initial values',
      fixable: true,
      fixType: 'refactor',
    });
  }

  const useEffectCount = (content.match(/useEffect\(/g) || []).length;
  const cleanupCount = (content.match(/return\s+\(\)\s*=>|return\s+function/g) || []).length;
  if (useEffectCount > cleanupCount && content.includes('addEventListener')) {
    issues.push({
      id: `REACT-${String(++issueCounter).padStart(3, '0')}`,
      category: 'react-patterns',
      severity: 'warning',
      message: 'useEffect with subscriptions/event listeners should have cleanup',
      suggestion: 'Return a cleanup function from useEffect to prevent memory leaks',
      fixable: true,
      fixType: 'add',
    });
  }

  lines.forEach((line, index) => {
    if (line.includes('.map(') && !content.substring(content.indexOf('.map(')).includes('key=')) {
      issues.push({
        id: `REACT-${String(++issueCounter).padStart(3, '0')}`,
        category: 'react-patterns',
        severity: 'error',
        line: index + 1,
        code: line.trim(),
        message: 'Missing key prop in list rendering',
        suggestion: 'Add unique key prop to each element in the map callback',
        fixable: true,
        fixType: 'add',
      });
    }
  });

  const propDrillingPattern = /(\w+):\s*(\w+Props)/g;
  let propDrillCount = 0;
  let match;
  while ((match = propDrillingPattern.exec(content)) !== null) {
    propDrillCount++;
  }
  if (propDrillCount > 2) {
    issues.push({
      id: `REACT-${String(++issueCounter).padStart(3, '0')}`,
      category: 'react-patterns',
      severity: 'info',
      message: 'Possible prop drilling detected - consider using Context or composition',
      suggestion: 'Use React.createContext or component composition to reduce prop drilling',
      fixable: false,
    });
  }

  return issues;
}

// ============================================================================
// ACCESSIBILITY ANALYSIS
// ============================================================================

export function analyzeAccessibility(content: string, lines: string[], _componentName: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  let issueCounter = 0;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    if (line.match(/<img\s/) && !line.includes('alt=')) {
      issues.push({
        id: `A11Y-${String(++issueCounter).padStart(3, '0')}`,
        category: 'accessibility',
        severity: 'error',
        line: lineNum,
        code: line.trim(),
        message: 'Image missing alt attribute',
        suggestion: 'Add alt attribute describing the image or alt="" for decorative images',
        fixable: true,
        fixType: 'add',
        wcag: '1.1.1',
      });
    }

    if (line.match(/<input\s/) && !line.includes('aria-label') && !line.includes('aria-labelledby')) {
      const hasId = line.match(/id=["'](\w+)["']/);
      if (hasId) {
        const labelPattern = new RegExp(`htmlFor=["']${hasId[1]}["']|for=["']${hasId[1]}["']`);
        if (!content.match(labelPattern)) {
          issues.push({
            id: `A11Y-${String(++issueCounter).padStart(3, '0')}`,
            category: 'accessibility',
            severity: 'error',
            line: lineNum,
            code: line.trim(),
            message: 'Form input missing associated label',
            suggestion: 'Add <label htmlFor="..."> or aria-label attribute',
            fixable: true,
            fixType: 'add',
            wcag: '1.3.1',
          });
        }
      } else {
        issues.push({
          id: `A11Y-${String(++issueCounter).padStart(3, '0')}`,
          category: 'accessibility',
          severity: 'warning',
          line: lineNum,
          code: line.trim(),
          message: 'Form input should have id with associated label or aria-label',
          suggestion: 'Add id attribute and matching <label htmlFor>, or use aria-label',
          fixable: true,
          fixType: 'add',
          wcag: '1.3.1',
        });
      }
    }

    if (line.match(/<div[^>]*onClick/)) {
      if (!line.includes('role=') && !line.includes('tabIndex')) {
        issues.push({
          id: `A11Y-${String(++issueCounter).padStart(3, '0')}`,
          category: 'accessibility',
          severity: 'error',
          line: lineNum,
          code: line.trim(),
          message: 'Clickable div missing role and keyboard accessibility',
          suggestion: 'Add role="button" tabIndex={0} and onKeyDown handler, or use <button>',
          fixable: true,
          fixType: 'add',
          wcag: '4.1.2',
        });
      }
    }

    if (line.match(/tabIndex=["'][1-9]/)) {
      issues.push({
        id: `A11Y-${String(++issueCounter).padStart(3, '0')}`,
        category: 'accessibility',
        severity: 'warning',
        line: lineNum,
        code: line.trim(),
        message: 'Avoid positive tabIndex values - they disrupt natural tab order',
        suggestion: 'Use tabIndex={0} for focusable elements or tabIndex={-1} for programmatic focus',
        fixable: true,
        fixType: 'replace',
        wcag: '2.4.3',
      });
    }

    if (line.match(/<(?:video|audio)[^>]*autoPlay/)) {
      issues.push({
        id: `A11Y-${String(++issueCounter).padStart(3, '0')}`,
        category: 'accessibility',
        severity: 'warning',
        line: lineNum,
        code: line.trim(),
        message: 'Autoplay media can be disruptive to users',
        suggestion: 'Remove autoplay or add controls and muted attribute',
        fixable: true,
        fixType: 'replace',
        wcag: '1.4.2',
      });
    }
  });

  if (content.includes('onClick') || content.includes('onKeyDown')) {
    if (!content.includes('focus') && !content.includes('focus-visible') && !content.includes('outline')) {
      issues.push({
        id: `A11Y-${String(++issueCounter).padStart(3, '0')}`,
        category: 'accessibility',
        severity: 'warning',
        message: 'Interactive elements should have visible focus styles',
        suggestion: 'Add :focus or :focus-visible styles for keyboard navigation',
        fixable: true,
        fixType: 'add',
        wcag: '2.4.7',
      });
    }
  }

  return issues;
}

// ============================================================================
// CODE QUALITY ANALYSIS
// ============================================================================

export function analyzeCodeQuality(content: string, lines: string[], componentName: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  let issueCounter = 0;

  if (componentName.includes('-')) {
    issues.push({
      id: `QUAL-${String(++issueCounter).padStart(3, '0')}`,
      category: 'code-quality',
      severity: 'error',
      message: `Component name "${componentName}" contains hyphens which are invalid JavaScript identifiers`,
      suggestion: `Rename to "${componentName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}" (PascalCase without hyphens)`,
      fixable: false,
    });
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const exportMatch = line.match(/export\s+(?:interface|type|const|function|class)\s+([\w-]+)/);
    if (exportMatch && exportMatch[1].includes('-')) {
      issues.push({
        id: `QUAL-${String(++issueCounter).padStart(3, '0')}`,
        category: 'code-quality',
        severity: 'error',
        line: lineNum,
        code: line.trim(),
        message: `Exported identifier "${exportMatch[1]}" contains hyphens which are invalid in JavaScript/TypeScript`,
        suggestion: `Rename to PascalCase: "${exportMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())}"`,
        fixable: false,
      });
    }
  });

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX):\s*(.+)/i);
    if (todoMatch) {
      issues.push({
        id: `QUAL-${String(++issueCounter).padStart(3, '0')}`,
        category: 'code-quality',
        severity: 'info',
        line: lineNum,
        code: line.trim(),
        message: `${todoMatch[1].toUpperCase()} comment found: ${todoMatch[2].trim()}`,
        suggestion: 'Address this item before production release',
        fixable: false,
      });
    }
  });

  lines.forEach((line, index) => {
    if (line.match(/console\.(log|debug|info)\(/)) {
      issues.push({
        id: `QUAL-${String(++issueCounter).padStart(3, '0')}`,
        category: 'code-quality',
        severity: 'warning',
        line: index + 1,
        code: line.trim(),
        message: 'Console statement found - should be removed in production',
        suggestion: 'Remove console statement or use a proper logging library',
        fixable: true,
        fixType: 'remove',
      });
    }
  });

  if (lines.length > 300) {
    issues.push({
      id: `QUAL-${String(++issueCounter).padStart(3, '0')}`,
      category: 'code-quality',
      severity: 'warning',
      message: `Component file is ${lines.length} lines (max recommended: 300)`,
      suggestion: 'Consider splitting into smaller components or extracting custom hooks',
      fixable: false,
    });
  }

  return issues;
}

// ============================================================================
// SECURITY ANALYSIS
// ============================================================================

function analyzeSecurity(content: string, lines: string[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  let issueCounter = 0;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    if (line.includes('dangerouslySetInnerHTML')) {
      issues.push({
        id: `SEC-${String(++issueCounter).padStart(3, '0')}`,
        category: 'security',
        severity: 'error',
        line: lineNum,
        code: line.trim(),
        message: 'dangerouslySetInnerHTML can introduce XSS vulnerabilities',
        suggestion: 'Sanitize HTML content or use a safe rendering method',
        fixable: false,
        docs: 'https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml',
      });
    }

    if (line.includes('eval(') || line.includes('new Function(')) {
      issues.push({
        id: `SEC-${String(++issueCounter).padStart(3, '0')}`,
        category: 'security',
        severity: 'error',
        line: lineNum,
        code: line.trim(),
        message: 'eval() or new Function() usage is a security risk',
        suggestion: 'Avoid dynamic code execution - use safe alternatives',
        fixable: false,
      });
    }

    if (line.includes('.innerHTML')) {
      issues.push({
        id: `SEC-${String(++issueCounter).padStart(3, '0')}`,
        category: 'security',
        severity: 'warning',
        line: lineNum,
        code: line.trim(),
        message: 'Direct innerHTML manipulation can lead to XSS',
        suggestion: "Use React's declarative rendering instead",
        fixable: true,
        fixType: 'refactor',
      });
    }

    if (line.match(/(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']+["']/i)) {
      issues.push({
        id: `SEC-${String(++issueCounter).padStart(3, '0')}`,
        category: 'security',
        severity: 'error',
        line: lineNum,
        code: line.replace(/["'][^"']+["']/, '"***"'),
        message: 'Possible hardcoded secret detected',
        suggestion: 'Use environment variables for sensitive values',
        fixable: true,
        fixType: 'refactor',
      });
    }
  });

  return issues;
}

// ============================================================================
// STYLING ANALYSIS
// ============================================================================

function analyzeStyling(content: string, lines: string[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  let issueCounter = 0;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    const colorPattern = /(?:background|color|border|bg)[^=]*=["'](?:#[0-9a-fA-F]{3,8}|rgb|rgba|hsl)/g;
    if (line.match(colorPattern)) {
      issues.push({
        id: `STYLE-${String(++issueCounter).padStart(3, '0')}`,
        category: 'styling',
        severity: 'info',
        line: lineNum,
        code: line.trim(),
        message: 'Hardcoded color value detected',
        suggestion: 'Use design tokens or Tailwind color classes for consistency',
        fixable: true,
        fixType: 'replace',
      });
    }

    if (line.match(/style=\{\{[^}]+\}\}/)) {
      issues.push({
        id: `STYLE-${String(++issueCounter).padStart(3, '0')}`,
        category: 'styling',
        severity: 'info',
        line: lineNum,
        code: line.trim(),
        message: 'Inline style detected',
        suggestion: 'Consider using Tailwind classes or CSS modules for better maintainability',
        fixable: false,
      });
    }

    if (line.includes('!important')) {
      issues.push({
        id: `STYLE-${String(++issueCounter).padStart(3, '0')}`,
        category: 'styling',
        severity: 'warning',
        line: lineNum,
        code: line.trim(),
        message: '!important usage indicates specificity issues',
        suggestion: 'Restructure CSS to avoid !important by using proper specificity',
        fixable: true,
        fixType: 'refactor',
      });
    }
  });

  return issues;
}

// ============================================================================
// TESTING ANALYSIS
// ============================================================================

function analyzeTesting(testContent: string | null, componentName: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  let issueCounter = 0;

  if (!testContent) {
    issues.push({
      id: `TEST-${String(++issueCounter).padStart(3, '0')}`,
      category: 'testing',
      severity: 'warning',
      message: 'No test file found for this component',
      suggestion: `Create ${componentName}.test.tsx with unit tests`,
      fixable: false,
    });
    return issues;
  }

  if (!testContent.includes('aria') && !testContent.includes('role') && !testContent.includes('accessible')) {
    issues.push({
      id: `TEST-${String(++issueCounter).padStart(3, '0')}`,
      category: 'testing',
      severity: 'info',
      message: 'No accessibility tests found',
      suggestion: 'Add tests for ARIA attributes and screen reader compatibility',
      fixable: false,
    });
  }

  if (!testContent.includes('error') && !testContent.includes('Error')) {
    issues.push({
      id: `TEST-${String(++issueCounter).padStart(3, '0')}`,
      category: 'testing',
      severity: 'info',
      message: 'No error state tests found',
      suggestion: 'Add tests for error handling and edge cases',
      fixable: false,
    });
  }

  if (!testContent.includes('fireEvent') && !testContent.includes('userEvent')) {
    issues.push({
      id: `TEST-${String(++issueCounter).padStart(3, '0')}`,
      category: 'testing',
      severity: 'info',
      message: 'No user interaction tests found',
      suggestion: 'Add tests for click, input, and keyboard interactions',
      fixable: false,
    });
  }

  if (testContent.includes('toMatchSnapshot')) {
    issues.push({
      id: `TEST-${String(++issueCounter).padStart(3, '0')}`,
      category: 'testing',
      severity: 'info',
      message: 'Snapshot test detected - consider behavioral tests instead',
      suggestion: 'Prefer testing behavior and user interactions over snapshots',
      fixable: false,
    });
  }

  return issues;
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

function calculateMetrics(content: string, issues: ReviewIssue[]): ReviewMetrics {
  const lines = content.split('\n');

  const decisionPatterns = [
    /\bif\s*\(/g,
    /\belse\s+if\b/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\b\?\s*[^:]+\s*:/g,
    /\b&&\b/g,
    /\b\|\|\b/g,
  ];

  let complexity = 1;
  decisionPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  });

  const maintainability = Math.max(0, Math.min(100,
    100 - (complexity * 2) - (issues.length * 3) - (lines.length > 200 ? 10 : 0)
  ));

  const internalImports = (content.match(/from\s+['"]\.\//g) || []).length;
  const externalImports = (content.match(/from\s+['"][^./]/g) || []).length;

  return {
    linesOfCode: lines.filter(l => l.trim().length > 0).length,
    complexity,
    maintainability,
    dependencies: {
      internal: internalImports,
      external: externalImports,
      unused: [],
    },
  };
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

function detectPatterns(content: string): ReviewPatterns {
  const detected: string[] = [];
  const suggested: string[] = [];

  if (content.includes('useState')) detected.push('state-management');
  if (content.includes('useEffect')) detected.push('side-effects');
  if (content.includes('useContext')) detected.push('context-consumer');
  if (content.includes('createContext')) detected.push('context-provider');
  if (content.includes('forwardRef')) detected.push('ref-forwarding');
  if (content.includes('useMemo')) detected.push('memoization');
  if (content.includes('useCallback')) detected.push('callback-memoization');
  if (content.includes('React.memo')) detected.push('component-memoization');
  if (content.includes('children')) detected.push('composition');
  if (content.match(/render\w*=\{/)) detected.push('render-prop');
  if (content.includes('useReducer')) detected.push('reducer-pattern');

  if (content.includes('useState') && content.includes('useEffect') && !content.includes('useReducer')) {
    suggested.push('custom-hook');
  }
  if (content.includes('props.') && (content.match(/props\.\w+/g)?.length ?? 0) > 5) {
    suggested.push('destructuring');
  }
  if (detected.includes('state-management') && !detected.includes('context-consumer')) {
    suggested.push('context');
  }

  return { detected, suggested };
}

// ============================================================================
// GRADE CALCULATION
// ============================================================================

export function calculateGrade(score: number): ReviewSummary['grade'] {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function calculateEstimatedFixTime(issues: ReviewIssue[]): string {
  let minutes = 0;
  issues.forEach(issue => {
    switch (issue.severity) {
      case 'error': minutes += 5; break;
      case 'warning': minutes += 3; break;
      case 'info': minutes += 1; break;
    }
  });
  if (minutes < 60) return `${minutes}min`;
  return `${Math.round(minutes / 60)}h`;
}

// ============================================================================
// TYPESCRIPT & TEST EXECUTION
// ============================================================================

function runTypeScriptCheck(componentDir: string): { errors: string[]; passed: boolean } {
  try {
    const tsconfigPath = findTsconfig(componentDir);
    if (!tsconfigPath) {
      return { errors: ['No tsconfig.json found'], passed: true };
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
    return { errors: errors.slice(0, 10), passed: false };
  }
}

function runTests(componentDir: string, componentName: string): { passed: number; failed: number; errors: string[] } {
  const testFile = findTestFile(componentDir, componentName);
  if (!testFile) {
    return { passed: 0, failed: 0, errors: ['No test file found'] };
  }

  try {
    const output = execSync(`npx vitest run ${testFile} --reporter=json 2>&1`, {
      cwd: path.join(componentDir, '..', '..'),
      stdio: 'pipe',
      timeout: 60000,
    }).toString();

    try {
      const result = JSON.parse(output);
      const testResult = result.testResults?.[0];
      return {
        passed: testResult?.numPassedTests || result.numPassedTests || 0,
        failed: testResult?.numFailedTests || result.numFailedTests || 0,
        errors: testResult?.message ? [testResult.message] : [],
      };
    } catch {
      if (output.includes('Tests') && output.includes('passed')) {
        return { passed: 1, failed: 0, errors: [] };
      }
      return { passed: 0, failed: 0, errors: ['Failed to parse test output'] };
    }
  } catch (error: unknown) {
    const err = error as { stdout?: { toString(): string }; stderr?: { toString(): string }; message: string };
    const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
    if (output.includes('FAIL') || output.includes('failed')) {
      return { passed: 0, failed: 1, errors: [output.substring(0, 500)] };
    }
    return { passed: 0, failed: 0, errors: [output.substring(0, 500)] };
  }
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

// ============================================================================
// QUICK FIXES GENERATION
// ============================================================================

function generateQuickFixes(issues: ReviewIssue[]): Array<{
  id: string;
  description: string;
  issueIds: string[];
  automated: boolean;
}> {
  const quickFixes: Array<{
    id: string;
    description: string;
    issueIds: string[];
    automated: boolean;
  }> = [];

  const fixableIssues = issues.filter(i => i.fixable);

  const typeIssues = fixableIssues.filter(i => i.category === 'type-safety');
  if (typeIssues.length > 0) {
    quickFixes.push({
      id: 'fix-types',
      description: `Fix ${typeIssues.length} type safety issues`,
      issueIds: typeIssues.map(i => i.id),
      automated: true,
    });
  }

  const a11yIssues = fixableIssues.filter(i => i.category === 'accessibility');
  if (a11yIssues.length > 0) {
    quickFixes.push({
      id: 'fix-a11y',
      description: `Fix ${a11yIssues.length} accessibility issues`,
      issueIds: a11yIssues.map(i => i.id),
      automated: true,
    });
  }

  const perfIssues = fixableIssues.filter(i => i.category === 'performance');
  if (perfIssues.length > 0) {
    quickFixes.push({
      id: 'fix-perf',
      description: `Fix ${perfIssues.length} performance issues`,
      issueIds: perfIssues.map(i => i.id),
      automated: false,
    });
  }

  return quickFixes;
}

// ============================================================================
// MAIN SERVER CLASS
// ============================================================================

class ComponentReviewerServer extends McpServerBase {
  constructor() {
    super({ name: 'component-reviewer', version: '3.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'review',
      'Comprehensive React component review - analyzes TypeScript, React patterns, accessibility, performance, security, code quality, and testing',
      {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the component file or directory to review',
          },
        },
        required: ['path'],
      },
      this.handleReview.bind(this)
    );
  }

  private async handleReview(args: unknown): Promise<ToolResult> {
    const { path: componentPath } = args as { path: string };

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

      const componentFile = findComponentFile(componentDir, componentName);
      if (!componentFile) {
        throw new Error(`Component file not found for: ${componentName}`);
      }

      const content = readFileContent(componentFile);
      if (!content) {
        throw new Error(`Could not read component file: ${componentFile}`);
      }

      const lines = getLines(content);

      const testFile = findTestFile(componentDir, componentName);
      const testContent = testFile ? readFileContent(testFile) : null;

      const typeScriptIssues = analyzeTypeScript(content, lines);
      const reactIssues = analyzeReactPatterns(content, lines, componentName);
      const accessibilityIssues = analyzeAccessibility(content, lines, componentName);
      const codeQualityIssues = analyzeCodeQuality(content, lines, componentName);
      const securityIssues = analyzeSecurity(content, lines);
      const stylingIssues = analyzeStyling(content, lines);
      const testingIssues = analyzeTesting(testContent, componentName);

      const allIssues = [
        ...typeScriptIssues,
        ...reactIssues,
        ...accessibilityIssues,
        ...codeQualityIssues,
        ...securityIssues,
        ...stylingIssues,
        ...testingIssues,
      ];

      const tsResult = runTypeScriptCheck(componentDir);
      const testResults = runTests(componentDir, componentName);
      const metrics = calculateMetrics(content, allIssues);
      const patterns = detectPatterns(content);
      const quickFixes = generateQuickFixes(allIssues);

      const criticalIssues = allIssues.filter(i => i.severity === 'error').length;
      const warningIssues = allIssues.filter(i => i.severity === 'warning').length;
      const infoIssues = allIssues.filter(i => i.severity === 'info').length;

      const categories: Record<IssueCategory, number> = {
        'type-safety': 0,
        'react-patterns': 0,
        'accessibility': 0,
        'performance': 0,
        'code-quality': 0,
        'security': 0,
        'styling': 0,
        'testing': 0,
      };
      allIssues.forEach(issue => {
        categories[issue.category]++;
      });

      let score = 100;
      score -= criticalIssues * 10;
      score -= warningIssues * 5;
      score -= infoIssues * 1;
      score -= tsResult.passed ? 0 : 20;
      score -= testResults.failed * 10;
      score = Math.max(0, Math.min(100, score));

      const summary: ReviewSummary = {
        component: componentName,
        file: path.relative(process.cwd(), componentFile),
        linesOfCode: metrics.linesOfCode,
        overallScore: score,
        grade: calculateGrade(score),
        totalIssues: allIssues.length,
        criticalIssues,
        warningIssues,
        infoIssues,
        estimatedFixTime: calculateEstimatedFixTime(allIssues),
        categories,
      };

      const result: ReviewResult = {
        success: true,
        summary,
        issues: allIssues,
        metrics,
        patterns,
        quickFixes,
        typescriptErrors: tsResult.errors,
        testResults,
      };

      const report = toHealthReport(result, new Date().toISOString().slice(0, 10));
      return this.successWithUI(result as unknown as Record<string, unknown>, {
        uri: 'ui://component-reviewer/report',
        html: renderReportHTML(report),
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
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new ComponentReviewerServer().run().catch(console.error);
