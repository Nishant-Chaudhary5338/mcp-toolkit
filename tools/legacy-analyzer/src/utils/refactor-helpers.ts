// ============================================================================
// REFACTOR HELPERS - Shared utilities for folder structure refactoring tools
// ============================================================================

import * as path from 'path';
import { findSourceFiles, readFileContent, getDirectoriesAtDepth } from './file-scanner.js';
import { buildImportGraph, resolveImportPath } from './import-tracker.js';
import { parseFile, extractImports } from './ast-parser.js';
import type { ImportGraph, ImportInfo } from '../types.js';

// ============================================================================
// FEATURE DETECTION
// ============================================================================

/**
 * Common feature name patterns extracted from file/folder names
 */
const FEATURE_NAME_PATTERNS: Record<string, string> = {
  // Auth
  login: 'auth',
  logout: 'auth',
  signin: 'auth',
  signup: 'auth',
  register: 'auth',
  auth: 'auth',
  authentication: 'auth',
  oauth: 'auth',
  forgotpassword: 'auth',
  resetpassword: 'auth',
  passwordreset: 'auth',
  mfa: 'auth',
  twoFactor: 'auth',

  // User
  user: 'user',
  profile: 'user',
  account: 'user',
  settings: 'user',
  preferences: 'user',
  avatar: 'user',

  // Dashboard
  dashboard: 'dashboard',
  home: 'dashboard',
  overview: 'dashboard',
  main: 'dashboard',
  landing: 'dashboard',

  // Admin
  admin: 'admin',
  management: 'admin',
  moderation: 'admin',

  // Notifications
  notification: 'notifications',
  alert: 'notifications',
  toast: 'notifications',
  message: 'notifications',

  // Search
  search: 'search',
  filter: 'search',
  results: 'search',

  // Products/Catalog
  product: 'catalog',
  catalog: 'catalog',
  item: 'catalog',
  inventory: 'catalog',
  listing: 'catalog',

  // Cart/Checkout
  cart: 'checkout',
  checkout: 'checkout',
  payment: 'checkout',
  order: 'checkout',
  purchase: 'checkout',
  billing: 'checkout',

  // Reports
  report: 'reports',
  analytics: 'reports',
  chart: 'reports',
  graph: 'reports',
  stats: 'reports',

  // Chat/Messaging
  chat: 'messaging',
  conversation: 'messaging',
  inbox: 'messaging',

  // Forms
  form: 'forms',
  wizard: 'forms',
  stepper: 'forms',

  // Layout
  header: 'layout',
  footer: 'layout',
  sidebar: 'layout',
  navbar: 'layout',
  nav: 'layout',
  menu: 'layout',
  layout: 'layout',

  // Error
  error: 'error',
  notfound: 'error',
  forbidden: 'error',
  unauthorized: 'error',
  boundary: 'error',
  fallback: 'error',
};

/**
 * Route path to feature mapping
 */
const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/login': 'auth',
  '/logout': 'auth',
  '/signin': 'auth',
  '/signup': 'auth',
  '/register': 'auth',
  '/auth': 'auth',
  '/forgot-password': 'auth',
  '/reset-password': 'auth',
  '/profile': 'user',
  '/account': 'user',
  '/settings': 'user',
  '/dashboard': 'dashboard',
  '/home': 'dashboard',
  '/admin': 'admin',
  '/notifications': 'notifications',
  '/search': 'search',
  '/products': 'catalog',
  '/catalog': 'catalog',
  '/cart': 'checkout',
  '/checkout': 'checkout',
  '/orders': 'checkout',
  '/reports': 'reports',
  '/analytics': 'reports',
  '/chat': 'messaging',
  '/messages': 'messaging',
  '/error': 'error',
  '/404': 'error',
  '/500': 'error',
};

/**
 * Detect feature name from a file path
 */
export function detectFeatureFromPath(filePath: string, rootDir: string): string | null {
  const relPath = path.relative(rootDir, filePath).toLowerCase();
  const parts = relPath.split(path.sep);

  // Check if already in a feature folder
  for (const part of parts) {
    if (FEATURE_NAME_PATTERNS[part]) {
      return FEATURE_NAME_PATTERNS[part];
    }
  }

  // Check filename
  const basename = path.basename(filePath, path.extname(filePath)).toLowerCase();
  if (FEATURE_NAME_PATTERNS[basename]) {
    return FEATURE_NAME_PATTERNS[basename];
  }

  // Check for compound names (e.g., LoginPage -> login -> auth)
  for (const [pattern, feature] of Object.entries(FEATURE_NAME_PATTERNS)) {
    if (basename.includes(pattern)) {
      return feature;
    }
  }

  return null;
}

/**
 * Detect feature from route path
 */
export function detectFeatureFromRoute(routePath: string): string | null {
  const normalized = routePath.toLowerCase().split(':')[0].replace(/\/$/, '');

  for (const [route, feature] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (normalized === route || normalized.startsWith(route + '/')) {
      return feature;
    }
  }

  return null;
}

/**
 * Cluster files by their import relationships to detect features
 */
export async function detectFeaturesByImportClustering(
  rootDir: string
): Promise<Record<string, string[]>> {
  const srcPath = path.join(rootDir, 'src');
  const files = await findSourceFiles(srcPath);
  const graph = await buildImportGraph(srcPath);

  const features: Record<string, string[]> = {};
  const visited = new Set<string>();

  for (const file of files) {
    if (visited.has(file)) continue;

    const feature = detectFeatureFromPath(file, srcPath);
    if (!feature) continue;

    if (!features[feature]) {
      features[feature] = [];
    }

    // Add file and its closely related files (direct imports)
    features[feature].push(file);
    visited.add(file);

    const imports = graph[file]?.imports || [];
    for (const imp of imports) {
      const resolved = resolveImportPath(file, imp.source, srcPath, files);
      if (resolved && !visited.has(resolved)) {
        const relResolved = path.relative(srcPath, resolved);
        // Only add if it's a component or page (not utils/config)
        const basename = path.basename(resolved, path.extname(resolved));
        if (/^[A-Z]/.test(basename) || basename.includes('page') || basename.includes('Page')) {
          features[feature].push(resolved);
          visited.add(resolved);
        }
      }
    }
  }

  return features;
}

/**
 * Extract route paths from routing files
 */
export async function extractRoutePaths(rootDir: string): Promise<{ path: string; component: string }[]> {
  const srcPath = path.join(rootDir, 'src');
  const files = await findSourceFiles(srcPath);
  const routes: { path: string; component: string }[] = [];

  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    // Match Route path="..." patterns
    const routeMatches = content.matchAll(/<Route\s+[^>]*path\s*=\s*["']([^"']+)["'][^>]*>/g);
    for (const match of routeMatches) {
      const routePath = match[1];
      // Try to extract component name
      const componentMatch = match[0].match(/component\s*=\s*\{?(\w+)\}?/);
      const elementMatch = match[0].match(/element\s*=\s*\{<(\w+)/);

      const component = componentMatch?.[1] || elementMatch?.[1] || 'Unknown';
      routes.push({ path: routePath, component });
    }

    // Also match createBrowserRouter patterns
    const createRouteMatches = content.matchAll(/path:\s*["']([^"']+)["']/g);
    for (const match of createRouteMatches) {
      routes.push({ path: match[1], component: 'Route' });
    }
  }

  return routes;
}

// ============================================================================
// FILE CLASSIFICATION
// ============================================================================

/**
 * Classify a file type based on its path and content
 */
export function classifyFileType(
  filePath: string,
  rootDir: string
): 'feature' | 'shared' | 'utility' | 'config' {
  const relPath = path.relative(rootDir, filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  // Config files
  if (
    basename.includes('config') ||
    basename.includes('.env') ||
    basename === 'constants.ts' ||
    basename === 'constants.js' ||
    basename === 'types.ts' ||
    basename === 'types.js' ||
    relPath.includes('/config/') ||
    relPath.includes('/constants/') ||
    relPath.includes('/types/')
  ) {
    return 'config';
  }

  // Utility files
  if (
    basename.includes('util') ||
    basename.includes('helper') ||
    basename.includes('common') ||
    basename.includes('lib') ||
    basename.includes('service') ||
    basename.includes('api') ||
    relPath.includes('/utils/') ||
    relPath.includes('/util/') ||
    relPath.includes('/helpers/') ||
    relPath.includes('/lib/') ||
    relPath.includes('/services/') ||
    relPath.includes('/api/')
  ) {
    return 'utility';
  }

  // Shared components (in root src/components or similar)
  const pathParts = relPath.split('/');
  if (
    (pathParts.includes('components') && pathParts.length <= 3) ||
    (pathParts.includes('ui') && pathParts.length <= 3) ||
    (pathParts.includes('shared') && pathParts.length <= 3) ||
    (pathParts.includes('common') && pathParts.length <= 3)
  ) {
    return 'shared';
  }

  // Everything else in a feature-like folder is feature-specific
  return 'feature';
}

// ============================================================================
// STRUCTURE DESIGN
// ============================================================================

/**
 * Standard subdirectories for each feature
 */
export const FEATURE_SUBDIRS: string[] = ['components', 'hooks', 'api', 'pages', 'types', 'utils'];

/**
 * Standard shared layer directories
 */
export const SHARED_DIRS: string[] = ['components', 'hooks', 'utils', 'types', 'lib', 'styles'];

/**
 * Standard app-level directories
 */
export const APP_DIRS: string[] = ['router', 'store', 'providers'];

/**
 * Generate target path for a file based on its classification
 */
export function generateTargetPath(
  filePath: string,
  rootDir: string,
  features: string[],
  featureMap: Record<string, string[]>
): string {
  const relPath = path.relative(rootDir, filePath);
  const basename = path.basename(filePath);
  const dirname = path.dirname(relPath);

  // Determine classification
  const feature = detectFeatureFromPath(filePath, rootDir);

  if (feature && features.includes(feature)) {
    // Feature-specific file
    const subdir = getFeatureSubdir(filePath);
    return path.join('src', 'features', feature, subdir, basename);
  }

  // Check if it's a utility
  if (classifyFileType(filePath, rootDir) === 'utility') {
    return path.join('src', 'shared', 'utils', basename);
  }

  // Check if it's config
  if (classifyFileType(filePath, rootDir) === 'config') {
    return path.join('src', 'shared', 'types', basename);
  }

  // Shared component
  if (classifyFileType(filePath, rootDir) === 'shared') {
    return path.join('src', 'shared', 'components', basename);
  }

  // Default to shared/components
  return path.join('src', 'shared', 'components', basename);
}

/**
 * Determine which feature subdirectory a file belongs to
 */
function getFeatureSubdir(filePath: string): string {
  const basename = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const dirname = path.dirname(filePath).toLowerCase();

  if (basename.includes('hook') || /^use[A-Z]/.test(basename)) {
    return 'hooks';
  }
  if (basename.includes('api') || basename.includes('service') || dirname.includes('/api/')) {
    return 'api';
  }
  if (basename.includes('page') || basename.includes('view') || basename.includes('screen')) {
    return 'pages';
  }
  if (basename.includes('type') || dirname.includes('/types/')) {
    return 'types';
  }

  return 'components';
}

// ============================================================================
// NAMING CONVENTIONS
// ============================================================================

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Detect current naming convention of a file
 */
export function detectNamingConvention(filePath: string): 'kebab-case' | 'camelCase' | 'PascalCase' | 'SCREAMING_SNAKE' | 'snake_case' {
  const basename = path.basename(filePath, path.extname(filePath));

  if (/^[A-Z][a-zA-Z0-9]*$/.test(basename)) return 'PascalCase';
  if (/^[a-z][a-zA-Z0-9]*$/.test(basename)) return 'camelCase';
  if (/^[A-Z_][A-Z0-9_]*$/.test(basename)) return 'SCREAMING_SNAKE';
  if (basename.includes('_') && /^[a-z]/.test(basename)) return 'snake_case';
  if (basename.includes('-')) return 'kebab-case';

  return 'camelCase';
}

/**
 * Suggest better name for a file based on its content and context
 */
export function suggestFileName(
  filePath: string,
  content: string
): string | null {
  const basename = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);

  // Generic names that should be renamed
  const genericNames: string[] = ['index', 'utils', 'helpers', 'common', 'lib', 'misc', 'stuff', 'temp', 'untitled', 'test'];
  if (!genericNames.includes(basename.toLowerCase())) {
    return null; // Name is already specific
  }

  // Try to extract a meaningful name from exports
  const exportMatch = content.match(/export\s+(default\s+)?(function|const|class)\s+(\w+)/);
  if (exportMatch) {
    return exportMatch[3] + ext;
  }

  // Try from default export
  const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
  if (defaultExportMatch) {
    return defaultExportMatch[1] + ext;
  }

  return null;
}

// ============================================================================
// BOUNDARY DETECTION
// ============================================================================

/**
 * Get the feature a file belongs to based on its path
 */
export function getFileFeature(filePath: string, rootDir: string): string | null {
  const relPath = path.relative(rootDir, filePath);
  const parts = relPath.split(path.sep);

  // Check if it's in a features folder
  const featuresIdx = parts.indexOf('features');
  if (featuresIdx !== -1 && parts.length > featuresIdx + 1) {
    return parts[featuresIdx + 1];
  }

  // Check top-level folder as feature
  if (parts.length >= 2) {
    const topFolder = parts[1].toLowerCase();
    if (FEATURE_NAME_PATTERNS[topFolder]) {
      return FEATURE_NAME_PATTERNS[topFolder];
    }
  }

  return null;
}

/**
 * Check if an import crosses feature boundaries
 */
export function isCrossFeatureImport(
  fromFile: string,
  importSource: string,
  rootDir: string,
  allFiles: string[]
): boolean {
  const fromFeature = getFileFeature(fromFile, rootDir);
  if (!fromFeature) return false;

  const resolved = resolveImportPath(fromFile, importSource, rootDir, allFiles);
  if (!resolved) return false;

  const toFeature = getFileFeature(resolved, rootDir);
  if (!toFeature) return false;

  return fromFeature !== toFeature;
}

/**
 * Calculate import depth (number of ../ traversals)
 */
export function getImportDepth(importSource: string): number {
  if (!importSource.startsWith('.')) return 0;
  return (importSource.match(/\.\.\//g) || []).length;
}

/**
 * Check if files are tightly coupled (mutual imports with many connections)
 */
export function areTightlyCoupled(
  graph: ImportGraph,
  fileA: string,
  fileB: string,
  threshold: number = 3
): boolean {
  const aImportsB = graph[fileA]?.imports.some((imp) =>
    imp.source.includes(path.basename(fileB, path.extname(fileB)))
  );
  const bImportsA = graph[fileB]?.imports.some((imp) =>
    imp.source.includes(path.basename(fileA, path.extname(fileA)))
  );

  if (!aImportsB && !bImportsA) return false;

  // Count total imports for each
  const aImportCount = graph[fileA]?.imports.length || 0;
  const bImportCount = graph[fileB]?.imports.length || 0;

  // If they import each other and have few other imports, they're tightly coupled
  return aImportsB && bImportsA && (aImportCount <= threshold || bImportCount <= threshold);
}

// ============================================================================
// MODULE SPLITTING
// ============================================================================

/**
 * Detect if a file is a "kitchen sink" utility file
 */
export function isKitchenSinkFile(filePath: string): boolean {
  const basename = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const genericNames: string[] = ['utils', 'helpers', 'common', 'lib', 'misc', 'index', 'util', 'helper'];
  return genericNames.includes(basename);
}

/**
 * Suggest splits for a utility file based on exported functions
 */
export function suggestUtilitySplits(
  filePath: string,
  content: string
): { category: string; functions: string[] }[] {
  const categories: Record<string, string[]> = {
    date: [],
    string: [],
    validation: [],
    formatting: [],
    array: [],
    object: [],
    network: [],
    storage: [],
    dom: [],
    other: [],
  };

  // Extract exported function names
  const exportMatches = content.matchAll(/export\s+(const|function)\s+(\w+)/g);
  for (const match of exportMatches) {
    const name = match[2].toLowerCase();

    if (name.includes('date') || name.includes('time') || name.includes('format') && name.includes('date')) {
      categories.date.push(match[2]);
    } else if (name.includes('format') || name.includes('parse') || name.includes('convert')) {
      categories.formatting.push(match[2]);
    } else if (name.includes('valid') || name.includes('check') || name.includes('verify') || name.includes('is')) {
      categories.validation.push(match[2]);
    } else if (name.includes('trim') || name.includes('capitalize') || name.includes('slug') || name.includes('string') || name.includes('text')) {
      categories.string.push(match[2]);
    } else if (name.includes('sort') || name.includes('filter') || name.includes('map') || name.includes('reduce') || name.includes('group') || name.includes('unique')) {
      categories.array.push(match[2]);
    } else if (name.includes('merge') || name.includes('clone') || name.includes('pick') || name.includes('omit') || name.includes('get') || name.includes('set')) {
      categories.object.push(match[2]);
    } else if (name.includes('fetch') || name.includes('request') || name.includes('api') || name.includes('http')) {
      categories.network.push(match[2]);
    } else if (name.includes('store') || name.includes('cache') || name.includes('local') || name.includes('session') || name.includes('cookie')) {
      categories.storage.push(match[2]);
    } else if (name.includes('dom') || name.includes('element') || name.includes('scroll') || name.includes('resize') || name.includes('event')) {
      categories.dom.push(match[2]);
    } else {
      categories.other.push(match[2]);
    }
  }

  return Object.entries(categories)
    .filter(([, funcs]) => funcs.length > 0)
    .map(([category, funcs]) => ({ category, functions: funcs }));
}