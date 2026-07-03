// ============================================================================
// AST TRANSFORM - AST-based import rewriting for refactoring
// ============================================================================

import * as path from 'path';
import type { ImportInfo, ParsedFile, ImportUpdate } from '../types.js';

// Lazy-load parser. `any`: @typescript-eslint/parser is required at runtime and ships no callable types here.
let parser: any = null;

function getParser() {
  if (!parser) {
    parser = require('@typescript-eslint/parser');
  }
  return parser;
}

/**
 * Parser options based on file extension
 */
function getParserOptions(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ecmaVersion: 2022 as const,
    sourceType: 'module' as const,
    ecmaFeatures: {
      jsx: ext === '.jsx' || ext === '.tsx',
    },
    range: true,
    loc: true,
    comment: true,
  };
}

/**
 * Parse a file into AST
 */
export function parseFile(filePath: string, content: string): ParsedFile | null {
  try {
    const p = getParser();
    const ast = p.parse(content, getParserOptions(filePath));
    const imports = extractImports(ast, content);
    return { filePath, content, ast, imports };
  } catch {
    try {
      const p = getParser();
      const ast = p.parse(content, {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        range: true,
        loc: true,
      });
      const imports = extractImports(ast, content);
      return { filePath, content, ast, imports };
    } catch {
      return null;
    }
  }
}

/**
 * Extract imports from AST with column positions
 */
export function extractImports(ast: unknown, content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');

  // `any`: dynamic traversal over ESTree nodes from @typescript-eslint/parser.
  function walk(node: any) {
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

      const line = node.loc?.start?.line || 0;
      const lineContent = lines[line - 1] || '';
      const startColumn = node.loc?.start?.column || 0;
      const endColumn = node.loc?.end?.column || lineContent.length;

      imports.push({
        source,
        specifiers,
        isDefault,
        line,
        startColumn,
        endColumn,
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
 * Calculate new relative import path after file move
 */
export function calculateNewImportPath(
  importingFile: string,
  importedFile: string,
  oldImportedFile: string,
  importSpecifier: string
): string {
  // If the import was to the moved file, calculate new relative path
  const importingDir = path.dirname(importingFile);
  let newRelativePath = path.relative(importingDir, importedFile);

  // Ensure it starts with ./ or ../
  if (!newRelativePath.startsWith('.')) {
    newRelativePath = './' + newRelativePath;
  }

  // Remove extension if present (for cleaner imports)
  const ext = path.extname(newRelativePath);
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    newRelativePath = newRelativePath.slice(0, -ext.length);
  }

  // Handle index files
  if (newRelativePath.endsWith('/index')) {
    newRelativePath = newRelativePath.slice(0, -'/index'.length) || '.';
  }

  return newRelativePath;
}

/**
 * Rewrite imports in a file based on moved files mapping
 */
export function rewriteImports(
  filePath: string,
  content: string,
  movedFiles: Record<string, string>, // old path -> new path
  projectPath: string
): { newContent: string; updates: ImportUpdate[] } {
  const parsed = parseFile(filePath, content);
  if (!parsed) {
    return { newContent: content, updates: [] };
  }

  const updates: ImportUpdate[] = [];
  const lines = content.split('\n');
  let newContent = content;
  const offset = 0; // Track character offset for replacements

  // Process imports in reverse order to maintain positions
  const sortedImports = [...parsed.imports].sort((a, b) => b.line - a.line);

  for (const imp of sortedImports) {
    // Skip non-relative imports
    if (!imp.source.startsWith('.')) continue;

    // Resolve the imported file
    const importingDir = path.dirname(filePath);
    const resolvedImport = path.resolve(importingDir, imp.source);

    // Try common extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'] as const;
    let actualResolved = '';

    for (const ext of extensions) {
      const candidate = resolvedImport + ext;
      if (candidate in movedFiles || Object.values(movedFiles).includes(candidate)) {
        actualResolved = candidate;
        break;
      }
    }

    if (!actualResolved) {
      // Check if any moved file matches this import
      for (const [oldPath, newPath] of Object.entries(movedFiles)) {
        const oldBasename = path.basename(oldPath, path.extname(oldPath));
        if (imp.source.includes(oldBasename)) {
          actualResolved = oldPath;
          break;
        }
      }
    }

    if (actualResolved && actualResolved in movedFiles) {
      const newFilePath = movedFiles[actualResolved];
      const newImportPath = calculateNewImportPath(filePath, newFilePath, actualResolved, imp.source);

      if (newImportPath !== imp.source) {
        // Find the exact import statement in the line
        const lineContent = lines[imp.line - 1];
        const oldImportStatement = `'${imp.source}'`;
        const newImportStatement = `'${newImportPath}'`;

        if (lineContent.includes(oldImportStatement)) {
          updates.push({
            file: filePath,
            oldImport: imp.source,
            newImport: newImportPath,
            line: imp.line,
          });
        }
      }
    }
  }

  // Apply updates (in reverse order to preserve line numbers)
  const uniqueUpdates = updates.filter(
    (update, index, self) =>
      index === self.findIndex((u) => u.line === update.line && u.oldImport === update.oldImport)
  );

  for (const update of uniqueUpdates.sort((a, b) => b.line - a.line)) {
    const lineIndex = update.line - 1;
    const oldLine = lines[lineIndex];
    const newLine = oldLine.replace(`'${update.oldImport}'`, `'${update.newImport}'`).replace(
      `"${update.oldImport}"`,
      `"${update.newImport}"`
    );
    lines[lineIndex] = newLine;
  }

  newContent = lines.join('\n');

  return { newContent, updates: uniqueUpdates };
}

/**
 * Rewrite import path in a single import statement
 */
export function rewriteSingleImport(
  content: string,
  oldSpecifier: string,
  newSpecifier: string
): string {
  // Handle both single and double quotes
  return content
    .replace(`'${oldSpecifier}'`, `'${newSpecifier}'`)
    .replace(`"${oldSpecifier}"`, `"${newSpecifier}"`);
}

/**
 * Generate import statement
 */
export function generateImportStatement(
  specifiers: string[],
  source: string,
  isDefault: boolean = false
): string {
  if (isDefault && specifiers.length === 1) {
    return `import ${specifiers[0]} from '${source}';`;
  }

  if (specifiers.length === 0) {
    return `import '${source}';`;
  }

  return `import { ${specifiers.join(', ')} } from '${source}';`;
}

/**
 * Generate export statement
 */
export function generateExportStatement(
  names: string[],
  isDefault: boolean = false
): string {
  if (isDefault && names.length === 1) {
    return `export default ${names[0]};`;
  }

  return `export { ${names.join(', ')} };`;
}

/**
 * Generate re-export statement for barrel files
 */
export function generateReExport(
  source: string,
  names?: string[],
  isDefault: boolean = false
): string {
  if (isDefault && names && names.length === 1) {
    return `export { default as ${names[0]} } from '${source}';`;
  }

  if (!names || names.length === 0) {
    return `export * from '${source}';`;
  }

  return `export { ${names.join(', ')} } from '${source}';`;
}