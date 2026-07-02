#!/usr/bin/env node
import { McpServerBase, safeReadFile } from '@mcp-showcase/shared';
import { renderReportHTML } from '@mcp-showcase/ui-kit';
import { toHealthReport } from './health-report.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface RenderIssue {
  type: 'missing-memo' | 'missing-usememo' | 'missing-usecallback' | 'inline-object' | 'inline-array' | 'inline-function' | 'new-object-prop' | 'context-value';
  component: string;
  file: string;
  line: number;
  description: string;
  severity: 'high' | 'medium' | 'low';
  fix: string;
}

interface ComponentRenderProfile {
  name: string;
  file: string;
  hasMemo: boolean;
  hasUseMemo: boolean;
  hasUseCallback: boolean;
  propsCount: number;
  inlineObjects: number;
  inlineFunctions: number;
  issues: RenderIssue[];
}

// ============================================================================
// SOURCE ANALYSIS
// ============================================================================

function scanDirectory(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'build', 'dist', '.next', '__tests__', '.turbo', '.git'].includes(entry.name)) continue;
      files.push(...scanDirectory(fullPath));
    } else if (entry.name.match(/\.(tsx|jsx)$/)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.') || entry.name.includes('.stories.')) continue;
      files.push(fullPath);
    }
  }
  return files;
}

// Data consts (SORT_OPTIONS, DEFAULT_FILTERS) are ALL-CAPS/SCREAMING_SNAKE and are never React
// components even though they match the `[A-Z]\w+` shape; skip them here.
function isScreamingSnakeCase(name: string): boolean {
  return name === name.toUpperCase();
}

export function extractComponents(content: string, filePath?: string): string[] {
  // Component detection only makes sense for JSX-capable files.
  if (filePath && !/\.(tsx|jsx)$/.test(filePath)) return [];

  const components: string[] = [];
  const fnRegex = /(?:export\s+(?:default\s+)?)?(?:const|function)\s+([A-Z]\w+)/g;
  let match;
  while ((match = fnRegex.exec(content)) !== null) {
    const name = match[1];
    if (isScreamingSnakeCase(name)) continue;
    if (!components.includes(name)) components.push(name);
  }
  return components;
}

// Locates the `const Name` / `function Name` declaration itself (not just any occurrence of the
// name, which can collide with a longer identifier like `NameProps`).
function findDeclarationStart(content: string, componentName: string): number {
  const re = new RegExp(`\\b(?:const|function)\\s+${componentName}\\b`);
  const match = re.exec(content);
  return match ? match.index : content.indexOf(componentName);
}

export function analyzeComponent(content: string, componentName: string, filePath: string): ComponentRenderProfile {
  let inlineObjects = 0;
  let inlineFunctions = 0;
  let propsCount = 0;
  const issues: RenderIssue[] = [];

  const compStart = findDeclarationStart(content, componentName);
  if (compStart === -1) {
    return { name: componentName, file: filePath, hasMemo: false, hasUseMemo: false, hasUseCallback: false, propsCount, inlineObjects, inlineFunctions, issues };
  }

  // Bound this component's body to the start of the next detected component so issues (and
  // memo/useMemo/useCallback detection) aren't attributed across component boundaries.
  const otherStarts = extractComponents(content, filePath)
    .filter(name => name !== componentName)
    .map(name => findDeclarationStart(content, name))
    .filter(idx => idx > compStart);
  const compEnd = otherStarts.length > 0 ? Math.min(...otherStarts) : content.length;

  const componentBody = content.slice(compStart, compEnd);
  const hasMemo = componentBody.includes(`memo(${componentName})`) || componentBody.includes('React.memo');
  const hasUseMemo = componentBody.includes('useMemo');
  const hasUseCallback = componentBody.includes('useCallback');

  const bodyLines = componentBody.split('\n');

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const lineNum = content.slice(0, compStart).split('\n').length + i;

    // Inline object literals as props: style={{...}}
    const inlineObjMatches = line.match(/\{\{[^}]+\}\}/g);
    if (inlineObjMatches) {
      inlineObjects += inlineObjMatches.length;
      for (const _m of inlineObjMatches) {
        issues.push({
          type: 'inline-object',
          component: componentName,
          file: filePath,
          line: lineNum,
          description: 'Inline object literal creates a new reference on every render, causing child re-renders.',
          severity: 'medium',
          fix: 'Extract to a const outside the component or wrap with useMemo:\nconst style = useMemo(() => ({ /* styles */ }), []);',
        });
      }
    }

    // Inline array literals as props: items={[...]}
    const inlineArrMatches = line.match(/=\s*\[[^\]]*\]/g);
    if (inlineArrMatches && line.includes('<')) {
      inlineObjects += inlineArrMatches.length;
      for (const _m of inlineArrMatches) {
        issues.push({
          type: 'inline-array',
          component: componentName,
          file: filePath,
          line: lineNum,
          description: 'Inline array literal creates a new reference on every render.',
          severity: 'medium',
          fix: 'Extract to useMemo:\nconst items = useMemo(() => [...], [deps]);',
        });
      }
    }

    // Inline arrow functions as props: onClick={() => ...}
    const inlineFnMatches = line.match(/on\w+=\{(?:\([^)]*\)\s*=>|[\w]+\s*=>)/g);
    if (inlineFnMatches) {
      inlineFunctions += inlineFnMatches.length;
      for (const _m of inlineFnMatches) {
        issues.push({
          type: 'inline-function',
          component: componentName,
          file: filePath,
          line: lineNum,
          description: 'Inline function creates a new reference on every render. Use useCallback to memoize.',
          severity: 'medium',
          fix: 'const handler = useCallback((e) => { /* handler logic */ }, [deps]);',
        });
      }
    }

    // Count props
    const propsMatch = line.match(/\(\s*\{\s*([^}]+)\s*\}/);
    if (propsMatch) {
      propsCount = propsMatch[1].split(',').length;
    }

    // new Date/Object inside component
    if (line.match(/new\s+(Date|Object|Array|Map|Set|RegExp)\(/)) {
      issues.push({
        type: 'new-object-prop',
        component: componentName,
        file: filePath,
        line: lineNum,
        description: 'Creating new object instance on every render. Move outside component or memoize.',
        severity: 'low',
        fix: 'const obj = useMemo(() => new Date(), []);',
      });
    }

    // Context value without useMemo
    if (line.includes('value=') && line.includes('{') && !hasUseMemo) {
      issues.push({
        type: 'context-value',
        component: componentName,
        file: filePath,
        line: lineNum,
        description: 'Context value object is recreated on every render. Wrap with useMemo.',
        severity: 'high',
        fix: 'const contextValue = useMemo(() => ({ prop1, prop2 }), [prop1, prop2]);',
      });
    }
  }

  // Missing memo check (only flag if component has props)
  if (!hasMemo && !content.includes('export default memo(') && propsCount > 0) {
    issues.push({
      type: 'missing-memo',
      component: componentName,
      file: filePath,
      line: 1,
      description: 'Component is not wrapped with React.memo. It will re-render whenever parent re-renders, even if props haven\'t changed.',
      severity: 'medium',
      fix: `export default memo(${componentName});`,
    });
  }

  // Missing key prop in .map() renders
  const mapMatches = [...componentBody.matchAll(/\.map\s*\(\s*(?:\([^)]*\)|[\w]+)\s*=>/g)];
  for (const mapMatch of mapMatches) {
    const mapIdx = mapMatch.index ?? 0;
    const mapBlock = componentBody.slice(mapIdx, mapIdx + 300);
    // Check if the returned JSX element has a key prop
    if (!mapBlock.includes('key=') && mapBlock.includes('<')) {
      const lineNum = content.slice(0, compStart + mapIdx).split('\n').length;
      issues.push({
        type: 'inline-function',
        component: componentName,
        file: filePath,
        line: lineNum,
        description: '.map() render missing key prop. React uses key to identify list items — missing keys cause unnecessary re-renders and reconciliation bugs.',
        severity: 'high',
        fix: 'Add a stable key prop to the root element: items.map((item) => <Component key={item.id} />)',
      });
    }
  }

  // useEffect with no dependency array (runs on every render)
  const effectMatches = [...componentBody.matchAll(/useEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>/g)];
  for (const effectMatch of effectMatches) {
    const effectIdx = effectMatch.index ?? 0;
    const effectBlock = componentBody.slice(effectIdx, effectIdx + 200);
    // If no closing ", [" or ", []" pattern → missing deps array
    if (!effectBlock.includes(', [') && !effectBlock.includes(',[')) {
      const lineNum = content.slice(0, compStart + effectIdx).split('\n').length;
      issues.push({
        type: 'missing-usecallback',
        component: componentName,
        file: filePath,
        line: lineNum,
        description: 'useEffect missing dependency array — runs on every render. This is likely a bug or performance issue.',
        severity: 'high',
        fix: 'Add dependency array as second argument: useEffect(() => { ... }, [dep1, dep2])\nUse [] for mount-only effects.',
      });
    }
  }

  return { name: componentName, file: filePath, hasMemo, hasUseMemo, hasUseCallback, propsCount, inlineObjects, inlineFunctions, issues };
}

// ============================================================================
// MAIN SERVER
// ============================================================================

class RenderAnalyzerServer extends McpServerBase {
  constructor() {
    super({ name: 'render-analyzer', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'detect_rerenders',
      'Analyze React component files for unnecessary re-render patterns: inline objects/arrays/functions, missing memo, context value issues.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to component file or directory to analyze' },
          severity: { type: 'string', enum: ['high', 'medium', 'low', 'all'], description: 'Minimum severity to report (default: all)' },
        },
        required: ['path'],
      },
      (args) => this.handleDetectRerenders(args)
    );

    this.addTool(
      'check_memo',
      'Check which components are wrapped with React.memo, use useMemo, or useCallback — and which are not.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to component file or directory' },
        },
        required: ['path'],
      },
      (args) => this.handleCheckMemo(args)
    );

    this.addTool(
      'analyze_props',
      'Find components that pass inline objects or functions as props — the most common cause of unnecessary child re-renders.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to component file or directory' },
        },
        required: ['path'],
      },
      (args) => this.handleAnalyzeProps(args)
    );
  }

  private async handleDetectRerenders(args: unknown) {
    const { path: targetPath, severity = 'all' } = args as { path: string; severity?: string };
    try {
      const stat = fs.statSync(targetPath);
      const files = stat.isDirectory() ? scanDirectory(targetPath) : [targetPath];

      const severityOrder = { high: 0, medium: 1, low: 2 } as const;
      const minSeverity = severityOrder[severity as keyof typeof severityOrder] ?? 2;

      const profiles: ComponentRenderProfile[] = [];
      let totalIssues = 0;

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        const components = extractComponents(content, file);
        for (const comp of components) {
          const profile = analyzeComponent(content, comp, file);
          const filteredIssues = profile.issues.filter(i => severityOrder[i.severity] <= minSeverity);
          profile.issues = filteredIssues;
          totalIssues += filteredIssues.length;
          profiles.push(profile);
        }
      }

      const result = {
        summary: {
          totalComponents: profiles.length,
          totalIssues,
          componentsWithIssues: profiles.filter(p => p.issues.length > 0).length,
        },
        profiles: profiles.filter(p => p.issues.length > 0),
      };
      return this.successWithUI(result as unknown as Record<string, unknown>, {
        uri: 'ui://render-analyzer/report',
        html: renderReportHTML(toHealthReport(result, new Date().toISOString().slice(0, 10))),
      });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleCheckMemo(args: unknown) {
    const { path: targetPath } = args as { path: string };
    try {
      const stat = fs.statSync(targetPath);
      const files = stat.isDirectory() ? scanDirectory(targetPath) : [targetPath];

      const results: unknown[] = [];
      let totalComponents = 0;
      let memoizedCount = 0;
      let useMemoCount = 0;
      let useCallbackCount = 0;

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        const components = extractComponents(content, file);
        for (const comp of components) {
          totalComponents++;
          const profile = analyzeComponent(content, comp, file);
          if (profile.hasMemo) memoizedCount++;
          if (profile.hasUseMemo) useMemoCount++;
          if (profile.hasUseCallback) useCallbackCount++;
          results.push({
            component: comp,
            file,
            hasMemo: profile.hasMemo,
            hasUseMemo: profile.hasUseMemo,
            hasUseCallback: profile.hasUseCallback,
            propsCount: profile.propsCount,
          });
        }
      }

      return this.success({
        summary: {
          totalComponents,
          memoized: memoizedCount,
          notMemoized: totalComponents - memoizedCount,
          useMemoUsage: useMemoCount,
          useCallbackUsage: useCallbackCount,
          memoizationRate: totalComponents > 0 ? Math.round((memoizedCount / totalComponents) * 100) : 100,
        },
        components: results,
      });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleAnalyzeProps(args: unknown) {
    const { path: targetPath } = args as { path: string };
    try {
      const stat = fs.statSync(targetPath);
      const files = stat.isDirectory() ? scanDirectory(targetPath) : [targetPath];

      const results: unknown[] = [];

      for (const file of files) {
        const content = safeReadFile(file);
        if (content === null) continue;
        const components = extractComponents(content, file);
        for (const comp of components) {
          const profile = analyzeComponent(content, comp, file);
          if (profile.inlineObjects > 0 || profile.inlineFunctions > 0) {
            results.push({
              component: comp,
              file,
              inlineObjects: profile.inlineObjects,
              inlineFunctions: profile.inlineFunctions,
              propsCount: profile.propsCount,
              issues: profile.issues.filter(i => ['inline-object', 'inline-array', 'inline-function'].includes(i.type)),
            });
          }
        }
      }

      return this.success({
        componentsWithPropIssues: results.length,
        results,
      });
    } catch (error) {
      return this.error(error);
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new RenderAnalyzerServer().run().catch(console.error);
