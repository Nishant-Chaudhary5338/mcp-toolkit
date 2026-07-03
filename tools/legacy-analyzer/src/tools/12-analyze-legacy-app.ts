// ============================================================================
// TOOL #12: analyze-legacy-app (AGGREGATOR)
// Calls all tools and produces final report with migration hints
// ============================================================================

import * as path from 'path';
import { detectMonorepo, hasRepoUiPackage } from '@mcp-showcase/shared';
import { detectProjectTech } from './01-detect-project-tech.js';
import { analyzeFolderStructure } from './02-analyze-folder-structure.js';
import { analyzeComponents } from './03-analyze-components.js';
import { analyzeStateManagement } from './04-analyze-state-management.js';
import { analyzeApiLayer } from './05-analyze-api-layer.js';
import { analyzeRouting } from './06-analyze-routing.js';
import { analyzeStyling } from './07-analyze-styling.js';
import { analyzeAssets } from './08-analyze-assets.js';
import { detectAntiPatterns } from './09-detect-anti-patterns.js';
import { detectDuplication } from './10-detect-duplication.js';
import { analyzeDependenciesUsage } from './11-analyze-dependencies-usage.js';
import type { AnalyzeLegacyAppOutput, MigrationHint, AnalyzerConfig, ToolInput } from '../types.js';

export async function analyzeLegacyApp(appPath: string, config?: Partial<AnalyzerConfig>): Promise<AnalyzeLegacyAppOutput> {
  // Run all analysis tools in parallel where possible
  const [
    tech,
    structure,
    components,
    state,
    api,
    routing,
    styling,
    assets,
    antiPatterns,
    duplication,
    dependencies,
  ] = await Promise.all([
    detectProjectTech(appPath, config),
    analyzeFolderStructure(appPath, config),
    analyzeComponents(appPath, config),
    analyzeStateManagement(appPath, config),
    analyzeApiLayer(appPath, config),
    analyzeRouting(appPath, config),
    analyzeStyling(appPath, config),
    analyzeAssets(appPath, config),
    detectAntiPatterns(appPath, config),
    detectDuplication(appPath, config),
    analyzeDependenciesUsage(appPath, config),
  ]);

  // Count total issues
  const totalIssues =
    structure.issues.length +
    state.issues.length +
    api.issues.length +
    routing.issues.length +
    styling.issues.length +
    assets.assetIssues.length +
    antiPatterns.antiPatterns.length +
    duplication.duplicateComponents.length +
    duplication.duplicateUtils.length +
    dependencies.issues.length +
    components.largeComponents.length +
    components.complexComponents.length;

  // Calculate health score (0-100) — weighted by severity
  let healthScore = 100;

  // TypeScript: -15 for no TS (high impact on maintainability)
  if (tech.language === 'JavaScript') healthScore -= 15;

  // Components: penalize proportionally but cap so large apps aren't destroyed
  // Large = files > 300 lines; Complex = many responsibilities
  const largeRatio = components.totalComponents > 0 ? components.largeComponents.length / components.totalComponents : 0;
  const complexRatio = components.totalComponents > 0 ? components.complexComponents.length / components.totalComponents : 0;
  healthScore -= Math.min(Math.round(largeRatio * 25), 10);  // max -10 for large files
  healthScore -= Math.min(Math.round(complexRatio * 25), 10); // max -10 for complex files

  // Anti-patterns: penalize per pattern type, capped at 30 total
  let antiPatternDeduction = 0;
  for (const ap of antiPatterns.antiPatterns) {
    if (ap.type === 'god-component') antiPatternDeduction += 10;
    else if (ap.type === 'missing-error-handling') antiPatternDeduction += 8;
    else if (ap.type === 'prop-drilling') antiPatternDeduction += 6;
    else if (ap.type === 'tight-coupling') antiPatternDeduction += 6;
    else if (ap.type === 'missing-alt-text') antiPatternDeduction += 5;
    else if (ap.type === 'unlabeled-inputs') antiPatternDeduction += 5;
    else if (ap.type === 'non-semantic-html') antiPatternDeduction += 4;
    else if (ap.type === 'inline-callbacks') antiPatternDeduction += 4;
    else if (ap.type === 'duplicated-logic') antiPatternDeduction += 3;
    else if (ap.type === 'react-namespace-style') antiPatternDeduction += 3;
    else if (ap.type === 'placeholder-images') antiPatternDeduction += 3;
    else antiPatternDeduction += 4;
  }
  healthScore -= Math.min(antiPatternDeduction, 30);

  // API issues: scattered pattern is a major structural debt
  if (api.apiPattern === 'scattered') healthScore -= 7;
  else if (api.apiPattern === 'mixed') healthScore -= 3;
  healthScore -= Math.min(api.issues.length * 2, 8);

  // State: all state in one component
  if (state.stateType === 'mixed') healthScore -= 4;
  if (state.issues.length > 0) healthScore -= Math.min(state.issues.length * 2, 6);

  // Duplication: cap at 8 — false positives are common in large apps
  healthScore -= Math.min(duplication.duplicateComponents.length * 2, 8);
  healthScore -= Math.min(duplication.duplicateUtils.length * 2, 6);

  // Styling
  healthScore -= Math.min(styling.issues.length * 2, 6);

  // Dependencies
  healthScore -= Math.min(dependencies.issues.length * 2, 6);

  // Structure
  if (structure.structureType === 'flat' && components.totalComponents > 3) healthScore -= 4;

  // No lazy loading on large apps (Next.js/Remix do this automatically — skip)
  const isFileBased = routing.routingLibrary === 'next/router' || routing.routingLibrary === 'next/navigation' || routing.routingLibrary === '@remix-run/react';
  if (!routing.lazyLoading && routing.routeCount > 5 && !isFileBased) healthScore -= 5;

  healthScore = Math.max(0, Math.round(healthScore));

  // Generate migration hints
  const migrationHints: MigrationHint[] = [];

  // TypeScript migration
  if (tech.language === 'JavaScript') {
    migrationHints.push({
      priority: 'high',
      category: 'TypeScript',
      description: 'Convert project to TypeScript for better type safety and developer experience. Start with renaming files to .ts/.tsx and adding type annotations.',
      affectedFiles: [],
    });
  }

  // UI package extraction — only meaningful in an actual monorepo with a shared
  // ui package; standalone repos have nowhere to extract components to.
  const monorepo = detectMonorepo(appPath);
  const hasRepoUi = monorepo.isMonorepo && hasRepoUiPackage(monorepo.workspaceRoot);
  if (hasRepoUi && components.totalComponents > 10) {
    migrationHints.push({
      priority: 'medium',
      category: 'UI Package',
      description: `Extract ${Math.min(components.totalComponents, 10)}+ reusable components to @repo/ui for cross-project reuse.`,
      affectedFiles: components.largeComponents.map((c) => c.file),
    });
  }

  // API layer
  if (api.apiPattern === 'scattered') {
    migrationHints.push({
      priority: 'high',
      category: 'API Layer',
      description: 'Create a centralized API service layer. Extract all fetch/axios calls into a dedicated api/ directory with proper error handling, typed responses, and request/response interceptors.',
      affectedFiles: [],
    });
  }

  // State management
  if (state.stateType === 'mixed') {
    migrationHints.push({
      priority: 'high',
      category: 'State Management',
      description: 'Consolidate state management. Choose one approach (Redux Toolkit or Zustand) and migrate all state to it.',
      affectedFiles: [],
    });
  }

  // Accessibility
  const a11yPatterns = antiPatterns.antiPatterns.filter((a) =>
    ['missing-alt-text', 'unlabeled-inputs', 'non-semantic-html'].includes(a.type)
  );
  if (a11yPatterns.length > 0) {
    migrationHints.push({
      priority: 'high',
      category: 'Accessibility',
      description: `Fix ${a11yPatterns.length} accessibility violation(s): ${a11yPatterns.map((a) => a.type).join(', ')}. Required for WCAG 2.1 compliance.`,
      affectedFiles: a11yPatterns.flatMap((a) => a.files),
    });
  }

  // God component splitting
  const godComponents = antiPatterns.antiPatterns.filter((a) => a.type === 'god-component');
  if (godComponents.length > 0) {
    migrationHints.push({
      priority: 'high',
      category: 'Component Architecture',
      description: `Split ${godComponents.length} god component(s) into smaller single-responsibility components. Extract state, API calls, and sub-views into separate files.`,
      affectedFiles: godComponents.flatMap((a) => a.files),
    });
  }

  // Error handling
  const errorHandlingIssues = antiPatterns.antiPatterns.filter((a) => a.type === 'missing-error-handling');
  if (errorHandlingIssues.length > 0) {
    migrationHints.push({
      priority: 'high',
      category: 'Error Handling',
      description: `Add try/catch or .catch() to ${errorHandlingIssues.flatMap((a) => a.files).length} file(s) with unhandled API calls. Consider adding a global error boundary.`,
      affectedFiles: errorHandlingIssues.flatMap((a) => a.files),
    });
  }

  // Folder restructuring
  if (structure.structureType === 'flat') {
    migrationHints.push({
      priority: 'medium',
      category: 'Folder Structure',
      description: 'Restructure to feature-based organization for better scalability. Group related components, hooks, and utilities by feature.',
      affectedFiles: [],
    });
  }

  // Code splitting
  if (!routing.lazyLoading && routing.routeCount > 5) {
    migrationHints.push({
      priority: 'medium',
      category: 'Performance',
      description: `Add lazy loading for ${routing.routeCount} routes using React.lazy() and Suspense for better initial load performance.`,
      affectedFiles: [],
    });
  }

  // Deduplication
  if (duplication.duplicateComponents.length > 0) {
    migrationHints.push({
      priority: 'medium',
      category: 'Code Quality',
      description: `Consolidate ${duplication.duplicateComponents.length} duplicate components into shared implementations.`,
      affectedFiles: duplication.duplicateComponents.flatMap((d) => d.locations),
    });
  }

  // Styling
  if (styling.stylingType.length > 2) {
    migrationHints.push({
      priority: 'low',
      category: 'Styling',
      description: `Standardize on one styling solution. Currently using ${styling.stylingType.join(', ')}.`,
      affectedFiles: [],
    });
  }

  // Anti-patterns
  if (antiPatterns.antiPatterns.length > 3) {
    migrationHints.push({
      priority: 'high',
      category: 'Code Quality',
      description: `Address ${antiPatterns.antiPatterns.length} anti-patterns (prop drilling, tight coupling, etc.) for better maintainability.`,
      affectedFiles: antiPatterns.antiPatterns.flatMap((a) => a.files),
    });
  }

  // Sort hints by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  migrationHints.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    summary: {
      appPath,
      analysisDate: new Date().toISOString(),
      totalIssues,
      healthScore,
    },
    tech,
    structure,
    components,
    state,
    api,
    routing,
    styling,
    assets,
    antiPatterns,
    duplication,
    dependencies,
    migrationHints,
  };
}