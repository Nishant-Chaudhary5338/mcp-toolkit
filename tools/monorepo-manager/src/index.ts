#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { renderResultHTML } from '@mcp-showcase/ui-kit';
import { toResultReport, type ListPackagesResult } from './result-report.js';
import * as fs from 'fs';
import * as path from 'path';
import {
  findMonorepoRoot,
  getWorkspaceInfo,
  getDependencyGraph,
  findDependents,
  expandGlob,
} from './utils.js';
import type { PackageInfo } from './types.js';

class MonorepoManagerServer extends McpServerBase {
  constructor() {
    super({ name: 'monorepo-manager', version: '2.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'list_packages',
      'List all packages in the monorepo workspace with their metadata',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
          filter: {
            type: 'string',
            enum: ['all', 'app', 'package', 'tool', 'config'],
            description: 'Filter by package type (default: all)',
          },
        },
      },
      async (args) => {
        try {
          const result = this.handleListPackages(args);
          // Cast is safe: handleListPackages shape matches ListPackagesResult structurally
          const typedResult = result as unknown as ListPackagesResult;
          return this.successWithUI(result as unknown as Record<string, unknown>, {
            uri: 'ui://monorepo-manager/report',
            html: renderResultHTML(toResultReport(typedResult, new Date().toISOString().slice(0, 10))),
          });
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'find_dependents',
      'Find all packages that depend on a given package',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
          package: { type: 'string', description: 'Package name to find dependents of' },
        },
        required: ['package'],
      },
      async (args) => {
        try {
          return this.success(this.handleFindDependents(args));
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'dependency_graph',
      'Build the full workspace dependency graph and detect circular dependencies',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
        },
      },
      async (args) => {
        try {
          return this.success(this.handleDependencyGraph(args));
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'check_health',
      'Run a workspace health check: detect version mismatches, missing scripts, and circular dependencies',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
        },
      },
      async (args) => {
        try {
          return this.success(this.handleCheckHealth(args));
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'find_shared_deps',
      'Find external dependencies used by multiple packages — candidates for extraction to a shared package',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
          minPackages: { type: 'number', description: 'Minimum number of packages that must use the dep (default: 2)' },
        },
      },
      async (args) => {
        try {
          return this.success(this.handleFindSharedDeps(args));
        } catch (error) {
          return this.error(error);
        }
      }
    );

    this.addTool(
      'sync_config',
      'Check if a config file is consistent across all packages and surface variants',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
          configFile: { type: 'string', description: 'Config file name to check, e.g. ".eslintrc.json" or "tsconfig.json"' },
        },
        required: ['configFile'],
      },
      async (args) => {
        try {
          return this.success(this.handleSyncConfig(args));
        } catch (error) {
          return this.error(error);
        }
      }
    );
  }

  private handleListPackages(args: unknown): Record<string, unknown> {
    const a = args as { root?: string; filter?: string } | null;
    const root = a?.root ? path.resolve(a.root) : findMonorepoRoot(process.cwd());
    const filter = a?.filter || 'all';
    const workspace = getWorkspaceInfo(root);

    let packages = workspace.packages;
    if (filter !== 'all') {
      packages = packages.filter(p => p.type === filter);
    }

    return {
      root: workspace.root,
      packageManager: workspace.packageManager,
      turboVersion: workspace.turboVersion,
      totalPackages: workspace.packages.length,
      filteredCount: packages.length,
      packages: packages.map(p => ({
        name: p.name,
        version: p.version,
        type: p.type,
        path: p.path,
        internalDeps: Object.keys({ ...p.dependencies, ...p.devDependencies })
          .filter(d => workspace.packages.some(wp => wp.name === d)),
        scripts: Object.keys(p.scripts),
      })),
    };
  }

  private handleFindDependents(args: unknown): Record<string, unknown> {
    const a = args as { root?: string; package: string };
    const root = a?.root ? path.resolve(a.root) : findMonorepoRoot(process.cwd());
    const targetPkg = a.package;
    const workspace = getWorkspaceInfo(root);

    const dependents = findDependents(workspace.packages, targetPkg);

    return {
      package: targetPkg,
      found: workspace.packages.some(p => p.name === targetPkg),
      dependents,
      dependentCount: dependents.length,
      impact: dependents.length === 0 ? 'low' : dependents.length <= 2 ? 'medium' : 'high',
    };
  }

  private handleDependencyGraph(args: unknown): Record<string, unknown> {
    const a = args as { root?: string } | null;
    const root = a?.root ? path.resolve(a.root) : findMonorepoRoot(process.cwd());
    const workspace = getWorkspaceInfo(root);
    const graph = getDependencyGraph(workspace.packages);

    const graphObj: Record<string, string[]> = {};
    for (const [pkg, deps] of graph) {
      if (deps.length > 0) graphObj[pkg] = deps;
    }

    const circular: string[][] = [];
    for (const [pkg, deps] of graph) {
      for (const dep of deps) {
        const depDeps = graph.get(dep) || [];
        if (depDeps.includes(pkg)) {
          const pair = [pkg, dep].sort();
          if (!circular.some(c => c[0] === pair[0] && c[1] === pair[1])) {
            circular.push(pair);
          }
        }
      }
    }

    return {
      dependencies: graphObj,
      circularDependencies: circular,
      hasCircularDeps: circular.length > 0,
      summary: {
        totalPackages: workspace.packages.length,
        packagesWithInternalDeps: Object.keys(graphObj).length,
        circularCount: circular.length,
      },
    };
  }

  private handleCheckHealth(args: unknown): Record<string, unknown> {
    const a = args as { root?: string } | null;
    const root = a?.root ? path.resolve(a.root) : findMonorepoRoot(process.cwd());
    const workspace = getWorkspaceInfo(root);
    const issues: Record<string, unknown>[] = [];

    const depVersions = new Map<string, Map<string, string[]>>();
    for (const pkg of workspace.packages) {
      for (const [dep, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
        if (!depVersions.has(dep)) depVersions.set(dep, new Map());
        const versions = depVersions.get(dep)!;
        if (!versions.has(version)) versions.set(version, []);
        versions.get(version)!.push(pkg.name);
      }
    }

    for (const [dep, versions] of depVersions) {
      if (versions.size > 1) {
        issues.push({
          type: 'version-mismatch',
          severity: 'warning',
          dependency: dep,
          versions: Object.fromEntries(versions),
          message: `${dep} has ${versions.size} different versions across workspace`,
        });
      }
    }

    for (const pkg of workspace.packages) {
      if (pkg.type === 'app' && !pkg.scripts.build) {
        issues.push({
          type: 'missing-script',
          severity: 'warning',
          package: pkg.name,
          script: 'build',
          message: `App ${pkg.name} has no build script`,
        });
      }
      if (!pkg.scripts.lint && pkg.type !== 'config') {
        issues.push({
          type: 'missing-script',
          severity: 'info',
          package: pkg.name,
          script: 'lint',
          message: `${pkg.name} has no lint script`,
        });
      }
    }

    const graph = getDependencyGraph(workspace.packages);
    const seenPairs = new Set<string>();
    for (const [pkg, deps] of graph) {
      for (const dep of deps) {
        const depDeps = graph.get(dep) || [];
        if (depDeps.includes(pkg)) {
          const key = [pkg, dep].sort().join('|');
          if (!seenPairs.has(key)) {
            seenPairs.add(key);
            issues.push({
              type: 'circular-dependency',
              severity: 'error',
              packages: [pkg, dep],
              message: `Circular dependency: ${pkg} <-> ${dep}`,
            });
          }
        }
      }
    }

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;

    return {
      healthy: errors === 0,
      summary: `${errors} errors, ${warnings} warnings, ${issues.length} total issues`,
      issues,
      stats: {
        totalPackages: workspace.packages.length,
        uniqueDependencies: depVersions.size,
        versionMismatches: issues.filter(i => i.type === 'version-mismatch').length,
        circularDependencies: issues.filter(i => i.type === 'circular-dependency').length,
      },
    };
  }

  private handleFindSharedDeps(args: unknown): Record<string, unknown> {
    const a = args as { root?: string; minPackages?: number } | null;
    const root = a?.root ? path.resolve(a.root) : findMonorepoRoot(process.cwd());
    const minPackages = a?.minPackages ?? 2;
    const workspace = getWorkspaceInfo(root);

    const depUsage = new Map<string, Set<string>>();
    const internalNames = new Set(workspace.packages.map(p => p.name));

    for (const pkg of workspace.packages) {
      for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
        if (internalNames.has(dep)) continue;
        if (!depUsage.has(dep)) depUsage.set(dep, new Set());
        depUsage.get(dep)!.add(pkg.name);
      }
    }

    const shared: Record<string, { packages: string[]; count: number }> = {};
    for (const [dep, users] of depUsage) {
      if (users.size >= minPackages) {
        shared[dep] = { packages: [...users], count: users.size };
      }
    }

    const sorted = Object.entries(shared).sort((a, b) => b[1].count - a[1].count);

    return {
      minPackages,
      sharedDepsCount: sorted.length,
      sharedDeps: Object.fromEntries(sorted.slice(0, 30)),
      extractionCandidates: sorted.filter(([, v]) => v.count >= 3).map(([dep]) => dep),
    };
  }

  private handleSyncConfig(args: unknown): Record<string, unknown> {
    const a = args as { root?: string; configFile?: string };
    if (!a?.configFile || typeof a.configFile !== 'string') {
      throw new Error('configFile is required');
    }
    const root = a.root ? path.resolve(a.root) : findMonorepoRoot(process.cwd());
    const configFile = a.configFile;
    const workspace = getWorkspaceInfo(root);

    const configContents = new Map<string, string[]>();

    for (const pkg of workspace.packages) {
      const configPath = path.join(pkg.path, configFile);
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8').trim();
        if (!configContents.has(content)) configContents.set(content, []);
        configContents.get(content)!.push(pkg.name);
      }
    }

    const configs = [...configContents.entries()].map(([content, pkgs]) => ({
      hash: Buffer.from(content).toString('base64').slice(0, 12),
      packages: pkgs,
      contentPreview: content.slice(0, 200),
    }));

    const consistent = configs.length <= 1;

    return {
      configFile,
      consistent,
      uniqueVariants: configs.length,
      packagesWithConfig: configs.reduce((sum, c) => sum + c.packages.length, 0),
      packagesWithoutConfig: workspace.packages.length - configs.reduce((sum, c) => sum + c.packages.length, 0),
      variants: configs,
      recommendation: consistent
        ? 'All configs are consistent'
        : `${configs.length} different variants found. Consider creating a shared config package.`,
    };
  }
}

new MonorepoManagerServer().run().catch(console.error);
