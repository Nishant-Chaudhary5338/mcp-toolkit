import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractImports, getExternalPackageName, scanSourceFiles, getAllPackages } from './index.js';

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
