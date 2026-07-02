import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  extractImports,
  getExternalPackageName,
  scanSourceFiles,
  scanPackageFiles,
  extractUsedDepsFromFile,
  getAllPackages,
  findMonorepoRoot,
} from './index.js';

const tmpDir = path.join(os.tmpdir(), 'dep-auditor-test-' + process.pid);

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('extractImports', () => {
  it('extracts named ES module imports', () => {
    const code = `import { useState } from 'react';`;
    expect(extractImports(code)).toContain('react');
  });

  it('extracts default imports', () => {
    const code = `import React from 'react';`;
    expect(extractImports(code)).toContain('react');
  });

  it('extracts side-effect imports', () => {
    const code = `import 'reflect-metadata';`;
    expect(extractImports(code)).toContain('reflect-metadata');
  });

  it('extracts require() calls', () => {
    const code = `const fs = require('fs');`;
    expect(extractImports(code)).toContain('fs');
  });

  it('extracts multiple imports from the same file', () => {
    const code = `import React from 'react';\nimport { useState } from 'react';\nimport axios from 'axios';`;
    const imports = extractImports(code);
    expect(imports).toContain('react');
    expect(imports).toContain('axios');
  });

  it('extracts combined default + named imports', () => {
    const code = `import express, { type NextFunction, type Request } from 'express';`;
    expect(extractImports(code)).toContain('express');
  });
});

describe('getExternalPackageName', () => {
  it('returns null for relative imports', () => {
    expect(getExternalPackageName('./utils')).toBeNull();
    expect(getExternalPackageName('../types')).toBeNull();
  });

  it('returns null for absolute path imports', () => {
    expect(getExternalPackageName('/usr/lib/something')).toBeNull();
  });

  it('returns scoped package names correctly', () => {
    expect(getExternalPackageName('@radix-ui/react-dialog/inner')).toBe('@radix-ui/react-dialog');
    expect(getExternalPackageName('@mcp-showcase/shared')).toBe('@mcp-showcase/shared');
  });

  it('returns top-level package name for deep imports', () => {
    expect(getExternalPackageName('lodash/get')).toBe('lodash');
    expect(getExternalPackageName('react')).toBe('react');
  });
});

describe('scanSourceFiles', () => {
  it('finds .ts and .tsx files recursively', () => {
    const src = path.join(tmpDir, 'src');
    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'index.ts'), '');
    fs.writeFileSync(path.join(src, 'sub', 'comp.tsx'), '');
    const files = scanSourceFiles(src);
    expect(files).toHaveLength(2);
  });

  it('skips test and story files', () => {
    const src = path.join(tmpDir, 'src');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'index.ts'), '');
    fs.writeFileSync(path.join(src, 'index.test.ts'), '');
    fs.writeFileSync(path.join(src, 'index.stories.ts'), '');
    const files = scanSourceFiles(src);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/index\.ts$/);
  });

  it('skips node_modules', () => {
    const src = path.join(tmpDir, 'src');
    const nm = path.join(src, 'node_modules', 'react');
    fs.mkdirSync(nm, { recursive: true });
    fs.writeFileSync(path.join(src, 'app.ts'), '');
    fs.writeFileSync(path.join(nm, 'index.ts'), '');
    const files = scanSourceFiles(src);
    expect(files).toHaveLength(1);
  });

  it('returns empty array for non-existent directory', () => {
    expect(scanSourceFiles('/no/such/dir')).toEqual([]);
  });
});

describe('scanPackageFiles', () => {
  it('includes config, css, and test files outside src/', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'vite.config.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.css'), '');
    fs.writeFileSync(path.join(tmpDir, 'src', 'App.test.tsx'), '');

    const files = scanPackageFiles(tmpDir);
    expect(files.some(f => f.endsWith('vite.config.ts'))).toBe(true);
    expect(files.some(f => f.endsWith('index.css'))).toBe(true);
    expect(files.some(f => f.endsWith('App.test.tsx'))).toBe(true);
  });

  it('skips node_modules, build, dist, and coverage', () => {
    for (const dir of ['node_modules', 'build', 'dist', 'coverage']) {
      const nested = path.join(tmpDir, dir, 'x');
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(nested, 'index.ts'), '');
    }
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), '');

    const files = scanPackageFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/app\.ts$/);
  });
});

describe('extractUsedDepsFromFile', () => {
  it('detects deps referenced via CSS @import', () => {
    const deps = extractUsedDepsFromFile('src/index.css', `@import 'tailwindcss';`);
    expect(deps).toContain('tailwindcss');
  });

  it('ignores relative CSS @import specifiers', () => {
    const deps = extractUsedDepsFromFile('src/index.css', `@import './tokens.css';`);
    expect(deps).not.toContain('./tokens.css');
  });

  it('maps environment config value to the matching package', () => {
    const deps = extractUsedDepsFromFile('vitest.config.ts', `test: { environment: 'jsdom' }`);
    expect(deps).toContain('jsdom');
  });

  it('maps coverage provider config value to the scoped package', () => {
    const deps = extractUsedDepsFromFile('vitest.config.ts', `coverage: { provider: 'v8' }`);
    expect(deps).toContain('@vitest/coverage-v8');
  });

  it('does not treat unrelated array strings as usage', () => {
    const deps = extractUsedDepsFromFile(
      'vite.config.ts',
      `manualChunks: { radix: ['@radix-ui/react-scroll-area'] }`,
    );
    expect(deps).not.toContain('@radix-ui/react-scroll-area');
  });
});

describe('findMonorepoRoot', () => {
  it('finds root via npm workspaces field in package.json', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ workspaces: ['tools/*'] }));
    const sub = path.join(tmpDir, 'tools', 'a');
    fs.mkdirSync(sub, { recursive: true });
    expect(findMonorepoRoot(sub)).toBe(tmpDir);
  });

  it('falls back to the nearest package.json for a standalone package', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'standalone' }));
    expect(findMonorepoRoot(tmpDir)).toBe(tmpDir);
  });
});

describe('getAllPackages', () => {
  it('finds packages in apps/, packages/, tools/ subdirectories', () => {
    const root = tmpDir;
    const appsDir = path.join(root, 'apps', 'my-app');
    fs.mkdirSync(appsDir, { recursive: true });
    fs.writeFileSync(path.join(appsDir, 'package.json'), JSON.stringify({ name: 'my-app', dependencies: {} }));

    const packages = getAllPackages(root);
    expect(packages.some(p => p.name === 'my-app')).toBe(true);
  });

  it('uses directory name as fallback when package has no name field', () => {
    const dir = path.join(tmpDir, 'packages', 'unnamed');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({}));

    const packages = getAllPackages(tmpDir);
    expect(packages.some(p => p.name === 'unnamed')).toBe(true);
  });
});
