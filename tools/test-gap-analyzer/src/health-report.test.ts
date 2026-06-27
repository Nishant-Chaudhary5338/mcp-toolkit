import { describe, it, expect } from "vitest";
import { toHealthReport, type CoverageResult } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const RESULT: CoverageResult = {
  overall: {
    totalFiles: 3,
    filesWithTests: 2,
    totalExports: 8,
    testedExports: 5,
    exportCoveragePercent: 62,
    edgeCaseCoveragePercent: 44,
    grade: "D",
  },
  files: [
    {
      file: "/project/src/utils.ts",
      testFile: "/project/src/utils.test.ts",
      exports: 4,
      hasTests: true,
      coverage: 75,
      gaps: [
        {
          export: "formatDate",
          type: "function",
          missing: [
            {
              category: "null-input",
              description: "Test with null/undefined arguments",
              severity: "high",
              suggestion: "Pass null/undefined to verify graceful handling",
            },
          ],
        },
      ],
    },
    {
      file: "/project/src/api.ts",
      testFile: null,
      exports: 4,
      hasTests: false,
      coverage: 0,
      gaps: [],
    },
  ],
};

describe("test-gap-analyzer toHealthReport", () => {
  const report = toHealthReport(RESULT, "2026-06-27");

  it("sets correct meta fields", () => {
    expect(report.meta.title).toBe("Test Coverage");
    expect(report.meta.tool).toBe("test-gap-analyzer");
    expect(report.meta.generatedAt).toBe("2026-06-27");
  });

  it("uses exportCoveragePercent as score", () => {
    expect(report.score).toBe(62);
  });

  it("carries grade and coverage chips", () => {
    expect(report.chips?.some((c) => c.label === "Grade" && c.value === "D")).toBe(true);
    expect(report.chips?.some((c) => c.label === "Export coverage" && c.value === "62%")).toBe(true);
  });

  it("maps high-severity gap to 'high' severity issue", () => {
    const issue = report.issues.find((i) => i.category === "uncovered-branches");
    expect(issue?.severity).toBe("high");
  });

  it("creates a 'files-without-tests' issue for api.ts", () => {
    const noTest = report.issues.find((i) => i.category === "files-without-tests");
    expect(noTest).toBeDefined();
    expect(noTest?.severity).toBe("high");
    expect(noTest?.title).toContain("api.ts");
  });

  it("totalIssues matches issues array length", () => {
    expect(report.totalIssues).toBe(report.issues.length);
  });

  it("generates topActions", () => {
    expect(report.topActions?.length).toBeGreaterThan(0);
    const kinds = report.topActions?.map((a) => a.kind) ?? [];
    expect(kinds.some((k) => k === "tool" || k === "prompt")).toBe(true);
  });

  it("renders to self-contained HTML containing title", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Test Coverage");
  });
});
