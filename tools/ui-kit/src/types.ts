// ============================================================================
// HEALTH REPORT SCHEMA — the generic, tool-agnostic contract.
// Any MCP tool that maps its output to this shape gets the full premium UI.
// legacy-analyzer is the flagship producer; component-reviewer, dep-auditor,
// quality-pipeline etc. can map into the same schema later.
// ============================================================================

export type Severity = "critical" | "high" | "medium" | "low";
export type CategoryStatus = "good" | "warn" | "bad";

/** An agentic action a UI element can trigger back in the host (or fall back to in a browser). */
export type ReportAction =
  | { id: string; label: string; kind: "tool"; tool: string; params?: Record<string, unknown>; fallback: string }
  | { id: string; label: string; kind: "prompt"; prompt: string; fallback?: string }
  | { id: string; label: string; kind: "link"; href: string };

export interface LabelValue {
  label: string;
  value: string;
}

export interface ReportCategory {
  id: string;
  name: string;
  /** 0-100; omit when a numeric score is not meaningful. */
  score?: number;
  status: CategoryStatus;
  summary: string;
  issueCount: number;
  details?: LabelValue[];
}

export interface ReportIssue {
  id: string;
  /** Matches a ReportCategory.id. */
  category: string;
  severity: Severity;
  title: string;
  description?: string;
  file?: string;
  meta?: LabelValue[];
  actions?: ReportAction[];
}

export interface ReportMeta {
  title: string;
  subtitle?: string;
  /** The thing being analysed (repo path, package name). */
  target: string;
  /** ISO date string. */
  generatedAt: string;
  /** Producing tool name, e.g. "legacy-analyzer". */
  tool: string;
}

export interface HealthReport {
  meta: ReportMeta;
  /** 0-100 headline score. */
  score: number;
  totalIssues: number;
  /** Tech/context chips shown in the hero. */
  chips?: LabelValue[];
  categories: ReportCategory[];
  issues: ReportIssue[];
  /** Top prioritised actions ("Fix-First Queue"). */
  topActions?: ReportAction[];
}

export type Grade = "A+" | "A" | "B" | "C" | "D" | "F";

export function scoreToGrade(score: number): Grade {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/** Health band drives the accent colour in both themes. */
export function scoreToBand(score: number): CategoryStatus {
  if (score >= 70) return "good";
  if (score >= 45) return "warn";
  return "bad";
}

// ============================================================================
// RESULT REPORT — for ACTION/generative tools (scaffold, fix, convert, generate)
// that produce file changes rather than an audit score. Rendered by
// renderResultHTML. Shares meta, ReportAction, and the chrome with HealthReport.
// ============================================================================

export type FileChangeKind = "created" | "modified" | "deleted" | "renamed";
export type ResultStatus = "success" | "partial" | "noop";
export type ItemStatus = "ok" | "warn" | "error";

export interface FileChange {
  path: string;
  kind: FileChangeKind;
  /** One-line description of what changed. */
  summary?: string;
  additions?: number;
  deletions?: number;
  language?: string;
  /** Optional unified-diff or code snippet shown in the detail drawer. */
  diff?: string;
}

export interface ResultSectionItem {
  title: string;
  detail?: string;
  status?: ItemStatus;
}

/** A grouped list — e.g. "Steps", "Workspaces", "Warnings". */
export interface ResultSection {
  title: string;
  items: ResultSectionItem[];
}

export interface ResultReport {
  meta: ReportMeta;
  /** Headline outcome, e.g. "Created 3 files", "Applied 7 fixes". */
  headline: string;
  status: ResultStatus;
  /** Context metrics shown as chips in the hero. */
  stats?: LabelValue[];
  /** File-level changes — the main grid. */
  changes?: FileChange[];
  /** Optional grouped detail lists. */
  sections?: ResultSection[];
  /** Follow-up actions (review, run tests, open file). */
  nextActions?: ReportAction[];
}

export function statusToBand(status: ResultStatus): CategoryStatus {
  if (status === "success") return "good";
  if (status === "partial") return "warn";
  return "good";
}
