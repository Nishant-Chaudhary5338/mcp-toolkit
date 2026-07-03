// ============================================================================
// PATH RESOLVER - Import path resolution and calculation
// ============================================================================

import * as path from 'path';

/**
 * Resolve an import specifier to an absolute file path
 */
export function resolveImportPath(
  fromFile: string,
  specifier: string,
  projectPath: string,
  allFiles: string[]
): string | null {
  // Skip node_modules imports (non-relative)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  let resolved: string;

  if (specifier.startsWith('.')) {
    // Relative import
    resolved = path.resolve(fromDir, specifier);
  } else {
    // Absolute import from project root
    resolved = path.resolve(projectPath, specifier.startsWith('/') ? specifier.slice(1) : specifier);
  }

  // Try exact match first
  if (allFiles.includes(resolved)) {
    return resolved;
  }

  // Try with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx'] as const;
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (allFiles.includes(candidate)) {
      return candidate;
    }
  }

  // Try index files
  const indexExtensions = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'] as const;
  for (const ext of indexExtensions) {
    const candidate = resolved + ext;
    if (allFiles.includes(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Calculate relative import path between two files
 */
export function calculateRelativePath(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let relativePath = path.relative(fromDir, toFile);

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  // Remove extension for cleaner imports
  const ext = path.extname(relativePath);
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    relativePath = relativePath.slice(0, -ext.length);
  }

  // Handle index files - simplify to directory path
  if (relativePath.endsWith('/index')) {
    relativePath = relativePath.slice(0, -'/index'.length) || '.';
  }

  return relativePath;
}

/**
 * Calculate new import path after a file has been moved
 */
export function calculateNewImportPathAfterMove(
  importingFile: string,
  originalImportedFile: string,
  newImportedFile: string,
  originalImportSpecifier: string
): string {
  return calculateRelativePath(importingFile, newImportedFile);
}

/**
 * Check if an import specifier points to a specific file
 */
export function importMatchesFile(
  specifier: string,
  filePath: string,
  fromFile: string,
  projectPath: string
): boolean {
  const resolved = resolveImportPath(fromFile, specifier, projectPath, [filePath]);
  return resolved === filePath;
}

/**
 * Get the depth of a relative import (number of ../)
 */
export function getImportDepth(specifier: string): number {
  if (!specifier.startsWith('.')) return 0;
  return (specifier.match(/\.\.\//g) || []).length;
}

/**
 * Check if import is deep (2+ levels of ../)
 */
export function isDeepImport(specifier: string): boolean {
  return getImportDepth(specifier) >= 2;
}

/**
 * Normalize import path for comparison
 */
export function normalizeImportPath(specifier: string): string {
  // Remove extension
  const ext = path.extname(specifier);
  let normalized = specifier;
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    normalized = specifier.slice(0, -ext.length);
  }

  // Handle index files
  if (normalized.endsWith('/index')) {
    normalized = normalized.slice(0, -'/index'.length) || '.';
  }

  return normalized;
}

/**
 * Check if two import specifiers point to the same module
 */
export function importsAreEqual(spec1: string, spec2: string): boolean {
  return normalizeImportPath(spec1) === normalizeImportPath(spec2);
}

/**
 * Build a map of file basenames to full paths for quick lookup
 */
export function buildFileIndex(files: string[]): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const file of files) {
    const basename = path.basename(file, path.extname(file));
    if (!index.has(basename)) {
      index.set(basename, []);
    }
    index.get(basename)!.push(file);
  }

  return index;
}

/**
 * Find files that import a specific file
 */
export function findFilesImporting(
  targetFile: string,
  allFiles: string[],
  projectPath: string
): string[] {
  const importers: string[] = [];
  const targetBasename = path.basename(targetFile, path.extname(targetFile));

  for (const file of allFiles) {
    if (file === targetFile) continue;

    // Simple heuristic: check if file content references the target
    // This is a simplified version - real implementation would parse AST
    const fileBasename = path.basename(file);
    const relPath = path.relative(path.dirname(file), targetFile);
    const importPath = relPath.startsWith('.') ? relPath : './' + relPath;

    // Would need to read file content and check imports
    // For now, return empty - actual implementation in ast-transform.ts
  }

  return importers;
}

/**
 * Get all possible import paths for a file
 */
export function getPossibleImportPaths(
  targetFile: string,
  fromFile: string
): string[] {
  const paths: string[] = [];
  const relPath = calculateRelativePath(fromFile, targetFile);
  paths.push(relPath);

  // Add version with extension
  const ext = path.extname(targetFile);
  if (ext && !relPath.endsWith(ext)) {
    paths.push(relPath + ext);
  }

  // Add index version if applicable
  if (path.basename(targetFile).startsWith('index.')) {
    const dirPath = relPath.slice(0, -('/index' + ext).length) || '.';
    paths.push(dirPath);
  }

  return paths;
}

/**
 * Calculate import path depth for analysis
 */
export function analyzeImportPath(specifier: string): {
  isRelative: boolean;
  isAbsolute: boolean;
  depth: number;
  isDeep: boolean;
  segments: string[];
} {
  const isRelative = specifier.startsWith('.');
  const isAbsolute = specifier.startsWith('/');
  const depth = getImportDepth(specifier);
  const isDeep = isDeepImport(specifier);
  const segments = specifier.split('/').filter(Boolean);

  return { isRelative, isAbsolute, depth, isDeep, segments };
}