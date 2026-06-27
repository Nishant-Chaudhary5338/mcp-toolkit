import { renderResultHTML } from '@mcp-showcase/ui-kit';
import type { ResultReport, FileChange, ResultSection, ReportAction } from '@mcp-showcase/ui-kit';

// Re-export so index.ts can import both from one place
export { renderResultHTML };

// ============================================================================
// Local input interface — mirrors ConvertToTypeScriptOutput
// ============================================================================

interface ConvertedFile {
  originalPath: string;
  newPath: string;
  addedTypes: string[];
  issues: string[];
  previewContent?: string;
}

interface ModernizeResult {
  success: boolean;
  convertedFiles: ConvertedFile[];
  skippedFiles: string[];
  errors: string[];
  summary: {
    totalFiles: number;
    convertedCount: number;
    skippedCount: number;
    errorCount: number;
  };
}

// ============================================================================
// Mapper
// ============================================================================

export function toResultReport(
  result: ModernizeResult,
  generatedAt: string,
  target = '.'
): ResultReport {
  const { convertedFiles, skippedFiles, errors, summary } = result;

  const totalTypesAdded = convertedFiles.reduce(
    (acc, f) => acc + f.addedTypes.length,
    0
  );

  const status: ResultReport['status'] =
    errors.length > 0 && convertedFiles.length === 0
      ? 'noop'
      : errors.length > 0
      ? 'partial'
      : 'success';

  const headline =
    summary.convertedCount === 0
      ? 'No files converted'
      : `Converted ${summary.convertedCount} file${summary.convertedCount === 1 ? '' : 's'} to TypeScript`;

  const changes: FileChange[] = convertedFiles.map((f) => {
    const isNewExt =
      f.newPath.endsWith('.ts') || f.newPath.endsWith('.tsx');
    const language = f.newPath.endsWith('.tsx') ? 'tsx' : 'ts';
    const typesNote =
      f.addedTypes.length > 0
        ? `; added interfaces: ${f.addedTypes.join(', ')}`
        : '';

    const diffSnippet = f.previewContent
      ? f.previewContent.split('\n').slice(0, 6).join('\n')
      : undefined;

    return {
      path: f.newPath,
      kind: 'modified',
      summary: `Renamed from ${f.originalPath}${isNewExt ? '' : ''}${typesNote}`,
      additions: f.addedTypes.length > 0 ? f.addedTypes.length * 3 : undefined,
      language,
      diff: diffSnippet,
    };
  });

  const sections: ResultSection[] = [];

  if (skippedFiles.length > 0) {
    sections.push({
      title: 'Skipped files',
      items: skippedFiles.map((f) => ({
        title: f,
        detail: 'Could not be parsed or was excluded by filter',
        status: 'warn',
      })),
    });
  }

  if (errors.length > 0) {
    sections.push({
      title: 'Errors',
      items: errors.map((e) => ({ title: e, status: 'error' })),
    });
  }

  const nextActions: ReportAction[] = [
    {
      id: 'verify-types',
      label: 'Verify TypeScript types',
      kind: 'tool',
      tool: 'typescript-enforcer',
      params: { path: target },
      fallback: `Run: tsc --noEmit in ${target}`,
    },
    {
      id: 'generate-tests',
      label: 'Generate tests for converted files',
      kind: 'tool',
      tool: 'generate-tests',
      params: { path: target },
      fallback: `Run the generate-tests tool on ${target}`,
    },
    {
      id: 'review',
      label: 'Review modernized components',
      kind: 'tool',
      tool: 'component-reviewer',
      params: { path: target },
      fallback: `Run the component-reviewer tool on ${target}`,
    },
  ];

  return {
    meta: {
      title: 'Code Modernizer',
      subtitle: 'JS → TypeScript',
      target,
      generatedAt,
      tool: 'code-modernizer',
    },
    headline,
    status,
    stats: [
      { label: 'Scanned', value: String(summary.totalFiles) },
      { label: 'Converted', value: String(summary.convertedCount) },
      { label: 'Types added', value: String(totalTypesAdded) },
      { label: 'Skipped', value: String(summary.skippedCount) },
      ...(errors.length > 0 ? [{ label: 'Errors', value: String(errors.length) }] : []),
    ],
    changes: changes.length > 0 ? changes : undefined,
    sections: sections.length > 0 ? sections : undefined,
    nextActions,
  };
}
