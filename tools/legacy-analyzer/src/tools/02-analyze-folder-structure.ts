// ============================================================================
// TOOL #2: analyze-folder-structure
// Analyzes directory structure: flat vs feature-based, folder presence, depth
// ============================================================================

import * as path from 'path';
import { getDirectoriesAtDepth, calculateMaxDepth, findSourceFiles, resolveSourceDir } from '../utils/file-scanner.js';
import type { FolderStructureOutput, AnalyzerConfig } from '../types.js';

const COMMON_FOLDERS = [
  'components', 'component', 'ui',
  'utils', 'util', 'helpers', 'helper',
  'services', 'service', 'api',
  'hooks', 'hook', 'custom-hooks',
  'pages', 'page', 'views', 'screens',
  'store', 'stores', 'redux', 'state',
  'assets', 'static', 'public',
  'styles', 'css', 'scss',
  'constants', 'config',
  'types', 'interfaces', 'models',
  'features', 'modules',
  'contexts', 'providers',
];

export async function analyzeFolderStructure(appPath: string, config?: Partial<AnalyzerConfig>): Promise<FolderStructureOutput> {
  const srcPath = resolveSourceDir(appPath);
  const allDirs = getDirectoriesAtDepth(srcPath, 5);

  // Get top-level directories in src/
  const topLevelDirs = allDirs.filter((d) => !d.includes(path.sep));
  const secondLevelDirs = allDirs.filter((d) => d.split(path.sep).length === 2);

  // Detect which common folders exist
  const folders: string[] = [];
  const foundFolders = new Set<string>();

  for (const dir of allDirs) {
    const parts = dir.split(path.sep);
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (COMMON_FOLDERS.includes(lower) && !foundFolders.has(lower)) {
        foundFolders.add(lower);
        folders.push(dir);
      }
    }
  }

  // Classify structure type
  let structureType: 'flat' | 'feature-based' | 'mixed';

  const hasFeatures = topLevelDirs.some((d) =>
    ['features', 'modules', 'pages', 'screens', 'views'].includes(d.toLowerCase())
  );

  const hasFlatStructure = topLevelDirs.some((d) =>
    ['components', 'utils', 'services', 'hooks'].includes(d.toLowerCase())
  );

  if (hasFeatures && hasFlatStructure) {
    structureType = 'mixed';
  } else if (hasFeatures) {
    structureType = 'feature-based';
  } else {
    structureType = 'flat';
  }

  // Calculate depth
  const maxDepth = calculateMaxDepth(srcPath);

  // Detect issues
  const issues: string[] = [];

  if (maxDepth > 5) {
    issues.push(`Deep nesting detected (${maxDepth} levels). Consider flattening the structure.`);
  }

  if (!foundFolders.has('components') && !foundFolders.has('component')) {
    issues.push('No dedicated components folder found.');
  }

  if (!foundFolders.has('utils') && !foundFolders.has('util') && !foundFolders.has('helpers')) {
    issues.push('No dedicated utils/helpers folder found. Utility code may be scattered.');
  }

  if (structureType === 'mixed') {
    issues.push('Mixed folder structure detected (both flat and feature-based). Consider standardizing.');
  }

  // Check for src at wrong level
  const sourceFiles = await findSourceFiles(appPath);
  const filesOutsideSrc = sourceFiles.filter((f) => {
    const rel = path.relative(appPath, f);
    return !rel.startsWith('src' + path.sep) && rel !== 'src';
  });

  if (filesOutsideSrc.length > 0) {
    issues.push(`${filesOutsideSrc.length} source files found outside src/ directory.`);
  }

  return {
    structureType,
    folders: folders.sort(),
    maxDepth,
    issues,
  };
}