// ============================================================================
// Map a static_audit result -> the shared ui-kit HealthReport.
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

// ---- Input shape from handleStaticAudit ------------------------------------

interface FileAuditResult {
  file: string;
  score: number;
  issues: string[];
}

export interface StaticAuditResult {
  filesAudited: number;
  averageScore: number;
  results: FileAuditResult[];
}

// ---- Severity weights (mirrors the shared contract) ------------------------

const WEIGHT: Record<Severity, number> = { critical: 26, high: 15, medium: 8, low: 3 };

// ---- Category definitions --------------------------------------------------

type CategoryId = "seo-meta" | "accessibility" | "social-cards" | "structured-data";

const CATEGORIES: Record<CategoryId, string> = {
  "seo-meta": "SEO Meta",
  accessibility: "Accessibility",
  "social-cards": "Social Cards",
  "structured-data": "Structured Data",
};

// Patterns that classify an issue string into a category and severity.
const CLASSIFICATION: Array<{
  pattern: RegExp;
  category: CategoryId;
  severity: Severity;
}> = [
  { pattern: /og:|open graph/i,          category: "social-cards",    severity: "medium" },
  { pattern: /twitter/i,                 category: "social-cards",    severity: "low" },
  { pattern: /json-ld|structured data/i, category: "structured-data", severity: "low" },
  { pattern: /title/i,                   category: "seo-meta",        severity: "high" },
  { pattern: /meta description/i,        category: "seo-meta",        severity: "high" },
  { pattern: /viewport/i,                category: "seo-meta",        severity: "high" },
  { pattern: /canonical/i,               category: "seo-meta",        severity: "high" },
  { pattern: /charset/i,                 category: "seo-meta",        severity: "medium" },
  { pattern: /favicon/i,                 category: "seo-meta",        severity: "low" },
  { pattern: /theme-color/i,             category: "seo-meta",        severity: "low" },
  { pattern: /lang/i,                    category: "accessibility",   severity: "high" },
  { pattern: /alt/i,                     category: "accessibility",   severity: "high" },
  { pattern: /semantic/i,               category: "accessibility",   severity: "medium" },
  { pattern: /render-blocking/i,         category: "accessibility",   severity: "medium" },
  { pattern: /large inline script/i,     category: "accessibility",   severity: "medium" },
];

function classify(issueText: string): { category: CategoryId; severity: Severity } {
  for (const rule of CLASSIFICATION) {
    if (rule.pattern.test(issueText)) return { category: rule.category, severity: rule.severity };
  }
  return { category: "seo-meta", severity: "low" };
}

// ---- Builders --------------------------------------------------------------

function buildIssues(results: FileAuditResult[]): ReportIssue[] {
  const issues: ReportIssue[] = [];
  let counter = 0;
  for (const fileResult of results) {
    const fileName = path.basename(fileResult.file);
    for (const issueText of fileResult.issues) {
      counter += 1;
      const { category, severity } = classify(issueText);
      const id = `issue-${counter}`;
      const actions: ReportAction[] = [
        {
          id: `fix:${id}`,
          label: "Fix this issue",
          kind: "prompt",
          prompt: `How do I fix the following HTML audit issue in ${fileName}? "${issueText}"`,
        },
      ];
      issues.push({
        id,
        category,
        severity,
        title: issueText,
        description: `Found in ${fileName}`,
        file: fileName,
        actions,
      });
    }
  }
  return issues;
}

function buildCategories(issues: ReportIssue[]): ReportCategory[] {
  return (Object.keys(CATEGORIES) as CategoryId[]).map((id) => {
    const own = issues.filter((i) => i.category === id);
    const penalty = own.reduce((sum, i) => sum + WEIGHT[i.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const worst = own.slice().sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])[0];
    return {
      id,
      name: CATEGORIES[id],
      score,
      status: scoreToBand(score),
      summary: own.length === 0 ? "No issues detected." : worst.title,
      issueCount: own.length,
    };
  });
}

function buildTopActions(issues: ReportIssue[], target: string): ReportAction[] {
  const highestSeverity = issues
    .slice()
    .sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])
    .slice(0, 3);

  const actions: ReportAction[] = highestSeverity.map((issue, idx) => ({
    id: `top:${idx}`,
    label: `Fix: ${issue.title.slice(0, 60)}`,
    kind: "prompt",
    prompt: `How do I fix the following issue in ${target}? "${issue.title}"`,
  }));

  if (actions.length === 0) {
    actions.push({
      id: "top:audit",
      label: "Run a full Lighthouse audit",
      kind: "prompt",
      prompt: `The static HTML audit for ${target} found no issues. Run a full Lighthouse audit with run_lighthouse to check runtime performance.`,
    });
  }

  return actions.slice(0, 3);
}

// ---- Public API ------------------------------------------------------------

export function toHealthReport(result: StaticAuditResult, generatedAt: string): HealthReport {
  const issues = buildIssues(result.results);
  const categories = buildCategories(issues);

  const firstName = result.results[0]?.file ?? "unknown";
  const target =
    result.filesAudited === 1
      ? path.basename(firstName)
      : `${result.filesAudited} HTML files`;

  const checksTotal = result.filesAudited * CLASSIFICATION.length;
  const checksFound = issues.length;
  const checksPassed = Math.max(0, checksTotal - checksFound);

  return {
    meta: {
      title: "Lighthouse Report",
      target,
      generatedAt,
      tool: "lighthouse-runner",
    },
    score: result.averageScore,
    totalIssues: issues.length,
    chips: [
      { label: "Files audited", value: String(result.filesAudited) },
      { label: "Avg score",     value: String(result.averageScore) },
      { label: "Checks passed", value: String(checksPassed) },
      { label: "Issues found",  value: String(checksFound) },
    ],
    categories,
    issues,
    topActions: buildTopActions(issues, target),
  };
}
