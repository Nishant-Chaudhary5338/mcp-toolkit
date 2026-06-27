// ============================================================================
// TOOL #1: detect-project-tech
// Detects React version, language, framework (CRA/Next/Vite/Remix/Gatsby/Expo),
// and major dependencies — works for any React-based app
// ============================================================================

import * as path from 'path';
import { readPackageJson, hasConfigFile, readFileContent } from '../utils/file-scanner.js';
import type { ProjectTechOutput, AnalyzerConfig, DEFAULT_CONFIG } from '../types.js';

const MAJOR_DEPS = [
  // Core
  'react', 'react-dom', 'react-scripts',
  // State management
  'redux', '@reduxjs/toolkit', 'react-redux', 'zustand', 'jotai', 'recoil', 'mobx',
  // Routing
  'react-router-dom', 'react-router',
  // Data fetching
  'axios', 'swr', 'react-query', '@tanstack/react-query',
  // Styling
  'styled-components', '@emotion/react', '@emotion/styled', 'tailwindcss',
  // Forms
  'formik', 'react-hook-form',
  // Validation
  'zod', 'yup',
  // Utilities
  'lodash', 'ramda',
  // Date
  'moment', 'dayjs', 'date-fns',
  // Async/reactive
  'rxjs',
  // GraphQL
  'graphql', '@apollo/client', 'urql',
  // Real-time
  'socket.io-client',
  // i18n
  'react-intl', 'react-i18next',
  // Meta-frameworks
  'next', 'gatsby',
];

export async function detectProjectTech(appPath: string, config?: Partial<AnalyzerConfig>): Promise<ProjectTechOutput> {
  const pkg = readPackageJson(appPath);

  if (!pkg) {
    return {
      framework: 'unknown',
      reactVersion: 'unknown',
      language: 'JavaScript',
      hasCRAConfig: false,
      majorDependencies: [],
    };
  }

  const allDeps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };

  // Detect React version
  let reactVersion = 'unknown';
  const reactDep = allDeps['react'] || '';
  const versionMatch = reactDep.match(/(\d+)\./);
  if (versionMatch) {
    reactVersion = versionMatch[1];
  }

  // Detect language
  const hasTypeScript = !!(allDeps['typescript'] || allDeps['@types/react']);
  const hasTSConfig = hasConfigFile(appPath, ['tsconfig.json']);
  const language: 'JavaScript' | 'TypeScript' = (hasTypeScript || hasTSConfig) ? 'TypeScript' : 'JavaScript';

  // Detect CRA
  const hasReactScripts = !!allDeps['react-scripts'];
  // Only react-scripts (or react-app-rewired's config-overrides) reliably signals CRA.
  // NOT .env — Vite/Next/etc. use .env too, which previously caused false CRA detection.
  const isCRA =
    hasReactScripts || hasConfigFile(appPath, ['config-overrides.js', 'config-overrides.ts']);

  // Detect framework (order matters — check specific before generic)
  let framework = 'unknown';
  if (allDeps['next']) framework = 'Next.js';
  else if (allDeps['@remix-run/react'] || allDeps['@remix-run/node']) framework = 'Remix';
  else if (allDeps['gatsby']) framework = 'Gatsby';
  else if (allDeps['expo'] || allDeps['react-native']) framework = 'React Native / Expo';
  else if (isCRA) framework = 'CRA';
  else if (allDeps['vite'] || allDeps['@vitejs/plugin-react'] || hasConfigFile(appPath, ['vite.config.ts', 'vite.config.js'])) framework = 'Vite';
  else if (allDeps['react']) framework = 'React';

  // Next.js app router vs pages router
  let routerType: string | undefined;
  if (framework === 'Next.js') {
    const hasAppDir = hasConfigFile(appPath, ['app', 'src/app']);
    const hasPagesDir = hasConfigFile(appPath, ['pages', 'src/pages']);
    if (hasAppDir) routerType = 'app-router';
    else if (hasPagesDir) routerType = 'pages-router';
  }
  void routerType; // used by analyze-routing

  // Detect major dependencies
  const majorDependencies: string[] = [];
  for (const dep of MAJOR_DEPS) {
    if (allDeps[dep]) {
      majorDependencies.push(dep);
    }
  }

  return {
    framework,
    reactVersion,
    language,
    hasCRAConfig: isCRA,
    majorDependencies,
  };
}