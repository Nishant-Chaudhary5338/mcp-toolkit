import { describe, it, expect } from "vitest";
import { toHealthReport, type AuditResultLike } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const RESULT: AuditResultLike = {
  summary: {
    totalIssues: 4,
    high: 2,
    medium: 1,
    low: 1,
    byType: {
      heavyImports: 1,
      memoryLeaks: 1,
      unoptimizedImages: 1,
      syncOperations: 0,
      deepNesting: 1,
    },
  },
  issues: [
    {
      type: "memory-leak",
      file: "/abs/src/App.tsx",
      line: 22,
      description: "useEffect adds event listener without cleanup.",
      severity: "high",
      impact: "Memory leak: listener accumulates on each render.",
      fix: "Return cleanup function: return () => element.removeEventListener(...)",
    },
    {
      type: "heavy-import",
      file: "/abs/src/utils/date.ts",
      line: 1,
      description: "Heavy library 'moment' imported.",
      severity: "high",
      impact: "Increases bundle size by ~70KB.",
      fix: "Replace with 'dayjs'",
    },
    {
      type: "unoptimized-image",
      file: "/abs/src/components/Hero.tsx",
      line: 14,
      description: "Image without lazy loading or optimization.",
      severity: "medium",
      impact: "Loads full-size image eagerly.",
      fix: 'Add loading="lazy" and use WebP.',
    },
    {
      type: "deep-nesting",
      file: "/abs/src/components/Form.tsx",
      line: 55,
      description: "3 nested ternary operators reduce readability.",
      severity: "medium",
      impact: "Hard to maintain.",
      fix: "Extract to named variables.",
    },
  ],
};

describe("performance-audit toHealthReport", () => {
  const report = toHealthReport(RESULT, "2026-06-27");

  it("sets meta fields correctly", () => {
    expect(report.meta.title).toBe("Performance Audit");
    expect(report.meta.tool).toBe("performance-audit");
    expect(report.meta.generatedAt).toBe("2026-06-27");
  });

  it("computes a score penalised by issue severity", () => {
    // mapped severities: memory-leak→critical(26) + heavy-import→high(15) + image→medium(8) + deep-nesting→medium(8) = 57 → 43
    expect(report.score).toBe(43);
    expect(report.totalIssues).toBe(4);
  });

  it("escalates memory-leak (high) to critical severity", () => {
    const leak = report.issues.find((i) => i.title.includes("event listener"));
    expect(leak?.severity).toBe("critical");
  });

  it("maps heavy-import to high severity", () => {
    const heavy = report.issues.find((i) => i.title.includes("moment"));
    expect(heavy?.severity).toBe("high");
  });

  it("maps unoptimized-image to medium severity", () => {
    const img = report.issues.find((i) => i.category === "images");
    expect(img?.severity).toBe("medium");
  });

  it("places issues in the correct categories", () => {
    expect(report.issues.filter((i) => i.category === "memory")).toHaveLength(1);
    expect(report.issues.filter((i) => i.category === "heavy-imports")).toHaveLength(1);
    expect(report.issues.filter((i) => i.category === "images")).toHaveLength(1);
    expect(report.issues.filter((i) => i.category === "nesting")).toHaveLength(1);
  });

  it("includes a render-analyzer tool action on each issue", () => {
    const hasRenderAnalyzer = report.issues.every((i) =>
      i.actions?.some((a) => a.kind === "tool" && "tool" in a && a.tool === "render-analyzer")
    );
    expect(hasRenderAnalyzer).toBe(true);
  });

  it("renders to self-contained HTML starting with doctype", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Performance Audit");
  });
});
