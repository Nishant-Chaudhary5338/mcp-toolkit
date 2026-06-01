// ============================================================================
// TOOL #15: detect-shared-modules
// Identifies files used across multiple features
// ============================================================================

import * as path from 'path';
import { findSourceFiles, resolveSourceDir } from '../utils/file-scanner.js';
import { buildImportGraph, resolveImportPath } from '../utils/import-tracker.js';
import { getFileFeature } from '../utils/refactor-helpers.js';
import type { DetectSharedModulesOutput, AnalyzerConfig } from '../types.js';

export async function detectSharedModules(
  appPath: string,
  config?: Partial<AnalyzerConfig>
): Promise<DetectSharedModulesOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);

  if (files.length === 0) {
    return { shared: [], usageCounts: {} };
  }

  const graph = await buildImportGraph(srcPath);

  // Track which features use each file
  const fileUsageByFeature = new Map<string, Set<string>>();

  for (const file of files) {
    const fromFeature = getFileFeature(file, srcPath);
    if (!fromFeature) continue;

    const imports = graph[file]?.imports || [];

    for (const imp of imports) {
      // Only track internal imports (relative paths)
      if (!imp.source.startsWith('.')) continue;

      const resolved = resolveImportPath(file, imp.source, srcPath, files);
      if (!resolved) continue;

      if (!fileUsageByFeature.has(resolved)) {
        fileUsageByFeature.set(resolved, new Set());
      }
      fileUsageByFeature.get(resolved)!.add(fromFeature);
    }
  }

  // Also track files that are imported by many files (high fan-in)
  const fileImportCount = new Map<string, number>();
  for (const file of files) {
    const importers = graph[file]?.importedBy || [];
    fileImportCount.set(file, importers.length);
  }

  // Identify shared modules: used by 2+ features OR high import count
  const shared: string[] = [];
  const usageCounts: Record<string, number> = {};

  for (const [file, features] of fileUsageByFeature) {
    const relPath = path.relative(srcPath, file);

    if (features.size >= 2) {
      if (!shared.includes(relPath)) {
        shared.push(relPath);
      }
      usageCounts[relPath] = features.size;
    }
  }

  // Also add files with high import count (>=5 importers) that aren't already shared
  for (const [file, count] of fileImportCount) {
    const relPath = path.relative(srcPath, file);
    if (count >= 5 && !shared.includes(relPath)) {
      // Only add if it's not a component-specific file
      const feature = getFileFeature(file, srcPath);
      if (!feature) {
        shared.push(relPath);
        usageCounts[relPath] = count;
      }
    }
  }

  // Sort by usage count descending
  shared.sort((a, b) => (usageCounts[b] || 0) - (usageCounts[a] || 0));

  return { shared, usageCounts };
}