// ============================================================================
// Map a coverage_report result -> the shared ui-kit HealthReport.
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

// ---------------------------------------------------------------------------
// Input shape (mirrors coverage_report success payload)
// ---------------------------------------------------------------------------

interface FileGap {
  export: string;
  type: string;
  missing: Array<{
    category: string;
    description: string;
    severity: "high" | "medium" | "low";
    suggestion: string;
  }>;
}

interface FileReport {
  file: string;
  testFile: string | null;
  exports: number;
  hasTests: boolean;
  coverage: number;
  gaps: FileGap[];
}

export interface CoverageResult {
  overall: {
    totalFiles: number;
    filesWithTests: number;
    totalExports: number;
    testedExports: number;
    exportCoveragePercent: number;
    edgeCaseCoveragePercent: number;
    grade: string;
  };
  files: FileReport[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

const CAT_NAMES: Record<string, string> = {
  "uncovered-functions": "Uncovered functions",
  "uncovered-branches": "Uncovered branches",
  "edge-cases": "Edge cases",
  "files-without-tests": "Files without tests",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gapSeverity(gapSev: "high" | "medium" | "low", type: string): Severity {
  if (type === "function" || type === "hook" || type === "class") return gapSev === "high" ? "high" : gapSev === "medium" ? "medium" : "low";
  return gapSev === "high" ? "medium" : "low";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function buildIssues(files: FileReport[]): ReportIssue[] {
  const issues: ReportIssue[] = [];
  let idx = 0;

  for (const f of files) {
    if (!f.hasTests) {
      issues.push({
        id: `no-test-${idx++}`,
        category: "files-without-tests",
        severity: "high",
        title: `No test file for ${path.basename(f.file)}`,
        description: "This file has no co-located test file.",
        file: path.basename(f.file),
        actions: [
          {
            id: `gen:${idx}`,
            label: "Generate tests",
            kind: "tool",
            tool: "generate-tests",
            params: { path: f.file },
            fallback: `Generate a Vitest suite for ${path.basename(f.file)}.`,
          },
        ],
      });
    }

    for (const gap of f.gaps) {
      for (const missing of gap.missing) {
        const sev = gapSeverity(missing.severity, gap.type);
        const catId =
          missing.category === "null-input" || missing.category === "empty-input" || missing.category === "boundary-values" || missing.category === "type-coercion" || missing.category === "async-error"
            ? "uncovered-branches"
            : "edge-cases";

        issues.push({
          id: `gap-${idx++}`,
          category: catId,
          severity: sev,
          title: `${gap.export}: ${missing.description}`,
          description: missing.suggestion,
          file: path.basename(f.file),
          meta: [
            { label: "Export", value: gap.export },
            { label: "Type", value: gap.type },
            { label: "Pattern", value: missing.category },
          ],
          actions: [
            {
              id: `gen:gap:${idx}`,
              label: "Generate edge case tests",
              kind: "tool",
              tool: "generate-tests",
              params: { path: f.file, focus: gap.export },
              fallback: `Add a test for ${gap.export} covering "${missing.description}" in ${path.basename(f.file)}.`,
            },
          ],
        });
      }
    }
  }

  // Uncovered-function issues: files that have tests but still have gaps
  for (const f of files) {
    if (f.hasTests && f.gaps.length > 0) {
      for (const gap of f.gaps) {
        issues.push({
          id: `uncovered-${idx++}`,
          category: "uncovered-functions",
          severity: "high",
          title: `${gap.export} (${gap.type}) has no direct test`,
          description: `The export "${gap.export}" in ${path.basename(f.file)} is not covered by any describe block.`,
          file: path.basename(f.file),
          meta: [{ label: "Type", value: gap.type }],
          actions: [
            {
              id: `gen:unc:${idx}`,
              label: "Generate tests",
              kind: "tool",
              tool: "generate-tests",
              params: { path: f.file, focus: gap.export },
              fallback: `Write tests for "${gap.export}" in ${path.basename(f.file)}.`,
            },
          ],
        });
      }
    }
  }

  return issues;
}

function buildCategories(issues: ReportIssue[]): ReportCategory[] {
  return Object.entries(CAT_NAMES).map(([id, name]) => {
    const own = issues.filter((i) => i.category === id);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = clamp(100 - penalty);
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    return {
      id,
      name,
      score,
      status: scoreToBand(score),
      summary: own.length === 0 ? "No gaps detected." : worst.title,
      issueCount: own.length,
    };
  });
}

function buildTopActions(result: CoverageResult): ReportAction[] {
  const { overall } = result;
  const actions: ReportAction[] = [];

  const untestedFiles = result.files.filter((f) => !f.hasTests);
  if (untestedFiles.length > 0) {
    actions.push({
      id: "top:gen-tests",
      label: `Generate tests for ${untestedFiles.length} untested file${untestedFiles.length === 1 ? "" : "s"}`,
      kind: "tool",
      tool: "generate-tests",
      params: { path: untestedFiles[0].file },
      fallback: `Create Vitest suites for the ${untestedFiles.length} files missing test coverage.`,
    });
  }

  const uncoveredCount = overall.totalExports - overall.testedExports;
  if (uncoveredCount > 0) {
    actions.push({
      id: "top:edge-cases",
      label: `Add edge case tests for ${uncoveredCount} uncovered export${uncoveredCount === 1 ? "" : "s"}`,
      kind: "prompt",
      prompt: `The test coverage report shows ${uncoveredCount} uncovered exports. Write targeted Vitest tests for each, covering null/undefined inputs, error paths, and boundary values.`,
      fallback: "Expand test suites to cover uncovered exports.",
    });
  }

  actions.push({
    id: "top:coverage-report",
    label: "Re-run coverage analysis",
    kind: "tool",
    tool: "test-gap-analyzer",
    params: {},
    fallback: "Run the test-gap-analyzer again after adding tests.",
  });

  return actions.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function toHealthReport(result: CoverageResult, generatedAt: string): HealthReport {
  const { overall, files } = result;
  const issues = buildIssues(files);
  const categories = buildCategories(issues);
  const targetBasename = files.length > 0 ? path.basename(path.dirname(files[0].file)) : "project";

  return {
    meta: {
      title: "Test Coverage",
      subtitle: `Grade ${overall.grade}`,
      target: targetBasename,
      generatedAt,
      tool: "test-gap-analyzer",
    },
    score: overall.exportCoveragePercent,
    totalIssues: issues.length,
    chips: [
      { label: "Export coverage", value: `${overall.exportCoveragePercent}%` },
      { label: "Edge case coverage", value: `${overall.edgeCaseCoveragePercent}%` },
      { label: "Files with tests", value: `${overall.filesWithTests}/${overall.totalFiles}` },
      { label: "Grade", value: overall.grade },
    ],
    categories,
    issues,
    topActions: buildTopActions(result),
  };
}
