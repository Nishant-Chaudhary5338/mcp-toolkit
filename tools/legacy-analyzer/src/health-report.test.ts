import { describe, it, expect } from "vitest";
import { toHealthReport } from "./health-report.js";
import { renderReportHTML } from "@mcp-showcase/ui-kit";
import type { AnalyzeLegacyAppOutput } from "./types.js";

const OUT: AnalyzeLegacyAppOutput = {
  summary: { appPath: "/tmp/acme-dashboard/", analysisDate: "2026-06-27T10:00:00Z", totalIssues: 5, healthScore: 62 },
  tech: { framework: "Create React App", reactVersion: "18.2.0", language: "JavaScript", hasCRAConfig: true, majorDependencies: ["redux", "axios"] },
  structure: { structureType: "flat", folders: ["src"], maxDepth: 2, issues: ["Flat structure for 94 components"] },
  components: {
    totalComponents: 94,
    largeComponents: [{ name: "Dashboard", file: "src/pages/Dashboard.jsx", lines: 612, jsxMaxDepth: 9, responsibilities: ["fetch", "layout", "charts"] }],
    complexComponents: [{ name: "Settings", file: "src/pages/Settings.jsx", lines: 280, jsxMaxDepth: 7, responsibilities: ["form", "tabs"] }],
  },
  state: { stateType: "redux", patterns: { normalizedState: false, derivedState: true, reselectUsed: false }, issues: ["Derived state stored in Redux"] },
  api: { apiPattern: "scattered", clients: ["axios"], duplicateEndpoints: ["GET /users"], issues: ["No central client"] },
  routing: { routingLibrary: "react-router", routingType: "nested", lazyLoading: false, routeCount: 12, issues: [] },
  styling: { stylingType: ["css", "styled-components"], inlineStylesCount: 14, hardcodedColors: ["#fff", "#000", "#abc"], duplicateClasses: [], issues: [] },
  assets: { totalAssets: 20, largeAssets: [{ file: "src/img/hero.png", sizeKB: 240, type: "image" }], unusedAssets: [], assetIssues: [] },
  antiPatterns: { antiPatterns: [{ type: "prop-drilling", description: "Prop drilling 4 levels for user", files: ["src/pages/Reports.jsx"] }] },
  duplication: { duplicateComponents: [{ name: "Card", locations: ["a.jsx", "b.jsx"], similarity: 0.92 }], duplicateUtils: [] },
  dependencies: { externalLibraries: [{ name: "moment", usageCount: 30, pattern: "suboptimal", issues: [] }], internalImports: { deepImports: [], crossFeatureImports: [], couplingIssues: [] }, uiUsage: { used: false, violations: [] }, utilsUsage: { duplicated: [], missingCentral: [] }, importAntiPatterns: [], issues: [] },
  migrationHints: [{ priority: "high", category: "api", description: "Centralise the API layer", affectedFiles: ["src/api/users.js"] }],
};

describe("toHealthReport", () => {
  const report = toHealthReport(OUT);

  it("carries the headline score and a clean target name", () => {
    expect(report.score).toBe(62);
    expect(report.meta.target).toBe("acme-dashboard");
    expect(report.meta.tool).toBe("legacy-analyzer");
  });

  it("emits the core categories with derived statuses", () => {
    const ids = report.categories.map((c) => c.id);
    for (const id of ["components", "state", "api", "routing", "styling", "assets", "deps", "structure"]) {
      expect(ids).toContain(id);
    }
    const routing = report.categories.find((c) => c.id === "routing");
    expect(routing?.status).toBe("good"); // no routing issues -> high score
  });

  it("flags the god component as critical with a fix action", () => {
    const god = report.issues.find((i) => i.title.includes("Dashboard"));
    expect(god?.severity).toBe("critical");
    expect(god?.actions?.some((a) => a.kind === "tool" && a.tool === "component-fixer")).toBe(true);
  });

  it("builds a Fix-First queue led by the refactor plan", () => {
    expect(report.topActions?.[0]?.id).toBe("top:plan");
    expect(report.topActions?.length).toBeGreaterThanOrEqual(2);
  });

  it("renders to valid self-contained HTML", () => {
    const html = renderReportHTML(report);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Codebase Health Studio");
    expect(html).toContain('data-count="62"');
  });
});
