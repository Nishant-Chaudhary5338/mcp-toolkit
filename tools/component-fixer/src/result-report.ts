import type { ResultReport, FileChange, ResultSection, ResultSectionItem } from '@mcp-showcase/ui-kit';

// ============================================================================
// INPUT SHAPE — mirrors FixOutput from index.ts (local copy to avoid circular)
// ============================================================================

interface FixResult {
  issueId: string;
  category: string;
  line?: number;
  message: string;
  applied: boolean;
  detail: string;
}

export interface FixOutput {
  success: boolean;
  component: string;
  file: string;
  summary: {
    totalFixable: number;
    applied: number;
    skipped: number;
    failed: number;
    scoreBefore?: number;
    scoreAfter?: number;
    gradeBefore?: string;
    gradeAfter?: string;
  };
  fixes: FixResult[];
  remainingIssues: Array<{ id: string; message: string; category: string }>;
  typescriptCheck: { passed: boolean; errors: string[] };
}

// ============================================================================
// MAPPER
// ============================================================================

export function toResultReport(result: FixOutput, generatedAt: string): ResultReport {
  const { summary, fixes, file, component, remainingIssues, typescriptCheck } = result;
  const applied = summary.applied;

  const status =
    applied === 0 && summary.skipped === 0
      ? 'noop'
      : summary.failed > 0 || applied < summary.totalFixable
      ? 'partial'
      : 'success';

  const headline =
    status === 'noop'
      ? 'No fixes needed'
      : `Applied ${applied} fix${applied !== 1 ? 'es' : ''} to ${component}`;

  const changes: FileChange[] = file
    ? [
        {
          path: file,
          kind: 'modified',
          summary: `${applied} fix${applied !== 1 ? 'es' : ''} applied (${summary.skipped} skipped, ${summary.failed} failed)`,
          additions: applied,
          deletions: summary.failed,
          language: file.endsWith('.tsx') || file.endsWith('.ts') ? 'tsx' : 'js',
        },
      ]
    : [];

  const fixItems: ResultSectionItem[] = fixes.map((f) => ({
    title: f.message,
    detail: f.detail,
    status: f.applied ? 'ok' : f.detail.includes('Error') ? 'error' : 'warn',
  }));

  const sections: ResultSection[] = [];

  if (fixItems.length > 0) {
    sections.push({ title: 'Fixes', items: fixItems });
  }

  if (remainingIssues.length > 0) {
    sections.push({
      title: 'Remaining Issues',
      items: remainingIssues.map((i) => ({
        title: i.message,
        detail: `Category: ${i.category} · id: ${i.id}`,
        status: 'warn' as const,
      })),
    });
  }

  if (!typescriptCheck.passed && typescriptCheck.errors.length > 0) {
    sections.push({
      title: 'TypeScript Errors After Fix',
      items: typescriptCheck.errors.slice(0, 5).map((e) => ({
        title: e,
        status: 'error' as const,
      })),
    });
  }

  return {
    meta: {
      title: 'Component Fixer',
      subtitle: component || undefined,
      target: file || component,
      generatedAt,
      tool: 'component-fixer',
    },
    headline,
    status,
    stats: [
      { label: 'Applied', value: String(applied) },
      { label: 'Skipped', value: String(summary.skipped) },
      { label: 'Failed', value: String(summary.failed) },
      ...(summary.scoreBefore !== undefined
        ? [{ label: 'Score Before', value: String(summary.scoreBefore) }]
        : []),
      ...(summary.gradeBefore !== undefined
        ? [{ label: 'Grade Before', value: summary.gradeBefore }]
        : []),
    ],
    changes,
    sections,
    nextActions: [
      {
        id: 'review',
        label: 'Re-review component',
        kind: 'tool',
        tool: 'component-reviewer',
        params: { path: file },
        fallback: `Review ${file} to verify fixes.`,
      },
      {
        id: 'tests',
        label: 'Generate tests',
        kind: 'tool',
        tool: 'generate-tests',
        params: { path: file },
        fallback: `Generate tests for ${file}.`,
      },
      {
        id: 'quality',
        label: 'Run quality pipeline',
        kind: 'tool',
        tool: 'quality-pipeline',
        params: { path: file },
        fallback: `Run quality-pipeline on ${file}.`,
      },
    ],
  };
}
