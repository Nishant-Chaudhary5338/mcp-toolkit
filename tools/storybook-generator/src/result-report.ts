import type { ResultReport, FileChange, ResultSection, ReportAction } from '@mcp-showcase/ui-kit';

// ============================================================================
// LOCAL INPUT TYPE — mirrors what handleGenerate returns on the success path
// ============================================================================

interface StoryEntry {
  file: string;
  storyPath: string;
  component: string;
  storiesCount: number;
  stories: string[];
  props: string[];
}

interface SkippedEntry {
  file: string;
  skipped: true;
  reason: string;
}

export interface GenerateResult {
  generated: number;
  skipped: number;
  results: Array<StoryEntry | SkippedEntry>;
}

// ============================================================================
// MAPPER
// ============================================================================

function isStoryEntry(r: StoryEntry | SkippedEntry): r is StoryEntry {
  return !('skipped' in r && r.skipped);
}

export function toResultReport(result: GenerateResult, generatedAt: string): ResultReport {
  const generated = result.results.filter(isStoryEntry);
  const total = generated.reduce((acc, r) => acc + r.storiesCount, 0);

  const firstComponent = generated[0]?.component ?? 'components';
  const target = generated.length === 1 ? firstComponent : `${generated.length} components`;

  const status: ResultReport['status'] =
    result.generated === 0 && result.skipped > 0
      ? 'noop'
      : result.skipped > 0
      ? 'partial'
      : 'success';

  const headline =
    result.generated === 0
      ? `No stories generated — ${result.skipped} already existed`
      : `Generated ${total} ${total === 1 ? 'story' : 'stories'} for ${target}`;

  const changes: FileChange[] = generated.map((r) => ({
    path: r.storyPath,
    kind: 'created' as const,
    summary: `${r.storiesCount} stories: ${r.stories.slice(0, 4).join(', ')}${r.stories.length > 4 ? '…' : ''}`,
    additions: r.storiesCount * 12,
    language: 'tsx',
    diff: r.stories
      .map((s) => `+ export const ${s}: Story = { ... };`)
      .join('\n'),
  }));

  const sections: ResultSection[] = generated.map((r) => ({
    title: r.component,
    items: r.stories.map((s) => ({ title: s, status: 'ok' as const })),
  }));

  const firstPath = generated[0]?.storyPath ?? '';

  const nextActions: ReportAction[] = [
    {
      id: 'review',
      label: 'Review the component',
      kind: 'tool',
      tool: 'component-reviewer',
      params: { path: generated[0]?.file ?? '' },
      fallback: `Review the component at ${generated[0]?.file ?? 'the component path'}.`,
    },
    {
      id: 'run-storybook',
      label: 'Run Storybook to preview stories',
      kind: 'prompt',
      prompt: 'Run `pnpm storybook` (or `npx storybook dev`) to view the generated stories in the browser.',
    },
    {
      id: 'open-story',
      label: 'Open generated story file',
      kind: 'link',
      href: `file://${firstPath}`,
    },
  ];

  return {
    meta: {
      title: 'Storybook Generator',
      subtitle: `${result.generated} generated · ${result.skipped} skipped`,
      target,
      generatedAt,
      tool: 'storybook-generator',
    },
    headline,
    status,
    stats: [
      { label: 'Stories created', value: String(total) },
      { label: 'Files written', value: String(result.generated) },
      { label: 'Skipped', value: String(result.skipped) },
    ],
    changes: changes.length > 0 ? changes : undefined,
    sections: sections.length > 0 ? sections : undefined,
    nextActions,
  };
}
