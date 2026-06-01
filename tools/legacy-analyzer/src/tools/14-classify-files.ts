// ============================================================================
// TOOL #14: classify-files
// Classifies each file into feature-specific, shared, utility, or config
// ============================================================================

import * as path from 'path';
import { findSourceFiles, resolveSourceDir } from '../utils/file-scanner.js';
import { buildImportGraph, resolveImportPath } from '../utils/import-tracker.js';
import {
  classifyFileType,
  detectFeatureFromPath,
  getFileFeature,
} from '../utils/refactor-helpers.js';
import type { ClassifyFilesOutput, FileClassification, AnalyzerConfig } from '../types.js';

export async function classifyFiles(
  appPath: string,
  config?: Partial<AnalyzerConfig>
): Promise<ClassifyFilesOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);

  if (files.length === 0) {
    return { files: [] };
  }

  // Build import graph for cross-feature analysis
  const graph = await buildImportGraph(srcPath);

  // Count how many different features import each file
  const importedByFeatures = new Map<string, Set<string>>();

  for (const file of files) {
    const imports = graph[file]?.imports || [];
    const fromFeature = getFileFeature(file, srcPath);

    for (const imp of imports) {
      const resolved = resolveImportPath(file, imp.source, srcPath, files);
      if (!resolved) continue;

      if (!importedByFeatures.has(resolved)) {
        importedByFeatures.set(resolved, new Set());
      }
      if (fromFeature) {
        importedByFeatures.get(resolved)!.add(fromFeature);
      }
    }
  }

  // Classify each file
  const classifications: FileClassification[] = [];

  for (const file of files) {
    const relPath = path.relative(srcPath, file);
    let type: FileClassification['type'];
    let feature: string | undefined;

    // First check: if imported by 2+ different features, it's shared
    const importingFeatures = importedByFeatures.get(file);
    if (importingFeatures && importingFeatures.size >= 2) {
      type = 'shared';
    } else {
      // Use path-based classification
      type = classifyFileType(file, srcPath);
    }

    // Detect feature for feature-specific files
    if (type === 'feature') {
      const detectedFeature = detectFeatureFromPath(file, srcPath);
      if (detectedFeature) {
        feature = detectedFeature;
      } else {
        // If no feature detected, reclassify as shared
        type = 'shared';
      }
    }

    classifications.push({
      path: relPath,
      type,
      feature,
    });
  }

  // Sort by type then by path
  classifications.sort((a, b) => {
    const typeOrder = { feature: 0, shared: 1, utility: 2, config: 3 } as const;
    const typeDiff = typeOrder[a.type] - typeOrder[b.type];
    if (typeDiff !== 0) return typeDiff;
    return a.path.localeCompare(b.path);
  });

  return { files: classifications };
}