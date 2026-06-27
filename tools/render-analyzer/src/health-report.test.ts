import { describe, it, expect } from "vitest";
import { toHealthReport, type DetectRerendersResult } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";

const FIXTURE: DetectRerendersResult = {
  summary: {
    totalComponents: 4,
    totalIssues: 3,
    componentsWithIssues: 2,
  },
  profiles: [
    {
      name: "UserCard",
      file: "/abs/src/components/UserCard.tsx",
      hasMemo: false,
      hasUseMemo: false,
      hasUseCallback: false,
      propsCount: 3,
      inlineObjects: 1,
      inlineFunctions: 1,
      issues: [
        {
          type: "inline-object",
          component: "UserCard",
          file: "/abs/src/components/UserCard.tsx",
          line: 12,
          description: "Inline object literal creates a new reference on every render, causing child re-renders.",
          severity: "medium",
          fix: "Extract to useMemo.",
        },
        {
          type: "missing-memo",
          component: "UserCard",
          file: "/abs/src/components/UserCard.tsx",
          line: 1,
          description: "Component is not wrapped with React.memo.",
          severity: "medium",
          fix: "export default memo(UserCard);",
        },
      ],
    },
    {
      name: "NavBar",
      file: "/abs/src/components/NavBar.tsx",
      hasMemo: false,
      hasUseMemo: false,
      hasUseCallback: false,
      propsCount: 2,
      inlineObjects: 0,
      inlineFunctions: 1,
      issues: [
        {
          type: "context-value",
          component: "NavBar",
          file: "/abs/src/components/NavBar.tsx",
          line: 22,
          description: "Context value object is recreated on every render.",
          severity: "high",
          fix: "const contextValue = useMemo(() => ({ ... }), [deps]);",
        },
      ],
    },
  ],
};

describe("render-analyzer toHealthReport", () => {
  const report = toHealthReport(FIXTURE, "2026-06-27");

  it("has correct meta fields", () => {
    expect(report.meta.title).toBe("Render Analysis");
    expect(report.meta.tool).toBe("render-analyzer");
    expect(report.meta.generatedAt).toBe("2026-06-27");
  });

  it("calculates score from weighted penalties", () => {
    // 2 medium (8 each) + 1 high (15) = 31 penalty → 100 - 31 = 69
    expect(report.score).toBe(69);
    expect(report.totalIssues).toBe(3);
  });

  it("maps 'high' severity to ReportIssue severity 'high'", () => {
    const contextIssue = report.issues.find((i) => i.meta?.some((m) => m.value === "context-value"));
    expect(contextIssue?.severity).toBe("high");
  });

  it("maps 'medium' severity issues correctly", () => {
    const inlineIssue = report.issues.find((i) => i.meta?.some((m) => m.value === "inline-object"));
    expect(inlineIssue?.severity).toBe("medium");
  });

  it("routes inline-object to inline-props category", () => {
    const inlineIssue = report.issues.find((i) => i.meta?.some((m) => m.value === "inline-object"));
    expect(inlineIssue?.category).toBe("inline-props");
  });

  it("routes context-value to rerenders category", () => {
    const contextIssue = report.issues.find((i) => i.meta?.some((m) => m.value === "context-value"));
    expect(contextIssue?.category).toBe("rerenders");
  });

  it("attaches a component-fixer tool action to each issue", () => {
    for (const issue of report.issues) {
      expect(issue.actions?.some((a) => a.kind === "tool" && a.tool === "component-fixer")).toBe(true);
    }
  });

  it("produces 3 categories", () => {
    expect(report.categories).toHaveLength(3);
  });

  it("renders to self-contained HTML that contains the tool title", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Render Analysis");
  });
});
