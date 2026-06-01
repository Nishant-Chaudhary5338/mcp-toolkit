// ============================================================================
// TOOL #18: detect-boundary-violations
// Identifies cross-feature imports, deep relative imports, and tight coupling
// ============================================================================

import * as path from 'path';
import { findSourceFiles, resolveSourceDir } from '../utils/file-scanner.js';
import { buildImportGraph, resolveImportPath, findDeepImports, findCrossFeatureImports } from '../utils/import-tracker.js';
import {
  getFileFeature,
  getImportDepth,
  areTightlyCoupled,
} from '../utils/refactor-helpers.js';
import type { DetectBoundaryViolationsOutput, BoundaryViolation, AnalyzerConfig } from '../types.js';

export async function detectBoundaryViolations(
  appPath: string,
  config?: Partial<AnalyzerConfig>
): Promise<DetectBoundaryViolationsOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);

  if (files.length === 0) {
    return {
      violations: [],
      summary: {
        crossFeatureImports: 0,
        deepRelativeImports: 0,
        circularDependencies: 0,
        tightCoupling: 0,
      },
    };
  }

  const graph = await buildImportGraph(srcPath);
  const violations: BoundaryViolation[] = [];

  // 1. Cross-feature imports
  const crossFeatureImports = findCrossFeatureImports(graph, appPath);
  for (const imp of crossFeatureImports) {
    const fromRel = path.relative(srcPath, imp.from);
    const toRel = path.relative(srcPath, imp.to);
    violations.push({
      type: 'cross-feature-import',
      from: fromRel,
      to: toRel,
      description: `File imports across feature boundary: "${imp.importPath}"`,
      severity: 'error',
    });
  }

  // 2. Deep relative imports (../../../ pattern)
  const deepImports = findDeepImports(graph);
  for (const di of deepImports) {
    const fileRel = path.relative(srcPath, di.file);
    violations.push({
      type: 'deep-relative-import',
      from: fileRel,
      to: di.import,
      description: `Deep relative import (${di.depth} levels): "${di.import}"`,
      severity: di.depth >= 3 ? 'error' : 'warning',
    });
  }

  // 3. Circular dependencies
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function detectCycles(file: string, path_: string[]): void {
    if (recursionStack.has(file)) {
      const cycleStart = path_.indexOf(file);
      if (cycleStart !== -1) {
        cycles.push([...path_.slice(cycleStart), file]);
      }
      return;
    }
    if (visited.has(file)) return;

    visited.add(file);
    recursionStack.add(file);
    path_.push(file);

    const imports = graph[file]?.imports || [];
    for (const imp of imports) {
      const resolved = resolveImportPath(file, imp.source, srcPath, files);
      if (resolved) {
        detectCycles(resolved, [...path_]);
      }
    }

    path_.pop();
    recursionStack.delete(file);
  }

  for (const file of files) {
    if (!visited.has(file)) {
      detectCycles(file, []);
    }
  }

  for (const cycle of cycles) {
    const relPaths = cycle.map((f) => path.relative(srcPath, f));
    violations.push({
      type: 'circular-dependency',
      from: relPaths[0],
      to: relPaths[1] || relPaths[0],
      description: `Circular dependency: ${relPaths.join(' → ')}`,
      severity: 'error',
    });
  }

  // 4. Tight coupling (mutual imports)
  const coupledPairs = new Set<string>();
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const pairKey = [files[i], files[j]].sort().join('::');
      if (coupledPairs.has(pairKey)) continue;

      if (areTightlyCoupled(graph, files[i], files[j])) {
        coupledPairs.add(pairKey);
        const fromRel = path.relative(srcPath, files[i]);
        const toRel = path.relative(srcPath, files[j]);
        violations.push({
          type: 'tight-coupling',
          from: fromRel,
          to: toRel,
          description: `Tight coupling: mutual imports between files`,
          severity: 'warning',
        });
      }
    }
  }

  // Deduplicate violations
  const seen = new Set<string>();
  const uniqueViolations = violations.filter((v) => {
    const key = `${v.type}:${v.from}:${v.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Calculate summary
  const summary = {
    crossFeatureImports: uniqueViolations.filter((v) => v.type === 'cross-feature-import').length,
    deepRelativeImports: uniqueViolations.filter((v) => v.type === 'deep-relative-import').length,
    circularDependencies: uniqueViolations.filter((v) => v.type === 'circular-dependency').length,
    tightCoupling: uniqueViolations.filter((v) => v.type === 'tight-coupling').length,
  };

  // Sort by severity (errors first)
  uniqueViolations.sort((a, b) => {
    if (a.severity === b.severity) return a.type.localeCompare(b.type);
    return a.severity === 'error' ? -1 : 1;
  });

  return { violations: uniqueViolations, summary };
}