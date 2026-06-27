import { describe, it, expect } from "vitest";
import { toHealthReport, type ReviewResultLike } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const RESULT: ReviewResultLike = {
  summary: {
    component: "UserCard",
    file: "/abs/src/components/UserCard.tsx",
    linesOfCode: 180,
    overallScore: 72,
    grade: "B",
    totalIssues: 3,
    categories: { "type-safety": 1, accessibility: 1, performance: 0, testing: 1, security: 0, "react-patterns": 0, "code-quality": 0, styling: 0 },
  },
  issues: [
    { id: "ts-1", category: "type-safety", severity: "error", line: 12, code: "no-any", message: "Avoid `any` on props", suggestion: "Type the props with an interface.", fixable: true },
    { id: "a11y-1", category: "accessibility", severity: "warning", line: 40, message: "Image missing alt text", suggestion: "Add an alt attribute.", fixable: true, wcag: "1.1.1" },
    { id: "test-1", category: "testing", severity: "info", message: "No test file found", suggestion: "Add a Vitest suite.", fixable: false },
  ],
  metrics: { complexity: 7 },
  typescriptErrors: ["TS2322: Type 'string' is not assignable to type 'number'."],
  testResults: { passed: 0, failed: 0 },
};

describe("component-reviewer toHealthReport", () => {
  const report = toHealthReport(RESULT, "2026-06-27");

  it("carries score, grade and target", () => {
    expect(report.score).toBe(72);
    expect(report.meta.target).toBe("UserCard");
    expect(report.meta.tool).toBe("component-reviewer");
    expect(report.chips?.some((c) => c.value === "B")).toBe(true);
  });

  it("escalates type-safety errors to critical", () => {
    const ts = report.issues.find((i) => i.id === "ts-1");
    expect(ts?.severity).toBe("critical");
  });

  it("maps warnings to medium and info to low", () => {
    expect(report.issues.find((i) => i.id === "a11y-1")?.severity).toBe("medium");
    expect(report.issues.find((i) => i.id === "test-1")?.severity).toBe("low");
  });

  it("adds a component-fixer action for fixable issues", () => {
    const a11y = report.issues.find((i) => i.id === "a11y-1");
    expect(a11y?.actions?.some((a) => a.kind === "tool" && a.tool === "component-fixer")).toBe(true);
  });

  it("builds a top-actions queue (auto-fix + TS errors)", () => {
    const ids = report.topActions?.map((a) => a.id) ?? [];
    expect(ids).toContain("top:fix");
    expect(ids).toContain("top:ts");
  });

  it("renders to self-contained HTML", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Component Review");
    expect(html).toContain('data-count="72"');
  });
});
