// ============================================================================
// ANALYZER - Tool Source Analysis Engine
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import type {
  AnalysisResult,
  AnalysisIssue,
  Dimension,
  DimensionScore,
  ExtractedTool,
  ToolSource,
  ProposedDiff,
  DiffChange,
} from './types.js';
import { runAllPatternChecks, descriptionPatterns, schemaPatterns, errorPatterns } from './patterns.js';

const DIMENSIONS: Dimension[] = [
  'descriptionQuality',
  'schemaCompleteness',
  'errorHandling',
  'edgeCaseCoverage',
  'responseStructure',
  'codeQuality',
  'contextualDepth',
];

const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  descriptionQuality: 2,
  schemaCompleteness: 2,
  errorHandling: 1.5,
  edgeCaseCoverage: 1,
  responseStructure: 1,
  codeQuality: 1,
  contextualDepth: 1.5,
};

// ============================================================================
// TOOL EXTRACTION
// ============================================================================

export function extractToolSource(filePath: string): ToolSource {
  const source = fs.readFileSync(filePath, 'utf-8');

  // Extract server name
  const nameMatch = source.match(/name:\s*['\"]([^'\"]+)['\"]/)
  const serverName = nameMatch ? nameMatch[1] : path.basename(path.dirname(filePath));

  // Extract server version
  const versionMatch = source.match(/version:\s*['\"]([^'\"]+)['\"]/)
  const serverVersion = versionMatch ? versionMatch[1] : '1.0.0';

  // Extract class name
  const classMatch = source.match(/class\s+(\w+)/);
  const className = classMatch ? classMatch[1] : 'Unknown';

  // Extract imports
  const imports: string[] = [];
  const importRegex = /import\s+.*?from\s+['\"]([^'\"]+)['\"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source)) !== null) {
    imports.push(m[1]);
  }

  // Extract tools from ListToolsRequestSchema handler
  const tools = extractToolsFromSource(source);

  return {
    filePath,
    serverName,
    serverVersion,
    tools,
    fullSource: source,
    imports,
    classStructure: {
      className,
      methods: extractMethods(source, className),
    },
  };
}

function extractToolsFromSource(source: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];

  // Strategy 1: Old SDK format — tools: [ { name: '...', description: '...', inputSchema: { ... } } ]
  const toolsArrayMatch = source.match(/tools:\s*\[([\s\S]*?)\]\s*,?\s*\}\)/);
  if (toolsArrayMatch) {
    const toolsBlock = toolsArrayMatch[1];
    const toolRegex = /\{\s*name:\s*['\"]([^'\"]+)['\"],\s*description:\s*(['\"])([\s\S]*?)\2\s*,\s*inputSchema:\s*(\{[\s\S]*?\})\s*\}/g;
    let match: RegExpExecArray | null;
    while ((match = toolRegex.exec(toolsBlock)) !== null) {
      const toolName = match[1];
      const toolDesc = match[3];
      const schemaStr = match[4];

      let inputSchema: Record<string, unknown> = {};
      try {
        const cleaned = schemaStr
          .replace(/(\w+):/g, '"$1":')
          .replace(/'/g, '"')
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*/g, '');
        inputSchema = JSON.parse(cleaned);
      } catch {
        inputSchema = { _raw: schemaStr.slice(0, 500) };
      }

      tools.push({
        name: toolName,
        description: toolDesc,
        inputSchema,
        handlerName: findHandlerForTool(source, toolName),
        handlerCode: '',
        lineNumber: source.slice(0, match.index).split('\n').length,
      });
    }
  }

  if (tools.length > 0) return tools;

  // Strategy 2: McpServerBase addTool() pattern
  // this.addTool('name', 'description', schemaObj, handler)
  const addToolRegex = /this\.addTool\(\s*['"]([^'"]+)['"]\s*,\s*'([^']*)'/g;
  let addMatch: RegExpExecArray | null;
  while ((addMatch = addToolRegex.exec(source)) !== null) {
    const toolName = addMatch[1];
    const toolDesc = addMatch[2];
    tools.push({
      name: toolName,
      description: toolDesc,
      inputSchema: {},
      handlerName: findHandlerForTool(source, toolName),
      handlerCode: '',
      lineNumber: source.slice(0, addMatch.index).split('\n').length,
    });
  }

  if (tools.length > 0) return tools;

  // Strategy 3: addTool with double-quoted description
  const addToolDqRegex = /this\.addTool\(\s*['"]([^'"]+)['"]\s*,\s*"([^"]*)"/g;
  let dqMatch: RegExpExecArray | null;
  while ((dqMatch = addToolDqRegex.exec(source)) !== null) {
    tools.push({
      name: dqMatch[1],
      description: dqMatch[2],
      inputSchema: {},
      handlerName: findHandlerForTool(source, dqMatch[1]),
      handlerCode: '',
      lineNumber: source.slice(0, dqMatch.index).split('\n').length,
    });
  }

  // Strategy 4: Simple fallback — name/description as adjacent object properties
  if (tools.length === 0) {
    const simpleToolRegex = /name:\s*['\"]([^'"]+)['"]\s*,\s*description:\s*['\"]([^'"]+)['"]/g;
    let simpleMatch: RegExpExecArray | null;
    while ((simpleMatch = simpleToolRegex.exec(source)) !== null) {
      const toolName = simpleMatch[1];
      tools.push({
        name: toolName,
        description: simpleMatch[2],
        inputSchema: {},
        handlerName: findHandlerForTool(source, toolName),
        handlerCode: '',
        lineNumber: simpleMatch.index ? source.slice(0, simpleMatch.index).split('\n').length : 0,
      });
    }
  }

  return tools;
}

function findHandlerForTool(source: string, toolName: string): string {
  // Look for case 'toolName': patterns
  const casePattern = new RegExp(`case\\s+['\"]${toolName}['\"]`);
  const match = source.match(casePattern);
  if (match && match.index !== undefined) {
    // Find the nearest method name before this case
    const beforeCase = source.slice(0, match.index);
    const methodMatch = beforeCase.match(/(?:private\s+)?(?:async\s+)?(handle\w+)\s*\(/g);
    if (methodMatch) {
      const lastMethod = methodMatch[methodMatch.length - 1];
      const nameMatch = lastMethod.match(/(handle\w+)/);
      return nameMatch ? nameMatch[1] : 'unknown';
    }
  }

  // Try to match by convention: handleXxx where Xxx relates to tool name
  const pascalName = toolName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const handlerPattern = new RegExp(`handle${pascalName}\\s*\\(`);
  if (handlerPattern.test(source)) {
    return `handle${pascalName}`;
  }

  return 'unknown';
}

function extractMethods(source: string, className: string): string[] {
  const methods: string[] = [];
  const methodRegex = /(?:private\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)/g;
  let match: RegExpExecArray | null;
  while ((match = methodRegex.exec(source)) !== null) {
    if (match[1] !== 'constructor' && match[1] !== 'run') {
      methods.push(match[1]);
    }
  }
  return methods;
}

// ============================================================================
// SCORING
// ============================================================================

function scoreDimension(issues: AnalysisIssue[], dimension: Dimension): DimensionScore {
  const dimIssues = issues.filter(i => i.dimension === dimension);
  
  // Start with 10, deduct based on severity
  let score = 10;
  for (const issue of dimIssues) {
    switch (issue.severity) {
      case 'critical': score -= 3; break;
      case 'high': score -= 2; break;
      case 'medium': score -= 1; break;
      case 'low': score -= 0.5; break;
    }
  }
  
  return {
    score: Math.max(0, Math.round(score * 10) / 10),
    maxScore: 10,
    issues: dimIssues,
  };
}

function calculateOverallScore(scores: Record<Dimension, DimensionScore>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of DIMENSIONS) {
    const weight = DIMENSION_WEIGHTS[dim];
    weightedSum += scores[dim].score * weight;
    totalWeight += weight;
  }

  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 9) return 'A';
  if (score >= 7) return 'B';
  if (score >= 5) return 'C';
  if (score >= 3) return 'D';
  return 'F';
}

// ============================================================================
// DIFF GENERATION
// ============================================================================

function generateProposedDiffs(
  source: string,
  filePath: string,
  issues: AnalysisIssue[],
  tools: ExtractedTool[],
): ProposedDiff[] {
  const diffs: ProposedDiff[] = [];

  // Group issues by improvement type
  const descIssues = issues.filter(i => i.dimension === 'descriptionQuality');
  const schemaIssues = issues.filter(i => i.dimension === 'schemaCompleteness');
  const errorIssues = issues.filter(i => i.dimension === 'errorHandling');

  // Generate description improvements
  if (descIssues.length > 0) {
    let changes: DiffChange[] = [];
    for (const tool of tools) {
      const toolIssues = descIssues.filter(i => i.location.includes(tool.name) || i.location === 'tool description');
      if (toolIssues.length > 0 && tool.description.length < 80) {
        const enriched = descriptionPatterns.enrichDescription(tool.name, tool.description, tool.inputSchema);
        changes.push(...enriched.changes);
      }
    }
    if (changes.length > 0) {
      diffs.push({
        file: filePath,
        reason: 'Enrich tool descriptions with examples, return format documentation, and limitations. This helps the AI caller understand exactly what to expect, reducing failed calls.',
        improvementImpact: 'Better AI tool selection, fewer wasted calls, clearer expectations for all tools',
        changes,
      });
    }
  }

  // Generate schema improvements
  if (schemaIssues.length > 0) {
    let changes: DiffChange[] = [];
    for (const tool of tools) {
      const props = tool.inputSchema?.properties || {};
      for (const [propName, prop] of Object.entries(props)) {
        const propIssues = schemaIssues.filter(i => i.location.includes(propName));
        if (propIssues.length > 0 && (!(prop as any).description || (prop as any).description.length < 10)) {
          const desc = generatePropertyDescription(propName, prop as any);
          changes.push({
            type: 'replace' as const,
            search: `${propName}: { type: '${(prop as any).type}'`,
            insert: `${propName}: { type: '${(prop as any).type}', description: '${desc}'`,
            description: `Added description for parameter "${propName}"`,
          });
        }
      }
    }
    if (changes.length > 0) {
      diffs.push({
        file: filePath,
        reason: 'Add missing descriptions to input schema parameters. Without descriptions, AI cannot determine what values to pass.',
        improvementImpact: 'Reduces invalid parameter errors, improves AI tool calling accuracy',
        changes,
      });
    }
  }

  // Generate error handling improvements
  if (errorIssues.some(i => i.current.includes('Unknown error'))) {
    diffs.push({
      file: filePath,
      reason: 'Replace generic error handling with structured error responses including error codes, detailed messages, and actionable suggestions.',
      improvementImpact: 'Better error diagnosis, easier debugging, clear guidance for fixing issues',
      changes: [{
        type: 'replace',
        search: "error instanceof Error ? error.message : 'Unknown error'",
        insert: `{
          error: true,
          code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          suggestion: 'Check input parameters and ensure all required values are provided.',
          timestamp: new Date().toISOString(),
        }`,
        description: 'Structured error response with code, message, and suggestion',
      }],
    });
  }

  return diffs;
}

function generatePropertyDescription(propName: string, prop: unknown): string {
  const typeDescriptions: Record<string, string> = {
    path: 'File or directory path to process',
    root: 'Root directory for the operation',
    name: 'Name identifier',
    outputPath: 'Output directory path for generated files',
    file: 'Path to the file to process',
    package: 'Package name to operate on',
    command: 'Command or script name to execute',
    filter: 'Filter criteria for results',
    configFile: 'Configuration file name to check',
    componentPath: 'Path to the component directory',
    projectRoot: 'Root directory of the project',
    testPath: 'Specific test file or directory to run',
    severity: 'Minimum severity level to include in results',
    format: 'Output format for the results',
    platform: 'Target platform for the operation',
    components: 'List of component names to process',
  };

  return typeDescriptions[propName] || `The ${propName.replace(/([A-Z])/g, ' $1').toLowerCase()} value`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function analyzeTool(filePath: string): AnalysisResult {
  const toolSource = extractToolSource(filePath);
  const { fullSource, tools } = toolSource;

  // Run all pattern checks
  const issues = runAllPatternChecks(fullSource, filePath, tools);

  // Score each dimension
  const scores: Record<Dimension, DimensionScore> = {} as any;
  for (const dim of DIMENSIONS) {
    scores[dim] = scoreDimension(issues, dim);
  }

  const overallScore = calculateOverallScore(scores);
  const grade = getGrade(overallScore);

  // Count issues by dimension
  const issuesByDimension: Record<Dimension, number> = {} as any;
  for (const dim of DIMENSIONS) {
    issuesByDimension[dim] = issues.filter(i => i.dimension === dim).length;
  }

  // Generate proposed diffs
  const proposedDiffs = generateProposedDiffs(fullSource, filePath, issues, tools);

  return {
    tool: toolSource.serverName,
    toolPath: filePath,
    scores,
    overallScore,
    maxScore: 10,
    grade,
    totalIssues: issues.length,
    issuesByDimension,
    proposedDiffs,
  };
}

export function scanToolsDirectory(toolsDir: string): string[] {
  const toolDirs: string[] = [];
  
  if (!fs.existsSync(toolsDir)) return toolDirs;
  
  const entries = fs.readdirSync(toolsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'mcp-tool-improviser') continue; // Skip self
    
    const indexPath = path.join(toolsDir, entry.name, 'src', 'index.ts');
    if (fs.existsSync(indexPath)) {
      toolDirs.push(indexPath);
    }
  }
  
  return toolDirs;
}