#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { renderReportHTML } from '@mcp-showcase/ui-kit';
import * as fs from 'fs';
import * as path from 'path';
import { scanFile, scanDirectory } from './scanner.js';
import type { RuleName, Severity, ScanOptions } from './types.js';
import { toHealthReport } from './health-report.js';

const VALID_RULES: RuleName[] = [
  'no-any',
  'generics',
  'utility-types',
  'modifiers',
  'type-guards',
  'discriminated-unions',
  'branded-types',
];

class TypeScriptEnforcerServer extends McpServerBase {
  constructor() {
    super({ name: 'typescript-enforcer', version: '2.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'scan_file',
      'Analyze a single TypeScript/JavaScript file for type safety violations. Runs all rules by default. Returns violations with line numbers, severity, current code, suggested fix, and explanation.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the TypeScript/JavaScript file to analyze' },
          rules: {
            type: 'array',
            items: { type: 'string', enum: VALID_RULES },
            description: `Specific rules to run. Defaults to all. Options: ${VALID_RULES.join(', ')}`,
          },
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'info'],
            description: 'Minimum severity to report (default: info shows all)',
          },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: targetPath, rules, severity } = (args ?? {}) as {
          path: string;
          rules?: RuleName[];
          severity?: Severity;
        };
        try {
          const resolved = path.resolve(targetPath);
          if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);
          if (fs.statSync(resolved).isDirectory()) throw new Error(`${resolved} is a directory. Use scan_directory instead.`);
          const options: ScanOptions = { rules, severity: severity || 'info' };
          const startTime = Date.now();
          const result = {
            ...scanFile(resolved, options),
            metadata: { timestamp: new Date().toISOString(), duration: Date.now() - startTime, version: '2.0.0' },
          };
          return this.success(result);
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'scan_directory',
      'Recursively scan a directory for TypeScript violations. Returns per-file results sorted by worst score first, plus summary statistics and breakdown by rule.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to scan recursively' },
          rules: {
            type: 'array',
            items: { type: 'string', enum: VALID_RULES },
            description: 'Specific rules to run (default: all)',
          },
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'info'],
            description: 'Minimum severity to report (default: info)',
          },
          maxFiles: { type: 'number', description: 'Maximum number of files to scan (default: unlimited)' },
          ignore: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional patterns to ignore',
          },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: targetPath, rules, severity, maxFiles, ignore } = (args ?? {}) as {
          path: string;
          rules?: RuleName[];
          severity?: Severity;
          maxFiles?: number;
          ignore?: string[];
        };
        try {
          const resolved = path.resolve(targetPath);
          if (!fs.existsSync(resolved)) throw new Error(`Directory not found: ${resolved}`);
          if (!fs.statSync(resolved).isDirectory()) throw new Error(`${resolved} is a file. Use scan_file instead.`);
          const options: ScanOptions = { rules, severity: severity || 'info', maxFiles, ignore };
          const startTime = Date.now();
          const result = {
            ...scanDirectory(resolved, options),
            metadata: { timestamp: new Date().toISOString(), duration: Date.now() - startTime, version: '2.0.0' },
          };
          return this.successWithUI(result as unknown as Record<string, unknown>, {
            uri: 'ui://typescript-enforcer/report',
            html: renderReportHTML(toHealthReport(result, new Date().toISOString().slice(0, 10))),
          });
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'scan_specific_rule',
      'Run a single specific rule across a file or directory. Useful for targeted fixes.',
      {
        type: 'object',
        properties: {
          rule: {
            type: 'string',
            enum: VALID_RULES,
            description: `The rule to run. Options: ${VALID_RULES.join(', ')}`,
          },
          path: { type: 'string', description: 'File or directory path to scan' },
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'info'],
            description: 'Minimum severity to report (default: info)',
          },
        },
        required: ['rule', 'path'],
      },
      async (args) => {
        const { rule, path: targetPath, severity } = (args ?? {}) as {
          rule: RuleName;
          path: string;
          severity?: Severity;
        };
        try {
          if (!VALID_RULES.includes(rule)) throw new Error(`Invalid rule: ${rule}`);
          const resolved = path.resolve(targetPath);
          if (!fs.existsSync(resolved)) throw new Error(`Path not found: ${resolved}`);
          const options: ScanOptions = { rules: [rule], severity: severity || 'info' };
          const startTime = Date.now();
          const scanResult = fs.statSync(resolved).isDirectory()
            ? scanDirectory(resolved, options)
            : scanFile(resolved, options);
          return this.success({
            rule,
            ...scanResult,
            metadata: { timestamp: new Date().toISOString(), duration: Date.now() - startTime, version: '2.0.0' },
          });
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'list_rules',
      'List all available TypeScript enforcement rules with descriptions and what they check for.',
      { type: 'object', properties: {} },
      async () => {
        return this.success({
          rules: [
            { name: 'no-any', severity: 'error', description: "Detect all 'any' type usages and suggest proper types", checks: [': any type annotations', 'as any type assertions', 'any[] arrays', 'Promise<any>', 'Record<string, any>', 'Generic <any>'] },
            { name: 'generics', severity: 'warning', description: 'Detect functions/classes that should use generics for reusability' },
            { name: 'utility-types', severity: 'info', description: 'Detect patterns that should use TypeScript utility types (Partial, Pick, Record, NonNullable, Awaited)' },
            { name: 'modifiers', severity: 'info', description: 'Detect missing readonly, const, as const, satisfies modifiers' },
            { name: 'type-guards', severity: 'info', description: 'Detect runtime checks that should be type predicates' },
            { name: 'discriminated-unions', severity: 'info', description: 'Detect union types that should use discriminated union pattern (coming soon)' },
            { name: 'branded-types', severity: 'info', description: 'Detect primitive types that should be branded for type safety (coming soon)' },
          ],
          totalRules: VALID_RULES.length,
          metadata: { timestamp: new Date().toISOString(), version: '2.0.0' },
        });
      }
    );
  }
}

new TypeScriptEnforcerServer().run().catch(console.error);
