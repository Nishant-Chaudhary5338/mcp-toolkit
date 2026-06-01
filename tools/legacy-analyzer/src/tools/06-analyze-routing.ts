// ============================================================================
// TOOL #6: analyze-routing
// Detects routing: react-router, Next.js file-based (pages/ and app/), Remix, Gatsby
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { findSourceFiles, readFileContent } from '../utils/file-scanner.js';
import { parseFile, extractImports, extractJSX } from '../utils/ast-parser.js';
import type { AnalyzeRoutingOutput, AnalyzerConfig } from '../types.js';

const ROUTING_LIBRARIES = ['react-router-dom', 'react-router', '@reach/router', 'wouter', 'preact-router', '@remix-run/react'] as const;

export async function analyzeRouting(appPath: string, config?: Partial<AnalyzerConfig>): Promise<AnalyzeRoutingOutput> {
  // Detect Next.js / Remix file-based routing before doing source file scan
  const nextPagesDir = path.join(appPath, 'pages');
  const nextAppDir = path.join(appPath, 'app');
  const srcPagesDir = path.join(appPath, 'src', 'pages');
  const srcAppDir = path.join(appPath, 'src', 'app');

  const hasNextPages = fs.existsSync(nextPagesDir) || fs.existsSync(srcPagesDir);
  const hasNextApp = fs.existsSync(nextAppDir) || fs.existsSync(srcAppDir);

  if (hasNextPages || hasNextApp) {
    const routerType = hasNextApp ? 'app-router' : 'pages-router';
    const lib = hasNextApp ? 'next/navigation' : 'next/router';
    const routeDir = hasNextApp
      ? (fs.existsSync(nextAppDir) ? nextAppDir : srcAppDir)
      : (fs.existsSync(nextPagesDir) ? nextPagesDir : srcPagesDir);

    // Count page files (each file = one route in Next.js)
    let routeCount = 0;
    const countPages = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) countPages(path.join(dir, entry.name));
        else if (entry.name.match(/\.(tsx|ts|jsx|js)$/) && !entry.name.startsWith('_') && !entry.name.includes('.test.') && entry.name !== 'layout.tsx' && entry.name !== 'loading.tsx') {
          routeCount++;
        }
      }
    };
    countPages(routeDir);

    const issues: string[] = [];
    if (routeCount > 20) {
      issues.push(`${routeCount} route files. Consider using Next.js Route Groups to organize routes.`);
    }

    return {
      routingLibrary: lib,
      routingType: 'nested',
      lazyLoading: true, // Next.js does automatic code splitting per page
      routeCount,
      issues,
    };
  }

  const srcPath = path.join(appPath, 'src');
  const files = await findSourceFiles(srcPath);

  let routingLibrary: string | null = null;
  let routeCount = 0;
  let hasNestedRoutes = false;
  let hasLazyLoading = false;
  const issues: string[] = [];

  const routeFiles: string[] = [];

  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    // Content-based routing library detection (works for .js files too)
    for (const lib of ROUTING_LIBRARIES) {
      if (content.includes(`from '${lib}'`) || content.includes(`from "${lib}"`) ||
          content.includes(`require('${lib}')`) || content.includes(`require("${lib}")`)) {
        routingLibrary = lib;
        routeFiles.push(path.relative(appPath, file));
        break;
      }
    }

    // Content-based route counting via regex (reliable for both JS and TS)
    const routeTagMatches = content.match(/<Route[\s/]/g) || [];
    routeCount += routeTagMatches.length;

    // Detect nested routes via content
    if (content.includes('<Route') || content.includes('<route')) {
      // Nested: Route inside Switch inside another Route, or Routes v6 pattern
      if (content.includes('<Routes>') || (content.match(/<Route[\s\S]*?<Route/m))) {
        hasNestedRoutes = true;
      }
    }

    // Detect lazy loading
    if (content.includes('React.lazy') || content.includes('lazy(') || content.includes('Suspense')) {
      hasLazyLoading = true;
    }

    // Detect dynamic imports for routes
    if (content.includes('import(') && (content.includes('Route') || content.includes('route'))) {
      hasLazyLoading = true;
    }

    // Also try AST-based extraction for richer data (optional)
    const parsed = parseFile(file);
    if (parsed) {
      const imports = extractImports(parsed.ast);
      const importSources = imports.map((i) => i.source);
      for (const lib of ROUTING_LIBRARIES) {
        if (importSources.some((s) => s.includes(lib))) {
          routingLibrary = lib;
        }
      }

      // AST-based nested route detection via depth
      const jsxElements = extractJSX(parsed.ast);
      const routeAtDepth = jsxElements.filter((e) =>
        (e.tagName === 'Route' || e.tagName === 'route') && e.depth > 2
      );
      if (routeAtDepth.length > 0) {
        hasNestedRoutes = true;
      }
    }
  }

  // Determine routing type
  let routingType: AnalyzeRoutingOutput['routingType'];
  if (!routingLibrary || routeCount === 0) {
    routingType = 'none';
  } else if (hasNestedRoutes) {
    routingType = 'nested';
  } else {
    routingType = 'flat';
  }

  // Issues
  if (!routingLibrary && files.length > 5) {
    issues.push('No routing library detected. App may be using custom routing or is a single-page view.');
  }

  if (routingLibrary && !hasLazyLoading && routeCount > 10) {
    issues.push(`${routeCount} routes without lazy loading. Consider using React.lazy() for code splitting.`);
  }

  if (routingType === 'flat' && routeCount > 15) {
    issues.push('Many flat routes detected. Consider organizing routes into nested groups.');
  }

  // Check for hardcoded route strings in components
  let hardcodedRoutes = 0;
  for (const file of files) {
    const content = readFileContent(file);
    if (!content) continue;

    // Look for navigate() calls or href patterns
    const navMatches = content.match(/navigate\s*\(\s*['"`]\/[^'"`]*['"`]\)/g) || [];
    const hrefMatches = content.match(/href\s*=\s*['"`]\/[^'"`]*['"`]/g) || [];
    hardcodedRoutes += navMatches.length + hrefMatches.length;
  }

  if (hardcodedRoutes > 5) {
    issues.push(`${hardcodedRoutes} hardcoded route strings found. Consider using route constants.`);
  }

  return {
    routingLibrary,
    routingType,
    lazyLoading: hasLazyLoading,
    routeCount,
    issues,
  };
}