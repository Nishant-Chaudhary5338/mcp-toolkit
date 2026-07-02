// ============================================================================
// TOOL #2: CREATE TARGET STRUCTURE
// Create folders if not present, ensure idempotency
// ============================================================================

import * as path from 'path';
import { createDirectory, getRequiredDirectories, pathExists } from '../utils/file-ops.js';
import { recordOperation } from '../utils/backup-manager.js';
import type {
  CreateTargetStructureInput,
  CreateTargetStructureOutput,
  RefactorPlan,
} from '../types.js';

/**
 * Create target directory structure for refactoring
 */
export async function createTargetStructure(
  input: CreateTargetStructureInput
): Promise<CreateTargetStructureOutput> {
  const { path: projectPath, refactorPlan, backupPath } = input;
  const createdDirectories: string[] = [];
  const errors: string[] = [];

  // Collect all target paths
  const targetPaths: string[] = [];

  // From moves
  for (const move of refactorPlan.moves) {
    targetPaths.push(path.resolve(projectPath, move.to));
  }

  // From renames
  for (const rename of refactorPlan.renames) {
    targetPaths.push(path.resolve(projectPath, rename.to));
  }

  // From splits
  for (const split of refactorPlan.splits) {
    for (const proposed of split.proposedFiles) {
      targetPaths.push(path.resolve(projectPath, proposed));
    }
  }

  // Get required directories
  const requiredDirs = getRequiredDirectories(targetPaths);

  // Create directories (idempotent)
  for (const dir of requiredDirs) {
    try {
      const exists = await pathExists(dir);
      const success = await createDirectory(dir);

      if (success && !exists) {
        createdDirectories.push(path.relative(projectPath, dir));

        // Record in backup if provided
        if (backupPath) {
          await recordOperation(backupPath, {
            type: 'create-dir',
            originalPath: dir,
            newPath: dir,
          });
        }
      }
    } catch (error) {
      errors.push(
        `Failed to create directory ${dir}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return {
    success: errors.length === 0,
    createdDirectories,
    errors,
  };
}