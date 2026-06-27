import { describe, it, expect } from 'vitest';
import { toResultReport, renderResultHTML } from './result-report.js';
import type { ResultReport } from '@mcp-showcase/ui-kit';

// ============================================================================
// Fixtures
// ============================================================================

const FULL_RESULT = {
  success: true,
  convertedFiles: [
    {
      originalPath: 'src/Button.jsx',
      newPath: 'src/Button.tsx',
      addedTypes: ['ButtonProps'],
      issues: [],
      previewContent: "import React from 'react';\n\ninterface ButtonProps { label: string; }\n",
    },
    {
      originalPath: 'src/utils.js',
      newPath: 'src/utils.ts',
      addedTypes: [],
      issues: [],
    },
  ],
  skippedFiles: ['src/legacy.js'],
  errors: [],
  summary: { totalFiles: 3, convertedCount: 2, skippedCount: 1, errorCount: 0 },
};

const NOOP_RESULT = {
  success: false,
  convertedFiles: [],
  skippedFiles: [],
  errors: ['Could not parse src/broken.js: SyntaxError'],
  summary: { totalFiles: 1, convertedCount: 0, skippedCount: 0, errorCount: 1 },
};

const PARTIAL_RESULT = {
  success: false,
  convertedFiles: [
    { originalPath: 'src/App.jsx', newPath: 'src/App.tsx', addedTypes: [], issues: [] },
  ],
  skippedFiles: [],
  errors: ['Failed to rename src/index.js: EACCES'],
  summary: { totalFiles: 2, convertedCount: 1, skippedCount: 0, errorCount: 1 },
};

// ============================================================================
// toResultReport
// ============================================================================

describe('toResultReport', () => {
  it('produces success status and correct headline for a full conversion', () => {
    const report = toResultReport(FULL_RESULT, '2026-06-27', 'src/');
    expect(report.status).toBe('success');
    expect(report.headline).toBe('Converted 2 files to TypeScript');
  });

  it('maps changes with correct length and language', () => {
    const report = toResultReport(FULL_RESULT, '2026-06-27', 'src/');
    expect(report.changes).toHaveLength(2);
    expect(report.changes?.[0].language).toBe('tsx');
    expect(report.changes?.[1].language).toBe('ts');
  });

  it('includes diff snippet when previewContent is present', () => {
    const report = toResultReport(FULL_RESULT, '2026-06-27', 'src/');
    expect(report.changes?.[0].diff).toBeTruthy();
  });

  it('marks skipped files in a section', () => {
    const report = toResultReport(FULL_RESULT, '2026-06-27', 'src/');
    const skipped = report.sections?.find((s) => s.title === 'Skipped files');
    expect(skipped?.items).toHaveLength(1);
  });

  it('emits noop status when zero files converted and errors exist', () => {
    const report = toResultReport(NOOP_RESULT, '2026-06-27', '.');
    expect(report.status).toBe('noop');
    expect(report.headline).toBe('No files converted');
  });

  it('emits partial status when some files converted but errors remain', () => {
    const report = toResultReport(PARTIAL_RESULT, '2026-06-27', '.');
    expect(report.status).toBe('partial');
  });

  it('has 3 nextActions pointing to downstream tools', () => {
    const report = toResultReport(FULL_RESULT, '2026-06-27', 'src/');
    expect(report.nextActions).toHaveLength(3);
    const toolIds = report.nextActions
      ?.filter((a): a is Extract<typeof a, { kind: 'tool' }> => a.kind === 'tool')
      .map((a) => a.tool);
    expect(toolIds).toContain('typescript-enforcer');
    expect(toolIds).toContain('generate-tests');
  });

  it('stamps meta correctly', () => {
    const report = toResultReport(FULL_RESULT, '2026-06-27', 'my-app/');
    expect(report.meta.title).toBe('Code Modernizer');
    expect(report.meta.subtitle).toBe('JS → TypeScript');
    expect(report.meta.tool).toBe('code-modernizer');
    expect(report.meta.target).toBe('my-app/');
    expect(report.meta.generatedAt).toBe('2026-06-27');
  });
});

// ============================================================================
// renderResultHTML integration
// ============================================================================

describe('renderResultHTML (code-modernizer report)', () => {
  it('produces a self-contained HTML document', () => {
    const report: ResultReport = toResultReport(FULL_RESULT, '2026-06-27', 'src/');
    const html = renderResultHTML(report);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Code Modernizer');
  });

  it('contains the headline in the rendered output', () => {
    const report = toResultReport(FULL_RESULT, '2026-06-27', 'src/');
    const html = renderResultHTML(report);
    expect(html).toContain('Converted 2 files to TypeScript');
  });

  it('does not include external script or link tags', () => {
    const report = toResultReport(FULL_RESULT, '2026-06-27', 'src/');
    const html = renderResultHTML(report);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
  });
});
