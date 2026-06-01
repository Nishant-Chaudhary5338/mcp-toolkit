// ============================================================================
// TOOL #11: analyze-dependencies-usage
// Deep analysis of external libraries, internal imports, UI package usage
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, readPackageJson, resolveSourceDir } from '../utils/file-scanner.js';
import { parseFile, extractImports } from '../utils/ast-parser.js';
import { buildImportGraph, findDeepImports, findCrossFeatureImports, findUnusedImports, detectCircularDependencies } from '../utils/import-tracker.js';
import type { AnalyzeDependenciesOutput, ExternalLibraryUsage, AnalyzerConfig } from '../types.js';

const LIBRARY_PATTERNS: Record<string, { check: RegExp; issues: (content: string) => string[] }> = {
  redux: {
    check: /from\s+['"]redux|from\s+['"]@reduxjs|from\s+['"]react-redux/,
    issues: (content: string) => {
      const issues: string[] = [];
      if (content.includes('getState()') && !content.includes('useSelector')) {
        issues.push('Direct store.getState() usage - prefer useSelector');
      }
      if (!content.includes('createSelector') && content.includes('mapStateToProps')) {
        issues.push('Using mapStateToProps without Reselect - consider memoized selectors');
      }
      return issues;
    },
  },
  'react-router-dom': {
    check: /from\s+['"]react-router-dom/,
    issues: (content: string) => {
      const issues: string[] = [];
      const hardcodedPaths = content.match(/['"`]\/[^'"`\s]+['"`]/g) || [];
      if (hardcodedPaths.length > 3) {
        issues.push(`${hardcodedPaths.length} hardcoded route paths - consider route constants`);
      }
      return issues;
    },
  },
  axios: {
    check: /from\s+['"]axios/,
    issues: (content: string) => {
      const issues: string[] = [];
      if (content.includes('axios.create') && content.split('axios.create').length > 3) {
        issues.push('Multiple axios instances created - consider a single configured instance');
      }
      if (!content.includes('interceptor')) {
        issues.push('No interceptors detected - consider adding for auth/error handling');
      }
      return issues;
    },
  },
  lodash: {
    check: /from\s+['"]lodash/,
    issues: (content: string) => {
      const issues: string[] = [];
      if (content.includes("from 'lodash'") || content.includes('from "lodash"')) {
        issues.push('Full lodash import - use lodash-es or individual imports for tree-shaking');
      }
      return issues;
    },
  },
  moment: {
    check: /from\s+['"]moment/,
    issues: () => ['moment.js is deprecated and has large bundle size - consider date-fns or dayjs'],
  },
};

export async function analyzeDependenciesUsage(appPath: string, config?: Partial<AnalyzerConfig>): Promise<AnalyzeDependenciesOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);
  const graph = await buildImportGraph(appPath);
  const pkg = readPackageJson(appPath);

  const allDeps = {
    ...((pkg?.dependencies as Record<string, string> | undefined) || {}),
    ...((pkg?.devDependencies as Record<string, string> | undefined) || {}),
  };

  const externalLibraries: ExternalLibraryUsage[] = [];
  const issues: string[] = [];
  const importAntiPatterns: string[] = [];

  // 1. Analyze external library usage
  for (const [libName, pattern] of Object.entries(LIBRARY_PATTERNS)) {
    if (!allDeps[libName]) continue;

    let usageCount = 0;
    const libIssues: string[] = [];

    for (const file of files) {
      const content = readFileContent(file);
      if (!content) continue;

      if (pattern.check.test(content)) {
        usageCount++;
        libIssues.push(...pattern.issues(content));
      }
    }

    if (usageCount > 0) {
      externalLibraries.push({
        name: libName,
        usageCount,
        pattern: libIssues.length > 0 ? 'suboptimal' : 'optimal',
        issues: [...new Set(libIssues)],
      });
    }
  }

  // Check for additional deps not in predefined patterns
  for (const dep of Object.keys(allDeps)) {
    if (LIBRARY_PATTERNS[dep]) continue;
    if (dep.startsWith('@types/') || dep.startsWith('eslint') || dep.startsWith('typescript')) continue;

    let usageCount = 0;
    for (const file of files) {
      const content = readFileContent(file);
      if (content && content.includes(dep)) {
        usageCount++;
      }
    }

    if (usageCount > 0) {
      externalLibraries.push({
        name: dep,
        usageCount,
        pattern: 'optimal',
        issues: [],
      });
    }
  }

  // 2. Analyze internal imports
  const deepImports = findDeepImports(graph);
  const crossFeatureImports = findCrossFeatureImports(graph, appPath);

  const deepImportList = deepImports.map((d) =>
    `${path.relative(appPath, d.file)}: ${d.import} (depth: ${d.depth})`
  );

  const crossFeatureList = crossFeatureImports.map((c) =>
    `${path.relative(appPath, c.from)} -> ${path.relative(appPath, c.to)} via ${c.importPath}`
  );

  // 3. Detect circular dependencies
  const cycles = detectCircularDependencies(graph);
  const circularIssues = cycles.map((cycle) =>
    `Circular: ${cycle.map((f) => path.relative(appPath, f)).join(' -> ')}`
  );

  // 4. Check UI package usage
  const uiPackageUsage = {
    used: false,
    violations: [] as string[],
  };

  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    const parsed = parseFile(file);
    if (!parsed) continue;

    const imports = extractImports(parsed.ast);

    // Check if @repo/ui is imported
    const hasUIImport = imports.some((i) =>
      i.source.includes('@repo/ui') || i.source.includes('@monorepo/ui')
    );

    if (hasUIImport) {
      uiPackageUsage.used = true;
    }

    // Check for reimplemented UI components
    const uiComponentNames = ['Button', 'Input', 'Card', 'Modal', 'Dialog', 'Select', 'Checkbox'] as const;
    for (const comp of uiComponentNames) {
      if (content.includes(`function ${comp}`) || content.includes(`const ${comp} =`) || content.includes(`class ${comp}`)) {
        if (!hasUIImport) {
          uiPackageUsage.violations.push(`${path.relative(appPath, file)}: Reimplements ${comp} component locally`);
        }
      }
    }
  }

  // 5. Check utils usage
  const duplicatedUtils: string[] = [];
  const missingCentral: string[] = [];

  const utilFunctions = new Map<string, string[]>();
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    // Look for common utility patterns that should be centralized
    const patterns = [
      { name: 'formatDate', regex: /formatDate|dateFormat/g },
      { name: 'formatCurrency', regex: /formatCurrency|currencyFormat/g },
      { name: 'debounce', regex: /debounce|useDebounce/g },
      { name: 'throttle', regex: /throttle|useThrottle/g },
      { name: 'classNames', regex: /classNames|clsx|cn\(/g },
    ];

    for (const p of patterns) {
      const matches = content.match(p.regex);
      if (matches && matches.length > 0) {
        if (!utilFunctions.has(p.name)) {
          utilFunctions.set(p.name, []);
        }
        utilFunctions.get(p.name)!.push(path.relative(appPath, file));
      }
    }
  }

  for (const [func, fileList] of utilFunctions) {
    if (fileList.length > 2) {
      duplicatedUtils.push(`${func} implemented in ${fileList.length} files: ${fileList.join(', ')}`);
    }
  }

  // 6. Detect import anti-patterns
  for (const d of deepImports) {
    if (d.depth >= 3) {
      importAntiPatterns.push(`Very deep import (${d.depth} levels): ${d.import}`);
    }
  }

  // Check for unused imports
  for (const file of files.slice(0, 50)) { // Limit for performance
    const content = readFileContent(file);
    if (!content) continue;

    const parsed = parseFile(file);
    if (!parsed) continue;

    const imports = extractImports(parsed.ast);
    const unused = findUnusedImports(content, imports);
    if (unused.length > 0) {
      importAntiPatterns.push(`${path.relative(appPath, file)}: ${unused.length} unused imports`);
    }
  }

  // Compile coupling issues
  const couplingIssues: string[] = [];
  if (crossFeatureList.length > 0) {
    couplingIssues.push(...crossFeatureList.slice(0, 5));
  }

  return {
    externalLibraries: externalLibraries.sort((a, b) => b.usageCount - a.usageCount),
    internalImports: {
      deepImports: deepImportList.slice(0, 10),
      crossFeatureImports: crossFeatureList.slice(0, 10),
      couplingIssues,
    },
    uiUsage: uiPackageUsage,
    utilsUsage: {
      duplicated: duplicatedUtils.slice(0, 10),
      missingCentral: missingCentral.slice(0, 10),
    },
    importAntiPatterns: importAntiPatterns.slice(0, 15),
    issues: [
      ...circularIssues,
      ...(uiPackageUsage.violations.length > 0 ? [`UI package violations: ${uiPackageUsage.violations.length} components reimplemented locally`] : []),
      ...(duplicatedUtils.length > 0 ? [`Duplicated utility functions detected across ${duplicatedUtils.length} patterns`] : []),
    ],
  };
}