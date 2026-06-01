// ============================================================================
// SHARED TYPES FOR LEGACY ANALYZER MCP TOOLS
// ============================================================================

/**
 * Configurable thresholds for analysis tools
 */
export interface AnalyzerConfig {
  /** Line count threshold for "large" components (default: 300) */
  largeComponentLines: number;
  /** Line count threshold for "large" utility files (default: 200) */
  largeUtilLines: number;
  /** Size threshold in KB for large image assets (default: 100) */
  largeAssetImageKB: number;
  /** Size threshold in MB for large video assets (default: 1) */
  largeAssetVideoMB: number;
  /** Depth threshold for prop drilling detection (default: 3) */
  propDrillingDepth: number;
  /** Similarity threshold 0-1 for duplication detection (default: 0.8) */
  duplicationThreshold: number;
}

export const DEFAULT_CONFIG: AnalyzerConfig = {
  largeComponentLines: 300,
  largeUtilLines: 200,
  largeAssetImageKB: 100,
  largeAssetVideoMB: 1,
  propDrillingDepth: 3,
  duplicationThreshold: 0.85,
};

/**
 * Common tool input
 */
export interface ToolInput {
  path: string;
  config?: Partial<AnalyzerConfig>;
}

/**
 * Tool #1: detect-project-tech
 */
export interface ProjectTechOutput {
  framework: string;
  reactVersion: string;
  language: "JavaScript" | "TypeScript";
  hasCRAConfig: boolean;
  majorDependencies: string[];
}

/**
 * Tool #2: analyze-folder-structure
 */
export interface FolderStructureOutput {
  structureType: "flat" | "feature-based" | "mixed";
  folders: string[];
  maxDepth: number;
  issues: string[];
}

/**
 * Tool #3: analyze-components
 */
export interface ComponentInfo {
  name: string;
  file: string;
  lines: number;
  jsxMaxDepth: number;
  responsibilities: string[];
}
export interface AnalyzeComponentsOutput {
  totalComponents: number;
  largeComponents: ComponentInfo[];
  complexComponents: ComponentInfo[];
}

/**
 * AST TYPES
 */
export interface ParsedFile {
  filePath: string;
  content: string;
  ast: unknown;
}

/**
 * Tool #4: analyze-state-management
 */
export interface StatePatterns {
  normalizedState: boolean;
  derivedState: boolean;
  reselectUsed: boolean;
}
export interface AnalyzeStateOutput {
  stateType: "redux" | "context" | "local" | "mixed" | "none";
  patterns: StatePatterns;
  issues: string[];
}

/**
 * Tool #5: analyze-api-layer
 */
export interface AnalyzeApiOutput {
  apiPattern: "centralized" | "scattered" | "mixed" | "none";
  clients: string[];
  duplicateEndpoints: string[];
  issues: string[];
}

/**
 * Tool #6: analyze-routing
 */
export interface AnalyzeRoutingOutput {
  routingLibrary: string | null;
  routingType: "flat" | "nested" | "none";
  lazyLoading: boolean;
  routeCount: number;
  issues: string[];
}

/**
 * Tool #7: analyze-styling
 */
export interface AnalyzeStylingOutput {
  stylingType: string[];
  inlineStylesCount: number;
  hardcodedColors: string[];
  duplicateClasses: string[];
  issues: string[];
}

/**
 * Tool #8: analyze-assets
 */
export interface AssetInfo {
  file: string;
  sizeKB: number;
  type: string;
}
export interface AnalyzeAssetsOutput {
  totalAssets: number;
  largeAssets: AssetInfo[];
  unusedAssets: string[];
  assetIssues: string[];
}

/**
 * Tool #9: detect-anti-patterns
 */
export interface AntiPattern {
  type: string;
  description: string;
  files: string[];
}
export interface DetectAntiPatternsOutput {
  antiPatterns: AntiPattern[];
}

/**
 * Tool #10: detect-duplication
 */
export interface DuplicateItem {
  name: string;
  locations: string[];
  similarity: number;
}
export interface DetectDuplicationOutput {
  duplicateComponents: DuplicateItem[];
  duplicateUtils: DuplicateItem[];
}

/**
 * Tool #11: analyze-dependencies-usage
 */
export interface ExternalLibraryUsage {
  name: string;
  usageCount: number;
  pattern: "optimal" | "suboptimal" | "mixed";
  issues: string[];
}
export interface InternalImports {
  deepImports: string[];
  crossFeatureImports: string[];
  couplingIssues: string[];
}
export interface UIUsage {
  used: boolean;
  violations: string[];
}
export interface UtilsUsage {
  duplicated: string[];
  missingCentral: string[];
}
export interface AnalyzeDependenciesOutput {
  externalLibraries: ExternalLibraryUsage[];
  internalImports: InternalImports;
  uiUsage: UIUsage;
  utilsUsage: UtilsUsage;
  importAntiPatterns: string[];
  issues: string[];
}

/**
 * Tool #12: analyze-legacy-app (Aggregator)
 */
export interface MigrationHint {
  priority: "high" | "medium" | "low";
  category: string;
  description: string;
  affectedFiles: string[];
}
export interface AnalyzeLegacyAppOutput {
  summary: {
    appPath: string;
    analysisDate: string;
    totalIssues: number;
    healthScore: number;
  };
  tech: ProjectTechOutput;
  structure: FolderStructureOutput;
  components: AnalyzeComponentsOutput;
  state: AnalyzeStateOutput;
  api: AnalyzeApiOutput;
  routing: AnalyzeRoutingOutput;
  styling: AnalyzeStylingOutput;
  assets: AnalyzeAssetsOutput;
  antiPatterns: DetectAntiPatternsOutput;
  duplication: DetectDuplicationOutput;
  dependencies: AnalyzeDependenciesOutput;
  migrationHints: MigrationHint[];
}

// ============================================================================
// AST TYPES
// ============================================================================

export interface ParsedFile {
  filePath: string;
  content: string;
  ast: unknown;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  isDefault: boolean;
  line: number;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  line: number;
  isExported: boolean;
  isComponent: boolean;
}

export interface JSXInfo {
  tagName: string;
  depth: number;
  line: number;
  childrenCount: number;
}

export interface ComponentAnalysis {
  filePath: string;
  name: string;
  lines: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  jsxElements: JSXInfo[];
  jsxMaxDepth: number;
  hooks: HookUsage[];
  props: string[];
}

export interface HookUsage {
  name: string;
  line: number;
}

export interface ImportGraph {
  [filePath: string]: {
    imports: ImportInfo[];
    importedBy: string[];
  };
}

// ============================================================================
// REFACTOR FOLDER STRUCTURE TYPES (Tools 13-22)
// ============================================================================

/**
 * Tool #13: detect-features
 */
export interface DetectFeaturesOutput {
  features: string[];
  featureMap: Record<string, string[]>; // feature -> file paths
}

/**
 * Tool #14: classify-files
 */
export type FileClassificationType = 'feature' | 'shared' | 'utility' | 'config';
export interface FileClassification {
  path: string;
  type: FileClassificationType;
  feature?: string;
}
export interface ClassifyFilesOutput {
  files: FileClassification[];
}

/**
 * Tool #15: detect-shared-modules
 */
export interface DetectSharedModulesOutput {
  shared: string[];
  usageCounts: Record<string, number>; // file -> number of features using it
}

/**
 * Tool #16: design-target-structure
 */
export interface FeatureStructure {
  components: string[];
  hooks: string[];
  api: string[];
  pages: string[];
  types: string[];
}
export interface TargetStructureNode {
  [key: string]: TargetStructureNode | string[];
}
export interface DesignTargetStructureOutput {
  structure: {
    src: {
      features: Record<string, string[]>;
      shared: string[];
      app: string[];
    };
  };
}

/**
 * Tool #17: map-files-to-target
 */
export interface FileMove {
  from: string;
  to: string;
  reason: string;
}
export interface MapFilesToTargetOutput {
  moves: FileMove[];
  unmapped: string[]; // files that don't fit cleanly
}

/**
 * Tool #18: detect-boundary-violations
 */
export interface BoundaryViolation {
  type: 'cross-feature-import' | 'deep-relative-import' | 'circular-dependency' | 'tight-coupling';
  from: string;
  to: string;
  description: string;
  severity: 'error' | 'warning';
}
export interface DetectBoundaryViolationsOutput {
  violations: BoundaryViolation[];
  summary: {
    crossFeatureImports: number;
    deepRelativeImports: number;
    circularDependencies: number;
    tightCoupling: number;
  };
}

/**
 * Tool #19: suggest-module-splitting
 */
export interface ModuleSplit {
  file: string;
  suggestion: string;
  reason: string;
  proposedFiles: string[];
}
export interface SuggestModuleSplittingOutput {
  splits: ModuleSplit[];
}

/**
 * Tool #20: naming-standardizer
 */
export interface FileRename {
  from: string;
  to: string;
  reason: string;
}
export interface NamingStandardizerOutput {
  renames: FileRename[];
  conventions: {
    files: string; // 'camelCase' | 'PascalCase' | 'kebab-case'
    folders: string;
  };
}

/**
 * Tool #21: generate-refactor-plan
 */
export interface RefactorStep {
  order: number;
  action: string;
  description: string;
  affectedFiles: string[];
  priority: 'high' | 'medium' | 'low';
}
export interface GenerateRefactorPlanOutput {
  features: string[];
  targetStructure: DesignTargetStructureOutput['structure'];
  fileMoves: FileMove[];
  splits: ModuleSplit[];
  renames: FileRename[];
  violations: BoundaryViolation[];
  steps: RefactorStep[];
  estimatedEffort: {
    filesToMove: number;
    filesToSplit: number;
    filesToRename: number;
    violationsToFix: number;
  };
}

/**
 * Tool #22: refactor-folder-structure (AGGREGATOR)
 */
export interface RefactorFolderStructureOutput {
  summary: {
    appPath: string;
    analysisDate: string;
    featuresDetected: number;
    filesToMove: number;
    filesToSplit: number;
    violationsFound: number;
    overallComplexity: 'low' | 'medium' | 'high';
  };
  features: string[];
  featureDetails: Record<string, string[]>;
  structure: DesignTargetStructureOutput['structure'];
  moves: FileMove[];
  splits: ModuleSplit[];
  renames: FileRename[];
  sharedModules: string[];
  violations: BoundaryViolation[];
  refactorSteps: RefactorStep[];
  improvements: string[];
  warnings: string[];
}
