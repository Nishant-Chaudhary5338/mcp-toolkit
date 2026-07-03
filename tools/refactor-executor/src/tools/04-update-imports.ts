// ============================================================================
// TOOL #4: UPDATE IMPORTS (CRITICAL)
// Update relative imports using AST (no regex)
// ============================================================================

import * as path from 'path';
import { listFiles, readFile, writeFile } from '../utils/file-ops.js';
import { parseFile, rewriteImports } from '../utils/ast-transform.js';
import type {
  UpdateImportsInput,
  UpdateImportsOutput,
  ImportUpdate,
} from '../types.js';

/**
 * Update all imports after file moves using AST-based transformation
 */
export async function updateImports(input: UpdateImportsInput): Promise<UpdateImportsOutput> {
  const { path: projectPath, refactorPlan, movedFiles = {} } = input;
  const updatedFiles: string[] = [];
  const allUpdates: ImportUpdate[] = [];
  const errors: string[] = [];

  // Build moved files map from refactor plan if not provided
  const filesMap = { ...movedFiles };
  if (Object.keys(filesMap).length === 0) {
    for (const move of refactorPlan.moves) {
      const sourcePath = path.resolve(projectPath, move.from);
      const destPath = path.resolve(projectPath, move.to);
      filesMap[sourcePath] = destPath;
    }
    // Also add renames
    for (const rename of refactorPlan.renames) {
      const oldPath = path.resolve(projectPath, rename.from);
      const newPath = path.resolve(projectPath, rename.to);
      filesMap[oldPath] = newPath;
    }
  }

  if (Object.keys(filesMap).length === 0) {
    return {
      success: true,
      updatedFiles: [],
      importUpdates: [],
      errors: [],
    };
  }

  // Get all source files in the project
  const allFiles = await listFiles(projectPath, ['.ts', '.tsx', '.js', '.jsx']);

  // Process each file to update its imports
  for (const filePath of allFiles) {
    // Skip files that were moved (they're already at their new location)
    if (Object.keys(filesMap).includes(filePath)) {
      continue;
    }

    const content = await readFile(filePath);
    if (!content) continue;

    try {
      const { newContent, updates } = rewriteImports(
        filePath,
        content,
        filesMap,
        projectPath
      );

      if (updates.length > 0) {
        // Write the updated content
        const writeSuccess = await writeFile(filePath, newContent);
        if (writeSuccess) {
          updatedFiles.push(path.relative(projectPath, filePath));
          allUpdates.push(...updates);
        } else {
          errors.push(`Failed to write updated file: ${filePath}`);
        }
      }
    } catch (error) {
      errors.push(
        `Error processing ${filePath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Also update imports within moved files
  for (const [oldPath, newPath] of Object.entries(filesMap)) {
    if (Object.values(filesMap).includes(newPath)) {
      const content = await readFile(newPath);
      if (!content) continue;

      try {
        const { newContent, updates } = rewriteImports(
          newPath,
          content,
          filesMap,
          projectPath
        );

        if (updates.length > 0) {
          const writeSuccess = await writeFile(newPath, newContent);
          if (writeSuccess) {
            if (!updatedFiles.includes(path.relative(projectPath, newPath))) {
              updatedFiles.push(path.relative(projectPath, newPath));
            }
            allUpdates.push(...updates);
          }
        }
      } catch (error) {
        errors.push(
          `Error updating imports in moved file ${newPath}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }
  }

  return {
    success: errors.length === 0,
    updatedFiles,
    importUpdates: allUpdates,
    errors,
  };
}