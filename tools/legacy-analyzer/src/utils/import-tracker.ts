// ============================================================================
// IMPORT TRACKER - Build import dependency graph across codebase
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent } from './file-scanner.js';
import { parseFile, extractImports } from './ast-parser.js';
import type { ImportGraph, ImportInfo } from '../types.js';

/**
 * Build a complete import graph for all source files in a directory
 */
export async function buildImportGraph(rootDir: string): Promise<ImportGraph> {
  const files = await findSourceFiles(rootDir);
  const graph: ImportGraph = {};

  // Initialize graph entries
  for (const file of files) {
    graph[file] = { imports: [], importedBy: [] };
  }

  // Parse each file and extract imports
  for (const file of files) {
    const parsed = parseFile(file);
    if (!parsed) continue;

    const imports = extractImports(parsed.ast);
    graph[file].imports = imports;

    // Resolve import paths and build reverse mapping
    for (const imp of imports) {
      const resolved = resolveImportPath(file, imp.source, rootDir, files);
      if (resolved && graph[resolved]) {
        if (!graph[resolved].importedBy.includes(file)) {
          graph[resolved].importedBy.push(file);
        }
      }
    }
  }

  return graph;
}

/**
 * Resolve an import specifier to an actual file path
 */
export function resolveImportPath(
  fromFile: string,
  specifier: string,
  rootDir: string,
  allFiles: string[]
): string | null {
  // Skip node_modules imports
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  let resolved: string;

  if (specifier.startsWith('.')) {
    // Relative import
    resolved = path.resolve(fromDir, specifier);
  } else {
    // Absolute import (from root)
    resolved = path.resolve(rootDir, specifier.startsWith('/') ? specifier.slice(1) : specifier);
  }

  // Try with extensions
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'] as const;
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (allFiles.includes(candidate)) {
      return candidate;
    }
  }

  // Try exact match
  if (allFiles.includes(resolved)) {
    return resolved;
  }

  return null;
}

/**
 * Detect circular dependencies in the import graph
 */
export function detectCircularDependencies(graph: ImportGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(file: string, currentPath: string[]): void {
    if (recursionStack.has(file)) {
      // Found a cycle
      const cycleStart = currentPath.indexOf(file);
      if (cycleStart !== -1) {
        cycles.push(currentPath.slice(cycleStart));
      }
      return;
    }

    if (visited.has(file)) return;

    visited.add(file);
    recursionStack.add(file);
    currentPath.push(file);

    for (const imp of graph[file]?.imports || []) {
      for (const [filePath, data] of Object.entries(graph)) {
        if (data.importedBy.includes(file) || filePath === imp.source) {
          dfs(filePath, [...currentPath]);
        }
      }
    }

    currentPath.pop();
    recursionStack.delete(file);
  }

  for (const file of Object.keys(graph)) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  return cycles;
}

/**
 * Find deep imports (../../../ pattern)
 */
export function findDeepImports(graph: ImportGraph): { file: string; import: string; depth: number }[] {
  const deepImports: { file: string; import: string; depth: number }[] = [];

  for (const [file, data] of Object.entries(graph)) {
    for (const imp of data.imports) {
      if (imp.source.startsWith('.')) {
        const depth = (imp.source.match(/\.\.\//g) || []).length;
        if (depth >= 2) {
          deepImports.push({ file, import: imp.source, depth });
        }
      }
    }
  }

  return deepImports.sort((a, b) => b.depth - a.depth);
}

/**
 * Detect cross-feature imports (importing from sibling feature folders)
 */
export function findCrossFeatureImports(
  graph: ImportGraph,
  rootDir: string,
  srcDir: string = 'src'
): { from: string; to: string; importPath: string }[] {
  const crossFeature: { from: string; to: string; importPath: string }[] = [];
  const srcPath = path.join(rootDir, srcDir);

  for (const [file, data] of Object.entries(graph)) {
    const relFile = path.relative(srcPath, file);
    const fileParts = relFile.split(path.sep);

    if (fileParts.length < 2) continue;

    for (const imp of data.imports) {
      if (!imp.source.startsWith('.')) continue;

      const resolved = resolveImportPath(file, imp.source, rootDir, Object.keys(graph));
      if (!resolved) continue;

      const relResolved = path.relative(srcPath, resolved);
      const resolvedParts = relResolved.split(path.sep);

      if (resolvedParts.length < 2) continue;

      if (fileParts[0] !== resolvedParts[0] && !resolvedParts[0].startsWith('components') && !resolvedParts[0].startsWith('utils')) {
        crossFeature.push({
          from: file,
          to: resolved,
          importPath: imp.source,
        });
      }
    }
  }

  return crossFeature;
}

/**
 * Find unused imports in a file
 */
export function findUnusedImports(content: string, imports: ImportInfo[]): string[] {
  const unused: string[] = [];

  for (const imp of imports) {
    for (const spec of imp.specifiers) {
      const cleanName = spec.replace('* as ', '');
      const regex = new RegExp(`\\b${escapeRegex(cleanName)}\\b`, 'g');
      const matches = content.match(regex);

      if (!matches || matches.length <= 1) {
        unused.push(`${spec} from '${imp.source}'`);
      }
    }
  }

  return unused;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate coupling between two files (how much A depends on B)
 */
export function calculateCoupling(graph: ImportGraph, fileA: string, fileB: string): number {
  const importsFromA = graph[fileA]?.imports || [];
  const importsFromB = graph[fileB]?.imports || [];

  let score = 0;

  for (const imp of importsFromA) {
    if (imp.source.includes(path.basename(fileB, path.extname(fileB)))) {
      score += 1;
    }
  }

  for (const imp of importsFromB) {
    if (imp.source.includes(path.basename(fileA, path.extname(fileA)))) {
      score += 1;
    }
  }

  return score;
}