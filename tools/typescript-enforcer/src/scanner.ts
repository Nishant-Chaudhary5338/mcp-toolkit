import * as fs from 'fs';
import * as path from 'path';
import { safeReadFile } from '@mcp-showcase/shared';
import type { Violation, FileScanResult, DirectoryScanResult, ScanOptions, RuleName } from './types.js';
import { checkNoAny } from './rules/no-any.js';
import { checkGenerics } from './rules/generics.js';
import { checkUtilityTypes } from './rules/utility-types.js';
import { checkModifiers } from './rules/modifiers.js';
import { checkTypeGuards } from './rules/type-guards.js';
import { checkDiscriminatedUnions } from './rules/discriminated-unions.js';
import { checkBrandedTypes } from './rules/branded-types.js';

type RuleChecker = (source: string, filePath: string) => { violations: Violation[] };

const RULES: Record<RuleName, RuleChecker> = {
  'no-any': checkNoAny,
  'generics': checkGenerics,
  'utility-types': checkUtilityTypes,
  'modifiers': checkModifiers,
  'type-guards': checkTypeGuards,
  'discriminated-unions': checkDiscriminatedUnions,
  'branded-types': checkBrandedTypes,
};

export function scanFile(filePath: string, options: ScanOptions = {}): FileScanResult {
  const source = safeReadFile(filePath);
  if (source === null) {
    return {
      file: filePath,
      violations: [],
      summary: { errors: 0, warnings: 0, infos: 0, total: 0 },
      score: 10,
      skipped: true,
    };
  }
  const rulesToRun = options.rules || Object.keys(RULES) as RuleName[];
  const minSeverity = options.severity || 'info';

  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  const minSeverityLevel = severityOrder[minSeverity] ?? 2;

  const allViolations: Violation[] = [];

  for (const ruleName of rulesToRun) {
    const checker = RULES[ruleName];
    if (checker) {
      try {
        const result = checker(source, filePath);
        allViolations.push(...result.violations);
      } catch {
        // Skip rules that fail on this file
      }
    }
  }

  const filtered = allViolations.filter(v => severityOrder[v.severity] <= minSeverityLevel);
  filtered.sort((a, b) => a.line - b.line);

  const errors = filtered.filter(v => v.severity === 'error').length;
  const warnings = filtered.filter(v => v.severity === 'warning').length;
  const infos = filtered.filter(v => v.severity === 'info').length;

  let score = 10;
  score -= errors * 2;
  score -= warnings * 1;
  score -= infos * 0.25;
  score = Math.max(0, Math.round(score * 10) / 10);

  return {
    file: filePath,
    violations: filtered,
    summary: { errors, warnings, infos, total: filtered.length },
    score,
  };
}

const DEFAULT_IGNORE_PATTERNS = ['node_modules', 'build', 'dist', '.next', '.git', '__tests__', '.test.', '.spec.', '.stories.'];

// Converts a simple glob (supporting `*` and `**`) into a RegExp matched against
// a path relative to the scan root, so patterns like '**/contacts/**' work.
function globToRegExp(pattern: string): RegExp {
  let regexStr = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        regexStr += '.*';
        i++;
        if (pattern[i + 1] === '/') i++;
      } else {
        regexStr += '[^/]*';
      }
    } else if ('.+^${}()|[]\\'.includes(c)) {
      regexStr += '\\' + c;
    } else {
      regexStr += c;
    }
  }
  return new RegExp(regexStr);
}

function matchesIgnore(relativePath: string, patterns: string[]): boolean {
  return patterns.some(pattern =>
    pattern.includes('*') ? globToRegExp(pattern).test(relativePath) : relativePath.includes(pattern)
  );
}

function scanDirectoryRecursive(dir: string, root: string, ignorePatterns: string[]): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath);

    if (matchesIgnore(relativePath, ignorePatterns)) continue;

    if (entry.isDirectory()) {
      files.push(...scanDirectoryRecursive(fullPath, root, ignorePatterns));
    } else if (entry.name.match(/\.(ts|tsx|js|jsx)$/)) {
      files.push(fullPath);
    }
  }

  return files;
}

export function scanDirectory(dir: string, options: ScanOptions = {}): DirectoryScanResult {
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...(options.ignore || [])];
  let files = scanDirectoryRecursive(dir, dir, ignorePatterns);

  if (options.maxFiles && files.length > options.maxFiles) {
    files = files.slice(0, options.maxFiles);
  }

  const results: FileScanResult[] = [];
  for (const file of files) {
    try {
      const result = scanFile(file, options);
      if (result.summary.total > 0 || options.severity === undefined) {
        results.push(result);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  results.sort((a, b) => a.score - b.score);

  const totalViolations = results.reduce((sum, r) => sum + r.summary.total, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.summary.errors, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.summary.warnings, 0);
  const totalInfos = results.reduce((sum, r) => sum + r.summary.infos, 0);

  const byRule = {} as Record<RuleName, number>;
  for (const result of results) {
    for (const v of result.violations) {
      byRule[v.rule] = (byRule[v.rule] || 0) + 1;
    }
  }

  const sorted = [...results].sort((a, b) => a.score - b.score);

  return {
    directory: dir,
    filesScanned: files.length,
    totalViolations,
    results,
    worstFiles: sorted.slice(0, 10).map(r => ({ file: r.file, score: r.score, violations: r.summary.total })),
    bestFiles: sorted.slice(-5).reverse().map(r => ({ file: r.file, score: r.score, violations: r.summary.total })),
    byRule,
    summary: { errors: totalErrors, warnings: totalWarnings, infos: totalInfos },
  };
}
