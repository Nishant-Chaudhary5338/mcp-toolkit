// @ts-nocheck
// ============================================================================
// AST PARSER - Parse JS/JSX/TS/TSX files using @typescript-eslint/parser
// ============================================================================

import * as path from 'path';
import fs from 'fs-extra';
import { createRequire } from 'module';
import type { ParsedFile, ImportInfo, FunctionInfo } from '../types.js';

const _require = createRequire(import.meta.url);

let parser: unknown = null;
function getParser() {
  if (!parser) parser = _require('@typescript-eslint/parser');
  return parser;
}

function getParserOptions(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ecmaVersion: 2022 as const,
    sourceType: 'module' as const,
    ecmaFeatures: { jsx: ext === '.jsx' || ext === '.tsx' },
  };
}

export function parseFile(filePath: string): ParsedFile | null {
  let content: string;
  try { content = fs.readFileSync(filePath, 'utf-8'); } catch { return null; }

  try {
    const p = getParser();
    const ast = p.parse(content, { ...getParserOptions(filePath), range: true, loc: true });
    return { filePath, content, ast, imports: extractImports(ast) };
  } catch {
    try {
      const p = getParser();
      const ast = p.parse(content, { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true }, range: true, loc: true });
      return { filePath, content, ast, imports: extractImports(ast) };
    } catch {
      return null;
    }
  }
}

export function extractImports(ast: unknown): ImportInfo[] {
  const imports: ImportInfo[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration') {
      const specifiers: string[] = [];
      let isDefault = false;
      for (const spec of node.specifiers || []) {
        if (spec.type === 'ImportDefaultSpecifier') { specifiers.push(spec.local?.name || ''); isDefault = true; }
        else if (spec.type === 'ImportSpecifier') specifiers.push(spec.imported?.name || spec.local?.name || '');
      }
      imports.push({ source: node.source?.value || '', specifiers, isDefault, line: node.loc?.start?.line || 0, startColumn: 0, endColumn: 0 });
    }
    for (const key of Object.keys(node)) {
      if (['parent', 'loc', 'range'].includes(key)) continue;
      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) { for (const item of child) walk(item); }
      else if (child && typeof child === 'object' && (child as Record<string, unknown>).type) walk(child);
    }
  }
  walk(ast);
  return imports;
}

export function hasJSX(ast: unknown): boolean {
  let found = false;
  function walk(node: unknown) {
    if (found || !node || typeof node !== 'object') return;
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') { found = true; return; }
    for (const key of Object.keys(node)) {
      if (['parent', 'loc', 'range'].includes(key)) continue;
      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) { for (const item of child) walk(item); }
      else if (child && typeof child === 'object' && (child as Record<string, unknown>).type) walk(child);
    }
  }
  walk(ast);
  return found;
}

export function extractFunctions(ast: unknown): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const exportedNames = new Set<string>();

  function collectExports(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const decl = node.declaration;
      if (decl.type === 'FunctionDeclaration' && decl.id?.name) exportedNames.add(decl.id.name);
      else if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations || []) { if (d.id?.name) exportedNames.add(d.id.name); }
      }
    }
    if (node.type === 'ExportDefaultDeclaration' && node.declaration?.id?.name) exportedNames.add(node.declaration.id.name);
    for (const key of Object.keys(node)) {
      if (['parent', 'loc', 'range'].includes(key)) continue;
      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) { for (const item of child) collectExports(item); }
      else if (child && typeof child === 'object' && (child as Record<string, unknown>).type) collectExports(child);
    }
  }
  collectExports(ast);

  function extractParamName(p: unknown): string {
    if (!p || typeof p !== 'object') return '...';
    const node = p as Record<string, unknown>;
    if (node.type === 'Identifier') return node.name as string;
    if (node.type === 'ObjectPattern') {
      const props = (node.properties as unknown[] ?? []).map(prop => {
        if (!prop || typeof prop !== 'object') return '';
        const pNode = prop as Record<string, unknown>;
        if (pNode.type === 'RestElement') return '...rest';
        const key = pNode.key as Record<string, unknown> | undefined;
        return (key?.name as string) || '';
      }).filter(Boolean);
      return props.length > 0 ? `{${props.join(',')}}` : '{...}';
    }
    if (node.type === 'ArrayPattern') return '[...]';
    if (node.type === 'RestElement') return '...rest';
    if (node.type === 'AssignmentPattern') {
      const left = node.left as Record<string, unknown>;
      return (left?.name as string) || '...';
    }
    return '...';
  }

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      const params = (node.params || []).map(extractParamName);
      functions.push({ name: node.id.name, params, line: node.loc?.start?.line || 0, isExported: exportedNames.has(node.id.name), isComponent: /^[A-Z]/.test(node.id.name) });
    }
    if (node.type === 'VariableDeclarator' && node.init) {
      const initType = node.init.type;
      if ((initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression') && node.id?.name) {
        const params = (node.init.params || []).map(extractParamName);
        functions.push({ name: node.id.name, params, line: node.loc?.start?.line || 0, isExported: exportedNames.has(node.id.name), isComponent: /^[A-Z]/.test(node.id.name) });
      }
    }
    for (const key of Object.keys(node)) {
      if (['parent', 'loc', 'range'].includes(key)) continue;
      const child = (node as Record<string, unknown>)[key];
      if (Array.isArray(child)) { for (const item of child) walk(item); }
      else if (child && typeof child === 'object' && (child as Record<string, unknown>).type) walk(child);
    }
  }
  walk(ast);
  return functions;
}
