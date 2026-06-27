// ============================================================================
// Map a performance-audit AuditResult -> the shared ui-kit HealthReport,
// so `audit_bundle` returns the same premium interactive dashboard.
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

// ---- Input shape (mirrors what handleAuditBundle returns) ------------------

interface PerfIssue {
  type: "heavy-import" | "large-bundle" | "unnecessary-rerender" | "unoptimized-image" | "sync-operation" | "memory-leak" | "deep-nesting";
  file: string;
  line: number;
  description: string;
  severity: "high" | "medium" | "low";
  impact: string;
  fix: string;
}

interface AuditSummary {
  totalIssues: number;
  high: number;
  medium: number;
  low: number;
  byType: {
    heavyImports: number;
    memoryLeaks: number;
    unoptimizedImages: number;
    syncOperations: number;
    deepNesting: number;
  };
}

export interface AuditResultLike {
  summary: AuditSummary;
  issues: PerfIssue[];
}

// ---- Constants ------------------------------------------------------------

const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

const CAT_IDS = ["memory", "heavy-imports", "images", "nesting"] as const;
type CatId = (typeof CAT_IDS)[number];

const CAT_NAMES: Record<CatId, string> = {
  memory: "Memory",
  "heavy-imports": "Heavy imports",
  images: "Images",
  nesting: "Nesting",
};

// ---- Severity mapping ------------------------------------------------------

function toSeverity(issue: PerfIssue): Severity {
  if (issue.type === "memory-leak" || issue.type === "sync-operation") {
    return issue.severity === "high" ? "critical" : "high";
  }
  if (issue.type === "heavy-import") return "high";
  if (issue.type === "unoptimized-image") return "medium";
  if (issue.type === "deep-nesting") return issue.severity === "medium" ? "medium" : "low";
  // large-bundle / unnecessary-rerender / fallback
  return issue.severity === "high" ? "high" : issue.severity === "medium" ? "medium" : "low";
}

function toCatId(type: PerfIssue["type"]): CatId {
  if (type === "memory-leak" || type === "sync-operation") return "memory";
  if (type === "heavy-import" || type === "large-bundle") return "heavy-imports";
  if (type === "unoptimized-image") return "images";
  return "nesting";
}

// ---- Issue building --------------------------------------------------------

function buildIssues(raw: PerfIssue[]): ReportIssue[] {
  return raw.map((r, idx) => {
    const severity = toSeverity(r);
    const catId = toCatId(r.type);
    const actions: ReportAction[] = [
      {
        id: `render:${idx}`,
        label: "Profile with render-analyzer",
        kind: "tool",
        tool: "render-analyzer",
        params: { file: r.file },
        fallback: `Open ${path.basename(r.file)} in render-analyzer to profile performance.`,
      },
      {
        id: `explain:${idx}`,
        label: "Explain this issue",
        kind: "prompt",
        prompt: `${r.description} — explain why this hurts performance and how to fix it in detail.`,
      },
    ];
    return {
      id: `perf-${String(idx).padStart(3, "0")}`,
      category: catId,
      severity,
      title: r.description,
      description: `${r.impact} Fix: ${r.fix}`,
      file: `${path.basename(r.file)}:${r.line}`,
      meta: [{ label: "Type", value: r.type }],
      actions,
    };
  });
}

// ---- Category building -----------------------------------------------------

function buildCategories(issues: ReportIssue[]): ReportCategory[] {
  return CAT_IDS.map((id) => {
    const own = issues.filter((i) => i.category === id);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    return {
      id,
      name: CAT_NAMES[id],
      score,
      status: scoreToBand(score),
      summary: own.length === 0 ? "No issues detected." : worst.title,
      issueCount: own.length,
    };
  });
}

// ---- Top actions -----------------------------------------------------------

function buildTopActions(result: AuditResultLike): ReportAction[] {
  const actions: ReportAction[] = [];
  const { summary } = result;

  if (summary.byType.memoryLeaks > 0) {
    actions.push({
      id: "top:memory",
      label: `Fix ${summary.byType.memoryLeaks} memory leak${summary.byType.memoryLeaks === 1 ? "" : "s"}`,
      kind: "prompt",
      prompt: `Find and fix all useEffect memory leaks (missing clearInterval/clearTimeout/removeEventListener) in this project.`,
    });
  }

  if (summary.byType.heavyImports > 0) {
    actions.push({
      id: "top:imports",
      label: `Optimise ${summary.byType.heavyImports} heavy import${summary.byType.heavyImports === 1 ? "" : "s"}`,
      kind: "tool",
      tool: "refactor-executor",
      params: { task: "Replace heavy library imports with tree-shakeable alternatives." },
      fallback: "Replace moment/lodash with dayjs/lodash-es and enable tree-shaking.",
    });
  }

  actions.push({
    id: "top:profile",
    label: "Run render profiler",
    kind: "tool",
    tool: "render-analyzer",
    params: {},
    fallback: "Run render-analyzer to identify unnecessary re-renders.",
  });

  return actions.slice(0, 3);
}

// ---- Headline score --------------------------------------------------------

// Derive from the MAPPED issue severities so the headline score is consistent
// with the per-category scores and the severities shown in the table.
function computeScore(issues: ReportIssue[]): number {
  const penalty = issues.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

// ---- Public export ---------------------------------------------------------

export function toHealthReport(result: AuditResultLike, generatedAt: string): HealthReport {
  const issues = buildIssues(result.issues);
  const { summary } = result;
  return {
    meta: {
      title: "Performance Audit",
      target: "Project",
      generatedAt,
      tool: "performance-audit",
    },
    score: computeScore(issues),
    totalIssues: issues.length,
    chips: [
      { label: "Issues", value: String(summary.totalIssues) },
      { label: "High", value: String(summary.high) },
      { label: "Medium", value: String(summary.medium) },
      { label: "Low", value: String(summary.low) },
    ],
    topActions: buildTopActions(result),
    categories: buildCategories(issues),
    issues,
  };
}
