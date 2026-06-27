import { describe, it, expect } from 'vitest';
import { renderResultHTML } from '@mcp-showcase/ui-kit';
import { toResultReport } from './result-report.js';
import type { ComponentFactoryResult } from './result-report.js';

const FIXTURE: ComponentFactoryResult = {
  componentName: 'Button',
  outputDirectory: '/repo/src/components/Button',
  source: 'shadcn/ui template',
  filesGenerated: 5,
  files: [
    '/repo/src/components/Button/Button.tsx',
    '/repo/src/components/Button/Button.types.ts',
    '/repo/src/components/Button/Button.test.tsx',
    '/repo/src/components/Button/Button.stories.tsx',
    '/repo/src/components/Button/index.ts',
  ],
  message: 'Successfully generated Button component with 5 files',
};

describe('toResultReport', () => {
  it('sets status to success when files were created', () => {
    const report = toResultReport(FIXTURE, '2026-06-27');
    expect(report.status).toBe('success');
  });

  it('sets status to noop when no files were created', () => {
    const report = toResultReport({ ...FIXTURE, filesGenerated: 0, files: [] }, '2026-06-27');
    expect(report.status).toBe('noop');
  });

  it('includes the correct headline with file count and component name', () => {
    const report = toResultReport(FIXTURE, '2026-06-27');
    expect(report.headline).toBe('Created 5 files for Button');
  });

  it('produces one FileChange per created file', () => {
    const report = toResultReport(FIXTURE, '2026-06-27');
    expect(report.changes).toHaveLength(FIXTURE.files.length);
  });

  it('marks all changes as "created"', () => {
    const report = toResultReport(FIXTURE, '2026-06-27');
    for (const change of report.changes ?? []) {
      expect(change.kind).toBe('created');
    }
  });

  it('sets meta tool to component-factory', () => {
    const report = toResultReport(FIXTURE, '2026-06-27');
    expect(report.meta.tool).toBe('component-factory');
    expect(report.meta.title).toBe('Component Factory');
  });

  it('includes 3 nextActions', () => {
    const report = toResultReport(FIXTURE, '2026-06-27');
    expect(report.nextActions).toHaveLength(3);
  });
});

describe('renderResultHTML(toResultReport(...))', () => {
  const report = toResultReport(FIXTURE, '2026-06-27');
  const html = renderResultHTML(report);

  it('produces a valid self-contained HTML document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('contains the tool title', () => {
    expect(html).toContain('Component Factory');
  });

  it('contains the headline', () => {
    expect(html).toContain('Created 5 files for Button');
  });
});
