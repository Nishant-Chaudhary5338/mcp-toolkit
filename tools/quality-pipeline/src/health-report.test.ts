import { describe, it, expect } from "vitest";
import { toHealthReport, type PipelineResultLike } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const PASS_STAGE = { name: "Tests", status: "pass" as const, duration: 120, summary: "3 passed, 0 failed", details: {} };
const FAIL_STAGE = { name: "Type Safety", status: "fail" as const, duration: 800, summary: "4 TypeScript errors across 2 files", details: {} };
const WARN_STAGE = { name: "Performance", status: "warn" as const, duration: 200, summary: "0 critical issues, 7 warnings across 12 files", details: {} };
const SKIP_STAGE = { name: "Accessibility", status: "skip" as const, duration: 0, summary: "Skipped", details: {} };
const PASS_STAGE2 = { name: "Design Tokens", status: "pass" as const, duration: 90, summary: "2 hardcoded values — 1 colors, 0 spacing, 0 fonts", details: {} };

const RESULT: PipelineResultLike = {
  overallStatus: "fail",
  grade: "D",
  totalDuration: 1210,
  stages: [PASS_STAGE, FAIL_STAGE, WARN_STAGE, SKIP_STAGE, PASS_STAGE2],
  timestamp: "2026-06-27T10:00:00.000Z",
};

describe("quality-pipeline toHealthReport", () => {
  const report = toHealthReport(RESULT, "2026-06-27");

  it("maps grade D to score 48", () => {
    expect(report.score).toBe(48);
  });

  it("sets meta fields correctly", () => {
    expect(report.meta.title).toBe("Quality Pipeline");
    expect(report.meta.tool).toBe("quality-pipeline");
    expect(report.meta.generatedAt).toBe("2026-06-27");
    expect(report.meta.subtitle).toBe("Grade D");
  });

  it("includes grade and status chips", () => {
    const chip = report.chips?.find((c) => c.label === "Grade");
    expect(chip?.value).toBe("D");
    expect(report.chips?.some((c) => c.label === "Status" && c.value === "fail")).toBe(true);
  });

  it("creates one category per stage", () => {
    expect(report.categories).toHaveLength(5);
    const ids = report.categories.map((c) => c.id);
    expect(ids).toContain("tests");
    expect(ids).toContain("types");
    expect(ids).toContain("performance");
    expect(ids).toContain("accessibility");
    expect(ids).toContain("design-tokens");
  });

  it("maps fail stage to a high-severity issue", () => {
    const typeIssue = report.issues.find((i) => i.category === "types");
    expect(typeIssue).toBeDefined();
    expect(typeIssue?.severity).toBe("high");
  });

  it("maps warn stage to a medium-severity issue", () => {
    const perfIssue = report.issues.find((i) => i.category === "performance");
    expect(perfIssue).toBeDefined();
    expect(perfIssue?.severity).toBe("medium");
  });

  it("does not emit issues for pass or skip stages", () => {
    const testIssues = report.issues.filter((i) => i.category === "tests");
    const a11yIssues = report.issues.filter((i) => i.category === "accessibility");
    expect(testIssues).toHaveLength(0);
    expect(a11yIssues).toHaveLength(0);
  });

  it("provides topActions targeting the failing stages first", () => {
    expect(report.topActions?.length).toBeGreaterThanOrEqual(1);
    const fixTypes = report.topActions?.find((a) => a.id === "fix:types");
    expect(fixTypes).toBeDefined();
    if (fixTypes && fixTypes.kind === "tool") {
      expect(fixTypes.tool).toBe("typescript-enforcer");
    }
  });

  it("renders to self-contained HTML containing the title", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Quality Pipeline");
  });
});
