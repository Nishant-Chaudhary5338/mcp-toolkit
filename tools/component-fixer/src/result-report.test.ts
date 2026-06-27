import { describe, it, expect } from 'vitest';
import { renderResultHTML } from '@mcp-showcase/ui-kit';
import { toResultReport } from './result-report.js';
import type { FixOutput } from './result-report.js';

// ============================================================================
// FIXTURE
// ============================================================================

const FIXTURE_APPLIED: FixOutput = {
  success: true,
  component: 'Button',
  file: 'src/components/Button/Button.tsx',
  summary: {
    totalFixable: 3,
    applied: 2,
    skipped: 1,
    failed: 0,
    scoreBefore: 72,
    gradeBefore: 'B',
  },
  fixes: [
    {
      issueId: 'TS-001',
      category: 'type-safety',
      line: 12,
      message: "Avoid using 'any' type",
      applied: true,
      detail: "Replaced 'any' with 'unknown' at line 12",
    },
    {
      issueId: 'A11Y-001',
      category: 'accessibility',
      line: 24,
      message: 'Image missing alt attribute',
      applied: true,
      detail: 'Added alt="" to image at line 24',
    },
    {
      issueId: 'REACT-001',
      category: 'react-patterns',
      message: 'Missing displayName',
      applied: false,
      detail: 'Component name could not be resolved',
    },
  ],
  remainingIssues: [
    { id: 'QUAL-001', message: 'Console statement found', category: 'code-quality' },
  ],
  typescriptCheck: { passed: true, errors: [] },
};

const FIXTURE_NOOP: FixOutput = {
  success: true,
  component: 'Card',
  file: 'src/components/Card/Card.tsx',
  summary: { totalFixable: 0, applied: 0, skipped: 0, failed: 0 },
  fixes: [],
  remainingIssues: [],
  typescriptCheck: { passed: true, errors: [] },
};

// ============================================================================
// TESTS
// ============================================================================

describe('toResultReport', () => {
  it('sets headline and status=success when all fixes applied', () => {
    const fullFixture: FixOutput = {
      ...FIXTURE_APPLIED,
      summary: { ...FIXTURE_APPLIED.summary, applied: 3, skipped: 0, failed: 0, totalFixable: 3 },
    };
    const report = toResultReport(fullFixture, '2026-06-27');
    expect(report.headline).toContain('Applied 3 fixes');
    expect(report.status).toBe('success');
  });

  it('sets status=partial when some fixes are skipped', () => {
    const report = toResultReport(FIXTURE_APPLIED, '2026-06-27');
    expect(report.status).toBe('partial');
    expect(report.headline).toContain('Applied 2 fixes');
  });

  it('sets status=noop and correct headline when nothing was applied', () => {
    const report = toResultReport(FIXTURE_NOOP, '2026-06-27');
    expect(report.status).toBe('noop');
    expect(report.headline).toBe('No fixes needed');
  });

  it('produces one FileChange entry for the modified file', () => {
    const report = toResultReport(FIXTURE_APPLIED, '2026-06-27');
    expect(report.changes).toHaveLength(1);
    expect(report.changes?.[0].kind).toBe('modified');
    expect(report.changes?.[0].path).toBe('src/components/Button/Button.tsx');
  });

  it('includes 3 nextActions with expected tool names', () => {
    const report = toResultReport(FIXTURE_APPLIED, '2026-06-27');
    const tools = report.nextActions
      ?.filter((a) => a.kind === 'tool')
      .map((a) => (a.kind === 'tool' ? a.tool : ''));
    expect(tools).toContain('component-reviewer');
    expect(tools).toContain('generate-tests');
  });

  it('sets meta fields correctly', () => {
    const report = toResultReport(FIXTURE_APPLIED, '2026-06-27');
    expect(report.meta.title).toBe('Component Fixer');
    expect(report.meta.tool).toBe('component-fixer');
    expect(report.meta.generatedAt).toBe('2026-06-27');
  });
});

describe('renderResultHTML with toResultReport', () => {
  it('starts with <!doctype html> and contains the tool title', () => {
    const report = toResultReport(FIXTURE_APPLIED, '2026-06-27');
    const html = renderResultHTML(report);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Component Fixer');
  });

  it('contains the headline text in the output', () => {
    const report = toResultReport(FIXTURE_APPLIED, '2026-06-27');
    const html = renderResultHTML(report);
    expect(html).toContain('Applied 2 fixes');
  });

  it('embeds the file path in the rendered output', () => {
    const report = toResultReport(FIXTURE_APPLIED, '2026-06-27');
    const html = renderResultHTML(report);
    expect(html).toContain('Button.tsx');
  });
});
