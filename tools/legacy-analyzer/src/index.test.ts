import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveSourceDir, readFileContent, fileExists, readPackageJson, hasConfigFile } from './utils/file-scanner.js';
import { detectDuplication } from './tools/10-detect-duplication.js';
import { detectAntiPatterns } from './tools/09-detect-anti-patterns.js';

const tmpDir = path.join(os.tmpdir(), 'legacy-analyzer-test-' + process.pid);

function makeDir(...parts: string[]): string {
  const dir = path.join(tmpDir, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(relPath: string, content: string): string {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// resolveSourceDir
// ---------------------------------------------------------------------------
describe('resolveSourceDir', () => {
  it('prefers src/ when it exists with source files', () => {
    const appRoot = makeDir('app-with-src');
    const src = path.join(appRoot, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'App.tsx'), 'export const x = 1;');
    expect(resolveSourceDir(appRoot)).toBe(src);
  });

  it('falls back to app/ for Next.js app-router projects', () => {
    const appRoot = makeDir('nextjs-app-router');
    const app = path.join(appRoot, 'app');
    fs.mkdirSync(app);
    fs.writeFileSync(path.join(app, 'page.tsx'), 'export default function Page() {}');
    expect(resolveSourceDir(appRoot)).toBe(app);
  });

  it('falls back to pages/ for Next.js pages-router projects', () => {
    const appRoot = makeDir('nextjs-pages-router');
    const pages = path.join(appRoot, 'pages');
    fs.mkdirSync(pages);
    fs.writeFileSync(path.join(pages, 'index.tsx'), 'export default function Home() {}');
    expect(resolveSourceDir(appRoot)).toBe(pages);
  });

  it('returns src/ path even when directory does not exist (fallback)', () => {
    const appRoot = makeDir('bare-root');
    const result = resolveSourceDir(appRoot);
    expect(result).toBe(path.join(appRoot, 'src'));
  });

  it('prefers src/ over app/ when both exist', () => {
    const appRoot = makeDir('both-src-and-app');
    const src = path.join(appRoot, 'src');
    const app = path.join(appRoot, 'app');
    fs.mkdirSync(src);
    fs.mkdirSync(app);
    fs.writeFileSync(path.join(src, 'main.tsx'), '');
    fs.writeFileSync(path.join(app, 'page.tsx'), '');
    expect(resolveSourceDir(appRoot)).toBe(src);
  });
});

// ---------------------------------------------------------------------------
// readFileContent
// ---------------------------------------------------------------------------
describe('readFileContent', () => {
  it('reads a file and returns its content', () => {
    writeFile('utils/helper.ts', 'export const PI = 3.14;');
    const content = readFileContent(path.join(tmpDir, 'utils/helper.ts'));
    expect(content).toBe('export const PI = 3.14;');
  });

  it('returns null for non-existent file', () => {
    expect(readFileContent('/nonexistent/path/file.ts')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fileExists
// ---------------------------------------------------------------------------
describe('fileExists', () => {
  it('returns true for existing file', () => {
    writeFile('exists.ts', '');
    expect(fileExists(path.join(tmpDir, 'exists.ts'))).toBe(true);
  });

  it('returns false for missing file', () => {
    expect(fileExists('/nonexistent/missing.ts')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readPackageJson
// ---------------------------------------------------------------------------
describe('readPackageJson', () => {
  it('reads and parses package.json', () => {
    const dir = makeDir('pkg-test');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'test-pkg', version: '1.0.0' }));
    const pkg = readPackageJson(dir);
    expect(pkg?.name).toBe('test-pkg');
    expect(pkg?.version).toBe('1.0.0');
  });

  it('returns null when package.json is missing', () => {
    const dir = makeDir('no-pkg');
    expect(readPackageJson(dir)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    const dir = makeDir('bad-pkg');
    fs.writeFileSync(path.join(dir, 'package.json'), '{ invalid json }');
    expect(readPackageJson(dir)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasConfigFile
// ---------------------------------------------------------------------------
describe('hasConfigFile', () => {
  it('returns true when one of the config files is present', () => {
    const dir = makeDir('cfg-test');
    fs.writeFileSync(path.join(dir, 'vite.config.ts'), '');
    expect(hasConfigFile(dir, ['vite.config.ts', 'vite.config.js'])).toBe(true);
  });

  it('returns false when none of the config files are present', () => {
    const dir = makeDir('nocfg-test');
    expect(hasConfigFile(dir, ['next.config.js', 'next.config.ts'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scaling regressions (QA harness regression)
//
// detectDuplication and detectAntiPatterns used to compare every (file, file)
// pair unconditionally — O(n^2). Against a 10k-file synthetic repo this made
// the aggregate analyze-legacy-app tool time out past 120s (previously
// unbounded). Both now bucket/filter candidates before the pairwise
// comparison. These tests use a moderate file count (400) with a tight time
// budget so a regression to the old O(n^2) behavior fails fast in CI without
// needing a full 10k-file fixture.
// ---------------------------------------------------------------------------
describe('detectDuplication scaling (QA harness regression)', () => {
  it('completes quickly on many components with varied hook signatures', async () => {
    const appRoot = makeDir('scale-duplication');
    const src = path.join(appRoot, 'src', 'components');
    fs.mkdirSync(src, { recursive: true });

    const hookSets = [
      ['useState', 'useMemo'],
      ['useState', 'useCallback'],
      ['useEffect', 'useMemo'],
      ['useState', 'useEffect', 'useMemo'],
    ];

    const N = 400;
    for (let i = 0; i < N; i++) {
      const hooks = hookSets[i % hookSets.length];
      const hookLines = hooks.map((h) => `  const _${h} = ${h}(() => ${i}, []);`).join('\n');
      const body = Array.from({ length: 25 }, (_, l) => `  // filler line ${l} for component ${i}`).join('\n');
      fs.writeFileSync(
        path.join(src, `Component${i}.tsx`),
        `import { ${hooks.join(', ')} } from 'react';\n\nexport function Component${i}() {\n${hookLines}\n${body}\n  return null;\n}\n`
      );
    }

    const start = Date.now();
    const result = await detectDuplication(appRoot);
    const elapsed = Date.now() - start;

    expect(Array.isArray(result.duplicateComponents)).toBe(true);
    // A regression to the old unbucketed O(n^2) comparison took multiple
    // seconds even at N=400 in local timing; the bucketed version completes
    // in well under a second. 5s leaves generous CI headroom while still
    // catching a real quadratic regression.
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('detectAntiPatterns tight-coupling scaling (QA harness regression)', () => {
  it('completes quickly on many files with sparse import edges', async () => {
    const appRoot = makeDir('scale-anti-patterns');
    const src = path.join(appRoot, 'src');
    fs.mkdirSync(src, { recursive: true });

    const N = 400;
    for (let i = 0; i < N; i++) {
      // Each file imports only its immediate neighbor — sparse edges, so the
      // old all-pairs loop did far more work than the actual import graph
      // warranted.
      const importLine = i > 0 ? `import { Comp${i - 1} } from './Comp${i - 1}';\n` : '';
      fs.writeFileSync(
        path.join(src, `Comp${i}.tsx`),
        `${importLine}export function Comp${i}() { return null; }\n`
      );
    }

    const start = Date.now();
    const result = await detectAntiPatterns(appRoot);
    const elapsed = Date.now() - start;

    expect(Array.isArray(result.antiPatterns)).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });

  it('still flags coupling via basename substring match even with no resolved import edge (QA session 2 regression)', () => {
    // A perf-optimization attempt restricted candidate pairs to resolved
    // import-graph edges, reasoning that calculateCoupling can only score
    // nonzero when an import edge exists between the pair. That's false:
    // calculateCoupling does a raw substring check on the import source
    // string, which can be true with NO resolved edge — e.g. importing
    // './formatter' (resolves to formatter.ts) scores coupling against an
    // unrelated format.ts, since 'formatter'.includes('format'). Verified
    // this scenario would have been silently dropped by that optimization
    // before reverting it; this test locks the correct (full-scan) behavior in.
    const appRoot = makeDir('coupling-substring-no-edge');
    const src = path.join(appRoot, 'src');
    fs.mkdirSync(src, { recursive: true });
    // Three imports whose source strings contain "format" (format.ts's
    // basename) without any of them resolving to format.ts itself.
    fs.writeFileSync(
      path.join(src, 'a.tsx'),
      `import { x } from './formatter';\nimport { y } from './formatting-utils';\nimport { z } from './dateformat';\nexport function A() { return x + y + z; }\n`
    );
    fs.writeFileSync(path.join(src, 'format.tsx'), `export function Format() { return null; }\n`);

    return detectAntiPatterns(appRoot).then((result) => {
      const coupling = result.antiPatterns.find((p) => p.type === 'tight-coupling');
      expect(coupling).toBeDefined();
      expect(coupling!.files.some((f) => f.includes('a.tsx') && f.includes('format.tsx'))).toBe(true);
    });
  });
});
