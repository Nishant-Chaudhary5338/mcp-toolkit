// ============================================================================
// Map a component-reviewer ReviewResult -> the shared ui-kit HealthReport,
// so `review` returns the same premium interactive dashboard as legacy-analyzer.
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

type RevSeverity = "error" | "warning" | "info";

interface RevIssue {
  id: string;
  category: string;
  severity: RevSeverity;
  line?: number;
  code?: string;
  message: string;
  suggestion: string;
  fixable: boolean;
  wcag?: string;
}
interface RevSummary {
  component: string;
  file: string;
  linesOfCode: number;
  overallScore: number;
  grade: string;
  totalIssues: number;
  categories: Record<string, number>;
}
export interface ReviewResultLike {
  summary: RevSummary;
  issues: RevIssue[];
  metrics?: { complexity?: number };
  typescriptErrors?: string[];
  testResults?: { passed: number; failed: number };
}

const CAT_NAMES: Record<string, string> = {
  "type-safety": "Type safety",
  "react-patterns": "React patterns",
  accessibility: "Accessibility",
  performance: "Performance",
  "code-quality": "Code quality",
  security: "Security",
  styling: "Styling",
  testing: "Testing",
};
const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

function toSeverity(issue: RevIssue): Severity {
  if (issue.severity === "error") {
    return issue.category === "security" || issue.category === "type-safety" ? "critical" : "high";
  }
  return issue.severity === "warning" ? "medium" : "low";
}

function buildIssues(result: ReviewResultLike): ReportIssue[] {
  const file = result.summary.file;
  return result.issues.map((i) => {
    const severity = toSeverity(i);
    const actions: ReportAction[] = [];
    if (i.fixable) {
      actions.push({
        id: `fix:${i.id}`,
        label: "Fix with component-fixer",
        kind: "tool",
        tool: "component-fixer",
        params: { file, issueId: i.id },
        fallback: `In ${file}: ${i.suggestion}`,
      });
    }
    actions.push({ id: `explain:${i.id}`, label: "Explain", kind: "prompt", prompt: `${i.message} — explain why this matters and how to fix it.` });
    const meta = [
      ...(i.line ? [{ label: "Line", value: String(i.line) }] : []),
      ...(i.code ? [{ label: "Rule", value: i.code }] : []),
      ...(i.wcag ? [{ label: "WCAG", value: i.wcag }] : []),
    ];
    return {
      id: i.id,
      category: i.category,
      severity,
      title: i.message,
      description: i.suggestion,
      file: i.line ? `${path.basename(file)}:${i.line}` : path.basename(file),
      meta: meta.length ? meta : undefined,
      actions,
    };
  });
}

function buildCategories(issues: ReportIssue[], summaryCategories: Record<string, number>): ReportCategory[] {
  const ids = Object.keys(summaryCategories).length ? Object.keys(summaryCategories) : Object.keys(CAT_NAMES);
  return ids.map((id) => {
    const own = issues.filter((i) => i.category === id);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    return {
      id,
      name: CAT_NAMES[id] ?? id,
      score,
      status: scoreToBand(score),
      summary: own.length === 0 ? "No issues detected." : worst.title,
      issueCount: own.length,
    };
  });
}

function buildTopActions(result: ReviewResultLike): ReportAction[] {
  const { summary, issues, typescriptErrors, testResults } = result;
  const actions: ReportAction[] = [];
  const fixable = issues.filter((i) => i.fixable).length;
  if (fixable) {
    actions.push({ id: "top:fix", label: `Auto-fix ${fixable} issue${fixable === 1 ? "" : "s"}`, kind: "tool", tool: "component-fixer", params: { file: summary.file }, fallback: `Fix the auto-fixable issues in ${summary.file}.` });
  }
  if (typescriptErrors?.length) {
    actions.push({ id: "top:ts", label: `Resolve ${typescriptErrors.length} TypeScript error${typescriptErrors.length === 1 ? "" : "s"}`, kind: "prompt", prompt: `Fix these TypeScript errors in ${summary.component}:\n${typescriptErrors.slice(0, 10).join("\n")}` });
  }
  if (testResults && testResults.failed > 0) {
    actions.push({ id: "top:tests", label: `Repair ${testResults.failed} failing test${testResults.failed === 1 ? "" : "s"}`, kind: "tool", tool: "fix-failing-tests", params: { path: summary.file }, fallback: `Fix the failing tests for ${summary.component}.` });
  } else if ((summary.categories.testing ?? 0) > 0) {
    actions.push({ id: "top:gen-tests", label: "Generate missing tests", kind: "tool", tool: "generate-tests", params: { path: summary.file }, fallback: `Generate a Vitest suite for ${summary.component}.` });
  }
  return actions.slice(0, 3);
}

export function toHealthReport(result: ReviewResultLike, generatedAt: string): HealthReport {
  const issues = buildIssues(result);
  const { summary, metrics } = result;
  return {
    meta: {
      title: "Component Review",
      subtitle: `Grade ${summary.grade}`,
      target: summary.component,
      generatedAt,
      tool: "component-reviewer",
    },
    score: summary.overallScore,
    totalIssues: issues.length,
    chips: [
      { label: "File", value: path.basename(summary.file) },
      { label: "Grade", value: summary.grade },
      { label: "LOC", value: String(summary.linesOfCode) },
      ...(metrics?.complexity != null ? [{ label: "Complexity", value: String(metrics.complexity) }] : []),
    ],
    topActions: buildTopActions(result),
    categories: buildCategories(issues, summary.categories),
    issues,
  };
}
