import { describe, it, expect } from "vitest";
import { renderResultHTML } from "@mcp-showcase/ui-kit";
import { toResultReport, type GenerateTestsResult } from "./result-report.js";

const FIXTURE: GenerateTestsResult = {
  message: "Generated 2 test suite(s)",
  dest: "/project/src/components/Button/Button.test.tsx",
  testContent: "import { describe, it } from 'vitest';\ndescribe('Button', () => { it('renders', () => {}); });",
  analysis: {
    components: ["Button"],
    hooks: ["useButtonState"],
    functions: [],
    classes: [],
  },
};

describe("toResultReport", () => {
  it("builds a success report with correct headline", () => {
    const report = toResultReport(FIXTURE, "2026-06-27");
    expect(report.status).toBe("success");
    expect(report.headline).toContain("Generated 1 test file");
    expect(report.headline).toContain("2 suite");
  });

  it("maps meta fields correctly", () => {
    const report = toResultReport(FIXTURE, "2026-06-27");
    expect(report.meta.title).toBe("Test Generator");
    expect(report.meta.tool).toBe("generate-tests");
    expect(report.meta.generatedAt).toBe("2026-06-27");
  });

  it("creates one FileChange per output file", () => {
    const report = toResultReport(FIXTURE, "2026-06-27");
    expect(report.changes).toHaveLength(1);
    expect(report.changes?.[0].kind).toBe("created");
    expect(report.changes?.[0].language).toBe("tsx");
  });

  it("populates nextActions with fix-failing-tests and test-gap-analyzer", () => {
    const report = toResultReport(FIXTURE, "2026-06-27");
    const ids = (report.nextActions ?? []).map(a => a.id);
    expect(ids).toContain("fix-failing");
    expect(ids).toContain("gap-analysis");
  });

  it("returns noop status when no dest is present", () => {
    const noopResult: GenerateTestsResult = { message: "No exportable symbols found to generate tests for" };
    const report = toResultReport(noopResult, "2026-06-27");
    expect(report.status).toBe("noop");
    expect(report.changes).toHaveLength(0);
  });
});

describe("renderResultHTML via toResultReport", () => {
  it("produces a complete self-contained document containing the tool title", () => {
    const report = toResultReport(FIXTURE, "2026-06-27");
    const html = renderResultHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Test Generator");
  });

  it("embeds the headline text in the output", () => {
    const report = toResultReport(FIXTURE, "2026-06-27");
    const html = renderResultHTML(report);
    expect(html).toContain("Generated 1 test file");
  });
});
