export type RuleName =
  | 'no-any'
  | 'generics'
  | 'utility-types'
  | 'modifiers'
  | 'type-guards'
  | 'discriminated-unions'
  | 'branded-types';

export type Severity = 'error' | 'warning' | 'info';

export interface Violation {
  rule: RuleName;
  severity: Severity;
  line: number;
  column: number;
  current: string;
  suggestion: string;
  fix: string;
  why: string;
}

export interface FileScanResult {
  file: string;
  violations: Violation[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    total: number;
  };
  score: number; // 0-10, 10 = no violations
}

export interface DirectoryScanResult {
  directory: string;
  filesScanned: number;
  totalViolations: number;
  results: FileScanResult[];
  worstFiles: { file: string; score: number; violations: number }[];
  bestFiles: { file: string; score: number; violations: number }[];
  byRule: Record<RuleName, number>;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface ScanOptions {
  rules?: RuleName[];
  severity?: Severity;
  ignore?: string[];
  maxFiles?: number;
}

export interface RuleCheckResult {
  violations: Violation[];
}
