// ============================================================================
// TOOL #10: APPLY REFACTOR (AGGREGATOR)
// Flow: validate → create folders → move → rename → update imports → validate build → rollback if needed
// ============================================================================

import { createFullBackup } from '../utils/backup-manager.js';
import { validateRefactorPlan } from './01-validate-refactor-plan.js';
import { createTargetStructure } from './02-create-target-structure.js';
import { moveFiles } from './03-move-files.js';
import { updateImports } from './04-update-imports.js';
import { renameFiles } from './05-rename-files.js';
import { splitModules } from './06-split-modules.js';
import { createIndexFiles } from './07-create-index-files.js';
import { validateBuild } from './08-validate-build.js';
import { rollbackOnFailure } from './09-rollback-on-failure.js';
import type {
  ApplyRefactorInput,
  ApplyRefactorOutput,
} from '../types.js';

/**
 * Apply full refactor pipeline with automatic rollback on failure
 */
export async function applyRefactor(
  input: ApplyRefactorInput
): Promise<ApplyRefactorOutput> {
  const { path: projectPath, refactorPlan, dryRun = false, buildCommand } = input;
  const steps: ApplyRefactorOutput['steps'] = [];
  let backupPath: string | undefined;

  // Step 1: Validate refactor plan
  const validationResult = await validateRefactorPlan({
    path: projectPath,
    refactorPlan,
  });
  steps.push({
    name: 'validate-refactor-plan',
    success: validationResult.valid,
    output: validationResult,
  });

  if (!validationResult.valid) {
    return {
      success: false,
      dryRun,
      steps,
      summary: {
        filesMoved: 0,
        filesRenamed: 0,
        filesSplit: 0,
        importsUpdated: 0,
        indexFilesCreated: 0,
      },
    };
  }

  // Dry run stops here
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      steps,
      summary: {
        filesMoved: validationResult.summary.totalMoves,
        filesRenamed: validationResult.summary.totalRenames,
        filesSplit: validationResult.summary.totalSplits,
        importsUpdated: 0,
        indexFilesCreated: 0,
      },
    };
  }

  // Step 2: Create backup
  try {
    backupPath = await createFullBackup(projectPath);
    steps.push({
      name: 'create-backup',
      success: true,
      output: { backupPath },
    });
  } catch (error) {
    steps.push({
      name: 'create-backup',
      success: false,
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    return {
      success: false,
      dryRun: false,
      steps,
      summary: {
        filesMoved: 0,
        filesRenamed: 0,
        filesSplit: 0,
        importsUpdated: 0,
        indexFilesCreated: 0,
      },
    };
  }

  // Step 3: Create target structure
  const structureResult = await createTargetStructure({
    path: projectPath,
    refactorPlan,
    backupPath,
  });
  steps.push({
    name: 'create-target-structure',
    success: structureResult.success,
    output: structureResult,
  });

  if (!structureResult.success) {
    await rollbackOnFailure({ path: projectPath, backupPath });
    return {
      success: false,
      dryRun: false,
      steps,
      backupPath,
      rollbackPerformed: true,
      summary: {
        filesMoved: 0,
        filesRenamed: 0,
        filesSplit: 0,
        importsUpdated: 0,
        indexFilesCreated: 0,
      },
    };
  }

  // Step 4: Move files
  const moveResult = await moveFiles({
    path: projectPath,
    refactorPlan,
    backupPath,
  });
  steps.push({
    name: 'move-files',
    success: moveResult.success,
    output: moveResult,
  });

  // Step 5: Rename files
  const renameResult = await renameFiles({
    path: projectPath,
    refactorPlan,
    backupPath,
  });
  steps.push({
    name: 'rename-files',
    success: renameResult.success,
    output: renameResult,
  });

  // Step 6: Split modules
  const splitResult = await splitModules({
    path: projectPath,
    refactorPlan,
    backupPath,
  });
  steps.push({
    name: 'split-modules',
    success: splitResult.success,
    output: splitResult,
  });

  // Step 7: Update imports (CRITICAL)
  const importResult = await updateImports({
    path: projectPath,
    refactorPlan,
  });
  steps.push({
    name: 'update-imports',
    success: importResult.success,
    output: importResult,
  });

  // Step 8: Create index files
  const indexResult = await createIndexFiles({
    path: projectPath,
    refactorPlan,
  });
  steps.push({
    name: 'create-index-files',
    success: indexResult.success,
    output: indexResult,
  });

  // Step 9: Validate build
  const buildResult = await validateBuild({
    path: projectPath,
    buildCommand,
  });
  steps.push({
    name: 'validate-build',
    success: buildResult.success,
    output: buildResult,
  });

  // If build fails, rollback
  if (!buildResult.success) {
    const rollbackResult = await rollbackOnFailure({
      path: projectPath,
      backupPath,
    });
    steps.push({
      name: 'rollback-on-failure',
      success: rollbackResult.success,
      output: rollbackResult,
    });

    return {
      success: false,
      dryRun: false,
      steps,
      backupPath,
      buildValidation: buildResult,
      rollbackPerformed: true,
      summary: {
        filesMoved: moveResult.movedFiles.filter((m) => m.success).length,
        filesRenamed: renameResult.renamedFiles.filter((r) => r.success).length,
        filesSplit: splitResult.splitOperations.filter((s) => s.success).length,
        importsUpdated: importResult.updatedFiles.length,
        indexFilesCreated: indexResult.createdIndexFiles.length,
      },
    };
  }

  // Success!
  return {
    success: true,
    dryRun: false,
    steps,
    backupPath,
    buildValidation: buildResult,
    rollbackPerformed: false,
    summary: {
      filesMoved: moveResult.movedFiles.filter((m) => m.success).length,
      filesRenamed: renameResult.renamedFiles.filter((r) => r.success).length,
      filesSplit: splitResult.splitOperations.filter((s) => s.success).length,
      importsUpdated: importResult.updatedFiles.length,
      indexFilesCreated: indexResult.createdIndexFiles.length,
    },
  };
}