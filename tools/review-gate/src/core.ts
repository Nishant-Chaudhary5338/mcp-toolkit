// review-gate CORE — pure logic (no MCP transport).
//
// Static quality gate for generated / changed React+TS code. Grades A–F on:
//   a11y     — <img> missing alt (error)
//   tokens   — hardcoded hex colors (warn)
//   smells   — `: any` (warn), console.log (warn)
//   stubs    — unfilled "not implemented" throws (error)
// Harvested from MicroFrontend/devtools review.js and generalized to grade any
// file or directory. Blocking gate for the CRUD workflow (workflow-runner).

import * as fs from 'fs';
import * as path from 'path';

export type Severity = 'error' | 'warn';

export interface Issue {
  file: string;
  line: number;
  rule: 'a11y' | 'tokens' | 'types' | 'quality' | 'stub';
  severity: Severity;
  message: string;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ReviewResult {
  path: string;
  grade: Grade;
  passed: boolean;
  fileCount: number;
  errorCount: number;
  warnCount: number;
  issues: Issue[];
}

const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/;
const IMG_NO_ALT_RE = /<img\b(?![^>]*\balt=)[^>]*>/;
const ANY_RE = /:\s*any\b/;
const STUB_RE = /not implemented/i;

/** Analyze one source file's text; returns issues with 1-based line numbers. */
export function analyzeSource(code: string, file: string): Issue[] {
  const issues: Issue[] = [];
  const lines = code.split('\n');
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (IMG_NO_ALT_RE.test(raw)) issues.push({ file, line, rule: 'a11y', severity: 'error', message: '<img> is missing an alt attribute' });
    if (STUB_RE.test(raw) && /throw\b/.test(raw)) issues.push({ file, line, rule: 'stub', severity: 'error', message: 'unfilled stub — "not implemented" throw' });
    if (ANY_RE.test(raw)) issues.push({ file, line, rule: 'types', severity: 'warn', message: 'avoid the `any` type' });
    if (/console\.log/.test(raw)) issues.push({ file, line, rule: 'quality', severity: 'warn', message: 'console.log left in code' });
    if (HEX_RE.test(raw)) issues.push({ file, line, rule: 'tokens', severity: 'warn', message: 'hardcoded color — use a design token' });
  });
  return issues;
}

export function gradeIssues(issues: Issue[]): Grade {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  if (errors === 0 && warns === 0) return 'A';
  if (errors === 0 && warns <= 2) return 'B';
  if (errors === 0) return 'C';
  if (errors === 1) return 'D';
  return 'F';
}

const SKIP_DIRS = new Set(['node_modules', 'build', 'dist', '.git']);

function collectFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) return /\.(tsx?|jsx?)$/.test(target) ? [target] : [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...collectFiles(path.join(target, entry.name)));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      out.push(path.join(target, entry.name));
    }
  }
  return out;
}

export function runReview(args: unknown): ReviewResult {
  const { path: target } = (args ?? {}) as { path?: string };
  if (!target || typeof target !== 'string') throw new Error('Missing required argument "path".');
  if (!fs.existsSync(target)) throw new Error(`Path does not exist: ${target}`);

  const files = collectFiles(target);
  const issues: Issue[] = [];
  for (const file of files) {
    issues.push(...analyzeSource(fs.readFileSync(file, 'utf8'), file));
  }
  const grade = gradeIssues(issues);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  return { path: target, grade, passed: errorCount === 0, fileCount: files.length, errorCount, warnCount, issues };
}
