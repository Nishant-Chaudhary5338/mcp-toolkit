import { describe, it, expect } from "vitest";
import { toHealthReport, type A11yResultLike } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const RESULT: A11yResultLike = {
  summary: {
    filesScanned: 3,
    totalIssues: 4,
    critical: 1,
    serious: 1,
    moderate: 1,
    minor: 1,
  },
  issues: [
    {
      rule: "image-alt",
      impact: "critical",
      element: '<img src="hero.png" />',
      file: "/project/src/components/Hero.tsx",
      line: 12,
      description: "Images must have alternate text",
      fix: 'Add alt="" or descriptive alt attribute to the img element',
      wcag: "1.1.1",
    },
    {
      rule: "button-name",
      impact: "serious",
      element: "<button></button>",
      file: "/project/src/components/Nav.tsx",
      line: 34,
      description: "Buttons must have discernible text",
      fix: "Add visible label text or aria-label to the button",
      wcag: "4.1.2",
    },
    {
      rule: "color-contrast",
      impact: "moderate",
      element: '<p class="text-gray-300">',
      file: "/project/src/components/Card.tsx",
      line: 8,
      description: "Elements must have sufficient color contrast",
      fix: "Increase the contrast ratio to at least 4.5:1 for normal text",
      wcag: "1.4.3",
    },
    {
      rule: "tabindex",
      impact: "minor",
      element: '<div tabIndex="2">',
      file: "/project/src/components/Card.tsx",
      line: 20,
      description: "Avoid positive tabindex values",
      fix: "Use tabIndex={0} or tabIndex={-1} instead of positive values",
      wcag: "2.4.3",
    },
  ],
};

describe("accessibility-checker toHealthReport", () => {
  const report = toHealthReport(RESULT, "2026-06-27");

  it("sets the correct meta fields", () => {
    expect(report.meta.title).toBe("Accessibility Audit");
    expect(report.meta.tool).toBe("accessibility-checker");
    expect(report.meta.generatedAt).toBe("2026-06-27");
  });

  it("derives a score penalised by severity weights", () => {
    // critical(26) + serious(15) + moderate(8) + low(3) = 52 penalty → score 48
    expect(report.score).toBe(48);
  });

  it("maps critical impact to critical severity", () => {
    const issue = report.issues.find((i) => i.id.startsWith("image-alt:"));
    expect(issue?.severity).toBe("critical");
  });

  it("maps serious impact to high severity", () => {
    const issue = report.issues.find((i) => i.id.startsWith("button-name:"));
    expect(issue?.severity).toBe("high");
  });

  it("maps moderate impact to medium severity", () => {
    const issue = report.issues.find((i) => i.id.startsWith("color-contrast:"));
    expect(issue?.severity).toBe("medium");
  });

  it("maps minor impact to low severity", () => {
    const issue = report.issues.find((i) => i.id.startsWith("tabindex:"));
    expect(issue?.severity).toBe("low");
  });

  it("groups image-alt into images category", () => {
    const issue = report.issues.find((i) => i.id.startsWith("image-alt:"));
    expect(issue?.category).toBe("images");
  });

  it("groups button-name into keyboard category", () => {
    const issue = report.issues.find((i) => i.id.startsWith("button-name:"));
    expect(issue?.category).toBe("keyboard");
  });

  it("includes WCAG, rule, line, and element in meta", () => {
    const issue = report.issues.find((i) => i.id.startsWith("image-alt:"));
    const wcag = issue?.meta?.find((m) => m.label === "WCAG");
    expect(wcag?.value).toBe("1.1.1");
  });

  it("attaches component-fixer tool action to every issue", () => {
    for (const issue of report.issues) {
      expect(issue.actions?.some((a) => a.kind === "tool" && a.tool === "component-fixer")).toBe(true);
    }
  });

  it("includes a top action targeting critical violations", () => {
    const top = report.topActions?.find((a) => a.id === "top:critical");
    expect(top).toBeDefined();
    expect(top?.kind).toBe("tool");
  });

  it("exposes chips for files scanned and severity counts", () => {
    expect(report.chips?.some((c) => c.label === "Files" && c.value === "3")).toBe(true);
    expect(report.chips?.some((c) => c.label === "Critical" && c.value === "1")).toBe(true);
  });

  it("renders to self-contained HTML containing the report title", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Accessibility Audit");
  });
});
