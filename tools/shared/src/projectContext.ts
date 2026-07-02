import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared "resolve the target project's context" utility.
 *
 * Every generator/analyzer in this toolkit was independently guessing the shape
 * of the project it was pointed at — where the `cn` util lives, whether there's
 * a tsconfig up the tree, what token system is in use, whether it's a monorepo.
 * Those guesses were the single biggest source of dogfood bugs (wrong import
 * paths, false "no tsconfig" grades, phantom "extract to @repo/ui" advice).
 *
 * This module centralises that detection so the tools agree on one answer.
 */

export type Framework =
  | 'next'
  | 'vite'
  | 'cra'
  | 'remix'
  | 'gatsby'
  | 'react'
  | 'unknown';

export type TokenSystem = 'shadcn' | 'css-vars' | 'none';

export interface AliasMapping {
  /** e.g. "@" for a `"@/*"` path mapping */
  prefix: string;
  /** absolute directory the prefix resolves to (e.g. <root>/src) */
  baseDir: string;
}

export interface ProjectContext {
  /** nearest ancestor dir containing a package.json (the package root) */
  root: string | null;
  /** nearest ancestor tsconfig.json (walking up), or null */
  tsconfigPath: string | null;
  framework: Framework;
  isMonorepo: boolean;
  /** a workspace UI package (@repo/ui, packages/ui, scoped ui) exists */
  hasRepoUi: boolean;
  tokenSystem: TokenSystem;
  /** `@/*`-style path aliases from tsconfig, resolved to absolute dirs */
  aliases: AliasMapping[];
}

/** Walk up from `fromDir` (inclusive) looking for `filename`; return its path or null. */
export function findUp(fromDir: string, filename: string): string | null {
  let current = path.resolve(fromDir);
  // stop at filesystem root
  while (true) {
    const candidate = path.join(current, filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Nearest tsconfig.json walking up the tree (fixes false "No tsconfig.json found"). */
export function findTsconfig(fromDir: string): string | null {
  return findUp(fromDir, 'tsconfig.json');
}

/** Nearest package.json's directory — the package root for `fromDir`. */
export function findPackageRoot(fromDir: string): string | null {
  const pkg = findUp(fromDir, 'package.json');
  return pkg ? path.dirname(pkg) : null;
}

/**
 * Tolerant JSON parse for tsconfig/jsonc: strips `//` and block comments and
 * trailing commas. String-aware — a naive regex strip would corrupt tsconfig
 * `paths` values like `"@/*"` and `"**\/*.ts"` that legitimately contain the
 * comment delimiters inside string literals.
 */
export function parseJsonc<T = unknown>(raw: string): T | null {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const next = raw[i + 1];
    if (inLine) {
      if (c === '\n') { inLine = false; out += c; }
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; i++; }
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') { out += next ?? ''; i++; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && next === '/') { inLine = true; i++; continue; }
    if (c === '/' && next === '*') { inBlock = true; i++; continue; }
    out += c;
  }
  const noTrailingCommas = out.replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(noTrailingCommas) as T;
  } catch {
    return null;
  }
}

interface TsconfigShape {
  extends?: string;
  references?: { path: string }[];
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

/**
 * Resolve tsconfig path aliases to absolute base dirs, following `extends` AND
 * `references`. The `references` case matters for Vite's default split-config
 * (root tsconfig.json just references tsconfig.app.json, where `paths` actually
 * lives) — without it we'd miss the project's `@/*` alias entirely.
 * Returns mappings like { prefix: "@", baseDir: "/abs/src" } for `"@/*": ["src/*"]`.
 */
export function readAliases(tsconfigPath: string, _seen = new Set<string>()): AliasMapping[] {
  if (_seen.has(tsconfigPath)) return [];
  _seen.add(tsconfigPath);

  let raw: string;
  try {
    raw = fs.readFileSync(tsconfigPath, 'utf-8');
  } catch {
    return [];
  }
  const cfg = parseJsonc<TsconfigShape>(raw);
  if (!cfg) return [];

  const dir = path.dirname(tsconfigPath);
  const inherited: AliasMapping[] = [];
  if (cfg.extends) {
    inherited.push(
      ...readAliases(
        path.resolve(dir, cfg.extends.endsWith('.json') ? cfg.extends : `${cfg.extends}.json`),
        _seen,
      ),
    );
  }
  for (const ref of cfg.references ?? []) {
    const refPath = path.resolve(dir, ref.path);
    const resolved = refPath.endsWith('.json') ? refPath : path.join(refPath, 'tsconfig.json');
    inherited.push(...readAliases(resolved, _seen));
  }

  const co = cfg.compilerOptions ?? {};
  const baseUrl = co.baseUrl ? path.resolve(dir, co.baseUrl) : dir;
  const mappings: AliasMapping[] = [];
  for (const [pattern, targets] of Object.entries(co.paths ?? {})) {
    if (!pattern.endsWith('/*') || !targets?.length) continue;
    const target = targets[0];
    if (!target.endsWith('/*')) continue;
    const prefix = pattern.slice(0, -2); // "@/*" -> "@/"  keep trailing slash off below
    const targetDir = path.resolve(baseUrl, target.slice(0, -2));
    mappings.push({ prefix: prefix.replace(/\/$/, ''), baseDir: targetDir });
  }
  // child mappings win over inherited ones with the same prefix
  const byPrefix = new Map<string, AliasMapping>();
  for (const m of [...inherited, ...mappings]) byPrefix.set(m.prefix, m);
  return [...byPrefix.values()];
}

function readPkg(root: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
  } catch {
    return null;
  }
}

function allDeps(pkg: Record<string, unknown> | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
}

/** Detect the framework. react-scripts / config-overrides ⇒ CRA (not just any .env). */
export function detectFramework(root: string): Framework {
  const pkg = readPkg(root);
  const deps = allDeps(pkg);
  if (deps.next) return 'next';
  if (
    deps['react-scripts'] ||
    fs.existsSync(path.join(root, 'config-overrides.js')) ||
    fs.existsSync(path.join(root, 'config-overrides.ts'))
  ) {
    return 'cra';
  }
  if (Object.keys(deps).some((d) => d.startsWith('@remix-run'))) return 'remix';
  if (deps.gatsby) return 'gatsby';
  if (
    deps.vite ||
    ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'].some((f) =>
      fs.existsSync(path.join(root, f)),
    )
  ) {
    return 'vite';
  }
  if (deps.react) return 'react';
  return 'unknown';
}

/** Monorepo detection: pnpm-workspace.yaml, or a package.json with `workspaces`. */
export function detectMonorepo(fromDir: string): { isMonorepo: boolean; workspaceRoot: string | null } {
  let current = path.resolve(fromDir);
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return { isMonorepo: true, workspaceRoot: current };
    }
    const pkg = readPkg(current);
    if (pkg && pkg.workspaces) return { isMonorepo: true, workspaceRoot: current };
    const parent = path.dirname(current);
    if (parent === current) return { isMonorepo: false, workspaceRoot: null };
    current = parent;
  }
}

/** Whether the monorepo exposes a shared UI package (so "extract to @repo/ui" is real advice). */
export function hasRepoUiPackage(workspaceRoot: string | null): boolean {
  if (!workspaceRoot) return false;
  for (const base of ['packages', 'libs', 'apps']) {
    const dir = path.join(workspaceRoot, base);
    if (!fs.existsSync(dir)) continue;
    for (const entry of safeReaddir(dir)) {
      const p = path.join(dir, entry);
      const pkg = readPkg(p);
      const name = pkg?.name as string | undefined;
      if (name && /\/ui$|(^|\/)ui$/.test(name)) return true;
      if (entry === 'ui' && pkg) return true;
    }
  }
  return false;
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * Detect the styling token system:
 *  - 'shadcn'   → components.json present, or shadcn's signature `--foreground`/
 *                 `--primary`/`--ring` token names (so `bg-primary` etc. resolve).
 *  - 'css-vars' → a custom token layer (Tailwind v4 `@theme`, or `:root` CSS vars)
 *                 that is NOT shadcn — emitting `bg-primary` would render unstyled.
 *  - 'none'     → no token layer detected.
 */
export function detectTokenSystem(root: string): TokenSystem {
  if (fs.existsSync(path.join(root, 'components.json'))) return 'shadcn';
  const cssFiles = ['src/index.css', 'src/globals.css', 'app/globals.css', 'styles/globals.css', 'src/app/globals.css'];
  for (const rel of cssFiles) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const css = safeRead(p);
    if (!css) continue;
    // shadcn ships --foreground/--primary/--ring as its signature token set
    if (/--foreground\b/.test(css) && /--(primary|ring|border|input)\b/.test(css)) return 'shadcn';
    // Tailwind v4 @theme block or classic :root CSS vars ⇒ a custom (non-shadcn) token layer
    if (/@theme\b/.test(css) || /:root\s*\{[^}]*--[\w-]+\s*:/.test(css)) return 'css-vars';
  }
  return 'none';
}

function safeRead(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * The correct import specifier for a `cn`/`clsx` util as seen from `fromFile`.
 *
 * Priority:
 *  1. An existing cn/utils file reachable via a tsconfig `@`-alias → use the alias
 *     (`@/lib/utils`), because that's what the rest of the project uses.
 *  2. An existing cn/utils file with no covering alias → a correct RELATIVE path
 *     computed from the output file's real location (fixes the off-by-one bug).
 *  3. Nothing found → default to `@/lib/utils` (shadcn convention) and flag it,
 *     so the tool can warn instead of emitting a path that resolves nowhere.
 */
export function resolveCnImport(fromFile: string): {
  importSpecifier: string;
  utilPath: string | null;
  needsCreation: boolean;
} {
  const fromDir = path.dirname(path.resolve(fromFile));
  const root = findPackageRoot(fromDir);
  const tsconfig = findTsconfig(fromDir);
  const aliases = tsconfig ? readAliases(tsconfig) : [];

  const candidates = [
    'src/lib/utils.ts',
    'src/lib/cn.ts',
    'src/lib/utils.tsx',
    'lib/utils.ts',
    'lib/cn.ts',
    'app/lib/utils.ts',
    'src/utils/cn.ts',
    'src/utils/utils.ts',
    'src/lib/utils/index.ts',
  ];

  let utilPath: string | null = null;
  if (root) {
    for (const rel of candidates) {
      const p = path.join(root, rel);
      if (fs.existsSync(p) && /export\s+(function|const)\s+cn\b/.test(safeRead(p) ?? '')) {
        utilPath = p;
        break;
      }
    }
  }

  if (utilPath) {
    // Prefer an alias that covers the util file.
    for (const a of aliases) {
      if (utilPath.startsWith(a.baseDir + path.sep)) {
        const rel = path.relative(a.baseDir, utilPath).replace(/\.(ts|tsx|js|jsx)$/, '');
        return { importSpecifier: `${a.prefix}/${rel}`.replace(/\\/g, '/'), utilPath, needsCreation: false };
      }
    }
    // No alias — emit a correct relative specifier from fromDir.
    let rel = path.relative(fromDir, utilPath).replace(/\.(ts|tsx|js|jsx)$/, '');
    if (!rel.startsWith('.')) rel = './' + rel;
    return { importSpecifier: rel.replace(/\\/g, '/'), utilPath, needsCreation: false };
  }

  // Nothing found — the safe default is the shadcn alias, and we flag creation.
  const hasAtAlias = aliases.some((a) => a.prefix === '@');
  return {
    importSpecifier: hasAtAlias ? '@/lib/utils' : '@/lib/utils',
    utilPath: null,
    needsCreation: true,
  };
}

/**
 * Correct relative import specifier from a test/spec file to its source file.
 * Fixes the generate-tests bug of importing from `./<symbolName>`.
 */
export function resolveRelativeImport(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(path.resolve(fromFile));
  let rel = path.relative(fromDir, path.resolve(toFile)).replace(/\.(ts|tsx|js|jsx)$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel.replace(/\\/g, '/');
}

/** One-shot: gather the full context for a directory or file inside a project. */
export function resolveProjectContext(fromPathInput: string): ProjectContext {
  const abs = path.resolve(fromPathInput);
  const fromDir = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? abs : path.dirname(abs);
  const root = findPackageRoot(fromDir);
  const tsconfigPath = findTsconfig(fromDir);
  const { isMonorepo, workspaceRoot } = detectMonorepo(fromDir);
  return {
    root,
    tsconfigPath,
    framework: root ? detectFramework(root) : 'unknown',
    isMonorepo,
    hasRepoUi: hasRepoUiPackage(workspaceRoot),
    tokenSystem: root ? detectTokenSystem(root) : 'none',
    aliases: tsconfigPath ? readAliases(tsconfigPath) : [],
  };
}
