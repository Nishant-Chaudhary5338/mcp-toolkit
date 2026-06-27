// Map accessibility-checker result -> shared ui-kit HealthReport for the MCP App dashboard.

import * as path from "path";
import { HealthReport, ReportCategory, ReportIssue, ReportAction, Severity, scoreToBand } from "@mcp-showcase/ui-kit";

type A11yImpact = "critical" | "serious" | "moderate" | "minor";

interface A11yIssueLike {
  rule: string;
  impact: A11yImpact;
  element: string;
  file: string;
  line: number;
  description: string;
  fix: string;
  wcag: string;
}

interface A11ySummaryLike {
  filesScanned: number;
  totalIssues: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

export interface A11yResultLike {
  summary: A11ySummaryLike;
  issues: A11yIssueLike[];
}

const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

const RULE_TO_CATEGORY: Record<string, string> = {
  "image-alt": "images",
  "button-name": "keyboard",
  "link-name": "keyboard",
  "tabindex": "keyboard",
  "aria-roles": "aria",
  "aria-hidden-focus": "aria",
  "label": "forms",
  "input-image-alt": "forms",
  "color-contrast": "contrast",
  "html-lang": "structure",
  "landmark-one-main": "structure",
  "heading-order": "structure",
  "duplicate-id": "structure",
};

const CAT_NAMES: Record<string, string> = {
  images: "Images",
  keyboard: "Keyboard & Focus",
  aria: "ARIA",
  forms: "Forms",
  contrast: "Color Contrast",
  structure: "Page Structure",
  other: "Other",
};

function toSeverity(impact: A11yImpact): Severity {
  if (impact === "critical") return "critical";
  if (impact === "serious") return "high";
  if (impact === "moderate") return "medium";
  return "low";
}

function buildIssues(result: A11yResultLike): ReportIssue[] {
  return result.issues.map((i, idx) => {
    const actions: ReportAction[] = [
      {
        id: `fix:${i.rule}:${idx}`,
        label: "Fix with component-fixer",
        kind: "tool",
        tool: "component-fixer",
        params: { file: i.file, rule: i.rule },
        fallback: `In ${path.basename(i.file)} line ${i.line}: ${i.fix}`,
      },
      {
        id: `explain:${i.rule}:${idx}`,
        label: "Explain this violation",
        kind: "prompt",
        prompt: `WCAG ${i.wcag} — ${i.description}. Explain why this matters and show a concrete fix for: ${i.element}`,
      },
    ];
    return {
      id: `${i.rule}:${idx}`,
      category: RULE_TO_CATEGORY[i.rule] ?? "other",
      severity: toSeverity(i.impact),
      title: i.description,
      description: i.fix,
      file: `${path.basename(i.file)}:${i.line}`,
      meta: [
        { label: "Rule", value: i.rule },
        { label: "WCAG", value: i.wcag },
        { label: "Line", value: String(i.line) },
        { label: "Element", value: i.element.slice(0, 80) },
      ],
      actions,
    };
  });
}

function buildCategories(issues: ReportIssue[]): ReportCategory[] {
  const catIds = [...new Set([...Object.keys(CAT_NAMES), ...issues.map((i) => i.category)])];
  return catIds.map((id) => {
    const own = issues.filter((i) => i.category === id);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    return {
      id,
      name: CAT_NAMES[id] ?? id,
      score,
      status: scoreToBand(score),
      summary: own.length === 0 ? "No issues detected." : worst.title,
      issueCount: own.length,
    };
  });
}

function buildTopActions(result: A11yResultLike, targetPath: string): ReportAction[] {
  const { summary } = result;
  const urgentCount = summary.critical + summary.serious;
  const actions: ReportAction[] = [];

  if (urgentCount > 0) {
    actions.push({
      id: "top:critical",
      label: `Fix ${urgentCount} critical/serious violation${urgentCount === 1 ? "" : "s"}`,
      kind: "tool",
      tool: "component-fixer",
      params: { path: targetPath, severity: "critical" },
      fallback: `Address the ${urgentCount} critical and serious WCAG violations in ${targetPath}.`,
    });
  }

  if (summary.totalIssues > 0) {
    actions.push({
      id: "top:audit",
      label: "Re-run accessibility audit after fixes",
      kind: "prompt",
      prompt: `After applying accessibility fixes in ${targetPath}, re-run check_accessibility and confirm all critical violations are resolved.`,
    });
  }

  actions.push({ id: "top:wcag", label: "View WCAG 2.1 quick reference", kind: "link", href: "https://www.w3.org/WAI/WCAG21/quickref/" });
  return actions.slice(0, 3);
}

export function toHealthReport(result: A11yResultLike, generatedAt: string): HealthReport {
  const issues = buildIssues(result);
  const { summary } = result;
  const targetPath = result.issues[0]?.file ?? "unknown";
  const target = path.basename(path.dirname(targetPath)) || path.basename(targetPath);
  const penalty =
    summary.critical * WEIGHT.critical +
    summary.serious * WEIGHT.high +
    summary.moderate * WEIGHT.medium +
    summary.minor * WEIGHT.low;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    meta: { title: "Accessibility Audit", subtitle: `${summary.filesScanned} file${summary.filesScanned === 1 ? "" : "s"} scanned`, target, generatedAt, tool: "accessibility-checker" },
    score,
    totalIssues: summary.totalIssues,
    chips: [
      { label: "Files", value: String(summary.filesScanned) },
      { label: "Critical", value: String(summary.critical) },
      { label: "Serious", value: String(summary.serious) },
      { label: "Moderate + Minor", value: String(summary.moderate + summary.minor) },
    ],
    topActions: buildTopActions(result, targetPath),
    categories: buildCategories(issues),
    issues,
  };
}
