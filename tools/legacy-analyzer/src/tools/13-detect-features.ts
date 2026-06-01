// ============================================================================
// TOOL #13: detect-features
// Identifies logical features/domains in the app using file names, routing,
// folder grouping, and import clustering
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, resolveSourceDir } from '../utils/file-scanner.js';
import { buildImportGraph, resolveImportPath } from '../utils/import-tracker.js';
import {
  detectFeatureFromPath,
  detectFeatureFromRoute,
  extractRoutePaths,
} from '../utils/refactor-helpers.js';
import type { DetectFeaturesOutput, AnalyzerConfig } from '../types.js';

export async function detectFeatures(
  appPath: string,
  config?: Partial<AnalyzerConfig>
): Promise<DetectFeaturesOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);

  if (files.length === 0) {
    return { features: [], featureMap: {} };
  }

  // Phase 1: Detect features from file paths
  const pathFeatures = new Map<string, Set<string>>();
  for (const file of files) {
    const feature = detectFeatureFromPath(file, srcPath);
    if (feature) {
      if (!pathFeatures.has(feature)) {
        pathFeatures.set(feature, new Set());
      }
      pathFeatures.get(feature)!.add(path.relative(srcPath, file));
    }
  }

  // Phase 2: Detect features from routing
  const routes = await extractRoutePaths(appPath);
  const routeFeatures = new Map<string, string[]>();
  for (const route of routes) {
    const feature = detectFeatureFromRoute(route.path);
    if (feature) {
      if (!routeFeatures.has(feature)) {
        routeFeatures.set(feature, []);
      }
      routeFeatures.get(feature)!.push(route.component);
    }
  }

  // Phase 3: Detect features from import clustering
  const graph = await buildImportGraph(srcPath);
  const importFeatures = new Map<string, Set<string>>();
  const visited = new Set<string>();

  for (const file of files) {
    if (visited.has(file)) continue;

    const feature = detectFeatureFromPath(file, srcPath);
    if (!feature) continue;

    if (!importFeatures.has(feature)) {
      importFeatures.set(feature, new Set());
    }

    importFeatures.get(feature)!.add(path.relative(srcPath, file));
    visited.add(file);

    // Follow imports to cluster related files
    const imports = graph[file]?.imports || [];
    for (const imp of imports) {
      const resolved = resolveImportPath(file, imp.source, srcPath, files);
      if (resolved && !visited.has(resolved)) {
        const basename = path.basename(resolved, path.extname(resolved));
        // Only cluster components and pages, not utils
        if (/^[A-Z]/.test(basename) || basename.toLowerCase().includes('page')) {
          importFeatures.get(feature)!.add(path.relative(srcPath, resolved));
          visited.add(resolved);
        }
      }
    }
  }

  // Merge all feature detection sources
  const allFeatures = new Set<string>();
  const featureMap: Record<string, string[]> = {};

  // Merge path-based features
  for (const [feature, files] of pathFeatures) {
    allFeatures.add(feature);
    if (!featureMap[feature]) featureMap[feature] = [];
    for (const f of files) {
      if (!featureMap[feature].includes(f)) {
        featureMap[feature].push(f);
      }
    }
  }

  // Merge route-based features
  for (const [feature] of routeFeatures) {
    allFeatures.add(feature);
    if (!featureMap[feature]) featureMap[feature] = [];
  }

  // Merge import-clustered features
  for (const [feature, files] of importFeatures) {
    allFeatures.add(feature);
    if (!featureMap[feature]) featureMap[feature] = [];
    for (const f of files) {
      if (!featureMap[feature].includes(f)) {
        featureMap[feature].push(f);
      }
    }
  }

  // Also detect features from folder names at top level
  const folders = new Set<string>();
  for (const file of files) {
    const relPath = path.relative(srcPath, file);
    const parts = relPath.split(path.sep);
    if (parts.length >= 2) {
      folders.add(parts[0]);
    }
  }

  // If no features detected from files, use folder names
  if (allFeatures.size === 0) {
    for (const folder of folders) {
      if (
        folder !== 'components' &&
        folder !== 'utils' &&
        folder !== 'hooks' &&
        folder !== 'lib' &&
        folder !== 'types' &&
        folder !== 'config' &&
        folder !== 'api' &&
        folder !== 'services' &&
        folder !== 'assets' &&
        folder !== 'styles' &&
        folder !== 'store' &&
        folder !== 'context'
      ) {
        allFeatures.add(folder);
        featureMap[folder] = files
          .filter((f) => path.relative(srcPath, f).startsWith(folder))
          .map((f) => path.relative(srcPath, f));
      }
    }
  }

  // Sort features alphabetically
  const features = Array.from(allFeatures).sort();

  // Sort file lists within each feature
  for (const feature of features) {
    featureMap[feature].sort();
  }

  return {
    features,
    featureMap,
  };
}