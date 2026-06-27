// ============================================================================
// Map a dep-auditor analyze_bundle_impact result -> shared ui-kit HealthReport.
// ============================================================================

import * as path from "path";
import {
  HealthReport,
  ReportCategory,
  ReportIssue,
  ReportAction,
  Severity,
  scoreToBand,
} from "@mcp-showcase/ui-kit";

// ---------------------------------------------------------------------------
// Input shape (mirrors what analyze_bundle_impact returns inside success())
// ---------------------------------------------------------------------------

interface BundlePackageRow {
  package: string;
  productionDeps: number;
  devDeps: number;
  usedInProduction: string[];
  usedInDevOnly: string[];
  declaredButNotUsed: string[];
}

export interface BundleAuditResult {
  summary: string;
  packages: BundlePackageRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHT: Record<Severity, number> = {
  critical: 26,
  high: 15,
  medium: 8,
  low: 3,
};

// ---------------------------------------------------------------------------
// Issue builders
// ---------------------------------------------------------------------------

function buildUnusedIssues(packages: BundlePackageRow[]): ReportIssue[] {
  const issues: ReportIssue[] = [];
  let counter = 0;
  for (const row of packages) {
    for (const dep of row.declaredButNotUsed) {
      const id = `unused-${++counter}`;
      const severity: Severity = "low";
      issues.push({
        id,
        category: "unused",
        severity,
        title: `Unused production dep: ${dep}`,
        description: `"${dep}" is declared in ${row.package} but never imported in source files.`,
        file: row.package,
        meta: [{ label: "Package", value: row.package }],
        actions: [
          {
            id: `${id}:remove`,
            label: "Remove with refactor-executor",
            kind: "tool",
            tool: "refactor-executor",
            params: { package: row.package, remove: dep },
            fallback: `Remove "${dep}" from ${row.package} package.json dependencies.`,
          },
        ],
      });
    }
  }
  return issues;
}

function buildBundleIssues(packages: BundlePackageRow[]): ReportIssue[] {
  const issues: ReportIssue[] = [];
  let counter = 0;
  for (const row of packages) {
    if (row.productionDeps > 20) {
      issues.push({
        id: `bundle-heavy-${++counter}`,
        category: "bundle",
        severity: "medium",
        title: `Heavy production bundle: ${row.package} (${row.productionDeps} deps)`,
        description: `${row.package} declares ${row.productionDeps} production dependencies which may inflate bundle size.`,
        file: row.package,
        meta: [
          { label: "Prod deps", value: String(row.productionDeps) },
          { label: "Used in prod", value: String(row.usedInProduction.length) },
        ],
        actions: [
          {
            id: `bundle-${counter}:audit`,
            label: "Audit bundle impact",
            kind: "prompt",
            prompt: `Audit the production dependencies of "${row.package}" and identify which ones can be replaced with lighter alternatives or removed.`,
          },
        ],
      });
    }
    for (const dep of row.usedInDevOnly) {
      issues.push({
        id: `dev-in-prod-${++counter}`,
        category: "bundle",
        severity: "low",
        title: `Dev-only dep imported in src: ${dep}`,
        description: `"${dep}" in ${row.package} is listed only as devDependency but imported from source files.`,
        file: row.package,
        meta: [{ label: "Dep", value: dep }, { label: "Package", value: row.package }],
        actions: [
          {
            id: `dev-${counter}:move`,
            label: "Move to dependencies",
            kind: "prompt",
            prompt: `Move "${dep}" from devDependencies to dependencies in ${row.package}/package.json.`,
          },
        ],
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Category builder
// ---------------------------------------------------------------------------

function buildCategories(issues: ReportIssue[]): ReportCategory[] {
  const defs: Array<{ id: string; name: string }> = [
    { id: "unused", name: "Unused Deps" },
    { id: "bundle", name: "Bundle Impact" },
  ];
  return defs.map(({ id, name }) => {
    const own = issues.filter((i) => i.category === id);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    return {
      id,
      name,
      score,
      status: scoreToBand(score),
      summary: own.length === 0 ? "No issues detected." : worst.title,
      issueCount: own.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Top actions builder
// ---------------------------------------------------------------------------

function buildTopActions(
  unusedTotal: number,
  packages: BundlePackageRow[],
): ReportAction[] {
  const actions: ReportAction[] = [];
  if (unusedTotal > 0) {
    actions.push({
      id: "top:remove-unused",
      label: `Remove ${unusedTotal} unused dep${unusedTotal === 1 ? "" : "s"}`,
      kind: "tool",
      tool: "refactor-executor",
      params: { task: "remove-unused-deps" },
      fallback: `Remove ${unusedTotal} unused production dependencies from the monorepo.`,
    });
  }
  const heavy = packages.filter((p) => p.productionDeps > 20);
  if (heavy.length > 0) {
    actions.push({
      id: "top:bundle-audit",
      label: `Audit ${heavy.length} heavy package${heavy.length === 1 ? "" : "s"}`,
      kind: "prompt",
      prompt: `These packages have more than 20 production dependencies: ${heavy.map((p) => p.package).join(", ")}. Identify which deps can be removed or replaced with lighter alternatives.`,
    });
  }
  actions.push({
    id: "top:dep-audit",
    label: "Run full dep audit",
    kind: "tool",
    tool: "dep-auditor",
    params: { task: "find_unused_deps" },
    fallback: "Run dep-auditor find_unused_deps across all packages.",
  });
  return actions.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

export function toHealthReport(result: BundleAuditResult, generatedAt: string): HealthReport {
  const { packages } = result;

  const unusedIssues = buildUnusedIssues(packages);
  const bundleIssues = buildBundleIssues(packages);
  const issues = [...unusedIssues, ...bundleIssues];

  const totalProdDeps = packages.reduce((n, p) => n + p.productionDeps, 0);
  const totalUnused = unusedIssues.length;
  const totalDevOnlyInSrc = packages.reduce((n, p) => n + p.usedInDevOnly.length, 0);

  const penalty = issues.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const target = path.basename(
    packages.length === 1 ? packages[0].package : "monorepo",
  );

  return {
    meta: {
      title: "Dependency Audit",
      target,
      generatedAt,
      tool: "dep-auditor",
    },
    score,
    totalIssues: issues.length,
    chips: [
      { label: "Packages", value: String(packages.length) },
      { label: "Prod deps", value: String(totalProdDeps) },
      { label: "Unused", value: String(totalUnused) },
      { label: "Dev-in-src", value: String(totalDevOnlyInSrc) },
    ],
    categories: buildCategories(issues),
    issues,
    topActions: buildTopActions(totalUnused, packages),
  };
}
