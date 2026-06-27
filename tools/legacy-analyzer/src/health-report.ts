// ============================================================================
// Map the analyzer's raw output -> the generic HealthReport the ui-kit renders.
// Aggregates noisy arrays into single counted issues for a clean triage view.
// ============================================================================

import { basename } from "node:path";
import {
  HealthReport,
  ReportCategory,
  ReportIssue,
  ReportAction,
  Severity,
  scoreToBand,
} from "@mcp-showcase/ui-kit";
import type { AnalyzeLegacyAppOutput, ComponentInfo, AntiPattern, DuplicateItem } from "./types.js";

const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

/** Some analyzer outputs cram detail into the file field ("src/x.tsx — 403 lines, ..."). Keep only the path. */
function cleanFile(file?: string): string | undefined {
  if (!file) return undefined;
  const first = file.split(/\s+[—–-]\s+|\s+\(/)[0].trim();
  return first || undefined;
}

const CATEGORY_NAMES: Record<string, string> = {
  components: "Components",
  state: "State",
  api: "API layer",
  routing: "Routing",
  styling: "Styling",
  assets: "Assets",
  deps: "Dependencies",
  duplication: "Duplication",
  structure: "Structure",
};
const CORE_ORDER = ["components", "state", "api", "routing", "styling", "assets", "deps", "structure"];

interface Draft {
  category: string;
  severity: Severity;
  title: string;
  file?: string;
  description?: string;
  meta?: { label: string; value: string }[];
  actions?: ReportAction[];
}

function componentSeverity(lines: number): Severity {
  if (lines > 500) return "critical";
  if (lines > 350) return "high";
  return "medium";
}

function antiPatternCategory(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("duplicat")) return "duplication";
  if (t.includes("coupl") || t.includes("boundary")) return "structure";
  if (t.includes("util") || t.includes("import")) return "deps";
  return "components";
}

function collectDrafts(out: AnalyzeLegacyAppOutput): Draft[] {
  const drafts: Draft[] = [];

  out.components.largeComponents.forEach((c: ComponentInfo) =>
    drafts.push({
      category: "components",
      severity: componentSeverity(c.lines),
      title: `God component: ${c.name} (${c.lines} lines)`,
      file: c.file,
      description: `${c.name} is ${c.lines} lines${c.responsibilities?.length ? ` with ${c.responsibilities.length} responsibilities` : ""}. Split it into focused components.`,
      meta: [{ label: "Lines", value: String(c.lines) }],
      actions: [
        { id: `fix:${c.file}`, label: "Split with component-fixer", kind: "tool", tool: "component-fixer", params: { file: c.file }, fallback: `Split ${c.file} into smaller components.` },
        { id: `explain:${c.file}`, label: "Explain the risk", kind: "prompt", prompt: `Explain why ${c.name} (${c.lines} lines) hurts maintainability and React performance, and how to split it.` },
      ],
    })
  );

  out.components.complexComponents.slice(0, 8).forEach((c: ComponentInfo) =>
    drafts.push({
      category: "components",
      severity: "medium",
      title: `Mixed responsibilities: ${c.name}`,
      file: c.file,
      meta: [{ label: "Responsibilities", value: String(c.responsibilities?.length ?? 0) }],
    })
  );

  out.antiPatterns.antiPatterns.slice(0, 10).forEach((a: AntiPattern, i) =>
    drafts.push({
      category: antiPatternCategory(a.type),
      severity: a.type.toLowerCase().includes("god") || a.type.toLowerCase().includes("coupl") ? "high" : "medium",
      title: a.description || a.type,
      file: a.files?.[0],
      meta: a.files?.length ? [{ label: "Affected files", value: String(a.files.length) }] : undefined,
    })
  );

  const dup = (items: DuplicateItem[], kind: string) =>
    items.slice(0, 8).forEach((d) =>
      drafts.push({
        category: "duplication",
        severity: d.similarity >= 0.9 ? "high" : "medium",
        title: `Duplicate ${kind}: ${d.name}`,
        file: d.locations?.[0],
        description: `Found in ${d.locations?.length ?? 0} locations (${Math.round(d.similarity * 100)}% similar).`,
        meta: [{ label: "Similarity", value: `${Math.round(d.similarity * 100)}%` }, { label: "Locations", value: String(d.locations?.length ?? 0) }],
      })
    );
  dup(out.duplication.duplicateComponents, "component");
  dup(out.duplication.duplicateUtils, "util");

  out.api.duplicateEndpoints.slice(0, 6).forEach((e) =>
    drafts.push({ category: "api", severity: "high", title: `Duplicated endpoint: ${e}` })
  );
  out.api.issues.forEach((m) => drafts.push({ category: "api", severity: "medium", title: m }));
  if (out.api.apiPattern === "scattered")
    drafts.push({ category: "api", severity: "high", title: "Scattered API calls — no centralised client", actions: [{ id: "api:centralise", label: "Centralise API client", kind: "prompt", prompt: "Create a centralised typed HTTP client and route all API calls through it." }] });

  out.state.issues.forEach((m) => drafts.push({ category: "state", severity: "medium", title: m }));
  out.routing.issues.forEach((m) => drafts.push({ category: "routing", severity: "medium", title: m }));
  if (!out.routing.lazyLoading && out.routing.routeCount > 3)
    drafts.push({ category: "routing", severity: "low", title: "No route-level code splitting (React.lazy)" });

  out.styling.issues.forEach((m) => drafts.push({ category: "styling", severity: "medium", title: m }));
  if (out.styling.hardcodedColors.length)
    drafts.push({ category: "styling", severity: "low", title: `${out.styling.hardcodedColors.length} hardcoded colours outside the token system`, meta: [{ label: "Count", value: String(out.styling.hardcodedColors.length) }] });
  if (out.styling.inlineStylesCount)
    drafts.push({ category: "styling", severity: "low", title: `${out.styling.inlineStylesCount} inline style usages` });

  out.assets.assetIssues.forEach((m) => drafts.push({ category: "assets", severity: "low", title: m }));
  if (out.assets.largeAssets.length)
    drafts.push({ category: "assets", severity: "low", title: `${out.assets.largeAssets.length} large assets`, meta: [{ label: "Count", value: String(out.assets.largeAssets.length) }] });

  out.dependencies.issues.forEach((m) => drafts.push({ category: "deps", severity: "medium", title: m }));
  out.dependencies.importAntiPatterns.forEach((m) => drafts.push({ category: "deps", severity: "medium", title: m }));
  out.dependencies.externalLibraries.filter((l) => l.pattern === "suboptimal").slice(0, 6).forEach((l) =>
    drafts.push({ category: "deps", severity: "low", title: `Suboptimal usage of ${l.name}`, meta: [{ label: "Usages", value: String(l.usageCount) }] })
  );

  out.structure.issues.forEach((m) => drafts.push({ category: "structure", severity: "medium", title: m }));

  return drafts;
}

function buildCategories(drafts: Draft[]): ReportCategory[] {
  const ids = new Set<string>([...CORE_ORDER]);
  drafts.forEach((d) => ids.add(d.category));
  const ordered = [...CORE_ORDER, ...[...ids].filter((id) => !CORE_ORDER.includes(id))];

  return ordered.map((id) => {
    const own = drafts.filter((d) => d.category === id);
    const penalty = own.reduce((sum, d) => sum + WEIGHT[d.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const status = scoreToBand(score);
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    const summary = own.length === 0 ? "No issues detected." : worst ? worst.title : `${own.length} issues.`;
    return { id, name: CATEGORY_NAMES[id] ?? id, score, status, summary, issueCount: own.length };
  });
}

function topActions(out: AnalyzeLegacyAppOutput, target: string): ReportAction[] {
  const actions: ReportAction[] = [
    { id: "top:plan", label: "Generate full refactor plan", kind: "tool", tool: "generate-refactor-plan", params: { path: out.summary.appPath }, fallback: `Generate a refactor plan for ${target}.` },
  ];
  const god = out.components.largeComponents.filter((c) => c.lines > 350);
  if (god.length)
    actions.push({ id: "top:god", label: `Split the ${god.length} largest component${god.length === 1 ? "" : "s"}`, kind: "tool", tool: "component-fixer", params: { files: god.map((c) => c.file) }, fallback: `Split these oversized components: ${god.map((c) => c.file).join(", ")}.` });
  const highHint = out.migrationHints.find((h) => h.priority === "high");
  if (highHint)
    actions.push({ id: "top:hint", label: highHint.description, kind: "prompt", prompt: `${highHint.description} Affected files: ${highHint.affectedFiles.slice(0, 8).join(", ")}.` });
  return actions.slice(0, 3);
}

export function toHealthReport(out: AnalyzeLegacyAppOutput): HealthReport {
  const drafts = collectDrafts(out);
  const issues: ReportIssue[] = drafts.map((d, i) => ({
    id: `issue-${i}`,
    category: d.category,
    severity: d.severity,
    title: d.title,
    description: d.description,
    file: cleanFile(d.file),
    meta: d.meta,
    actions: d.actions,
  }));
  const target = basename(out.summary.appPath.replace(/[/\\]+$/, "")) || out.summary.appPath;

  return {
    meta: {
      title: "Codebase Health Studio",
      subtitle: `${out.tech.framework} · ${out.tech.language}`,
      target,
      generatedAt: out.summary.analysisDate?.slice(0, 10) ?? "",
      tool: "legacy-analyzer",
    },
    score: out.summary.healthScore,
    totalIssues: issues.length,
    chips: [
      { label: "Framework", value: out.tech.framework },
      { label: "React", value: out.tech.reactVersion || "—" },
      { label: "Language", value: out.tech.language },
      { label: "Components", value: String(out.components.totalComponents) },
    ],
    topActions: topActions(out, target),
    categories: buildCategories(drafts),
    issues,
  };
}
