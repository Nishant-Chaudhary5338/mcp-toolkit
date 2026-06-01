// ============================================================================
// TOOL #17: map-files-to-target
// Maps existing files to new target structure
// ============================================================================

import * as path from 'path';
import { findSourceFiles, resolveSourceDir } from '../utils/file-scanner.js';
import { detectFeatures } from './13-detect-features.js';
import { classifyFiles } from './14-classify-files.js';
import {
  detectFeatureFromPath,
  generateTargetPath,
  classifyFileType,
} from '../utils/refactor-helpers.js';
import type { MapFilesToTargetOutput, FileMove, AnalyzerConfig } from '../types.js';

export async function mapFilesToTarget(
  appPath: string,
  config?: Partial<AnalyzerConfig>
): Promise<MapFilesToTargetOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);

  if (files.length === 0) {
    return { moves: [], unmapped: [] };
  }

  // Get features and classifications
  const { features, featureMap } = await detectFeatures(appPath, config);
  const { files: classifications } = await classifyFiles(appPath, config);

  // Create classification lookup
  const classificationMap = new Map(
    classifications.map((c) => [c.path, c])
  );

  const moves: FileMove[] = [];
  const unmapped: string[] = [];

  for (const file of files) {
    const relPath = path.relative(srcPath, file);
    const classification = classificationMap.get(relPath);

    // Skip entry point files (index.js/tsx, App.js/tsx, etc.)
    const basename = path.basename(file);
    if (
      basename === 'index.tsx' ||
      basename === 'index.ts' ||
      basename === 'index.jsx' ||
      basename === 'index.js' ||
      basename === 'App.tsx' ||
      basename === 'App.ts' ||
      basename === 'App.jsx' ||
      basename === 'App.js' ||
      basename === 'index.css' ||
      basename === 'index.scss' ||
      basename === 'react-app-env.d.ts' ||
      basename === 'reportWebVitals.ts' ||
      basename === 'reportWebVitals.js' ||
      basename === 'setupTests.ts' ||
      basename === 'setupTests.js'
    ) {
      continue;
    }

    // Determine target path
    const targetPath = generateTargetPath(file, srcPath, features, featureMap);

    // Check if file is already in the right place
    const currentNormalized = relPath.replace(/\\/g, '/');
    const targetNormalized = targetPath.replace(/\\/g, '/');

    if (currentNormalized === targetNormalized) {
      continue; // File is already in the right place
    }

    // Determine reason for the move
    let reason = '';
    if (classification) {
      switch (classification.type) {
        case 'feature':
          reason = `Feature-specific file for "${classification.feature}" feature`;
          break;
        case 'shared':
          reason = 'Shared module used across multiple features';
          break;
        case 'utility':
          reason = 'Utility function should be in shared/utils';
          break;
        case 'config':
          reason = 'Configuration file should be in shared/types';
          break;
      }
    } else {
      reason = 'Reorganize to target structure';
    }

    moves.push({
      from: relPath,
      to: targetPath,
      reason,
    });
  }

  // Files that couldn't be cleanly mapped
  for (const file of files) {
    const relPath = path.relative(srcPath, file);
    const inMoves = moves.some((m) => m.from === relPath);
    const basename = path.basename(file);

    // Skip entry points
    if (
      basename === 'index.tsx' ||
      basename === 'index.ts' ||
      basename === 'index.jsx' ||
      basename === 'index.js' ||
      basename === 'App.tsx' ||
      basename === 'App.ts' ||
      basename === 'App.jsx' ||
      basename === 'App.js'
    ) {
      continue;
    }

    if (!inMoves) {
      const feature = detectFeatureFromPath(file, srcPath);
      if (!feature) {
        unmapped.push(relPath);
      }
    }
  }

  // Sort moves by target path
  moves.sort((a, b) => a.to.localeCompare(b.to));
  unmapped.sort();

  return { moves, unmapped };
}