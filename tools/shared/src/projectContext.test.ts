import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parseJsonc,
  readAliases,
  resolveCnImport,
  resolveRelativeImport,
  detectFramework,
  detectMonorepo,
  detectTokenSystem,
  findTsconfig,
} from './projectContext.js';

let dir: string;

function w(rel: string, content: string) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pctx-'));
});
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('parseJsonc', () => {
  it('strips comments and trailing commas', () => {
    expect(parseJsonc('{"a":1, /* x */ "b":2, // y\n}')).toEqual({ a: 1, b: 2 });
  });
  it('does NOT corrupt strings containing /* or */ (tsconfig globs)', () => {
    const parsed = parseJsonc<{ compilerOptions: { paths: Record<string, string[]> } }>(
      '{"compilerOptions":{"paths":{"@/*":["./src/*"],"x":["**/*.ts"]}}}',
    );
    expect(parsed?.compilerOptions.paths['@/*']).toEqual(['./src/*']);
    expect(parsed?.compilerOptions.paths['x']).toEqual(['**/*.ts']);
  });
});

describe('readAliases', () => {
  it('resolves @/* alias from compilerOptions.paths', () => {
    w('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }));
    const aliases = readAliases(path.join(dir, 'tsconfig.json'));
    expect(aliases).toContainEqual({ prefix: '@', baseDir: path.join(dir, 'src') });
  });
  it('follows project references (Vite split-config pattern)', () => {
    const sub = path.join(dir, 'ref');
    fs.mkdirSync(sub, { recursive: true });
    w('ref/tsconfig.app.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '~/*': ['./app/*'] } }, files: [] }));
    w('ref/tsconfig.json', JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }] }));
    const aliases = readAliases(path.join(sub, 'tsconfig.json'));
    expect(aliases).toContainEqual({ prefix: '~', baseDir: path.join(sub, 'app') });
  });
});

describe('resolveCnImport', () => {
  it('prefers the @ alias when it covers an existing cn util', () => {
    const proj = path.join(dir, 'aliased');
    fs.mkdirSync(path.join(proj, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{"name":"x"}');
    fs.writeFileSync(path.join(proj, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } } }));
    fs.writeFileSync(path.join(proj, 'src', 'lib', 'cn.ts'), 'export function cn() {}');
    const r = resolveCnImport(path.join(proj, 'src', 'components', 'ui', 'Badge', 'Badge.tsx'));
    expect(r.importSpecifier).toBe('@/lib/cn');
    expect(r.needsCreation).toBe(false);
  });
  it('computes a correct relative path (not off-by-one) when no alias', () => {
    const proj = path.join(dir, 'relative');
    fs.mkdirSync(path.join(proj, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{"name":"x"}');
    fs.writeFileSync(path.join(proj, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'lib', 'utils.ts'), 'export const cn = () => {}');
    const r = resolveCnImport(path.join(proj, 'src', 'components', 'ui', 'Badge', 'Badge.tsx'));
    // Badge.tsx -> up Badge/ui/components -> src, then lib/utils
    expect(r.importSpecifier).toBe('../../../lib/utils');
  });
  it('flags creation and returns @/lib/utils when nothing is found', () => {
    const proj = path.join(dir, 'empty');
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{"name":"x"}');
    const r = resolveCnImport(path.join(proj, 'components', 'Badge', 'Badge.tsx'));
    expect(r.needsCreation).toBe(true);
    expect(r.importSpecifier).toBe('@/lib/utils');
  });
});

describe('resolveRelativeImport', () => {
  it('imports from the source basename, not the symbol name', () => {
    expect(resolveRelativeImport('/a/b/types.test.ts', '/a/b/types.ts')).toBe('./types');
    expect(resolveRelativeImport('/a/b/__tests__/x.test.ts', '/a/b/thinking.ts')).toBe('../thinking');
  });
});

describe('detectFramework', () => {
  it('detects vite / next / cra distinctly', () => {
    const mk = (name: string, pkg: object, extra?: () => void) => {
      const p = path.join(dir, name);
      fs.mkdirSync(p, { recursive: true });
      fs.writeFileSync(path.join(p, 'package.json'), JSON.stringify(pkg));
      extra?.();
      return p;
    };
    expect(detectFramework(mk('vite-app', { dependencies: { react: '19' }, devDependencies: { vite: '5' } }))).toBe('vite');
    expect(detectFramework(mk('next-app', { dependencies: { next: '15', react: '19' } }))).toBe('next');
    expect(detectFramework(mk('cra-app', { dependencies: { 'react-scripts': '5', react: '18' } }))).toBe('cra');
  });
  it('does NOT flag a plain react app with a .env as CRA', () => {
    const p = path.join(dir, 'plain');
    fs.mkdirSync(p, { recursive: true });
    fs.writeFileSync(path.join(p, 'package.json'), JSON.stringify({ dependencies: { react: '18' } }));
    fs.writeFileSync(path.join(p, '.env'), 'X=1');
    expect(detectFramework(p)).toBe('react');
  });
});

describe('detectTokenSystem', () => {
  it('detects Tailwind v4 @theme as css-vars (not shadcn)', () => {
    const p = path.join(dir, 'tw4');
    fs.mkdirSync(path.join(p, 'src'), { recursive: true });
    fs.writeFileSync(path.join(p, 'src', 'index.css'), '@import "tailwindcss";\n@theme { --color-brand: #0af; }');
    expect(detectTokenSystem(p)).toBe('css-vars');
  });
  it('detects shadcn token names', () => {
    const p = path.join(dir, 'shadcn');
    fs.mkdirSync(path.join(p, 'src'), { recursive: true });
    fs.writeFileSync(path.join(p, 'src', 'globals.css'), ':root { --foreground: 0 0% 0%; --primary: 1 2% 3%; }');
    expect(detectTokenSystem(p)).toBe('shadcn');
  });
});

describe('detectMonorepo + findTsconfig', () => {
  it('detects pnpm-workspace.yaml and walks up for tsconfig', () => {
    const root = path.join(dir, 'mono');
    fs.mkdirSync(path.join(root, 'apps', 'web', 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}');
    const res = detectMonorepo(path.join(root, 'apps', 'web', 'src'));
    expect(res.isMonorepo).toBe(true);
    expect(findTsconfig(path.join(root, 'apps', 'web', 'src'))).toBe(path.join(root, 'tsconfig.json'));
  });
});
