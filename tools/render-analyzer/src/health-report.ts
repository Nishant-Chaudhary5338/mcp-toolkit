import * as path from "path";
import {
  HealthReport,
  ReportCategory,
  ReportIssue,
  ReportAction,
  Severity,
  scoreToBand,
} from "@mcp-showcase/ui-kit";

// ---------------------------------------------------------------------------
// Input shape (mirrors what handleDetectRerenders returns inside success())
// ---------------------------------------------------------------------------

interface RenderIssueLike {
  type: string;
  component: string;
  file: string;
  line: number;
  description: string;
  severity: "high" | "medium" | "low";
  fix: string;
}

interface RenderProfileLike {
  name: string;
  file: string;
  hasMemo: boolean;
  hasUseMemo: boolean;
  hasUseCallback: boolean;
  propsCount: number;
  inlineObjects: number;
  inlineFunctions: number;
  issues: RenderIssueLike[];
}

interface DetectRerendersSummary {
  totalComponents: number;
  totalIssues: number;
  componentsWithIssues: number;
}

export interface DetectRerendersResult {
  summary: DetectRerendersSummary;
  profiles: RenderProfileLike[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

const ISSUE_TYPE_TO_CATEGORY: Record<string, string> = {
  "inline-object": "inline-props",
  "inline-array": "inline-props",
  "inline-function": "inline-props",
  "missing-memo": "memoization",
  "missing-usememo": "memoization",
  "missing-usecallback": "memoization",
  "new-object-prop": "inline-props",
  "context-value": "rerenders",
};

const CATEGORY_NAMES: Record<string, string> = {
  rerenders: "Re-renders",
  memoization: "Memoization",
  "inline-props": "Inline Props",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSeverity(raw: "high" | "medium" | "low"): Severity {
  return raw; // render-analyzer uses 'high'|'medium'|'low' directly
}

function buildIssues(profiles: RenderProfileLike[]): ReportIssue[] {
  const issues: ReportIssue[] = [];
  let counter = 0;

  for (const profile of profiles) {
    for (const raw of profile.issues) {
      const severity = toSeverity(raw.severity);
      const category = ISSUE_TYPE_TO_CATEGORY[raw.type] ?? "rerenders";
      const id = `RA-${String(++counter).padStart(3, "0")}`;
      const actions: ReportAction[] = [
        {
          id: `fix:${id}`,
          label: "Fix with component-fixer",
          kind: "tool",
          tool: "component-fixer",
          params: { file: raw.file, component: raw.component },
          fallback: raw.fix,
        },
        {
          id: `explain:${id}`,
          label: "Explain this issue",
          kind: "prompt",
          prompt: `${raw.description} — explain why this matters in React and show a concrete fix.`,
        },
      ];
      issues.push({
        id,
        category,
        severity,
        title: `${raw.component}: ${raw.type.replace(/-/g, " ")}`,
        description: raw.description,
        file: `${path.basename(raw.file)}:${raw.line}`,
        meta: [
          { label: "Component", value: raw.component },
          { label: "Type", value: raw.type },
        ],
        actions,
      });
    }
  }

  return issues;
}

function buildCategories(issues: ReportIssue[]): ReportCategory[] {
  return Object.entries(CATEGORY_NAMES).map(([id, name]) => {
    const own = issues.filter((i) => i.category === id);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    return {
      id,
      name,
      score,
      status: scoreToBand(score),
      summary: own.length === 0 ? "No issues detected." : worst.title,
      issueCount: own.length,
    };
  });
}

function buildTopActions(result: DetectRerendersResult): ReportAction[] {
  const { summary } = result;
  const actions: ReportAction[] = [];

  if (summary.totalIssues > 0) {
    actions.push({
      id: "top:fix-all",
      label: `Auto-fix ${summary.totalIssues} render issue${summary.totalIssues === 1 ? "" : "s"}`,
      kind: "tool",
      tool: "component-fixer",
      params: {},
      fallback: "Run component-fixer to resolve the detected render issues.",
    });
  }

  actions.push({
    id: "top:memo-audit",
    label: "Run memoization audit",
    kind: "prompt",
    prompt: "Which components in this codebase would benefit most from React.memo, useMemo, or useCallback? Prioritise by render frequency.",
  });

  actions.push({
    id: "top:perf-profile",
    label: "Profile with React DevTools",
    kind: "prompt",
    prompt: "How do I use React DevTools Profiler to find which components re-render unnecessarily?",
  });

  return actions.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function toHealthReport(result: DetectRerendersResult, generatedAt: string): HealthReport {
  const issues = buildIssues(result.profiles);
  const { summary } = result;

  const penalty = issues.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const targetFile = result.profiles[0]?.file ?? "unknown";
  const target = path.basename(path.dirname(targetFile)) || path.basename(targetFile);

  return {
    meta: {
      title: "Render Analysis",
      target,
      generatedAt,
      tool: "render-analyzer",
    },
    score,
    totalIssues: summary.totalIssues,
    chips: [
      { label: "Components", value: String(summary.totalComponents) },
      { label: "With Issues", value: String(summary.componentsWithIssues) },
      { label: "Total Issues", value: String(summary.totalIssues) },
      { label: "Score", value: String(score) },
    ],
    categories: buildCategories(issues),
    issues,
    topActions: buildTopActions(result),
  };
}
