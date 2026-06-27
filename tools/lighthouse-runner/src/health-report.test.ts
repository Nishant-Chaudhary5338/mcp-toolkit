import { describe, it, expect } from "vitest";
import { toHealthReport, type StaticAuditResult } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const FIXTURE: StaticAuditResult = {
  filesAudited: 2,
  averageScore: 74,
  results: [
    {
      file: "/project/dist/index.html",
      score: 82,
      issues: [
        "Missing Open Graph meta tags (og:title, og:description, og:image)",
        "Missing canonical URL (rel=\"canonical\"). Prevents duplicate content SEO issues.",
        "Missing Twitter Card meta tags (twitter:card, twitter:title, twitter:description)",
      ],
    },
    {
      file: "/project/dist/about.html",
      score: 66,
      issues: [
        "Missing or empty <title> tag",
        "Missing meta description",
        "No JSON-LD structured data found. Adding schema.org markup improves rich search results.",
        "2 images without alt attribute",
      ],
    },
  ],
};

describe("lighthouse-runner toHealthReport", () => {
  const report = toHealthReport(FIXTURE, "2026-06-27");

  it("sets correct meta fields", () => {
    expect(report.meta.title).toBe("Lighthouse Report");
    expect(report.meta.tool).toBe("lighthouse-runner");
    expect(report.meta.generatedAt).toBe("2026-06-27");
    expect(report.meta.target).toBe("2 HTML files");
  });

  it("carries average score and total issues", () => {
    expect(report.score).toBe(74);
    expect(report.totalIssues).toBe(7);
  });

  it("maps missing title to high severity under seo-meta", () => {
    const titleIssue = report.issues.find((i) => /<title>/i.test(i.title));
    expect(titleIssue?.severity).toBe("high");
    expect(titleIssue?.category).toBe("seo-meta");
  });

  it("maps Open Graph issues to medium severity under social-cards", () => {
    const ogIssue = report.issues.find((i) => /open graph/i.test(i.title));
    expect(ogIssue?.severity).toBe("medium");
    expect(ogIssue?.category).toBe("social-cards");
  });

  it("maps JSON-LD issues to structured-data category", () => {
    const jldIssue = report.issues.find((i) => /json-ld/i.test(i.title));
    expect(jldIssue?.category).toBe("structured-data");
  });

  it("builds chips with file count and avg score", () => {
    expect(report.chips?.find((c) => c.label === "Files audited")?.value).toBe("2");
    expect(report.chips?.find((c) => c.label === "Avg score")?.value).toBe("74");
  });

  it("creates exactly 4 categories", () => {
    expect(report.categories).toHaveLength(4);
    const ids = report.categories.map((c) => c.id);
    expect(ids).toContain("seo-meta");
    expect(ids).toContain("accessibility");
    expect(ids).toContain("social-cards");
    expect(ids).toContain("structured-data");
  });

  it("renders to self-contained HTML with correct title", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Lighthouse Report");
  });
});
