#!/usr/bin/env node
// ============================================================================
// MCP TOOL IMPROVISER - Main Server
// Deep analysis and improvement of MCP tools
// ============================================================================

import { McpServerBase } from '@mcp-showcase/shared';
import type { ToolResult } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { analyzeTool, scanToolsDirectory } from './analyzer.js';
import { applyDiffs, rollbackFromBackup } from './generator.js';
import type { BatchAnalysisResult, AnalysisResult, ProposedDiff, ApplyResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// HELPER: Find tools directory
// ============================================================================

function findToolsDir(): string {
  // The improviser is at tools/mcp-tool-improviser/src/index.ts
  // Tools directory is at tools/
  return path.resolve(__dirname, '..', '..');
}

// ============================================================================
// MAIN SERVER
// ============================================================================

class McpToolImproviserServer extends McpServerBase {
  constructor() {
    super({ name: 'mcp-tool-improviser', version: '2.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'analyze_tool',
      'Deep analysis of a single MCP tool across 7 dimensions (description quality, schema completeness, error handling, edge case coverage, response structure, code quality, contextual depth). Returns JSON report with scores, detailed issues, and proposed diffs with reasons explaining each improvement.',
      {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the MCP tool source file (typically src/index.ts) or the tool directory',
          },
        },
        required: ['path'],
      },
      this.handleAnalyzeTool.bind(this)
    );

    this.addTool(
      'batch_analyze',
      'Analyze ALL MCP tools in the tools/ directory and return a comprehensive report. Shows worst/best performers, summary statistics, and all proposed diffs.',
      {
        type: 'object',
        properties: {
          toolsDir: {
            type: 'string',
            description: 'Path to tools directory (auto-detected if omitted)',
          },
        },
      },
      this.handleBatchAnalyze.bind(this)
    );

    this.addTool(
      'apply_improvements',
      'Apply approved diffs to improve MCP tools. Creates timestamped backups (.bak files) before modifying.',
      {
        type: 'object',
        properties: {
          diffs: {
            type: 'array',
            description: 'Array of ProposedDiff objects from analyze_tool/batch_analyze results',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string', description: 'File path to modify' },
                reason: { type: 'string', description: 'Why this change is being made' },
                improvementImpact: { type: 'string', description: 'Expected improvement impact' },
                changes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['replace', 'insert_after', 'insert_before', 'delete'] },
                      search: { type: 'string' },
                      insert: { type: 'string' },
                      description: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          dryRun: {
            type: 'boolean',
            description: 'If true, validate changes without writing to files (default: false)',
            default: false,
          },
        },
        required: ['diffs'],
      },
      this.handleApplyImprovements.bind(this)
    );

    this.addTool(
      'rollback',
      'Restore a file from its backup. Use this if an applied improvement caused issues.',
      {
        type: 'object',
        properties: {
          backupPath: { type: 'string', description: 'Path to the .bak backup file' },
          originalPath: { type: 'string', description: 'Path to restore to' },
        },
        required: ['backupPath', 'originalPath'],
      },
      this.handleRollback.bind(this)
    );
  }

  // ========================================================================
  // HANDLERS
  // ========================================================================

  private async handleAnalyzeTool(args: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const { path: targetPath } = args as { path: string };

    let resolvedPath = path.resolve(targetPath);

    // If directory, find src/index.ts
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      const indexPath = path.join(resolvedPath, 'src', 'index.ts');
      if (fs.existsSync(indexPath)) {
        resolvedPath = indexPath;
      } else {
        throw new Error(`No src/index.ts found in ${resolvedPath}`);
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    const result: AnalysisResult = analyzeTool(resolvedPath);
    const duration = Date.now() - startTime;

    return this.successWithDashboard('Mcp Tool Improviser', {
      ...result,
      metadata: {
        timestamp: new Date().toISOString(),
        duration,
        version: '2.0.0',
      },
    });
  }

  private async handleBatchAnalyze(args: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const { toolsDir: inputToolsDir } = (args || {}) as { toolsDir?: string };

    const toolsDir = inputToolsDir ? path.resolve(inputToolsDir) : findToolsDir();
    const toolPaths = scanToolsDirectory(toolsDir);

    if (toolPaths.length === 0) {
      throw new Error(`No MCP tools found in ${toolsDir}. Each tool should have src/index.ts.`);
    }

    const toolResults: AnalysisResult[] = [];
    for (const toolPath of toolPaths) {
      try {
        const result = analyzeTool(toolPath);
        toolResults.push(result);
      } catch (err) {
        // Skip tools that fail analysis
        console.error(`Failed to analyze ${toolPath}:`, err);
      }
    }

    // Calculate summary
    const scores = toolResults.map((r) => r.overallScore);
    const averageScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

    const allDiffs = toolResults.flatMap((r) => r.proposedDiffs);

    const summary = {
      criticalIssues: toolResults.reduce((sum, r) => {
        let count = 0;
        for (const dim of Object.values(r.scores)) {
          count += dim.issues.filter((i) => i.severity === 'critical').length;
        }
        return sum + count;
      }, 0),
      highIssues: toolResults.reduce((sum, r) => {
        let count = 0;
        for (const dim of Object.values(r.scores)) {
          count += dim.issues.filter((i) => i.severity === 'high').length;
        }
        return sum + count;
      }, 0),
      mediumIssues: toolResults.reduce((sum, r) => {
        let count = 0;
        for (const dim of Object.values(r.scores)) {
          count += dim.issues.filter((i) => i.severity === 'medium').length;
        }
        return sum + count;
      }, 0),
      lowIssues: toolResults.reduce((sum, r) => {
        let lowCount = 0;
        for (const dim of Object.values(r.scores)) {
          lowCount += dim.issues.filter((i) => i.severity === 'low').length;
        }
        return sum + lowCount;
      }, 0),
      totalDiffs: allDiffs.length,
    };

    const sorted = [...toolResults].sort((a, b) => a.overallScore - b.overallScore);

    const batchResult: BatchAnalysisResult = {
      timestamp: new Date().toISOString(),
      totalTools: toolResults.length,
      averageScore,
      toolResults,
      summary,
      worstPerformers: sorted.slice(0, 5).map((r) => ({ tool: r.tool, score: r.overallScore })),
      bestPerformers: sorted.slice(-5).reverse().map((r) => ({ tool: r.tool, score: r.overallScore })),
    };

    const duration = Date.now() - startTime;

    return this.successWithDashboard('Mcp Tool Improviser', {
      ...batchResult,
      metadata: {
        timestamp: new Date().toISOString(),
        duration,
        version: '2.0.0',
        toolsDirectory: toolsDir,
      },
    });
  }

  private async handleApplyImprovements(args: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const { diffs, dryRun } = args as { diffs: ProposedDiff[]; dryRun?: boolean };

    if (!diffs || !Array.isArray(diffs) || diffs.length === 0) {
      throw new Error('No diffs provided. Run analyze_tool or batch_analyze first to get proposed diffs.');
    }

    if (dryRun) {
      // Validate changes without applying
      const validation = diffs.map((diff) => {
        const issues: string[] = [];
        for (const change of diff.changes) {
          if (change.type === 'replace' && change.search) {
            if (!fs.existsSync(diff.file)) {
              issues.push(`File not found: ${diff.file}`);
            } else {
              const source = fs.readFileSync(diff.file, 'utf-8');
              if (!source.includes(change.search)) {
                issues.push(`Search string not found in ${diff.file}: "${change.search.slice(0, 80)}..."`);
              }
            }
          }
        }
        return { file: diff.file, valid: issues.length === 0, issues };
      });

      const duration = Date.now() - startTime;
      return this.successWithDashboard('Mcp Tool Improviser', {
        dryRun: true,
        validation,
        totalChanges: diffs.reduce((sum, d) => sum + d.changes.length, 0),
        validFiles: validation.filter((v) => v.valid).length,
        invalidFiles: validation.filter((v) => !v.valid).length,
        metadata: {
          timestamp: new Date().toISOString(),
          duration,
          version: '2.0.0',
        },
      });
    }

    // Apply changes
    const results: ApplyResult[] = applyDiffs(diffs);
    const duration = Date.now() - startTime;

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return this.successWithDashboard('Mcp Tool Improviser', {
      results,
      summary: {
        totalFiles: results.length,
        succeeded: successCount,
        failed: failCount,
        totalChangesApplied: results.reduce((sum, r) => sum + r.appliedChanges, 0),
      },
      backupPaths: results.filter((r) => r.backupPath).map((r) => ({ file: r.file, backup: r.backupPath })),
      rollbackNote: 'To undo changes, use the rollback tool with the backup path.',
      metadata: {
        timestamp: new Date().toISOString(),
        duration,
        version: '2.0.0',
      },
    });
  }

  private async handleRollback(args: unknown): Promise<ToolResult> {
    const { backupPath, originalPath } = args as { backupPath: string; originalPath: string };

    if (!backupPath || !originalPath) {
      throw new Error('Both backupPath and originalPath are required.');
    }

    const resolvedBackup = path.resolve(backupPath);
    const resolvedOriginal = path.resolve(originalPath);

    if (!fs.existsSync(resolvedBackup)) {
      throw new Error(`Backup file not found: ${resolvedBackup}`);
    }

    const success = rollbackFromBackup(resolvedBackup, resolvedOriginal);

    return this.successWithDashboard('Mcp Tool Improviser', {
      restored: success,
      backupPath: resolvedBackup,
      originalPath: resolvedOriginal,
      message: success
        ? `Successfully restored ${resolvedOriginal} from backup.`
        : `Failed to restore from backup.`,
    });
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new McpToolImproviserServer().run().catch(console.error);