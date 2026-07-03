// ============================================================================
// TOOL #5: RENAME FILES
// Apply naming improvements, update all references
// ============================================================================

import * as path from 'path';
import { renameFile, pathExists } from '../utils/file-ops.js';
import { recordOperation } from '../utils/backup-manager.js';
import type {
  RenameFilesInput,
  RenameFilesOutput,
  RenameOperation,
} from '../types.js';

/**
 * Rename files according to naming standardization plan
 */
export async function renameFiles(input: RenameFilesInput): Promise<RenameFilesOutput> {
  const { path: projectPath, refactorPlan, backupPath } = input;
  const renamedFiles: RenameOperation[] = [];
  const errors: string[] = [];

  for (const rename of refactorPlan.renames) {
    const oldPath = path.resolve(projectPath, rename.from);
    const newPath = path.resolve(projectPath, rename.to);

    // Verify source exists
    if (!(await pathExists(oldPath))) {
      errors.push(`File to rename does not exist: ${rename.from}`);
      renamedFiles.push({
        oldPath: rename.from,
        newPath: rename.to,
        success: false,
        error: 'File does not exist',
      });
      continue;
    }

    // Skip if same path (no-op)
    if (oldPath === newPath) {
      renamedFiles.push({
        oldPath: rename.from,
        newPath: rename.to,
        success: true,
      });
      continue;
    }

    // Perform the rename
    const result = await renameFile(oldPath, newPath, backupPath);
    renamedFiles.push({
      oldPath: rename.from,
      newPath: rename.to,
      success: result.success,
      error: result.error,
    });

    if (!result.success) {
      errors.push(`Failed to rename ${rename.from}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    renamedFiles,
    errors,
  };
}