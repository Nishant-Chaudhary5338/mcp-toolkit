import { describe, it, expect } from "vitest";
import { toHealthReport, type BundleAuditResult } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const RESULT: BundleAuditResult = {
  summary: "Analyzed 2 packages for bundle impact",
  packages: [
    {
      package: "@repo/ui",
      productionDeps: 22,
      devDeps: 5,
      usedInProduction: ["react", "clsx"],
      usedInDevOnly: ["vitest"],
      declaredButNotUsed: ["lodash", "dayjs"],
    },
    {
      package: "@repo/utils",
      productionDeps: 4,
      devDeps: 3,
      usedInProduction: ["zod"],
      usedInDevOnly: [],
      declaredButNotUsed: [],
    },
  ],
};

describe("dep-auditor toHealthReport", () => {
  const report = toHealthReport(RESULT, "2026-06-27");

  it("sets correct meta fields", () => {
    expect(report.meta.title).toBe("Dependency Audit");
    expect(report.meta.tool).toBe("dep-auditor");
    expect(report.meta.generatedAt).toBe("2026-06-27");
  });

  it("derives a score from penalties", () => {
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("counts total issues including unused deps", () => {
    // 2 unused deps from @repo/ui + 1 heavy bundle issue + 1 dev-in-src issue
    expect(report.totalIssues).toBe(4);
  });

  it("maps unused deps to low severity", () => {
    const unused = report.issues.filter((i) => i.category === "unused");
    expect(unused.length).toBe(2);
    expect(unused.every((i) => i.severity === "low")).toBe(true);
  });

  it("maps dev-only-in-src to low severity under bundle category", () => {
    const devInSrc = report.issues.filter(
      (i) => i.category === "bundle" && i.title.startsWith("Dev-only dep"),
    );
    expect(devInSrc.length).toBe(1);
    expect(devInSrc[0].severity).toBe("low");
  });

  it("creates Unused Deps and Bundle Impact categories", () => {
    const ids = report.categories.map((c) => c.id);
    expect(ids).toContain("unused");
    expect(ids).toContain("bundle");
  });

  it("includes package and dep chips", () => {
    expect(report.chips?.some((c) => c.label === "Packages" && c.value === "2")).toBe(true);
    expect(report.chips?.some((c) => c.label === "Unused" && c.value === "2")).toBe(true);
  });

  it("renders to self-contained HTML containing the title", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Dependency Audit");
  });
});
