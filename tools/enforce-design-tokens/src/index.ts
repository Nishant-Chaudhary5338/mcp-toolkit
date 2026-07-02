#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { scanPath, filterBySeverity, gradeViolations, type TokenViolation } from './core.js';

class EnforceDesignTokensServer extends McpServerBase {
  constructor() {
    super({ name: 'enforce-design-tokens', version: '2.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'scan_tokens',
      'Scan a file or directory for hardcoded design values (colors, spacing, font sizes, radii, shadows, z-index) that should use design tokens. Returns a summary + violations, filterable by severity.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to a file or directory to scan.' },
          severity: { type: 'string', enum: ['high', 'medium', 'low', 'all'], description: 'Minimum severity to include. Defaults to "all".' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: target, severity = 'all' } = (args ?? {}) as { path?: string; severity?: string };
        if (!target) return this.error(new Error('Missing required argument "path".'));
        try {
          const violations = filterBySeverity(scanPath(target), severity);
          return this.success({
            summary: {
              totalViolations: violations.length,
              high: violations.filter((v) => v.severity === 'high').length,
              medium: violations.filter((v) => v.severity === 'medium').length,
              low: violations.filter((v) => v.severity === 'low').length,
            },
            violations,
          });
        } catch (err) {
          return this.error(err);
        }
      },
    );

    this.addTool(
      'suggest_tokens',
      'Suggest a design-token replacement for each hardcoded value found in a file or directory.',
      {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path to a file or directory to scan.' } },
        required: ['path'],
      },
      async (args) => {
        const { path: target } = (args ?? {}) as { path?: string };
        if (!target) return this.error(new Error('Missing required argument "path".'));
        try {
          const suggestions = scanPath(target).map((v) => ({ file: v.file, line: v.line, replace: v.value, with: v.tokenSuggestion, type: v.type }));
          return this.success({ suggestions });
        } catch (err) {
          return this.error(err);
        }
      },
    );

    this.addTool(
      'enforce_tokens',
      'Grade a path A–F on design-token compliance and group violations by file. A blocking gate for generated/changed UI code.',
      {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path to a file or directory to scan.' } },
        required: ['path'],
      },
      async (args) => {
        const { path: target } = (args ?? {}) as { path?: string };
        if (!target) return this.error(new Error('Missing required argument "path".'));
        try {
          const violations = scanPath(target);
          const byFile: Record<string, TokenViolation[]> = {};
          for (const v of violations) (byFile[v.file] ??= []).push(v);
          return this.success({
            grade: gradeViolations(violations),
            passed: violations.filter((v) => v.severity === 'high').length === 0,
            totalViolations: violations.length,
            filesAffected: Object.keys(byFile).length,
            byFile,
          });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new EnforceDesignTokensServer().run().catch(console.error);
