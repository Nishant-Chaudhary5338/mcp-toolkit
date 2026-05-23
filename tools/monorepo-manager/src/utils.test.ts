import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { findMonorepoRoot, expandGlob, getPackageInfo, getDependencyGraph, findDependents } from './utils.js';
import type { PackageInfo } from './types.js';

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'monorepo-test-'));
  tmpDirs.push(d);
  return d;
}

function writeJson(filePath: string, obj: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
}

afterEach(() => {
  for (const d of tmpDirs) if (fs.existsSync(d)) fs.rmSync(d, { recursive: true });
  tmpDirs = [];
});

describe('findMonorepoRoot', () => {
  it('finds root with pnpm-workspace.yaml', () => {
    const root = makeTmpDir();
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    const sub = path.join(root, 'packages', 'my-pkg');
    fs.mkdirSync(sub, { recursive: true });
    expect(findMonorepoRoot(sub)).toBe(root);
  });

  it('finds root with turbo.json', () => {
    const root = makeTmpDir();
    fs.writeFileSync(path.join(root, 'turbo.json'), '{}');
    expect(findMonorepoRoot(root)).toBe(root);
  });

  it('throws when no root found', () => {
    const isolated = makeTmpDir();
    expect(() => findMonorepoRoot(isolated)).toThrow('No monorepo root found');
  });
});

describe('expandGlob', () => {
  it('expands wildcard pattern to package directories', () => {
    const root = makeTmpDir();
    const pkgA = path.join(root, 'packages', 'a');
    const pkgB = path.join(root, 'packages', 'b');
    writeJson(path.join(pkgA, 'package.json'), { name: 'a', version: '1.0.0' });
    writeJson(path.join(pkgB, 'package.json'), { name: 'b', version: '1.0.0' });

    const results = expandGlob('packages/*', root);
    expect(results).toHaveLength(2);
    expect(results.some(r => r.endsWith('/a'))).toBe(true);
    expect(results.some(r => r.endsWith('/b'))).toBe(true);
  });

  it('excludes directories without package.json', () => {
    const root = makeTmpDir();
    const pkgA = path.join(root, 'packages', 'a');
    const bare = path.join(root, 'packages', 'bare');
    writeJson(path.join(pkgA, 'package.json'), { name: 'a' });
    fs.mkdirSync(bare, { recursive: true });

    const results = expandGlob('packages/*', root);
    expect(results).toHaveLength(1);
  });

  it('returns empty array when parent dir does not exist', () => {
    const root = makeTmpDir();
    expect(expandGlob('nonexistent/*', root)).toHaveLength(0);
  });
});

describe('getPackageInfo', () => {
  it('returns package info from package.json', () => {
    const root = makeTmpDir();
    writeJson(path.join(root, 'package.json'), {
      name: 'my-app',
      version: '2.0.0',
      scripts: { build: 'tsc' },
      dependencies: { react: '^18.0.0' },
    });

    const info = getPackageInfo(root);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('my-app');
    expect(info!.version).toBe('2.0.0');
    expect(info!.scripts.build).toBe('tsc');
  });

  it('returns null when package.json is missing', () => {
    const dir = makeTmpDir();
    expect(getPackageInfo(dir)).toBeNull();
  });

  it('detects tool type from path', () => {
    const root = makeTmpDir();
    const toolDir = path.join(root, 'tools', 'my-tool');
    writeJson(path.join(toolDir, 'package.json'), { name: 'my-tool', version: '1.0.0' });

    const info = getPackageInfo(toolDir);
    expect(info!.type).toBe('tool');
  });
});

describe('getDependencyGraph', () => {
  it('returns empty map for empty packages', () => {
    const graph = getDependencyGraph([]);
    expect(graph.size).toBe(0);
  });

  it('builds internal dependency edges', () => {
    const pkgs: PackageInfo[] = [
      { name: 'a', version: '1.0.0', path: '/a', type: 'package', dependencies: { b: '*' }, devDependencies: {}, scripts: {} },
      { name: 'b', version: '1.0.0', path: '/b', type: 'package', dependencies: {}, devDependencies: {}, scripts: {} },
    ];
    const graph = getDependencyGraph(pkgs);
    expect(graph.get('a')).toContain('b');
    expect(graph.get('b')).toHaveLength(0);
  });

  it('ignores external dependencies', () => {
    const pkgs: PackageInfo[] = [
      { name: 'a', version: '1.0.0', path: '/a', type: 'package', dependencies: { react: '^18.0.0' }, devDependencies: {}, scripts: {} },
    ];
    const graph = getDependencyGraph(pkgs);
    expect(graph.get('a')).toHaveLength(0);
  });
});

describe('findDependents', () => {
  it('returns empty array when no dependents', () => {
    const pkgs: PackageInfo[] = [
      { name: 'a', version: '1.0.0', path: '/a', type: 'package', dependencies: {}, devDependencies: {}, scripts: {} },
    ];
    expect(findDependents(pkgs, 'a')).toHaveLength(0);
  });

  it('finds packages that depend on target', () => {
    const pkgs: PackageInfo[] = [
      { name: 'app', version: '1.0.0', path: '/app', type: 'app', dependencies: { 'shared-lib': '*' }, devDependencies: {}, scripts: {} },
      { name: 'shared-lib', version: '1.0.0', path: '/lib', type: 'package', dependencies: {}, devDependencies: {}, scripts: {} },
    ];
    const dependents = findDependents(pkgs, 'shared-lib');
    expect(dependents).toContain('app');
  });

  it('returns empty for nonexistent package', () => {
    const pkgs: PackageInfo[] = [
      { name: 'a', version: '1.0.0', path: '/a', type: 'package', dependencies: {}, devDependencies: {}, scripts: {} },
    ];
    expect(findDependents(pkgs, 'nonexistent')).toHaveLength(0);
  });
});
