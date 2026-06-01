#!/usr/bin/env node
import { McpServerBase, safeReadFile } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeFile, filterByImpact } from './rules.js';
import type { A11yIssue } from './rules.js';

function scanDirectory(dir: string, exts: string[] = ['.tsx', '.jsx', '.html']): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const SKIP = new Set(['node_modules', 'build', 'dist', '.next', '.turbo', '__tests__', '.git', 'coverage', 'out']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      files.push(...scanDirectory(fullPath, exts));
    } else if (
      exts.some(e => entry.name.endsWith(e)) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function readAndAnalyze(targetPath: string): { files: string[]; issues: A11yIssue[] } {
  const stat = fs.statSync(targetPath);
  const files = stat.isDirectory() ? scanDirectory(targetPath) : [targetPath];
  const issues: A11yIssue[] = [];
  for (const file of files) {
    const content = safeReadFile(file);
    if (content === null) continue;
    issues.push(...analyzeFile(file, content));
  }
  return { files, issues };
}

class AccessibilityCheckerServer extends McpServerBase {
  constructor() {
    super({ name: 'accessibility-checker', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'check_accessibility',
      'Run axe-core style rules against React components and HTML files to detect WCAG violations.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file or directory to scan' },
          severity: {
            type: 'string',
            enum: ['critical', 'serious', 'moderate', 'minor'],
            description: 'Minimum severity to report (default: minor — report all)',
          },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: targetPath, severity = 'minor' } = (args ?? {}) as {
          path: string;
          severity?: A11yIssue['impact'];
        };
        try {
          const { files, issues } = readAndAnalyze(path.resolve(targetPath));
          const filtered = filterByImpact(issues, severity);
          return this.success({
            summary: {
              filesScanned: files.length,
              totalIssues: filtered.length,
              critical: filtered.filter(i => i.impact === 'critical').length,
              serious: filtered.filter(i => i.impact === 'serious').length,
              moderate: filtered.filter(i => i.impact === 'moderate').length,
              minor: filtered.filter(i => i.impact === 'minor').length,
            },
            issues: filtered,
          });
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'validate_aria',
      'Check ARIA attributes for correctness: valid roles, proper aria-hidden usage.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file or directory to scan' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: targetPath } = (args ?? {}) as { path: string };
        try {
          const { files, issues } = readAndAnalyze(path.resolve(targetPath));
          const ariaRules = new Set(['aria-roles', 'aria-hidden-focus']);
          const filtered = issues.filter(i => ariaRules.has(i.rule));
          return this.success({ filesScanned: files.length, ariaIssues: filtered.length, issues: filtered });
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'audit_keyboard_nav',
      'Audit keyboard navigation: tabindex usage, focus order, icon-only buttons without labels.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to file or directory to scan' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path: targetPath } = (args ?? {}) as { path: string };
        try {
          const { files, issues } = readAndAnalyze(path.resolve(targetPath));
          const keyboardRules = new Set(['tabindex', 'button-name', 'link-name']);
          const filtered = issues.filter(i => keyboardRules.has(i.rule));
          return this.success({ filesScanned: files.length, keyboardIssues: filtered.length, issues: filtered });
        } catch (error) {
          return this.error(error);
        }
      }
    );
  }
}

new AccessibilityCheckerServer().run().catch(console.error);
