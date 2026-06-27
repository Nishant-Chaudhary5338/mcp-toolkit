import { describe, it, expect } from 'vitest';
import { renderResultHTML } from '@mcp-showcase/ui-kit';
import { toResultReport, type GenerateResult } from './result-report.js';

const FIXTURE: GenerateResult = {
  generated: 2,
  skipped: 1,
  results: [
    {
      file: 'src/components/Button/Button.tsx',
      storyPath: 'src/components/Button/Button.stories.tsx',
      component: 'Button',
      storiesCount: 6,
      stories: ['Default', 'Playground', 'Primary', 'Disabled', 'Loading', 'Accessibility'],
      props: ['variant', 'size', 'disabled'],
    },
    {
      file: 'src/components/Badge/Badge.tsx',
      storyPath: 'src/components/Badge/Badge.stories.tsx',
      component: 'Badge',
      storiesCount: 3,
      stories: ['Default', 'Playground', 'Accessibility'],
      props: ['variant'],
    },
    {
      file: 'src/components/Avatar/Avatar.tsx',
      skipped: true,
      reason: 'Story already exists. Pass overwrite: true to replace.',
    },
  ],
};

describe('toResultReport', () => {
  const report = toResultReport(FIXTURE, '2026-06-27');

  it('sets the correct meta', () => {
    expect(report.meta.title).toBe('Storybook Generator');
    expect(report.meta.tool).toBe('storybook-generator');
    expect(report.meta.generatedAt).toBe('2026-06-27');
  });

  it('builds a partial status when skips exist alongside generated files', () => {
    expect(report.status).toBe('partial');
  });

  it('headline reflects total stories and target', () => {
    expect(report.headline).toContain('9');
    expect(report.headline).toContain('stories');
    expect(report.headline).toContain('2 components');
  });

  it('creates one FileChange per generated file', () => {
    expect(report.changes).toHaveLength(2);
    expect(report.changes?.[0].kind).toBe('created');
    expect(report.changes?.[0].language).toBe('tsx');
  });

  it('includes stats chips', () => {
    const labels = report.stats?.map((s) => s.label) ?? [];
    expect(labels).toContain('Stories created');
    expect(labels).toContain('Files written');
    expect(labels).toContain('Skipped');
  });

  it('exposes 3 nextActions including a component-reviewer tool action', () => {
    expect(report.nextActions).toHaveLength(3);
    const reviewAction = report.nextActions?.find((a) => a.kind === 'tool');
    expect(reviewAction).toBeDefined();
    if (reviewAction?.kind === 'tool') {
      expect(reviewAction.tool).toBe('component-reviewer');
    }
  });

  it('noop status when nothing generated', () => {
    const noopResult: GenerateResult = {
      generated: 0,
      skipped: 1,
      results: [{ file: 'Foo.tsx', skipped: true, reason: 'exists' }],
    };
    const noopReport = toResultReport(noopResult, '2026-06-27');
    expect(noopReport.status).toBe('noop');
  });
});

describe('renderResultHTML with storybook report', () => {
  const report = toResultReport(FIXTURE, '2026-06-27');
  const html = renderResultHTML(report);

  it('produces a complete self-contained HTML document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('contains the tool title', () => {
    expect(html).toContain('Storybook Generator');
  });

  it('contains the headline', () => {
    expect(html).toContain('stories');
  });

  it('has no external link or script references', () => {
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });
});
