import * as fs from 'fs';
import * as path from 'path';
import type { PackageInfo, WorkspaceInfo } from './types.js';

export function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== '/' && dir !== '.') {
    if (
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(dir, 'turbo.json')) ||
      fs.existsSync(path.join(dir, 'lerna.json'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error('No monorepo root found (no pnpm-workspace.yaml, turbo.json, or lerna.json)');
}

export function readWorkspaceConfig(root: string): string[] {
  const pnpmWorkspace = path.join(root, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspace)) {
    const content = fs.readFileSync(pnpmWorkspace, 'utf-8');
    const match = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/);
    if (match) {
      return match[1]
        .split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.replace(/.*-\s+['"]?/, '').replace(/['"]$/, '').trim())
        .filter(Boolean);
    }
  }
  return ['apps/*', 'packages/*', 'tools/*'];
}

export function expandGlob(pattern: string, root: string): string[] {
  const results: string[] = [];
  const basePattern = pattern.replace(/\*$/, '');

  if (pattern.includes('*')) {
    const parentDir = path.join(root, basePattern);
    if (fs.existsSync(parentDir)) {
      const entries = fs.readdirSync(parentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pkgPath = path.join(parentDir, entry.name);
          if (fs.existsSync(path.join(pkgPath, 'package.json'))) {
            results.push(pkgPath);
          }
        }
      }
    }
  } else {
    const pkgPath = path.join(root, pattern);
    if (fs.existsSync(path.join(pkgPath, 'package.json'))) {
      results.push(pkgPath);
    }
  }

  return results;
}

export function getPackageInfo(pkgPath: string): PackageInfo | null {
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return null;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as Record<string, unknown>;

  let type: PackageInfo['type'] = 'package';
  if (pkgPath.includes('/apps/')) type = 'app';
  else if (pkgPath.includes('/tools/')) type = 'tool';
  else if (
    pkgPath.includes('/configs/') ||
    pkgPath.includes('/packages/eslint') ||
    pkgPath.includes('/packages/typescript') ||
    pkgPath.includes('/packages/tailwind')
  ) {
    type = 'config';
  }

  return {
    name: (pkg.name as string) || path.basename(pkgPath),
    version: (pkg.version as string) || '0.0.0',
    path: pkgPath,
    type,
    dependencies: (pkg.dependencies as Record<string, string>) || {},
    devDependencies: (pkg.devDependencies as Record<string, string>) || {},
    scripts: (pkg.scripts as Record<string, string>) || {},
    exports: pkg.exports as Record<string, unknown> | undefined,
  };
}

export function getWorkspaceInfo(root: string): WorkspaceInfo {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as Record<string, unknown>;
  const workspacePatterns = readWorkspaceConfig(root);
  const packages: PackageInfo[] = [];

  for (const pattern of workspacePatterns) {
    const pkgPaths = expandGlob(pattern, root);
    for (const pkgPath of pkgPaths) {
      const info = getPackageInfo(pkgPath);
      if (info) packages.push(info);
    }
  }

  let turboVersion: string | undefined;
  const turboJson = path.join(root, 'turbo.json');
  if (fs.existsSync(turboJson)) {
    const turboPkg = path.join(root, 'node_modules/turbo/package.json');
    if (fs.existsSync(turboPkg)) {
      const turboPkgJson = JSON.parse(fs.readFileSync(turboPkg, 'utf-8')) as Record<string, unknown>;
      turboVersion = turboPkgJson.version as string;
    }
  }

  return {
    root,
    packageManager: (rootPkg.packageManager as string) || 'unknown',
    turboVersion,
    packages,
  };
}

export function getDependencyGraph(packages: PackageInfo[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const pkgNames = new Set(packages.map(p => p.name));

  for (const pkg of packages) {
    const deps: string[] = [];
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of Object.keys(allDeps)) {
      if (pkgNames.has(dep)) {
        deps.push(dep);
      }
    }
    graph.set(pkg.name, deps);
  }

  return graph;
}

export function findDependents(packages: PackageInfo[], targetPkg: string): string[] {
  const dependents: string[] = [];
  for (const pkg of packages) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps[targetPkg] && pkg.name !== targetPkg) {
      dependents.push(pkg.name);
    }
  }
  return dependents;
}
