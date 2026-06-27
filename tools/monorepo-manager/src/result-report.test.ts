import { describe, it, expect } from 'vitest';
import { renderResultHTML } from '@mcp-showcase/ui-kit';
import { toResultReport } from './result-report.js';

const FIXTURE = {
  root: '/workspace/my-repo',
  packageManager: 'pnpm',
  turboVersion: '2.1.0',
  totalPackages: 3,
  filteredCount: 3,
  packages: [
    {
      name: '@repo/ui',
      version: '1.0.0',
      type: 'package',
      path: 'packages/ui',
      internalDeps: [],
      scripts: ['build', 'test'],
    },
    {
      name: 'web-app',
      version: '0.1.0',
      type: 'app',
      path: 'apps/web',
      internalDeps: ['@repo/ui'],
      scripts: ['dev', 'build'],
    },
    {
      name: '@repo/eslint-config',
      version: '1.0.0',
      type: 'config',
      path: 'packages/eslint-config',
      internalDeps: [],
      scripts: [],
    },
  ],
};

describe('toResultReport', () => {
  const report = toResultReport(FIXTURE, '2026-06-27');

  it('sets headline to workspace count + repo name', () => {
    expect(report.headline).toBe('3 workspaces in my-repo');
  });

  it('returns success status', () => {
    expect(report.status).toBe('success');
  });

  it('populates sections with workspace items', () => {
    const workspaces = report.sections?.find((s) => s.title === 'Workspaces');
    expect(workspaces).toBeDefined();
    expect(workspaces?.items).toHaveLength(3);
    expect(workspaces?.items[0].title).toBe('@repo/ui');
    expect(workspaces?.items[1].detail).toContain('@repo/ui');
  });

  it('populates By Type section grouping package types', () => {
    const byType = report.sections?.find((s) => s.title === 'By Type');
    expect(byType).toBeDefined();
    expect(byType?.items.some((i) => i.title.startsWith('app'))).toBe(true);
  });

  it('includes turboVersion in stats when present', () => {
    const turboStat = report.stats?.find((s) => s.label === 'Turbo');
    expect(turboStat?.value).toBe('2.1.0');
  });

  it('has nextActions with health and dep-auditor actions', () => {
    const ids = report.nextActions?.map((a) => a.id);
    expect(ids).toContain('health');
    expect(ids).toContain('dep-audit');
  });
});

describe('renderResultHTML with monorepo report', () => {
  const report = toResultReport(FIXTURE, '2026-06-27');
  const html = renderResultHTML(report);

  it('produces a self-contained HTML document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('contains the tool title', () => {
    expect(html).toContain('Monorepo Manager');
  });

  it('contains the headline', () => {
    expect(html).toContain('3 workspaces in my-repo');
  });
});
