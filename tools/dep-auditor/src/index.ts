#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface MonorepoPackage {
  name: string;
  path: string;
  pkg: PackageJson;
}

// ============================================================================
// HELPERS
// ============================================================================

export function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(dir, 'turbo.json'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error('No monorepo root found (no pnpm-workspace.yaml or turbo.json)');
}

export function getAllPackages(root: string): MonorepoPackage[] {
  const dirs = ['apps', 'packages', 'tools'] as const;
  const packages: MonorepoPackage[] = [];

  for (const dir of dirs) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgJson = path.join(dirPath, entry.name, 'package.json');
      if (fs.existsSync(pkgJson)) {
        const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
        packages.push({ name: pkg.name ?? entry.name, path: path.join(dirPath, entry.name), pkg });
      }
    }
  }
  return packages;
}

export function scanSourceFiles(
  dir: string,
  exts: string[] = ['.ts', '.tsx', '.js', '.jsx'],
): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const SKIP = new Set(['node_modules', 'build', 'dist', '.next', '__tests__', '.git']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      files.push(...scanSourceFiles(fullPath, exts));
    } else if (
      exts.some(e => entry.name.endsWith(e)) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.') &&
      !entry.name.includes('.stories.')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

export function extractImports(content: string): string[] {
  const imports: string[] = [];
  for (const m of content.matchAll(/import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g)) {
    imports.push(m[1]);
  }
  for (const m of content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    imports.push(m[1]);
  }
  return imports;
}

export function getExternalPackageName(importPath: string): string | null {
  if (importPath.startsWith('.') || importPath.startsWith('/')) return null;
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importPath;
  }
  return importPath.split('/')[0];
}

const TOOLING_DEPS = new Set([
  'typescript', 'vitest', 'jest', 'eslint', 'prettier', '@types/node',
]);

// ============================================================================
// SERVER
// ============================================================================

class DepAuditorServer extends McpServerBase {
  constructor() {
    super({ name: 'dep-auditor', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'find_unused_deps',
      'Find declared dependencies that are not imported anywhere in the package source files.',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
          package: { type: 'string', description: 'Target package name (all packages if omitted)' },
        },
      },
      async (args) => {
        const { root: rootArg, package: targetPkg } = (args ?? {}) as {
          root?: string;
          package?: string;
        };
        const root = rootArg ? path.resolve(rootArg) : findMonorepoRoot(process.cwd());
        const packages = getAllPackages(root);
        const filtered = targetPkg ? packages.filter(p => p.name === targetPkg) : packages;

        const results: unknown[] = [];
        for (const pkg of filtered) {
          const declaredDeps = new Set([
            ...Object.keys(pkg.pkg.dependencies ?? {}),
            ...Object.keys(pkg.pkg.devDependencies ?? {}),
          ]);
          const usedDeps = new Set<string>();
          for (const file of scanSourceFiles(path.join(pkg.path, 'src'))) {
            for (const imp of extractImports(fs.readFileSync(file, 'utf-8'))) {
              const ext = getExternalPackageName(imp);
              if (ext) usedDeps.add(ext);
            }
          }
          const unused = [...declaredDeps].filter(
            d => !d.startsWith('@types/') && !TOOLING_DEPS.has(d) && !usedDeps.has(d),
          );
          if (unused.length > 0) {
            results.push({ package: pkg.name, unusedDeps: unused, totalDeclared: declaredDeps.size });
          }
        }

        return this.success({
          summary: `Found ${results.reduce((n: number, r) => n + (r as { unusedDeps: string[] }).unusedDeps.length, 0)} potentially unused deps across ${results.length} packages`,
          packagesAudited: filtered.length,
          results,
        });
      }
    );

    this.addTool(
      'find_duplicate_deps',
      'Find dependencies declared with different versions across monorepo packages.',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
        },
      },
      async (args) => {
        const { root: rootArg } = (args ?? {}) as { root?: string };
        const root = rootArg ? path.resolve(rootArg) : findMonorepoRoot(process.cwd());
        const packages = getAllPackages(root);

        const depVersions = new Map<string, Map<string, string[]>>();
        for (const pkg of packages) {
          const allDeps = { ...pkg.pkg.dependencies, ...pkg.pkg.devDependencies };
          for (const [dep, version] of Object.entries(allDeps)) {
            if (!depVersions.has(dep)) depVersions.set(dep, new Map());
            const versions = depVersions.get(dep)!;
            if (!versions.has(version)) versions.set(version, []);
            versions.get(version)!.push(pkg.name);
          }
        }

        const duplicates = [...depVersions.entries()]
          .filter(([, versions]) => versions.size > 1)
          .map(([dep, versions]) => ({
            dependency: dep,
            versions: Object.fromEntries(versions),
            versionCount: versions.size,
          }))
          .sort((a, b) => b.versionCount - a.versionCount);

        return this.success({
          summary: `Found ${duplicates.length} dependencies with version mismatches`,
          totalDependencies: depVersions.size,
          duplicates,
          recommendation: duplicates.length > 0
            ? 'Align versions using a shared dependency or pnpm overrides'
            : 'All dependency versions are consistent',
        });
      }
    );

    this.addTool(
      'check_outdated',
      'Compare declared dependency versions against the latest npm versions.',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
          package: { type: 'string', description: 'Target package name (all packages if omitted)' },
        },
      },
      async (args) => {
        const { root: rootArg, package: targetPkg } = (args ?? {}) as {
          root?: string;
          package?: string;
        };
        const root = rootArg ? path.resolve(rootArg) : findMonorepoRoot(process.cwd());
        const packages = getAllPackages(root);
        const filtered = targetPkg ? packages.filter(p => p.name === targetPkg) : packages;

        const results: unknown[] = [];
        for (const pkg of filtered) {
          const allDeps = { ...pkg.pkg.dependencies, ...pkg.pkg.devDependencies };
          for (const [dep, declared] of Object.entries(allDeps)) {
            try {
              const latestVersion = execSync(`npm view ${dep} version 2>/dev/null`, {
                encoding: 'utf-8', timeout: 10000,
              }).trim();
              const cleanDeclared = declared.replace(/[^0-9.]/g, '');
              if (latestVersion && cleanDeclared !== latestVersion) {
                results.push({
                  package: pkg.name, dependency: dep,
                  declared: cleanDeclared, latest: latestVersion,
                  type: pkg.pkg.dependencies?.[dep] ? 'production' : 'dev',
                });
              }
            } catch { /* skip — npm unreachable or package not found */ }
          }
        }

        const seen = new Set<string>();
        const unique = results.filter(r => {
          const row = r as { package: string; dependency: string };
          const key = `${row.package}:${row.dependency}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).sort((a, b) => (a as { dependency: string }).dependency.localeCompare((b as { dependency: string }).dependency));

        return this.success({
          summary: `Found ${unique.length} outdated dependencies`,
          packagesChecked: filtered.length,
          outdated: unique.slice(0, 50),
        });
      }
    );

    this.addTool(
      'analyze_bundle_impact',
      'Estimate bundle size contribution by scanning which production deps are actually imported.',
      {
        type: 'object',
        properties: {
          root: { type: 'string', description: 'Monorepo root path (auto-detected if omitted)' },
        },
      },
      async (args) => {
        const { root: rootArg } = (args ?? {}) as { root?: string };
        const root = rootArg ? path.resolve(rootArg) : findMonorepoRoot(process.cwd());
        const packages = getAllPackages(root);

        const analysis = packages.map(pkg => {
          const prodDeps = new Set(Object.keys(pkg.pkg.dependencies ?? {}));
          const devDeps = new Set(Object.keys(pkg.pkg.devDependencies ?? {}));
          const usedInSrc = new Set<string>();

          for (const file of scanSourceFiles(path.join(pkg.path, 'src'))) {
            for (const imp of extractImports(fs.readFileSync(file, 'utf-8'))) {
              const ext = getExternalPackageName(imp);
              if (ext) usedInSrc.add(ext);
            }
          }

          return {
            package: pkg.name,
            productionDeps: prodDeps.size,
            devDeps: devDeps.size,
            usedInProduction: [...usedInSrc].filter(d => prodDeps.has(d)),
            usedInDevOnly: [...usedInSrc].filter(d => devDeps.has(d) && !prodDeps.has(d)),
            declaredButNotUsed: [...prodDeps].filter(d => !usedInSrc.has(d)),
          };
        });

        return this.success({
          summary: `Analyzed ${packages.length} packages for bundle impact`,
          packages: analysis,
        });
      }
    );
  }
}

new DepAuditorServer().run().catch(console.error);
