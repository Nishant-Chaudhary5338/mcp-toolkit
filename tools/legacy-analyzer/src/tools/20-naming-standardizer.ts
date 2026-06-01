// ============================================================================
// TOOL #20: naming-standardizer
// Suggests better file/folder naming conventions
// ============================================================================

import * as path from 'path';
import { findSourceFiles, getDirectoriesAtDepth, resolveSourceDir } from '../utils/file-scanner.js';
import {
  detectNamingConvention,
  toKebabCase,
  toCamelCase,
  toPascalCase,
} from '../utils/refactor-helpers.js';
import type { NamingStandardizerOutput, FileRename, AnalyzerConfig } from '../types.js';

// Recommended conventions
const FILE_CONVENTION = 'camelCase'; // React convention: camelCase for files
const FOLDER_CONVENTION = 'kebab-case'; // Folders in kebab-case

// Files that should stay PascalCase (React components)
const PASCALCASE_EXCEPTIONS = [
  /\.tsx?$/,
  /\.jsx?$/,
];

// Folder names that should NOT be renamed (standard conventions)
const PRESERVED_FOLDERS = new Set([
  'node_modules',
  '.git',
  'build',
  'dist',
  'public',
  'src',
  'assets',
  'components',
  'hooks',
  'utils',
  'lib',
  'types',
  'config',
  'constants',
  'api',
  'services',
  'pages',
  'views',
  'features',
  'shared',
  'store',
  'context',
  'styles',
  'pages',
  'layouts',
]);

export async function namingStandardizer(
  appPath: string,
  config?: Partial<AnalyzerConfig>
): Promise<NamingStandardizerOutput> {
  const srcPath = resolveSourceDir(appPath);
  const files = await findSourceFiles(srcPath);
  const renames: FileRename[] = [];

  // Analyze file naming
  for (const file of files) {
    const basename = path.basename(file);
    const ext = path.extname(file);
    const nameWithoutExt = basename.replace(ext, '');
    const relPath = path.relative(srcPath, file);
    const dirname = path.dirname(relPath);

    // Skip node_modules, build, etc.
    if (relPath.includes('node_modules') || relPath.includes('build')) continue;

    // Check if this is a React component file (should be PascalCase)
    const isComponent = /^[A-Z]/.test(nameWithoutExt) && PASCALCASE_EXCEPTIONS.some((re) => re.test(basename));

    if (isComponent) {
      // Components should be PascalCase
      const pascal = toPascalCase(nameWithoutExt);
      if (nameWithoutExt !== pascal) {
        renames.push({
          from: relPath,
          to: path.join(dirname, pascal + ext),
          reason: `Component file should use PascalCase: "${pascal}${ext}"`,
        });
      }
    } else {
      // Non-component files should be camelCase
      const camel = toCamelCase(nameWithoutExt);
      if (nameWithoutExt !== camel) {
        renames.push({
          from: relPath,
          to: path.join(dirname, camel + ext),
          reason: `Non-component file should use camelCase: "${camel}${ext}"`,
        });
      }
    }

    // Check for generic names
    const genericNames: string[] = ['index', 'utils', 'helpers', 'common', 'lib', 'misc', 'temp', 'untitled'];
    if (genericNames.includes(nameWithoutExt.toLowerCase()) && ext !== '.css' && ext !== '.scss') {
      renames.push({
        from: relPath,
        to: relPath, // Don't suggest a specific rename, just flag it
        reason: `Generic filename "${basename}" - consider a more descriptive name`,
      });
    }

    // Check for inconsistent separators
    if (nameWithoutExt.includes('_') && !nameWithoutExt.includes('-')) {
      const kebab = toKebabCase(nameWithoutExt);
      if (nameWithoutExt !== kebab) {
        renames.push({
          from: relPath,
          to: path.join(dirname, kebab + ext),
          reason: `Inconsistent naming: use "${kebab}${ext}" instead of "${basename}"`,
        });
      }
    }

    // Check for SCREAMING_SNAKE_CASE in non-config files
    if (/^[A-Z][A-Z0-9_]+$/.test(nameWithoutExt) && !relPath.includes('config') && !relPath.includes('constants')) {
      const camel = toCamelCase(nameWithoutExt);
      renames.push({
        from: relPath,
        to: path.join(dirname, camel + ext),
        reason: `SCREAMING_SNAKE_CASE is only for constants/config: use "${camel}${ext}"`,
      });
    }

    // Check for spaces in filenames
    if (basename.includes(' ')) {
      const kebab = toKebabCase(nameWithoutExt);
      renames.push({
        from: relPath,
        to: path.join(dirname, kebab + ext),
        reason: `Filename contains spaces: use "${kebab}${ext}"`,
      });
    }
  }

  // Analyze folder naming
  const dirs = getDirectoriesAtDepth(srcPath, 5);
  for (const dir of dirs) {
    const parts = dir.split(path.sep);
    const lastPart = parts[parts.length - 1];

    if (PRESERVED_FOLDERS.has(lastPart)) continue;

    // Folder names should be kebab-case
    const kebab = toKebabCase(lastPart);
    if (lastPart !== kebab && lastPart !== toCamelCase(lastPart)) {
      renames.push({
        from: dir,
        to: path.join(...parts.slice(0, -1), kebab),
        reason: `Folder should use kebab-case: "${kebab}"`,
      });
    }
  }

  // Deduplicate renames
  const seen = new Set<string>();
  const uniqueRenames = renames.filter((r) => {
    // Don't include renames where from === to (just warnings)
    if (r.from === r.to && r.reason.includes('Generic filename')) {
      // Keep these as warnings
    } else if (r.from === r.to) {
      return false;
    }

    const key = r.from;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    renames: uniqueRenames,
    conventions: {
      files: FILE_CONVENTION,
      folders: FOLDER_CONVENTION,
    },
  };
}