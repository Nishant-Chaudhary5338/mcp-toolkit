// ============================================================================
// CONVERT TO TYPESCRIPT
// Rename .js/.jsx to .ts/.tsx, add TypeScript type annotations
// ============================================================================

import * as path from 'path';
import fs from 'fs-extra';
import { parseFile, hasJSX, extractFunctions } from '../utils/ast-parser.js';
import { listFiles, renameFile, writeFile } from '../utils/file-ops.js';
import { generatePropsInterface, generateFileHeader } from '../utils/type-generator.js';
import type { ConvertToTypeScriptInput, ConvertToTypeScriptOutput, ConvertedFile } from '../types.js';

function buildTypedContent(content: string, functions: ReturnType<typeof extractFunctions>, includeProps: boolean): { newContent: string; addedTypes: string[] } {
  const addedTypes: string[] = [];
  let newContent = content;

  if (!includeProps) return { newContent, addedTypes };

  // Collect all interfaces to inject after the last import line
  const interfacesToInject: string[] = [];

  for (const fn of functions) {
    if (!fn.isComponent || fn.params.length === 0) continue;

    const param = fn.params[0];
    // Only generate for destructured object params or named params
    if (param === '{...}' || param === '[...]' || param === '...') continue;

    // Don't regenerate if interface already exists
    const existingInterface = new RegExp(`interface\\s+${fn.name}Props\\s*\\{`);
    if (existingInterface.test(content)) continue;

    const iface = generatePropsInterface(fn.name, fn.params);
    interfacesToInject.push(iface);
    addedTypes.push(`${fn.name}Props`);

    // Also annotate the function signature if it uses destructuring
    if (param.startsWith('{') && !content.includes(`: ${fn.name}Props`)) {
      const destructured = param; // e.g. {label,onClick,disabled}
      // Try to replace the function signature to add type annotation
      // Handles: function Foo({ ... }) and const Foo = ({ ... }) =>
      const fnDeclPattern = new RegExp(
        `((?:export\\s+)?(?:default\\s+)?function\\s+${fn.name}\\s*\\()${destructured.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*\\))`,
        'g'
      );
      const arrowPattern = new RegExp(
        `((?:export\\s+)?const\\s+${fn.name}[^=]*=\\s*(?:React\\.memo\\(\\s*)?(?:React\\.forwardRef\\([^)]*,\\s*)?)\\(${destructured.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*)\\)`,
        'g'
      );

      const annotated = `${destructured}: ${fn.name}Props`;
      newContent = newContent.replace(fnDeclPattern, `$1${annotated}$2`);
      newContent = newContent.replace(arrowPattern, `$1(${annotated}$2)`);
    }
  }

  if (interfacesToInject.length > 0) {
    const header = generateFileHeader('convert-to-typescript');
    const importLines = newContent.match(/^import\s.*$/gm) || [];
    const insertPos = importLines.length > 0
      ? newContent.lastIndexOf(importLines[importLines.length - 1]) + importLines[importLines.length - 1].length
      : 0;

    const block = '\n\n' + header + interfacesToInject.join('\n\n') + '\n';
    newContent = newContent.slice(0, insertPos) + block + newContent.slice(insertPos);
  }

  return { newContent, addedTypes };
}

export async function convertToTypeScript(
  input: ConvertToTypeScriptInput
): Promise<ConvertToTypeScriptOutput> {
  const { path: projectPath, includeProps = true, dryRun = false } = input;

  const convertedFiles: ConvertedFile[] = [];
  const skippedFiles: string[] = [];
  const errors: string[] = [];

  const allFiles = await listFiles(projectPath, ['.js', '.jsx']);
  const jsFiles = allFiles.filter((f) => {
    const relative = path.relative(projectPath, f);
    if (relative.includes('node_modules') || relative.includes('build/') || relative.includes('dist/')) return false;
    const basename = path.basename(f);
    if (basename.includes('.config.') || basename.includes('.test.') || basename.includes('.spec.')) return false;
    return true;
  });

  for (const filePath of jsFiles) {
    try {
      const relativePath = path.relative(projectPath, filePath);
      const parsed = parseFile(filePath);

      if (!parsed) {
        skippedFiles.push(relativePath);
        continue;
      }

      const { content, ast } = parsed;
      const containsJSX = hasJSX(ast);
      const ext = path.extname(filePath);
      const newExt = ext === '.jsx' ? '.tsx' : (containsJSX ? '.tsx' : '.ts');
      const newPath = filePath.replace(ext, newExt);

      const functions = extractFunctions(ast);
      const { newContent, addedTypes } = buildTypedContent(content, functions, includeProps);

      if (dryRun) {
        convertedFiles.push({
          originalPath: relativePath,
          newPath: path.relative(projectPath, newPath),
          addedTypes,
          issues: [],
          previewContent: newContent !== content ? newContent : undefined,
        });
        continue;
      }

      const renameResult = await renameFile(filePath, newPath);
      if (!renameResult.success) {
        errors.push(`Failed to rename ${relativePath}: ${renameResult.error}`);
        continue;
      }

      if (newContent !== content) {
        await writeFile(newPath, newContent);
      }

      convertedFiles.push({
        originalPath: relativePath,
        newPath: path.relative(projectPath, newPath),
        addedTypes,
        issues: [],
      });
    } catch (error) {
      errors.push(`Error processing ${path.relative(projectPath, filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    success: errors.length === 0,
    convertedFiles,
    skippedFiles,
    errors,
    summary: {
      totalFiles: jsFiles.length,
      convertedCount: convertedFiles.length,
      skippedCount: skippedFiles.length,
      errorCount: errors.length,
    },
  };
}
