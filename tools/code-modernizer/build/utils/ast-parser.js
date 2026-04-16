// @ts-nocheck
// ============================================================================
// AST PARSER - Parse JS/JSX/TS/TSX files using @typescript-eslint/parser
// ============================================================================
import * as path from 'path';
import fs from 'fs-extra';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
let parser = null;
function getParser() {
    if (!parser)
        parser = _require('@typescript-eslint/parser');
    return parser;
}
function getParserOptions(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: ext === '.jsx' || ext === '.tsx' },
    };
}
export function parseFile(filePath) {
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }
    try {
        const p = getParser();
        const ast = p.parse(content, { ...getParserOptions(filePath), range: true, loc: true });
        return { filePath, content, ast, imports: extractImports(ast) };
    }
    catch {
        try {
            const p = getParser();
            const ast = p.parse(content, { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true }, range: true, loc: true });
            return { filePath, content, ast, imports: extractImports(ast) };
        }
        catch {
            return null;
        }
    }
}
export function extractImports(ast) {
    const imports = [];
    function walk(node) {
        if (!node || typeof node !== 'object')
            return;
        if (node.type === 'ImportDeclaration') {
            const specifiers = [];
            let isDefault = false;
            for (const spec of node.specifiers || []) {
                if (spec.type === 'ImportDefaultSpecifier') {
                    specifiers.push(spec.local?.name || '');
                    isDefault = true;
                }
                else if (spec.type === 'ImportSpecifier')
                    specifiers.push(spec.imported?.name || spec.local?.name || '');
            }
            imports.push({ source: node.source?.value || '', specifiers, isDefault, line: node.loc?.start?.line || 0, startColumn: 0, endColumn: 0 });
        }
        for (const key of Object.keys(node)) {
            if (['parent', 'loc', 'range'].includes(key))
                continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const item of child)
                    walk(item);
            }
            else if (child && typeof child === 'object' && child.type)
                walk(child);
        }
    }
    walk(ast);
    return imports;
}
export function hasJSX(ast) {
    let found = false;
    function walk(node) {
        if (found || !node || typeof node !== 'object')
            return;
        if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
            found = true;
            return;
        }
        for (const key of Object.keys(node)) {
            if (['parent', 'loc', 'range'].includes(key))
                continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const item of child)
                    walk(item);
            }
            else if (child && typeof child === 'object' && child.type)
                walk(child);
        }
    }
    walk(ast);
    return found;
}
export function extractFunctions(ast) {
    const functions = [];
    const exportedNames = new Set();
    function collectExports(node) {
        if (!node || typeof node !== 'object')
            return;
        if (node.type === 'ExportNamedDeclaration' && node.declaration) {
            const decl = node.declaration;
            if (decl.type === 'FunctionDeclaration' && decl.id?.name)
                exportedNames.add(decl.id.name);
            else if (decl.type === 'VariableDeclaration') {
                for (const d of decl.declarations || []) {
                    if (d.id?.name)
                        exportedNames.add(d.id.name);
                }
            }
        }
        if (node.type === 'ExportDefaultDeclaration' && node.declaration?.id?.name)
            exportedNames.add(node.declaration.id.name);
        for (const key of Object.keys(node)) {
            if (['parent', 'loc', 'range'].includes(key))
                continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const item of child)
                    collectExports(item);
            }
            else if (child && typeof child === 'object' && child.type)
                collectExports(child);
        }
    }
    collectExports(ast);
    function walk(node) {
        if (!node || typeof node !== 'object')
            return;
        if (node.type === 'FunctionDeclaration' && node.id?.name) {
            const params = (node.params || []).map((p) => {
                if (p.type === 'Identifier')
                    return p.name;
                if (p.type === 'ObjectPattern')
                    return '{...}';
                return '...';
            });
            functions.push({ name: node.id.name, params, line: node.loc?.start?.line || 0, isExported: exportedNames.has(node.id.name), isComponent: /^[A-Z]/.test(node.id.name) });
        }
        if (node.type === 'VariableDeclarator' && node.init) {
            const initType = node.init.type;
            if ((initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression') && node.id?.name) {
                const params = (node.init.params || []).map((p) => {
                    if (p.type === 'Identifier')
                        return p.name;
                    if (p.type === 'ObjectPattern')
                        return '{...}';
                    return '...';
                });
                functions.push({ name: node.id.name, params, line: node.loc?.start?.line || 0, isExported: exportedNames.has(node.id.name), isComponent: /^[A-Z]/.test(node.id.name) });
            }
        }
        for (const key of Object.keys(node)) {
            if (['parent', 'loc', 'range'].includes(key))
                continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const item of child)
                    walk(item);
            }
            else if (child && typeof child === 'object' && child.type)
                walk(child);
        }
    }
    walk(ast);
    return functions;
}
//# sourceMappingURL=ast-parser.js.map