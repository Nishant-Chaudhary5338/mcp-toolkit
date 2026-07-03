// ============================================================================
// TOOL #9: ROLLBACK ON FAILURE
// Revert all changes if build fails
// ============================================================================

import { rollbackFromBackup, cleanupBackup } from '../utils/backup-manager.js';
import type {
  RollbackInput,
  RollbackOutput,
} from '../types.js';

/**
 * Rollback all changes from backup
 */
export async function rollbackOnFailure(
  input: RollbackInput
): Promise<RollbackOutput> {
  const { path: projectPath, backupPath } = input;

  try {
    // Perform the rollback
    const result = await rollbackFromBackup(backupPath);

    // Optionally cleanup backup after successful rollback
    if (result.success) {
      await cleanupBackup(backupPath);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      operations: [],
      errors: [
        `Rollback failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      ],
    };
  }
}