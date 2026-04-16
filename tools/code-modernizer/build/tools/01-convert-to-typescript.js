// ============================================================================
// CONVERT TO TYPESCRIPT
// Rename .js/.jsx to .ts/.tsx, add basic type annotations
// ============================================================================
import * as path from 'path';
import { parseFile, hasJSX, extractFunctions } from '../utils/ast-parser.js';
import { listFiles, renameFile, writeFile } from '../utils/file-ops.js';
import { generatePropsInterface, generateParamType, generateFileHeader } from '../utils/type-generator.js';
export async function convertToTypeScript(input) {
    const { path: projectPath, includeProps = true, dryRun = false } = input;
    const convertedFiles = [];
    const skippedFiles = [];
    const errors = [];
    const allFiles = await listFiles(projectPath, ['.js', '.jsx']);
    const jsFiles = allFiles.filter((f) => {
        const relative = path.relative(projectPath, f);
        if (relative.includes('node_modules') || relative.includes('build/') || relative.includes('dist/'))
            return false;
        const basename = path.basename(f);
        if (basename.includes('.config.') || basename.includes('.test.') || basename.includes('.spec.'))
            return false;
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
            let newExt;
            if (ext === '.jsx') {
                newExt = '.tsx';
            }
            else if (ext === '.js' && containsJSX) {
                newExt = '.tsx';
            }
            else {
                newExt = '.ts';
            }
            const newPath = filePath.replace(ext, newExt);
            const functions = extractFunctions(ast);
            const addedTypes = [];
            const issues = [];
            if (includeProps) {
                for (const fn of functions) {
                    if (fn.isComponent && fn.params.length > 0 && fn.params[0] !== '{...}') {
                        const propsInterface = generatePropsInterface(fn.name, fn.params);
                        addedTypes.push(propsInterface);
                    }
                }
            }
            let newContent = content;
            for (const fn of functions) {
                for (const param of fn.params) {
                    if (param !== '{...}' && param !== '[...]' && param !== '...') {
                        const type = generateParamType(param);
                        if (type !== 'unknown')
                            addedTypes.push(`${fn.name}(${param}: ${type})`);
                    }
                }
            }
            if (!dryRun) {
                const renameResult = await renameFile(filePath, newPath);
                if (!renameResult.success) {
                    errors.push(`Failed to rename ${relativePath}: ${renameResult.error}`);
                    continue;
                }
                if (addedTypes.length > 0) {
                    const propsInterfaces = addedTypes.filter(t => t.includes('interface'));
                    if (propsInterfaces.length > 0) {
                        const header = generateFileHeader('convert-to-typescript');
                        const imports = newContent.match(/^import.*$/gm) || [];
                        const lastImportIndex = imports.length > 0
                            ? newContent.lastIndexOf(imports[imports.length - 1]) + imports[imports.length - 1].length
                            : 0;
                        newContent = newContent.slice(0, lastImportIndex) + '\n\n' + propsInterfaces.join('\n\n') + '\n' + newContent.slice(lastImportIndex);
                    }
                    await writeFile(newPath, newContent);
                }
            }
            convertedFiles.push({
                originalPath: relativePath,
                newPath: path.relative(projectPath, newPath),
                addedTypes,
                issues,
            });
        }
        catch (error) {
            errors.push(`Error processing ${path.relative(projectPath, filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    return {
        success: errors.length === 0,
        convertedFiles,
        skippedFiles: skippedFiles.map(f => path.relative(projectPath, f)),
        errors,
        summary: {
            totalFiles: jsFiles.length,
            convertedCount: convertedFiles.length,
            skippedCount: skippedFiles.length,
            errorCount: errors.length,
        },
    };
}
//# sourceMappingURL=01-convert-to-typescript.js.map