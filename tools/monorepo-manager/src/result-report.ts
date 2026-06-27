import type { ResultReport, ResultSection, ResultSectionItem, ItemStatus } from '@mcp-showcase/ui-kit';

// ============================================================================
// INPUT SHAPE — mirrors handleListPackages return value
// ============================================================================

interface PackageSummary {
  name: string;
  version?: string;
  type: string;
  path: string;
  internalDeps: string[];
  scripts: string[];
}

export interface ListPackagesResult {
  root: string;
  packageManager?: string;
  turboVersion?: string;
  totalPackages: number;
  filteredCount: number;
  packages: PackageSummary[];
}

// ============================================================================
// MAPPER
// ============================================================================

function typeToStatus(type: string): ItemStatus {
  if (type === 'app') return 'ok';
  if (type === 'package') return 'ok';
  if (type === 'config') return 'warn';
  return 'ok';
}

export function toResultReport(result: ListPackagesResult, generatedAt: string): ResultReport {
  const repoName = result.root.split('/').at(-1) ?? result.root;

  const workspaceItems: ResultSectionItem[] = result.packages.map((pkg) => ({
    title: pkg.name,
    detail: `${pkg.type} · ${pkg.path}${pkg.internalDeps.length > 0 ? ` · deps: ${pkg.internalDeps.join(', ')}` : ''}`,
    status: typeToStatus(pkg.type),
  }));

  const sections: ResultSection[] = [
    {
      title: 'Workspaces',
      items: workspaceItems,
    },
  ];

  // Group packages by type for a summary section
  const byType: Record<string, string[]> = {};
  for (const pkg of result.packages) {
    if (!byType[pkg.type]) byType[pkg.type] = [];
    byType[pkg.type].push(pkg.name);
  }

  const typeItems: ResultSectionItem[] = Object.entries(byType).map(([type, names]) => ({
    title: `${type} (${names.length})`,
    detail: names.join(', '),
    status: 'ok' as ItemStatus,
  }));

  if (typeItems.length > 0) {
    sections.push({ title: 'By Type', items: typeItems });
  }

  return {
    meta: {
      title: 'Monorepo Manager',
      subtitle: `${result.packageManager ?? 'pnpm'} workspace`,
      target: repoName,
      generatedAt,
      tool: 'monorepo-manager',
    },
    headline: `${result.totalPackages} workspaces in ${repoName}`,
    status: 'success',
    stats: [
      { label: 'Workspaces', value: String(result.totalPackages) },
      { label: 'Showing', value: String(result.filteredCount) },
      { label: 'Package manager', value: result.packageManager ?? 'pnpm' },
      ...(result.turboVersion ? [{ label: 'Turbo', value: result.turboVersion }] : []),
    ],
    sections,
    nextActions: [
      {
        id: 'health',
        label: 'Run health check',
        kind: 'tool',
        tool: 'monorepo-manager',
        params: { action: 'check_health' },
        fallback: 'Run the monorepo health check tool.',
      },
      {
        id: 'dep-audit',
        label: 'Audit dependencies',
        kind: 'tool',
        tool: 'dep-auditor',
        params: {},
        fallback: 'Run the dep-auditor tool on this workspace.',
      },
      {
        id: 'graph',
        label: 'View dependency graph',
        kind: 'prompt',
        prompt: 'Run the dependency_graph tool in monorepo-manager to see the full workspace dependency graph.',
      },
    ],
  };
}
