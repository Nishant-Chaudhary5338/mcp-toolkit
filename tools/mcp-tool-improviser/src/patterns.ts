// ============================================================================
// PATTERNS - Improvement Pattern Library
// ============================================================================

import type { Dimension, AnalysisIssue, DiffChange } from './types.js';

// ============================================================================
// DESCRIPTION QUALITY PATTERNS
// ============================================================================

export const descriptionPatterns = {
  minLength: 80,
  shouldInclude: ['what it does', 'return format', 'example', 'limitations'],
  
  enrichDescription(
    toolName: string,
    currentDesc: string,
    inputSchema: Record<string, unknown>,
  ): { improved: string; changes: DiffChange[] } {
    const changes: DiffChange[] = [];
    const required: string[] = (inputSchema.required as string[]) || [];
    const props: Record<string, Record<string, unknown>> = (inputSchema.properties as Record<string, Record<string, unknown>>) || {};
    
    // Build example from required params
    const exampleParams = required
      .filter((p: string) => props[p])
      .map((p: string) => {
        const prop = props[p];
        if (prop.type === 'string') return `${p}: "/path/to/${p}"`;
        if (prop.type === 'boolean') return `${p}: true`;
        if (prop.type === 'number') return `${p}: 1`;
        if (prop.type === 'array') return `${p}: ["item1"]`;
        return `${p}: "value"`;
      })
      .slice(0, 3);
    
    const example = exampleParams.length > 0
      ? `Example: {${exampleParams.join(', ')}}.`
      : '';

    // Build optional params note
    const optional = Object.keys(props).filter(
      (p: string) => !required.includes(p) && props[p].description,
    );
    const optionalNote = optional.length > 0
      ? ` Optional: ${optional.map((p: string) => `${p} (${props[p].description})`).join(', ')}.`
      : '';

    const improved = `${currentDesc.replace(/\.$/, '')}. ${example}${optionalNote}`;

    changes.push({
      type: 'replace',
      search: `description: '${currentDesc.replace(/'/g, "\\'")}'`,
      insert: `description: '${improved.replace(/'/g, "\\'")}'`,
      description: 'Enriched tool description with example and parameter notes',
    });

    return { improved, changes };
  },

  checkDescription(desc: string): AnalysisIssue | null {
    if (!desc) {
      return {
        dimension: 'descriptionQuality',
        severity: 'critical',
        location: 'tool description',
        current: '(empty)',
        problem: 'Tool has no description. AI callers cannot understand what this tool does.',
        improvement: 'Add a detailed description explaining what the tool does, its inputs, and outputs.',
      };
    }
    if (desc.length < 40) {
      return {
        dimension: 'descriptionQuality',
        severity: 'high',
        location: 'tool description',
        current: desc,
        problem: `Description is only ${desc.length} characters. Too vague for AI to make informed tool selection.`,
        improvement: 'Expand to include: what it does, example usage, return format, and any limitations.',
      };
    }
    if (desc.length < this.minLength) {
      return {
        dimension: 'descriptionQuality',
        severity: 'medium',
        location: 'tool description',
        current: desc,
        problem: `Description is ${desc.length} characters. Missing examples or return format information.`,
        improvement: 'Add usage example and document what the tool returns.',
      };
    }
    return null;
  },
};

// ============================================================================
// SCHEMA COMPLETENESS PATTERNS
// ============================================================================

export const schemaPatterns = {
  checkProperty(propName: string, prop: unknown): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    const propObj = prop as Record<string, unknown>;

    if (!propObj.description || (propObj.description as string).length < 10) {
      issues.push({
        dimension: 'schemaCompleteness',
        severity: 'high',
        location: `inputSchema.${propName}`,
        current: (propObj.description as string) || '(none)',
        problem: `Parameter "${propName}" has no description. AI cannot determine what value to pass.`,
        improvement: `Add description: e.g., "${propName === 'path' ? 'File or directory path to process' : `The ${propName} value`}".`,
      });
    }

    if (propObj.type === 'string' && !propObj.enum && !propObj.pattern && !propObj.format) {
      if (propName === 'path' || propName.endsWith('Path') || propName.endsWith('Dir')) {
        issues.push({
          dimension: 'schemaCompleteness',
          severity: 'medium',
          location: `inputSchema.${propName}`,
          current: JSON.stringify(prop),
          problem: `Path parameter "${propName}" lacks format validation.`,
          improvement: 'Add format: "path" or pattern for validation.',
        });
      }
    }

    if (propObj.type === 'number' && (propName.includes('threshold') || propName.includes('limit') || propName.includes('max'))) {
      if (propObj.minimum === undefined && propObj.maximum === undefined) {
        issues.push({
          dimension: 'schemaCompleteness',
          severity: 'medium',
          location: `inputSchema.${propName}`,
          current: JSON.stringify(prop),
          problem: `Numeric parameter "${propName}" has no min/max bounds.`,
          improvement: 'Add minimum and/or maximum constraints.',
        });
      }
    }

    if (propObj.type === 'boolean' && propObj.default === undefined) {
      issues.push({
        dimension: 'schemaCompleteness',
        severity: 'low',
        location: `inputSchema.${propName}`,
        current: JSON.stringify(prop),
        problem: `Boolean parameter "${propName}" has no default value.`,
        improvement: 'Add default: true or default: false.',
      });
    }

    return issues;
  },

  checkRequiredVsDefault(schema: unknown): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    const schemaObj = schema as Record<string, unknown>;
    const required: string[] = (schemaObj.required as string[]) || [];
    const properties: Record<string, unknown> = (schemaObj.properties as Record<string, unknown>) || {};

    for (const [propName, prop] of Object.entries(properties)) {
      if (!required.includes(propName) && (prop as Record<string, unknown>).default === undefined && propName !== 'root') {
        issues.push({
          dimension: 'schemaCompleteness',
          severity: 'low',
          location: `inputSchema.${propName}`,
          current: `optional, no default`,
          problem: `Optional parameter "${propName}" has no default documented in schema.`,
          improvement: `Add default value to schema so AI knows what to expect if omitted.`,
        });
      }
    }

    return issues;
  },
};

// ============================================================================
// ERROR HANDLING PATTERNS
// ============================================================================

export const errorPatterns = {
  genericCatch: /error instanceof Error \? error\.message : ['"]Unknown error['"]/,
  genericCatchAlt: /error instanceof Error \? error\.message : ['"]Unknown['"]/,

  checkGenericErrorHandling(source: string): AnalysisIssue | null {
    if (this.genericCatch.test(source) || this.genericCatchAlt.test(source)) {
      return {
        dimension: 'errorHandling',
        severity: 'high',
        location: 'catch blocks',
        current: "error instanceof Error ? error.message : 'Unknown error'",
        problem: 'Generic error handling loses context. No error codes, no structured info, no retry guidance.',
        improvement: 'Use structured error format: {error: true, code: "SPECIFIC_CODE", message: "...", details: {...}, suggestion: "how to fix"}.',
      };
    }
    return null;
  },

  generateStructuredError(errorVar: string = 'error'): string {
    return `{
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          details: {
            tool: '${' + errorVar + '}',
            timestamp: new Date().toISOString(),
          },
          suggestion: 'Check the error message and ensure all inputs are valid.',
        }, null, 2),
      }],
      isError: true,
    }`;
  },

  checkMissingValidation(source: string, toolName: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    // Check for missing path validation
    if (source.includes('fs.existsSync') && !source.includes('path.resolve') && !source.includes('validatePath')) {
      issues.push({
        dimension: 'errorHandling',
        severity: 'high',
        location: `${toolName} handler`,
        current: 'Uses fs.existsSync without path validation',
        problem: 'No path traversal protection. Malicious paths like "../../../etc/passwd" could be accessed.',
        improvement: 'Add path.resolve() and validate that resolved path stays within expected boundaries.',
      });
    }

    // Check for missing input validation
    if (!source.includes('if (!args') && !source.includes('if (!path') && !source.includes('if (!')) {
      issues.push({
        dimension: 'errorHandling',
        severity: 'medium',
        location: `${toolName} handler`,
        current: 'No input validation before processing',
        problem: 'Missing or invalid inputs will cause cryptic runtime errors instead of helpful messages.',
        improvement: 'Add input validation at the start of each handler: if (!args.path) throw new Error("path is required").',
      });
    }

    return issues;
  },
};

// ============================================================================
// EDGE CASE PATTERNS
// ============================================================================

export const edgeCasePatterns = {
  checkEmptyDirectory(source: string): AnalysisIssue | null {
    if (source.includes('readdirSync') && !source.includes('.length === 0') && !source.includes('entries.length')) {
      return {
        dimension: 'edgeCaseCoverage',
        severity: 'medium',
        location: 'directory scanning',
        current: 'Reads directory without checking if empty',
        problem: 'Empty directories will cause silent failures or confusing results.',
        improvement: 'Check if directory is empty and return meaningful message: if (entries.length === 0) return { message: "No files found" }.',
      };
    }
    return null;
  },

  checkLargeFiles(source: string): AnalysisIssue | null {
    if (source.includes('readFileSync') && !source.includes('maxBuffer') && !source.includes('size') && !source.includes('chunk')) {
      return {
        dimension: 'edgeCaseCoverage',
        severity: 'medium',
        location: 'file reading',
        current: 'Uses readFileSync without size limits',
        problem: 'Very large files (>100MB) will cause memory issues or crashes.',
        improvement: 'Add size check: const stats = fs.statSync(filePath); if (stats.size > MAX_SIZE) throw new Error("File too large"). Or use streams.',
      };
    }
    return null;
  },

  checkSymlinks(source: string): AnalysisIssue | null {
    if (source.includes('readdirSync') && !source.includes('withFileTypes') && !source.includes('lstatSync')) {
      return {
        dimension: 'edgeCaseCoverage',
        severity: 'low',
        location: 'file system operations',
        current: 'Does not handle symlinks explicitly',
        problem: 'Symlinks may cause infinite loops or unexpected behavior.',
        improvement: 'Use readdirSync with withFileTypes:true and check entry.isSymbolicLink(). Or use lstatSync for symlink-aware operations.',
      };
    }
    return null;
  },

  checkPermissions(source: string): AnalysisIssue | null {
    if (source.includes('writeFileSync') && !source.includes('try') && !source.includes('catch')) {
      return {
        dimension: 'edgeCaseCoverage',
        severity: 'medium',
        location: 'file writing',
        current: 'Writes files without permission error handling',
        problem: 'Permission denied errors will crash the tool instead of providing helpful message.',
        improvement: 'Wrap file operations in try-catch and provide clear error: "Permission denied. Check that the directory is writable."',
      };
    }
    return null;
  },

  checkConcurrentAccess(source: string): AnalysisIssue | null {
    if (source.includes('writeFileSync') && source.includes('readdirSync')) {
      return {
        dimension: 'edgeCaseCoverage',
        severity: 'low',
        location: 'file operations',
        current: 'No concurrent access protection',
        problem: 'Multiple simultaneous tool calls could cause race conditions.',
        improvement: 'Consider using file locks or atomic write operations for critical files.',
      };
    }
    return null;
  },
};

// ============================================================================
// RESPONSE STRUCTURE PATTERNS
// ============================================================================

export const responsePatterns = {
  checkConsistentFormat(source: string): AnalysisIssue | null {
    const hasTypeText = source.includes("type: 'text'") || source.includes('type: "text"');
    const hasJsonStringify = source.includes('JSON.stringify');
    
    if (hasTypeText && hasJsonStringify) {
      // Check if responses include metadata
      if (!source.includes('timestamp') && !source.includes('duration') && !source.includes('version')) {
        return {
          dimension: 'responseStructure',
          severity: 'medium',
          location: 'response format',
          current: 'Returns JSON without metadata',
          problem: 'Responses lack metadata (timestamp, duration, version) for debugging and monitoring.',
          improvement: 'Add metadata to responses: { timestamp: new Date().toISOString(), duration: Date.now() - startTime, version: "1.0.0" }.',
        };
      }
    }
    return null;
  },

  checkMissingSuccessField(source: string): AnalysisIssue | null {
    if (source.includes('JSON.stringify') && !source.includes('success:') && !source.includes('"success"')) {
      return {
        dimension: 'responseStructure',
        severity: 'medium',
        location: 'response format',
        current: 'Response does not include success field',
        problem: 'AI callers cannot easily determine if the operation succeeded without parsing the full response.',
        improvement: 'Always include success: true/false at the top level of responses.',
      };
    }
    return null;
  },
};

// ============================================================================
// CODE QUALITY PATTERNS
// ============================================================================

export const codeQualityPatterns = {
  checkDuplicatedScanDirectory(source: string, filePath: string): AnalysisIssue | null {
    const scanDirRegex = /function scanDirectory\s*\(/;
    if (scanDirRegex.test(source)) {
      return {
        dimension: 'codeQuality',
        severity: 'medium',
        location: `${filePath} - scanDirectory function`,
        current: 'Duplicated scanDirectory function (found in 8+ other tools)',
        problem: 'Code duplication across tools. Bug fixes require updating multiple files.',
        improvement: 'Extract to shared utility module or keep consistent implementation across all tools.',
      };
    }
    return null;
  },

  checkDuplicatedFindTsconfig(source: string, filePath: string): AnalysisIssue | null {
    if (source.includes('function findTsconfig') || source.includes('findTsconfig(')) {
      return {
        dimension: 'codeQuality',
        severity: 'low',
        location: `${filePath} - findTsconfig function`,
        current: 'Duplicated findTsconfig function',
        problem: 'Same utility function duplicated across multiple tools.',
        improvement: 'Consider extracting to shared utility or ensuring consistent implementation.',
      };
    }
    return null;
  },

  checkLongFunctions(source: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    const lines = source.split('\n');
    let currentFunction = '';
    let functionStart = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fnMatch = line.match(/(?:private\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)/);
      if (fnMatch && line.includes('{')) {
        currentFunction = fnMatch[1];
        functionStart = i;
        braceDepth = 1;
      } else if (currentFunction) {
        braceDepth += (line.match(/{/g) || []).length;
        braceDepth -= (line.match(/}/g) || []).length;
        if (braceDepth === 0) {
          const length = i - functionStart;
          if (length > 100) {
            issues.push({
              dimension: 'codeQuality',
              severity: length > 200 ? 'high' : 'medium',
              location: `function ${currentFunction} (lines ${functionStart + 1}-${i + 1})`,
              current: `${length} lines`,
              problem: `Function "${currentFunction}" is ${length} lines long. Hard to understand and maintain.`,
              improvement: 'Break into smaller functions with single responsibilities. Extract sub-operations into private methods.',
            });
          }
          currentFunction = '';
        }
      }
    }

    return issues;
  },

  checkAnyTypes(source: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];
    const lines = source.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check for args: any pattern in handlers
      if (line.match(/args:\s*any/) && !line.includes('//')) {
        issues.push({
          dimension: 'codeQuality',
          severity: 'medium',
          location: `line ${i + 1}`,
          current: line.trim(),
          problem: 'Using "any" type loses type safety. Parameters should be properly typed.',
          improvement: 'Define an interface for the handler arguments: interface HandlerArgs { path: string; ... }',
        });
      }
    }

    return issues;
  },
};

// ============================================================================
// CONTEXTUAL DEPTH PATTERNS
// ============================================================================

export const contextualPatterns = {
  checkMissingWhy(source: string): AnalysisIssue | null {
    // Check if issue objects include a `problem` or `improvement` field explaining WHY
    // (description: appears everywhere in schema props, so use issue-specific fields)
    if (source.includes('issues.push') && !source.includes('problem:') && !source.includes('improvement:') && !source.includes('fix:')) {
      return {
        dimension: 'contextualDepth',
        severity: 'high',
        location: 'issue reporting',
        current: 'Reports issues without explaining WHY they matter',
        problem: 'Tool outputs what is wrong but not why it matters or how to fix it.',
        improvement: 'Add problem (why it matters) and improvement/fix (how to resolve) to each reported issue.',
      };
    }
    return null;
  },

  checkMissingConfidenceScores(source: string): AnalysisIssue | null {
    if (source.includes('severity') && !source.includes('confidence')) {
      return {
        dimension: 'contextualDepth',
        severity: 'low',
        location: 'analysis results',
        current: 'No confidence scores on detections',
        problem: 'AI cannot distinguish between high-confidence and speculative findings.',
        improvement: 'Add confidence: number (0-1) to each detection to indicate certainty level.',
      };
    }
    return null;
  },

  checkMissingSuggestions(source: string): AnalysisIssue | null {
    const hasIssues = source.includes('issues') || source.includes('Issues');
    const hasSuggestions = source.includes('suggestion') || source.includes('Suggestion') || source.includes('recommendation');
    
    if (hasIssues && !hasSuggestions) {
      return {
        dimension: 'contextualDepth',
        severity: 'medium',
        location: 'analysis output',
        current: 'Reports problems without actionable suggestions',
        problem: 'Users see what is wrong but not what to do about it.',
        improvement: 'Add prioritized suggestions array: suggestions: [{priority: 1, action: "Fix X", reason: "Because Y"}].',
      };
    }
    return null;
  },
};

// ============================================================================
// AGGREGATE: Run all pattern checks
// ============================================================================

export function runAllPatternChecks(
  source: string,
  filePath: string,
  tools: { name: string; description: string; inputSchema: unknown }[],
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];

  // Check each tool's description and schema
  for (const tool of tools) {
    const descIssue = descriptionPatterns.checkDescription(tool.description);
    if (descIssue) issues.push(descIssue);

    const inputSchema = tool.inputSchema as Record<string, unknown> | undefined;
    const props = (inputSchema?.properties || {}) as Record<string, unknown>;
    for (const [propName, prop] of Object.entries(props)) {
      issues.push(...schemaPatterns.checkProperty(propName, prop));
    }

    if (inputSchema) {
      issues.push(...schemaPatterns.checkRequiredVsDefault(inputSchema));
    }
  }

  // Code-level checks
  const errorIssue = errorPatterns.checkGenericErrorHandling(source);
  if (errorIssue) issues.push(errorIssue);

  for (const tool of tools) {
    issues.push(...errorPatterns.checkMissingValidation(source, tool.name));
  }

  // Edge cases
  const emptyDir = edgeCasePatterns.checkEmptyDirectory(source);
  if (emptyDir) issues.push(emptyDir);

  const largeFile = edgeCasePatterns.checkLargeFiles(source);
  if (largeFile) issues.push(largeFile);

  const symlinks = edgeCasePatterns.checkSymlinks(source);
  if (symlinks) issues.push(symlinks);

  const permissions = edgeCasePatterns.checkPermissions(source);
  if (permissions) issues.push(permissions);

  // Response structure
  const responseFormat = responsePatterns.checkConsistentFormat(source);
  if (responseFormat) issues.push(responseFormat);

  const successField = responsePatterns.checkMissingSuccessField(source);
  if (successField) issues.push(successField);

  // Code quality
  const scanDir = codeQualityPatterns.checkDuplicatedScanDirectory(source, filePath);
  if (scanDir) issues.push(scanDir);

  const findTs = codeQualityPatterns.checkDuplicatedFindTsconfig(source, filePath);
  if (findTs) issues.push(findTs);

  issues.push(...codeQualityPatterns.checkLongFunctions(source));
  issues.push(...codeQualityPatterns.checkAnyTypes(source));

  // Contextual depth
  const why = contextualPatterns.checkMissingWhy(source);
  if (why) issues.push(why);

  const confidence = contextualPatterns.checkMissingConfidenceScores(source);
  if (confidence) issues.push(confidence);

  const suggestions = contextualPatterns.checkMissingSuggestions(source);
  if (suggestions) issues.push(suggestions);

  return issues;
}