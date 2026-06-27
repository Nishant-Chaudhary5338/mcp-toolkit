#!/usr/bin/env node
// ============================================================================
// CODE MODERNIZER MCP SERVER
// Modernize React codebases: TypeScript conversion
// ============================================================================

import { McpServerBase } from '@mcp-showcase/shared';
import type { ToolResult } from '@mcp-showcase/shared';
import { convertToTypeScript } from './tools/01-convert-to-typescript.js';
import { toResultReport, renderResultHTML } from './result-report.js';

// ============================================================================
// SERVER
// ============================================================================

class CodeModernizerServer extends McpServerBase {
  constructor() {
    super({ name: 'code-modernizer', version: '2.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'convert-to-typescript',
      'Rename .js/.jsx files to .ts/.tsx, add basic type annotations, convert propTypes to TypeScript interfaces',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to legacy app root directory' },
          includeProps: {
            type: 'boolean',
            description: 'Convert propTypes to TS interfaces (default: true)',
            default: true,
          },
          dryRun: {
            type: 'boolean',
            description: 'If true, only analyze without making changes (default: false)',
            default: false,
          },
        },
        required: ['path'],
      },
      this.handleConvert.bind(this)
    );
  }

  private async handleConvert(args: unknown): Promise<ToolResult> {
    const { path, includeProps, dryRun } = args as {
      path: string;
      includeProps?: boolean;
      dryRun?: boolean;
    };

    try {
      const result = await convertToTypeScript({
        path,
        includeProps,
        dryRun,
      });

      const report = toResultReport(
        result,
        new Date().toISOString().slice(0, 10),
        path
      );

      return this.successWithUI(
        result as unknown as Record<string, unknown>,
        {
          uri: 'ui://code-modernizer/report',
          html: renderResultHTML(report),
        }
      );
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: {
                  code: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
                  message: error instanceof Error ? error.message : String(error),
                  suggestion: 'Check that the path exists and contains .js/.jsx files.',
                  timestamp: new Date().toISOString(),
                },
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

new CodeModernizerServer().run().catch(console.error);
