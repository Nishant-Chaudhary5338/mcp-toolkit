// ============================================================================
// TYPES - MCP Tool Improviser
// ============================================================================

export interface DimensionScore {
  score: number;
  maxScore: number;
  issues: AnalysisIssue[];
}

export interface AnalysisIssue {
  dimension: Dimension;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  current: string;
  problem: string;
  improvement: string;
}

export type Dimension =
  | 'descriptionQuality'
  | 'schemaCompleteness'
  | 'errorHandling'
  | 'edgeCaseCoverage'
  | 'responseStructure'
  | 'codeQuality'
  | 'contextualDepth';

export interface AnalysisResult {
  tool: string;
  toolPath: string;
  scores: Record<Dimension, DimensionScore>;
  overallScore: number;
  maxScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalIssues: number;
  issuesByDimension: Record<Dimension, number>;
  proposedDiffs: ProposedDiff[];
}

export interface ProposedDiff {
  file: string;
  reason: string;
  improvementImpact: string;
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'replace' | 'insert_after' | 'insert_before' | 'delete';
  search?: string;
  insert?: string;
  lineNumber?: number;
  description: string;
}

export interface BatchAnalysisResult {
  timestamp: string;
  totalTools: number;
  averageScore: number;
  toolResults: AnalysisResult[];
  summary: {
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    totalDiffs: number;
  };
  worstPerformers: { tool: string; score: number }[];
  bestPerformers: { tool: string; score: number }[];
}

export interface ApplyResult {
  tool: string;
  file: string;
  backupPath: string;
  appliedChanges: number;
  success: boolean;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ExtractedTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handlerName: string;
  handlerCode: string;
  lineNumber: number;
}

export interface ToolSource {
  filePath: string;
  serverName: string;
  serverVersion: string;
  tools: ExtractedTool[];
  fullSource: string;
  imports: string[];
  classStructure: {
    className: string;
    methods: string[];
  };
}