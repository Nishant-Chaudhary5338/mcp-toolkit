import { describe, it, expect } from "vitest";
import { toHealthReport, type ScanResultLike } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const RESULT: ScanResultLike = {
  directory: "/projects/my-app/src",
  filesScanned: 12,
  totalViolations: 4,
  results: [
    {
      file: "/projects/my-app/src/utils.ts",
      score: 6, // 0-10; will be multiplied ×10 → 60 in aggregate
      violations: [
        {
          rule: "no-any",
          severity: "error",
          line: 14,
          column: 3,
          current: "const data: any = fetch(url);",
          suggestion: "Use `unknown` and narrow the type before use.",
          fix: "const data: unknown = fetch(url);",
          why: "Using `any` disables type checking for this value.",
        },
        {
          rule: "modifiers",
          severity: "info",
          line: 22,
          column: 7,
          current: "const config = { retries: 3 } as Config;",
          suggestion: "Add `as const` to prevent accidental mutation.",
          fix: "const config = { retries: 3 } as const satisfies Config;",
          why: "Missing `as const` allows the object to be mutated.",
        },
      ],
    },
    {
      file: "/projects/my-app/src/api.ts",
      score: 8, // → 80 in aggregate
      violations: [
        {
          rule: "generics",
          severity: "warning",
          line: 5,
          column: 1,
          current: "function identity(x: string): string { return x; }",
          suggestion: "Make this function generic: `function identity<T>(x: T): T`.",
          fix: "function identity<T>(x: T): T { return x; }",
          why: "This function can be made generic for reusability.",
        },
      ],
    },
    {
      file: "/projects/my-app/src/clean.ts",
      score: 10, // → 100 in aggregate; no violations
      violations: [],
    },
  ],
  byRule: { "no-any": 1, "generics": 1, "modifiers": 1 },
  summary: { errors: 1, warnings: 1, infos: 1 },
};

describe("typescript-enforcer toHealthReport", () => {
  const report = toHealthReport(RESULT, "2026-06-27");

  it("multiplies the 0-10 file score by 10 and averages across files", () => {
    // avg(6, 8, 10) = 8.0 → ×10 = 80
    expect(report.score).toBe(80);
  });

  it("sets the correct meta fields", () => {
    expect(report.meta.title).toBe("TypeScript Audit");
    expect(report.meta.target).toBe("src");
    expect(report.meta.tool).toBe("typescript-enforcer");
    expect(report.meta.generatedAt).toBe("2026-06-27");
  });

  it("reports correct totalIssues from totalViolations", () => {
    expect(report.totalIssues).toBe(4);
  });

  it("includes score, files, and any-count chips", () => {
    const labels = report.chips?.map((c) => c.label) ?? [];
    expect(labels).toContain("Score");
    expect(labels).toContain("Files scanned");
    expect(labels).toContain("`any` count");
  });

  it("maps no-any error violations to 'high' severity", () => {
    const anyIssue = report.issues.find((i) => i.category === "no-any");
    expect(anyIssue?.severity).toBe("high");
  });

  it("maps info violations to rule-default severity (modifiers → low)", () => {
    const modIssue = report.issues.find((i) => i.category === "modifiers");
    expect(modIssue?.severity).toBe("low");
  });

  it("creates a category for every rule, including ones with no issues", () => {
    const ids = report.categories.map((c) => c.id);
    expect(ids).toContain("no-any");
    expect(ids).toContain("discriminated-unions");
    expect(ids).toContain("branded-types");
  });

  it("marks clean categories as 'good' status", () => {
    const clean = report.categories.find((c) => c.id === "discriminated-unions");
    expect(clean?.status).toBe("good");
    expect(clean?.summary).toBe("No issues detected.");
  });

  it("includes a top action targeting no-any violations", () => {
    const anyAction = report.topActions?.find((a) => a.id === "top:any");
    expect(anyAction).toBeDefined();
  });

  it("renders to self-contained HTML containing the title", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("TypeScript Audit");
  });
});
