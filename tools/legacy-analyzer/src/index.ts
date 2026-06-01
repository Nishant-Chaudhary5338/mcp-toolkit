#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import type { ToolResult } from '@mcp-showcase/shared';
import { detectProjectTech } from './tools/01-detect-project-tech.js';
import { analyzeFolderStructure } from './tools/02-analyze-folder-structure.js';
import { analyzeComponents } from './tools/03-analyze-components.js';
import { analyzeStateManagement } from './tools/04-analyze-state-management.js';
import { analyzeApiLayer } from './tools/05-analyze-api-layer.js';
import { analyzeRouting } from './tools/06-analyze-routing.js';
import { analyzeStyling } from './tools/07-analyze-styling.js';
import { analyzeAssets } from './tools/08-analyze-assets.js';
import { detectAntiPatterns } from './tools/09-detect-anti-patterns.js';
import { detectDuplication } from './tools/10-detect-duplication.js';
import { analyzeDependenciesUsage } from './tools/11-analyze-dependencies-usage.js';
import { analyzeLegacyApp } from './tools/12-analyze-legacy-app.js';
import { detectFeatures } from './tools/13-detect-features.js';
import { classifyFiles } from './tools/14-classify-files.js';
import { detectSharedModules } from './tools/15-detect-shared-modules.js';
import { designTargetStructure } from './tools/16-design-target-structure.js';
import { mapFilesToTarget } from './tools/17-map-files-to-target.js';
import { detectBoundaryViolations } from './tools/18-detect-boundary-violations.js';
import { suggestModuleSplitting } from './tools/19-suggest-module-splitting.js';
import { namingStandardizer } from './tools/20-naming-standardizer.js';
import { generateRefactorPlan } from './tools/21-generate-refactor-plan.js';
import { refactorFolderStructure } from './tools/22-refactor-folder-structure.js';
import type { AnalyzerConfig } from './types.js';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const CONFIG_SCHEMA = {
  type: 'object',
  description: 'Optional configuration overrides',
  properties: {
    largeComponentLines: { type: 'number', description: 'Line count threshold for large components (default: 300)' },
    largeUtilLines: { type: 'number', description: 'Line count threshold for large utility files (default: 200)' },
    largeAssetImageKB: { type: 'number', description: 'Size threshold in KB for large images (default: 100)' },
    largeAssetVideoMB: { type: 'number', description: 'Size threshold in MB for large videos (default: 1)' },
    propDrillingDepth: { type: 'number', description: 'Depth threshold for prop drilling detection (default: 3)' },
    duplicationThreshold: { type: 'number', description: 'Similarity threshold 0-1 for duplication detection (default: 0.8)' },
  },
};

const TOOLS = [
  {
    name: 'detect-project-tech',
    description: 'Detect React version, language (JS/TS), framework (CRA/Vite/Next.js/Remix/Gatsby/React Native), and major dependencies',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-folder-structure',
    description: 'Analyze folder structure: flat vs feature-based, presence of standard folders, nesting depth',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-components',
    description: 'Scan all components: count, large components (>300 lines), complex components with multiple responsibilities',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-state-management',
    description: 'Detect Redux, Context API, local state patterns, normalized state, derived state, Reselect usage',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-api-layer',
    description: 'Detect HTTP client usage (axios/fetch/superagent/ky), Next.js API routes, centralized vs scattered pattern, endpoint duplication',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-routing',
    description: 'Detect react-router usage, route structure (flat vs nested), lazy loading usage',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-styling',
    description: 'Detect CSS/SCSS/Tailwind/styled-components, inline styles, hardcoded colors, duplicate classes',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-assets',
    description: 'Detect large images/videos, assets inside src, unused assets',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'detect-anti-patterns',
    description: 'Detect prop drilling, tight coupling, duplicated logic, large utility files, god components',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'detect-duplication',
    description: 'Detect duplicate components, duplicate utility functions, similar file structures',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-dependencies-usage',
    description: 'Deep analysis of external libraries, internal imports, UI package usage, import anti-patterns',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'analyze-legacy-app',
    description: 'Complete analysis for any React-based app (CRA, Vite, Next.js, Remix, Gatsby). Runs all 22 sub-tools and produces a unified health score (0-100) with prioritized migration hints.',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'detect-features',
    description: 'Identify logical features/domains in the app using file names, routing, folder grouping, and import clustering',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'classify-files',
    description: 'Classify each file into feature-specific, shared, utility, or config type',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'detect-shared-modules',
    description: 'Identify files used across multiple features (shared modules)',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'design-target-structure',
    description: 'Generate scalable folder structure suggestion based on feature-based architecture',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'map-files-to-target',
    description: 'Map existing files to new target structure',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'detect-boundary-violations',
    description: 'Detect cross-feature imports, deep relative imports, and tight coupling issues',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'suggest-module-splitting',
    description: 'Suggest splitting large or generic files into smaller modules',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'naming-standardizer',
    description: 'Suggest better file and folder naming conventions',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'generate-refactor-plan',
    description: 'Combine all analysis outputs into a single structured refactor plan',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
  {
    name: 'refactor-folder-structure',
    description: 'Aggregator: calls all refactoring suggestion tools and produces final structured plan',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to app root directory (CRA, Vite, Next.js, Remix, Gatsby, plain React)' }, config: CONFIG_SCHEMA }, required: ['path'] },
  },
];

// ============================================================================
// HANDLER DISPATCH TABLE
// ============================================================================

type HandlerFn = (appPath: string, config?: Partial<AnalyzerConfig>) => Promise<unknown>;

const HANDLERS: Record<string, HandlerFn> = {
  'detect-project-tech': detectProjectTech,
  'analyze-folder-structure': analyzeFolderStructure,
  'analyze-components': analyzeComponents,
  'analyze-state-management': analyzeStateManagement,
  'analyze-api-layer': analyzeApiLayer,
  'analyze-routing': analyzeRouting,
  'analyze-styling': analyzeStyling,
  'analyze-assets': analyzeAssets,
  'detect-anti-patterns': detectAntiPatterns,
  'detect-duplication': detectDuplication,
  'analyze-dependencies-usage': analyzeDependenciesUsage,
  'analyze-legacy-app': analyzeLegacyApp,
  'detect-features': detectFeatures,
  'classify-files': classifyFiles,
  'detect-shared-modules': detectSharedModules,
  'design-target-structure': designTargetStructure,
  'map-files-to-target': mapFilesToTarget,
  'detect-boundary-violations': detectBoundaryViolations,
  'suggest-module-splitting': suggestModuleSplitting,
  'naming-standardizer': namingStandardizer,
  'generate-refactor-plan': generateRefactorPlan,
  'refactor-folder-structure': refactorFolderStructure,
};

// ============================================================================
// SERVER
// ============================================================================

class LegacyAnalyzerServer extends McpServerBase {
  constructor() {
    super({ name: 'legacy-analyzer', version: '1.0.0' });
  }

  protected registerTools(): void {
    for (const tool of TOOLS) {
      const toolName = tool.name;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.addTool(
        toolName,
        tool.description,
        tool.inputSchema as any,
        (args) => this.dispatchTool(toolName, args)
      );
    }
  }

  private async dispatchTool(name: string, args: unknown): Promise<ToolResult> {
    const { path: appPath, config } = args as { path: string; config?: Partial<AnalyzerConfig> };
    const handler = HANDLERS[name];
    if (!handler) {
      return this.error(new Error(`Unknown tool: ${name}`));
    }
    try {
      const result = await handler(appPath, config);
      return this.success(result as Record<string, unknown>);
    } catch (error) {
      return this.error(error);
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new LegacyAnalyzerServer().run().catch(console.error);
