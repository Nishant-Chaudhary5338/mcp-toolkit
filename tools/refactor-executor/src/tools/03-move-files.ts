// ============================================================================
// TOOL #3: MOVE FILES
// Move files based on plan, preserve content, track moved files
// ============================================================================

import * as path from 'path';
import { moveFile, pathExists, readFile } from '../utils/file-ops.js';
import { recordOperation } from '../utils/backup-manager.js';
import type {
  MoveFilesInput,
  MoveFilesOutput,
  MoveOperation,
} from '../types.js';

/**
 * Move files according to refactor plan
 */
export async function moveFiles(input: MoveFilesInput): Promise<MoveFilesOutput> {
  const { path: projectPath, refactorPlan, backupPath } = input;
  const movedFiles: MoveOperation[] = [];
  const errors: string[] = [];
  const movedFilesMap: Record<string, string> = {}; // old path -> new path

  for (const move of refactorPlan.moves) {
    const sourcePath = path.resolve(projectPath, move.from);
    const destPath = path.resolve(projectPath, move.to);

    // Verify source exists
    if (!(await pathExists(sourcePath))) {
      errors.push(`Source file does not exist: ${move.from}`);
      movedFiles.push({
        source: move.from,
        destination: move.to,
        success: false,
        error: 'Source file does not exist',
      });
      continue;
    }

    // Perform the move
    const result = await moveFile(sourcePath, destPath, backupPath);
    movedFiles.push({
      source: move.from,
      destination: move.to,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      movedFilesMap[sourcePath] = destPath;
    } else {
      errors.push(`Failed to move ${move.from}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    movedFiles,
    errors,
  };
}

/**
 * Get the mapping of moved files (for use by update-imports)
 */
export function getMovedFilesMap(
  projectPath: string,
  refactorPlan: { moves: { from: string; to: string }[] }
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const move of refactorPlan.moves) {
    const sourcePath = path.resolve(projectPath, move.from);
    const destPath = path.resolve(projectPath, move.to);
    map[sourcePath] = destPath;
  }
  return map;
}