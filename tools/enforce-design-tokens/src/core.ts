// enforce-design-tokens CORE — pure logic (no MCP transport).
//
// Scan React/TS/CSS for hardcoded design values (colors, spacing, font sizes,
// radii, shadows, z-index) that should use design tokens, suggest token
// replacements, and grade a path A–F. Ported from my-turborepo; restructured
// core-first so review-gate / workflow-runner can compose it.

import * as fs from 'fs';
import * as path from 'path';

export type ViolationType =
  | 'hardcoded-color' | 'hardcoded-spacing' | 'hardcoded-font-size'
  | 'hardcoded-font-family' | 'hardcoded-border-radius' | 'hardcoded-shadow'
  | 'hardcoded-z-index';

export type Severity = 'high' | 'medium' | 'low';

export interface TokenViolation {
  type: ViolationType;
  file: string;
  line: number;
  value: string;
  tokenSuggestion: string;
  severity: Severity;
}

export const COLOR_TOKENS: Record<string, string> = {
  '#ffffff': 'var(--color-white) or bg-white', '#fff': 'var(--color-white) or bg-white',
  '#000000': 'var(--color-black) or bg-black', '#000': 'var(--color-black) or bg-black',
  '#f5f5f5': 'bg-gray-50', '#e5e5e5': 'bg-gray-200', '#d4d4d4': 'bg-gray-300', '#a3a3a3': 'text-gray-400',
  '#737373': 'text-gray-500', '#525252': 'text-gray-600', '#404040': 'text-gray-700', '#262626': 'bg-gray-800', '#171717': 'bg-gray-900',
  '#ef4444': 'text-red-500', '#dc2626': 'text-red-600', '#f97316': 'text-orange-500', '#eab308': 'text-yellow-500',
  '#22c55e': 'text-green-500', '#16a34a': 'text-green-600', '#3b82f6': 'text-blue-500', '#2563eb': 'text-blue-600',
  '#8b5cf6': 'text-violet-500', '#a855f7': 'text-purple-500', '#ec4899': 'text-pink-500',
};

const SPACING_TOKENS: Record<string, string> = {
  '4px': 'p-1 / gap-1', '8px': 'p-2 / gap-2', '12px': 'p-3 / gap-3', '16px': 'p-4 / gap-4', '20px': 'p-5 / gap-5',
  '24px': 'p-6 / gap-6', '32px': 'p-8 / gap-8', '40px': 'p-10 / gap-10', '48px': 'p-12 / gap-12', '64px': 'p-16 / gap-16',
};

const BORDER_RADIUS_TOKENS: Record<string, string> = {
  '9999px': 'rounded-full', '16px': 'rounded-2xl', '12px': 'rounded-xl', '8px': 'rounded-lg', '6px': 'rounded-md', '2px': 'rounded-sm',
};

const SKIP_DIRS = new Set(['node_modules', 'build', 'dist', '.next', '__tests__', 'tokens', '.git']);
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css'];

/** Analyze file text for hardcoded design values. Pure — takes content, not a path. */
export function analyzeContent(content: string, filePath: string): TokenViolation[] {
  const violations: TokenViolation[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const t = line.trim();
    if (t.startsWith('import ') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) continue;
    if (line.includes('tokens') || line.includes('--color-')) {
      // still allow non-color checks below; only skip color when token-defining
    }

    for (const match of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const hex = match[0].toLowerCase();
      if (line.includes('--color-') || line.includes('tokens')) continue;
      const token = COLOR_TOKENS[hex];
      if (token) violations.push({ type: 'hardcoded-color', file: filePath, line: i + 1, value: match[0], tokenSuggestion: token, severity: 'high' });
      else if (hex.length >= 6) violations.push({ type: 'hardcoded-color', file: filePath, line: i + 1, value: match[0], tokenSuggestion: `Define a design token for ${match[0]}`, severity: 'medium' });
    }

    for (const match of line.matchAll(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g)) {
      if (!line.includes('--color-') && !line.includes('tokens')) {
        violations.push({ type: 'hardcoded-color', file: filePath, line: i + 1, value: `${match[0]}...)`, tokenSuggestion: 'Use a design token or CSS variable', severity: 'medium' });
      }
    }

    for (const [value, token] of Object.entries(SPACING_TOKENS)) {
      const regex = new RegExp(`(?<!\\d)${value}(?!\\d)`, 'g');
      if (regex.test(line) && !line.includes('--spacing-') && !line.includes('tokens')) {
        violations.push({ type: 'hardcoded-spacing', file: filePath, line: i + 1, value, tokenSuggestion: token, severity: 'medium' });
      }
    }

    for (const [value, token] of Object.entries(BORDER_RADIUS_TOKENS)) {
      if (line.includes(value) && !line.includes('--radius') && !line.includes('tokens')) {
        violations.push({ type: 'hardcoded-border-radius', file: filePath, line: i + 1, value, tokenSuggestion: token, severity: 'medium' });
      }
    }

    if (/font-family:\s*['"]/.test(line) && !line.includes('var(--')) {
      violations.push({ type: 'hardcoded-font-family', file: filePath, line: i + 1, value: line.match(/font-family:\s*([^;]+)/)?.[1]?.trim() ?? 'unknown', tokenSuggestion: 'Use var(--font-family-sans) or font-sans', severity: 'high' });
    }
    if (/z-index:\s*\d+/.test(line) && !line.includes('var(--z')) {
      violations.push({ type: 'hardcoded-z-index', file: filePath, line: i + 1, value: line.match(/z-index:\s*(\d+)/)?.[1] ?? 'unknown', tokenSuggestion: 'Use z-0…z-50 tokens', severity: 'medium' });
    }
    if (/box-shadow:\s*\d/.test(line) && !line.includes('var(--shadow')) {
      violations.push({ type: 'hardcoded-shadow', file: filePath, line: i + 1, value: line.match(/box-shadow:\s*([^;]+)/)?.[1]?.trim().slice(0, 50) ?? 'unknown', tokenSuggestion: 'Use shadow-sm…shadow-xl tokens', severity: 'medium' });
    }
  }
  return violations;
}

function scanDirectory(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...scanDirectory(full));
    } else if (EXTS.some((e) => entry.name.endsWith(e)) && !/\.(test|spec|stories)\./.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/** Walk a file or directory and collect all violations. */
export function scanPath(target: string): TokenViolation[] {
  if (!fs.existsSync(target)) throw new Error(`Path does not exist: ${target}`);
  const files = fs.statSync(target).isDirectory() ? scanDirectory(target) : [target];
  const violations: TokenViolation[] = [];
  for (const file of files) violations.push(...analyzeContent(fs.readFileSync(file, 'utf8'), file));
  return violations;
}

const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function filterBySeverity(violations: TokenViolation[], severity: string): TokenViolation[] {
  if (severity === 'all') return violations;
  const min = SEV_ORDER[severity as Severity] ?? 2;
  return violations.filter((v) => SEV_ORDER[v.severity] <= min);
}

export function gradeViolations(violations: TokenViolation[]): 'A' | 'B' | 'C' | 'D' | 'F' {
  const n = violations.length;
  if (n === 0) return 'A';
  if (n <= 5) return 'B';
  if (n <= 15) return 'C';
  if (n <= 30) return 'D';
  return 'F';
}
