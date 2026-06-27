// ============================================================================
// Map a typescript-enforcer DirectoryScanResult -> the shared ui-kit HealthReport.
// ============================================================================

import * as path from "path";
import {
  HealthReport,
  ReportCategory,
  ReportIssue,
  ReportAction,
  Severity,
  scoreToBand,
} from "@mcp-showcase/ui-kit";
import type { RuleName } from "./types.js";

// Local structural interface — mirrors what scan_directory + metadata returns.
interface ScanViolation {
  rule: RuleName;
  severity: "error" | "warning" | "info";
  line: number;
  column: number;
  current: string;
  suggestion: string;
  fix: string;
  why: string;
}
interface FileScanResult {
  file: string;
  violations: ScanViolation[];
  score: number; // 0-10
}
interface DirectorySummary {
  errors: number;
  warnings: number;
  infos: number;
}
export interface ScanResultLike {
  directory: string;
  filesScanned: number;
  totalViolations: number;
  results: FileScanResult[];
  byRule: Partial<Record<RuleName, number>>;
  summary: DirectorySummary;
}

const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

const RULE_META: Record<RuleName, { name: string; severity: Severity }> = {
  "no-any":              { name: "No `any` types",          severity: "high" },
  "generics":            { name: "Generics usage",           severity: "medium" },
  "utility-types":       { name: "Utility types",            severity: "low" },
  "modifiers":           { name: "Readonly / const modifiers", severity: "low" },
  "type-guards":         { name: "Type guards",              severity: "medium" },
  "discriminated-unions":{ name: "Discriminated unions",     severity: "medium" },
  "branded-types":       { name: "Branded types",            severity: "low" },
};

function toSeverity(ruleName: RuleName, nativeSeverity: "error" | "warning" | "info"): Severity {
  if (nativeSeverity === "error") {
    return ruleName === "no-any" ? "high" : "high";
  }
  if (nativeSeverity === "warning") return "medium";
  return RULE_META[ruleName]?.severity ?? "low";
}

function buildIssues(results: FileScanResult[]): ReportIssue[] {
  const issues: ReportIssue[] = [];
  let counter = 0;
  for (const fileResult of results) {
    for (const v of fileResult.violations) {
      const severity = toSeverity(v.rule, v.severity);
      const actions: ReportAction[] = [
        {
          id: `modernize:${counter}`,
          label: "Fix with code-modernizer",
          kind: "tool",
          tool: "code-modernizer",
          params: { file: fileResult.file, rule: v.rule },
          fallback: `In ${path.basename(fileResult.file)} line ${v.line}: ${v.suggestion}`,
        },
        {
          id: `explain:${counter}`,
          label: "Explain",
          kind: "prompt",
          prompt: `${v.why} — why does this matter and how should I fix it?`,
        },
      ];
      issues.push({
        id: `TS-${String(++counter).padStart(4, "0")}`,
        category: v.rule,
        severity,
        title: v.why,
        description: v.suggestion,
        file: `${path.basename(fileResult.file)}:${v.line}`,
        meta: [
          { label: "Rule", value: v.rule },
          { label: "Current", value: v.current.slice(0, 80) },
        ],
        actions,
      });
    }
  }
  return issues;
}

function buildCategories(issues: ReportIssue[]): ReportCategory[] {
  const rules: RuleName[] = [
    "no-any", "generics", "utility-types", "modifiers",
    "type-guards", "discriminated-unions", "branded-types",
  ];
  return rules.map((rule) => {
    const own = issues.filter((i) => i.category === rule);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    return {
      id: rule,
      name: RULE_META[rule].name,
      score,
      status: scoreToBand(score),
      summary: own.length === 0 ? "No issues detected." : worst.title,
      issueCount: own.length,
    };
  });
}

function buildTopActions(result: ScanResultLike, issues: ReportIssue[]): ReportAction[] {
  const actions: ReportAction[] = [];
  const anyCount = result.byRule["no-any"] ?? 0;
  if (anyCount > 0) {
    actions.push({
      id: "top:any",
      label: `Replace ${anyCount} \`any\` type${anyCount === 1 ? "" : "s"} with proper types`,
      kind: "prompt",
      prompt: `There are ${anyCount} \`any\` usages in ${path.basename(result.directory)}. Suggest concrete replacements for each.`,
    });
  }
  actions.push({
    id: "top:modernize",
    label: "Run code-modernizer on this directory",
    kind: "tool",
    tool: "code-modernizer",
    params: { path: result.directory },
    fallback: `Run code-modernizer on ${result.directory} to modernize TypeScript patterns.`,
  });
  if (result.totalViolations > 0) {
    actions.push({
      id: "top:enforcer",
      label: "Re-scan after fixes",
      kind: "prompt",
      prompt: `After fixing violations in ${path.basename(result.directory)}, run typescript-enforcer scan_directory again to verify.`,
    });
  }
  return actions.slice(0, 3);
}

function aggregateScore(results: FileScanResult[]): number {
  if (results.length === 0) return 100;
  const avg = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  return Math.max(0, Math.min(100, Math.round(avg * 10)));
}

export function toHealthReport(result: ScanResultLike, generatedAt: string): HealthReport {
  const issues = buildIssues(result.results);
  const categories = buildCategories(issues);
  const score = aggregateScore(result.results);
  const anyCount = result.byRule["no-any"] ?? 0;

  return {
    meta: {
      title: "TypeScript Audit",
      target: path.basename(result.directory),
      generatedAt,
      tool: "typescript-enforcer",
    },
    score,
    totalIssues: result.totalViolations,
    chips: [
      { label: "Score", value: `${score}/100` },
      { label: "Files scanned", value: String(result.filesScanned) },
      { label: "`any` count", value: String(anyCount) },
      { label: "Total violations", value: String(result.totalViolations) },
    ],
    categories,
    issues,
    topActions: buildTopActions(result, issues),
  };
}
