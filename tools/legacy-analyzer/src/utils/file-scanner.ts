// ============================================================================
// FILE SCANNER - File discovery utilities using glob patterns
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Resolve the best source directory for a given app root.
 * Handles CRA/Vite (src/), Next.js app router (app/), Next.js pages router (pages/),
 * and apps where source is at root level.
 */
export function resolveSourceDir(appPath: string): string {
  // Priority: src/ > app/ (Next.js app router) > pages/ > root
  for (const candidate of ['src', 'app', 'pages']) {
    const dir = path.join(appPath, candidate);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      // Sanity check: must have at least one source file
      const entries = fs.readdirSync(dir);
      if (entries.some((e) => /\.(tsx?|jsx?)$/.test(e) || fs.statSync(path.join(dir, e)).isDirectory())) {
        return dir;
      }
    }
  }
  // Fallback to src even if doesn't exist (will be empty)
  return path.join(appPath, 'src');
}

/**
 * Find all JS/JSX/TS/TSX files in a directory
 */
export async function findSourceFiles(rootDir: string): Promise<string[]> {
  const patterns = ['**/*.{js,jsx,ts,tsx}'];
  const ignore = [
    '**/node_modules/**',
    '**/build/**',
    '**/dist/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.test.{js,jsx,ts,tsx}',
    '**/*.spec.{js,jsx,ts,tsx}',
    '**/*.stories.{js,jsx,ts,tsx}',
    '**/*.d.ts',
  ];

  const files = await glob(patterns, {
    cwd: rootDir,
    ignore,
    absolute: true,
  });

  return files.sort();
}

/**
 * Find component files (files that likely export React components)
 */
export async function findComponentFiles(rootDir: string): Promise<string[]> {
  const allFiles = await findSourceFiles(rootDir);
  return allFiles.filter((f) => {
    const basename = path.basename(f, path.extname(f));
    // Components typically start with uppercase
    return /^[A-Z]/.test(basename);
  });
}

/**
 * Find CSS/SCSS/Less/style files
 */
export async function findStyleFiles(rootDir: string): Promise<string[]> {
  const patterns = ['**/*.{css,scss,less,sass,module.css,module.scss}'];
  const ignore = ['**/node_modules/**', '**/build/**', '**/dist/**'];

  return glob(patterns, {
    cwd: rootDir,
    ignore,
    absolute: true,
  });
}

/**
 * Find asset files (images, videos, fonts)
 */
export async function findAssetFiles(rootDir: string): Promise<string[]> {
  const patterns = [
    '**/*.{png,jpg,jpeg,gif,svg,webp,ico,bmp}',
    '**/*.{mp4,webm,ogg,avi,mov}',
    '**/*.{woff,woff2,ttf,eot,otf}',
  ];
  const ignore = ['**/node_modules/**', '**/build/**', '**/dist/**'];

  return glob(patterns, {
    cwd: rootDir,
    ignore,
    absolute: true,
  });
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Read file content safely
 */
export function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Get all directories at a specific depth from root
 */
export function getDirectoriesAtDepth(rootDir: string, maxDepth: number = 10): string[] {
  const dirs: string[] = [];

  function walk(currentDir: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(rootDir, fullPath);
          dirs.push(relativePath);
          walk(fullPath, depth + 1);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walk(rootDir, 1);
  return dirs;
}

/**
 * Calculate directory nesting depth
 */
export function calculateMaxDepth(rootDir: string): number {
  const dirs = getDirectoriesAtDepth(rootDir, 20);
  if (dirs.length === 0) return 0;
  return Math.max(...dirs.map((d) => d.split(path.sep).length));
}

/**
 * Read package.json from a directory
 */
export function readPackageJson(rootDir: string): Record<string, unknown> | null {
  const pkgPath = path.join(rootDir, 'package.json');
  const content = readFileContent(pkgPath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if directory contains specific config files
 */
export function hasConfigFile(rootDir: string, filenames: string[]): boolean {
  return filenames.some((f) => fileExists(path.join(rootDir, f)));
}