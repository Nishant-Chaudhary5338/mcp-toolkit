import type { ResultReport, FileChange, ResultStatus } from '@mcp-showcase/ui-kit';

// ============================================================================
// INPUT SHAPE — mirrors the success payload from handleGenerateComponent
// ============================================================================

export interface ComponentFactoryResult {
  componentName: string;
  outputDirectory: string;
  source: string;
  filesGenerated: number;
  files: string[];
  message?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const LANGUAGE_MAP: Record<string, string> = {
  tsx: 'tsx',
  ts: 'typescript',
  md: 'markdown',
};

function fileLanguage(filePath: string): string {
  const ext = filePath.split('.').pop() ?? '';
  return LANGUAGE_MAP[ext] ?? ext;
}

function fileKindSummary(filePath: string, componentName: string): string {
  const base = filePath.split('/').pop() ?? filePath;
  if (base === `${componentName}.tsx`) return `Component implementation (shadcn/ui template)`;
  if (base.endsWith('.types.ts')) return `TypeScript type declarations`;
  if (base.endsWith('.test.tsx')) return `Vitest + RTL test suite`;
  if (base.endsWith('.stories.tsx')) return `Storybook stories (Default + Destructive)`;
  if (base.endsWith('.docs.md')) return `Component documentation`;
  if (base === 'index.ts') return `Barrel export`;
  return `Generated file`;
}

function deriveStatus(filesGenerated: number): ResultStatus {
  if (filesGenerated === 0) return 'noop';
  return 'success';
}

// ============================================================================
// MAPPER
// ============================================================================

export function toResultReport(
  result: ComponentFactoryResult,
  generatedAt: string
): ResultReport {
  const { componentName, outputDirectory, source, filesGenerated, files } = result;
  const status = deriveStatus(filesGenerated);

  const changes: FileChange[] = files.map((filePath) => ({
    path: filePath,
    kind: 'created' as const,
    summary: fileKindSummary(filePath, componentName),
    language: fileLanguage(filePath),
  }));

  return {
    meta: {
      title: 'Component Factory',
      subtitle: `${source} · ${componentName}`,
      target: outputDirectory,
      generatedAt,
      tool: 'component-factory',
    },
    headline:
      filesGenerated === 0
        ? `No files created for ${componentName}`
        : `Created ${filesGenerated} file${filesGenerated === 1 ? '' : 's'} for ${componentName}`,
    status,
    stats: [
      { label: 'Created', value: String(filesGenerated) },
      { label: 'Template', value: source },
      { label: 'Component', value: componentName },
    ],
    changes,
    sections: [
      {
        title: 'Steps',
        items: [
          { title: `Resolved ${source} template for ${componentName}`, status: 'ok' },
          { title: `Generated ${filesGenerated} file(s) in output directory`, status: 'ok' },
          {
            title: 'Barrel export not auto-added to parent index',
            detail: `Add \`export * from './${componentName}'\` to the parent index.ts`,
            status: 'warn',
          },
        ],
      },
    ],
    nextActions: [
      {
        id: 'review',
        label: 'Review the component',
        kind: 'tool',
        tool: 'component-reviewer',
        params: { path: `${outputDirectory}/${componentName}.tsx` },
        fallback: `Review ${outputDirectory}/${componentName}.tsx`,
      },
      {
        id: 'story',
        label: 'Generate more stories',
        kind: 'tool',
        tool: 'storybook-generator',
        params: { path: `${outputDirectory}/${componentName}.tsx` },
        fallback: `Generate Storybook stories for ${componentName}.`,
      },
      {
        id: 'barrel',
        label: 'Update barrel export',
        kind: 'prompt',
        prompt: `Add \`export * from './${componentName}'\` to the parent components/index.ts`,
      },
    ],
  };
}
