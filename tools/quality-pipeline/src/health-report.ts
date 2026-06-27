// ============================================================================
// Map a quality-pipeline PipelineResult -> the shared ui-kit HealthReport,
// so `run_full_pipeline` returns the same premium interactive dashboard as
// other MCP tools.
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
import type { PipelineStage } from "./utils.js";

// ============================================================================
// LOCAL INPUT CONTRACT
// ============================================================================

export interface PipelineResultLike {
  overallStatus: "pass" | "fail" | "warn";
  grade: string;
  totalDuration: number;
  stages: PipelineStage[];
  timestamp: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GRADE_TO_SCORE: Record<string, number> = {
  "A+": 97,
  A: 90,
  B: 78,
  C: 62,
  D: 48,
  F: 30,
};

// Matches the stage names used by quality-pipeline index.ts
const STAGE_IDS: Record<string, string> = {
  Tests: "tests",
  "Type Safety": "types",
  Performance: "performance",
  Accessibility: "accessibility",
  "Design Tokens": "design-tokens",
};

const STAGE_FIXERS: Record<string, string> = {
  tests: "fix-failing-tests",
  types: "typescript-enforcer",
  performance: "performance-audit",
  accessibility: "accessibility-checker",
  "design-tokens": "enforce-design-tokens",
};

const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

// ============================================================================
// HELPERS
// ============================================================================

function stageScore(stage: PipelineStage): number {
  if (stage.status === "pass") return 95;
  if (stage.status === "warn") return 62;
  if (stage.status === "fail") return 30;
  return 70; // skip — neutral
}

function stageToIssues(stage: PipelineStage): ReportIssue[] {
  if (stage.status === "pass" || stage.status === "skip") return [];
  const id = STAGE_IDS[stage.name] ?? stage.name.toLowerCase().replace(/\s+/g, "-");
  const severity: Severity = stage.status === "fail" ? "high" : "medium";
  return [
    {
      id: `${id}-summary`,
      category: id,
      severity,
      title: stage.summary,
      description: `Stage "${stage.name}" completed with status: ${stage.status}. Duration: ${stage.duration}ms.`,
    },
  ];
}

function buildCategories(stages: PipelineStage[], issues: ReportIssue[]): ReportCategory[] {
  return stages.map((stage) => {
    const id = STAGE_IDS[stage.name] ?? stage.name.toLowerCase().replace(/\s+/g, "-");
    const own = issues.filter((i) => i.category === id);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, stageScore(stage) - penalty));
    return {
      id,
      name: stage.name,
      score,
      status: stage.status === "skip" ? "good" : scoreToBand(score),
      summary: stage.summary,
      issueCount: own.length,
      details: [{ label: "Duration", value: `${stage.duration}ms` }],
    };
  });
}

function buildTopActions(result: PipelineResultLike): ReportAction[] {
  const actions: ReportAction[] = [];
  const failedStages = result.stages.filter((s) => s.status === "fail");
  const warnedStages = result.stages.filter((s) => s.status === "warn");

  for (const stage of [...failedStages, ...warnedStages].slice(0, 2)) {
    const id = STAGE_IDS[stage.name] ?? stage.name.toLowerCase().replace(/\s+/g, "-");
    const fixer = STAGE_FIXERS[id];
    if (fixer) {
      actions.push({
        id: `fix:${id}`,
        label: `Fix ${stage.name} issues`,
        kind: "tool",
        tool: fixer,
        fallback: `Fix the ${stage.name} issues found by quality-pipeline.`,
      });
    }
  }

  if (actions.length < 3) {
    actions.push({
      id: "generate-tests",
      label: "Generate missing tests",
      kind: "tool",
      tool: "generate-tests",
      fallback: "Generate a Vitest suite to improve test coverage.",
    });
  }

  return actions.slice(0, 3);
}

// ============================================================================
// EXPORT
// ============================================================================

export function toHealthReport(result: PipelineResultLike, generatedAt: string): HealthReport {
  const allIssues: ReportIssue[] = result.stages.flatMap(stageToIssues);
  const categories = buildCategories(result.stages, allIssues);
  const score = GRADE_TO_SCORE[result.grade] ?? 62;
  const activeStages = result.stages.filter((s) => s.status !== "skip");
  const passedCount = activeStages.filter((s) => s.status === "pass").length;

  return {
    meta: {
      title: "Quality Pipeline",
      subtitle: `Grade ${result.grade}`,
      target: path.basename(process.cwd()),
      generatedAt,
      tool: "quality-pipeline",
    },
    score,
    totalIssues: allIssues.length,
    chips: [
      { label: "Grade", value: result.grade },
      { label: "Status", value: result.overallStatus },
      { label: "Stages passed", value: `${passedCount}/${activeStages.length}` },
      { label: "Duration", value: `${result.totalDuration}ms` },
    ],
    categories,
    issues: allIssues,
    topActions: buildTopActions(result),
  };
}
