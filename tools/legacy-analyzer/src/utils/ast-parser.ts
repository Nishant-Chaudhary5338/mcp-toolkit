// @ts-nocheck
// ============================================================================
// AST PARSER - Parse JS/JSX/TS/TSX files to AST using @typescript-eslint
// ============================================================================

import * as path from 'path';
import { readFileContent } from './file-scanner.js';
import type {
  ParsedFile,
  ImportInfo,
  ExportInfo,
  FunctionInfo,
  JSXInfo,
  ComponentAnalysis,
  HookUsage,
} from '../types.js';

// Lazy-load parser to avoid issues at module level
let parser: any = null;

function getParser() {
  if (!parser) {
    parser = require('@typescript-eslint/parser');
  }
  return parser;
}

/**
 * Determine parser options based on file extension
 */
function getParserOptions(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const isTS = ext === '.ts' || ext === '.tsx';

  return {
    ecmaVersion: 2022 as const,
    sourceType: 'module' as const,
    ecmaFeatures: {
      jsx: ext === '.jsx' || ext === '.tsx',
    },
    ...(isTS && {
      project: undefined,
      warnOnUnsupportedTypeScriptVersion: false,
    }),
  };
}

/**
 * Parse a file into an AST
 */
export function parseFile(filePath: string): ParsedFile | null {
  const content = readFileContent(filePath);
  if (!content) return null;

  try {
    const p = getParser();
    const ast = p.parse(content, {
      ...getParserOptions(filePath),
      range: true,
      loc: true,
      comment: true,
    });

    return { filePath, content, ast };
  } catch (error) {
    try {
      const p = getParser();
      const ast = p.parse(content, {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        range: true,
        loc: true,
        comment: true,
      });
      return { filePath, content, ast };
    } catch {
      return null;
    }
  }
}

/**
 * Extract import declarations from AST
 */
export function extractImports(ast: unknown): ImportInfo[] {
  const imports: ImportInfo[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'ImportDeclaration') {
      const source = node.source?.value || '';
      const specifiers: string[] = [];
      let isDefault = false;

      for (const spec of node.specifiers || []) {
        if (spec.type === 'ImportDefaultSpecifier') {
          specifiers.push(spec.local?.name || '');
          isDefault = true;
        } else if (spec.type === 'ImportSpecifier') {
          specifiers.push(spec.imported?.name || spec.local?.name || '');
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          specifiers.push(`* as ${spec.local?.name || ''}`);
        }
      }

      imports.push({
        source,
        specifiers,
        isDefault,
        line: node.loc?.start?.line || 0,
      });
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }
  }

  walk(ast);
  return imports;
}

/**
 * Extract export declarations from AST
 */
export function extractExports(ast: unknown): ExportInfo[] {
  const exports: ExportInfo[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration;
      let name = 'default';
      if (decl?.type === 'FunctionDeclaration' || decl?.type === 'ClassDeclaration') {
        name = decl.id?.name || 'default';
      } else if (decl?.type === 'Identifier') {
        name = decl.name;
      }
      exports.push({ name, isDefault: true, line: node.loc?.start?.line || 0 });
    }

    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations || []) {
            if (d.id?.name) {
              exports.push({ name: d.id.name, isDefault: false, line: node.loc?.start?.line || 0 });
            }
          }
        } else if (decl.id?.name) {
          exports.push({ name: decl.id.name, isDefault: false, line: node.loc?.start?.line || 0 });
        }
      }
      for (const spec of node.specifiers || []) {
        const name = spec.exported?.name || spec.local?.name || '';
        if (name) {
          exports.push({ name, isDefault: false, line: node.loc?.start?.line || 0 });
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }
  }

  walk(ast);
  return exports;
}

/**
 * Extract function declarations from AST
 */
export function extractFunctions(ast: unknown): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const exportedNames = new Set<string>();

  function collectExports(node: unknown) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const decl = node.declaration;
      if (decl.type === 'FunctionDeclaration' && decl.id?.name) {
        exportedNames.add(decl.id.name);
      } else if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations || []) {
          if (d.id?.name) exportedNames.add(d.id.name);
        }
      }
    }
    if (node.type === 'ExportDefaultDeclaration' && node.declaration?.id?.name) {
      exportedNames.add(node.declaration.id.name);
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) collectExports(item);
      } else if (child && typeof child === 'object' && child.type) {
        collectExports(child);
      }
    }
  }

  collectExports(ast);

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      const params = (node.params || []).map((p: unknown) => {
        if (p.type === 'Identifier') return p.name;
        if (p.type === 'ObjectPattern') return '{...}';
        if (p.type === 'ArrayPattern') return '[...]';
        return '...';
      });

      const name = node.id.name;
      functions.push({
        name,
        params,
        line: node.loc?.start?.line || 0,
        isExported: exportedNames.has(name),
        isComponent: /^[A-Z]/.test(name),
      });
    }

    if (node.type === 'VariableDeclarator' && node.init) {
      const initType = node.init.type;
      if ((initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression') && node.id?.name) {
        const params = (node.init.params || []).map((p: unknown) => {
          if (p.type === 'Identifier') return p.name;
          if (p.type === 'ObjectPattern') return '{...}';
          return '...';
        });

        const name = node.id.name;
        functions.push({
          name,
          params,
          line: node.loc?.start?.line || 0,
          isExported: exportedNames.has(name),
          isComponent: /^[A-Z]/.test(name),
        });
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }
  }

  walk(ast);
  return functions;
}

/**
 * Extract JSX elements and calculate nesting depth
 */
export function extractJSX(ast: unknown): JSXInfo[] {
  const elements: JSXInfo[] = [];

  function walk(node: unknown, currentDepth: number = 0) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
      let tagName = 'Fragment';
      if (node.type === 'JSXElement' && node.openingElement?.name) {
        const name = node.openingElement.name;
        if (name.type === 'JSXIdentifier') {
          tagName = name.name;
        } else if (name.type === 'JSXMemberExpression') {
          tagName = `${name.object?.name || ''}.${name.property?.name || ''}`;
        }
      }

      const childrenCount = (node.children || []).filter(
        (c: unknown) => c.type === 'JSXElement' || c.type === 'JSXFragment'
      ).length;

      elements.push({
        tagName,
        depth: currentDepth,
        line: node.loc?.start?.line || 0,
        childrenCount,
      });

      for (const child of node.children || []) {
        walk(child, currentDepth + 1);
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range' || key === 'children') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item, currentDepth);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child, currentDepth);
      }
    }
  }

  walk(ast);
  return elements;
}

/**
 * Extract React hook usage from AST
 */
export function extractHooks(ast: unknown): HookUsage[] {
  const hooks: HookUsage[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
      const name = node.callee.name;
      if (/^use[A-Z]/.test(name)) {
        hooks.push({
          name,
          line: node.loc?.start?.line || 0,
        });
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }
  }

  walk(ast);
  return hooks;
}

/**
 * Full component analysis of a file
 */
export function analyzeComponent(filePath: string): ComponentAnalysis | null {
  const parsed = parseFile(filePath);
  if (!parsed) return null;

  const { ast, content } = parsed;
  const lines = content.split('\n').length;
  const name = path.basename(filePath, path.extname(filePath));

  const imports = extractImports(ast);
  const exports = extractExports(ast);
  const functions = extractFunctions(ast);
  const jsxElements = extractJSX(ast);
  const hooks = extractHooks(ast);
  const jsxMaxDepth = jsxElements.length > 0 ? Math.max(...jsxElements.map((e) => e.depth)) : 0;

  const props: string[] = [];
  for (const fn of functions) {
    if (fn.isComponent && fn.params.length > 0) {
      props.push(...fn.params);
    }
  }

  return {
    filePath,
    name,
    lines,
    imports,
    exports,
    functions,
    jsxElements,
    jsxMaxDepth,
    hooks,
    props,
  };
}

/**
 * Analyze multiple files in batch
 */
export async function analyzeComponents(filePaths: string[]): Promise<ComponentAnalysis[]> {
  const results: ComponentAnalysis[] = [];
  for (const filePath of filePaths) {
    const analysis = analyzeComponent(filePath);
    if (analysis) {
      results.push(analysis);
    }
  }
  return results;
}