import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveSourceDir, readFileContent, fileExists, readPackageJson, hasConfigFile } from './utils/file-scanner.js';

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
