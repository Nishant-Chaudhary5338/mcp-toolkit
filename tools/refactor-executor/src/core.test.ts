import { describe, it, expect } from 'vitest';
import {
  calculateNewImportPath,
  generateImportStatement,
  generateExportStatement,
  generateReExport,
  rewriteSingleImport,
  extractImports,
} from './utils/ast-transform.js';

describe('generateImportStatement', () => {
  it('emits default, named, and side-effect imports', () => {
    expect(generateImportStatement(['React'], 'react', true)).toBe("import React from 'react';");
    expect(generateImportStatement(['useState', 'useEffect'], 'react')).toBe("import { useState, useEffect } from 'react';");
    expect(generateImportStatement([], './styles.css')).toBe("import './styles.css';");
  });
});

describe('generateExportStatement / generateReExport', () => {
  it('emits default vs named exports', () => {
    expect(generateExportStatement(['Button'], true)).toBe('export default Button;');
    expect(generateExportStatement(['a', 'b'])).toBe('export { a, b };');
  });
  it('emits barrel re-exports', () => {
    expect(generateReExport('./Button')).toBe("export * from './Button';");
    expect(generateReExport('./Button', ['Button'], true)).toBe("export { default as Button } from './Button';");
    expect(generateReExport('./util', ['a', 'b'])).toBe("export { a, b } from './util';");
  });
});

describe('calculateNewImportPath', () => {
  it('computes a relative path and strips the extension', () => {
    const p = calculateNewImportPath('/app/src/pages/Home.tsx', '/app/src/components/Button.tsx', '/app/src/Button.tsx', '../Button');
    expect(p).toBe('../components/Button');
  });
});

describe('rewriteSingleImport', () => {
  it('replaces the specifier in single or double quotes', () => {
    expect(rewriteSingleImport("import x from './old'", './old', './new')).toContain('./new');
    expect(rewriteSingleImport('import x from "./old"', './old', './new')).toContain('./new');
  });
});

describe('extractImports', () => {
  it('extracts import declarations from parsed source', async () => {
    const parser = await import('@typescript-eslint/parser');
    const src = "import React from 'react';\nimport { render } from '@testing-library/react';\n";
    const ast = parser.parse(src, { ecmaVersion: 2022, sourceType: 'module', range: true, loc: true });
    const imports = extractImports(ast, src);
    expect(imports.map((i) => i.source)).toContain('react');
    expect(imports.map((i) => i.source)).toContain('@testing-library/react');
  });
});
