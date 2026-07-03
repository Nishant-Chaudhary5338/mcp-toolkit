// ============================================================================
// TOOL #1: VALIDATE REFACTOR PLAN
// Ensure paths exist, no duplicate destinations, no conflicting moves
// ============================================================================

import * as path from 'path';
import { pathExists, listFiles } from '../utils/file-ops.js';
import type {
  ValidateRefactorPlanInput,
  ValidateRefactorPlanOutput,
  ValidationError,
  ValidationWarning,
  RefactorPlan,
} from '../types.js';

/**
 * Validate refactor plan before execution
 */
export async function validateRefactorPlan(
  input: ValidateRefactorPlanInput
): Promise<ValidateRefactorPlanOutput> {
  const { path: projectPath, refactorPlan } = input;
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check project path exists
  if (!(await pathExists(projectPath))) {
    errors.push({
      type: 'invalid-path',
      message: `Project path does not exist: ${projectPath}`,
      files: [projectPath],
    });
    return {
      valid: false,
      errors,
      warnings,
      summary: {
        totalMoves: 0,
        totalRenames: 0,
        totalSplits: 0,
        affectedFiles: 0,
      },
    };
  }

  // Get all files in project
  const allFiles = await listFiles(projectPath);
  const allFilesSet = new Set(allFiles);

  // Validate moves
  await validateMoves(refactorPlan.moves, projectPath, allFilesSet, errors, warnings);

  // Validate renames
  await validateRenames(refactorPlan.renames, projectPath, allFilesSet, errors, warnings);

  // Validate splits
  await validateSplits(refactorPlan.splits, projectPath, allFilesSet, errors, warnings);

  // Check for conflicts between moves and renames
  checkMoveRenameConflicts(refactorPlan, errors);

  // Calculate affected files
  const affectedFiles = new Set<string>();
  for (const move of refactorPlan.moves) {
    affectedFiles.add(move.from);
  }
  for (const rename of refactorPlan.renames) {
    affectedFiles.add(rename.from);
  }
  for (const split of refactorPlan.splits) {
    affectedFiles.add(split.file);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalMoves: refactorPlan.moves.length,
      totalRenames: refactorPlan.renames.length,
      totalSplits: refactorPlan.splits.length,
      affectedFiles: affectedFiles.size,
    },
  };
}

/**
 * Validate file moves
 */
async function validateMoves(
  moves: RefactorPlan['moves'],
  projectPath: string,
  allFiles: Set<string>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): Promise<void> {
  const destinations = new Map<string, string[]>(); // dest -> sources

  for (const move of moves) {
    const sourcePath = path.resolve(projectPath, move.from);
    const destPath = path.resolve(projectPath, move.to);

    // Check source exists
    if (!allFiles.has(sourcePath)) {
      errors.push({
        type: 'missing-source',
        message: `Source file does not exist: ${move.from}`,
        files: [move.from],
      });
    }

    // Track destinations for duplicate check
    if (!destinations.has(destPath)) {
      destinations.set(destPath, []);
    }
    destinations.get(destPath)!.push(move.from);

    // Warn if destination already exists
    if (allFiles.has(destPath)) {
      warnings.push({
        type: 'destination-exists',
        message: `Destination file already exists and will be overwritten: ${move.to}`,
        files: [move.to],
      });
    }
  }

  // Check for duplicate destinations
  for (const [dest, sources] of destinations) {
    if (sources.length > 1) {
      errors.push({
        type: 'duplicate-destination',
        message: `Multiple files moving to the same destination: ${dest}`,
        files: sources,
      });
    }
  }
}

/**
 * Validate file renames
 */
async function validateRenames(
  renames: RefactorPlan['renames'],
  projectPath: string,
  allFiles: Set<string>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): Promise<void> {
  const newNames = new Map<string, string[]>(); // new path -> old paths

  for (const rename of renames) {
    const oldPath = path.resolve(projectPath, rename.from);
    const newPath = path.resolve(projectPath, rename.to);

    // Check source exists
    if (!allFiles.has(oldPath)) {
      errors.push({
        type: 'missing-source',
        message: `File to rename does not exist: ${rename.from}`,
        files: [rename.from],
      });
    }

    // Track new names for duplicate check
    if (!newNames.has(newPath)) {
      newNames.set(newPath, []);
    }
    newNames.get(newPath)!.push(rename.from);

    // Warn if target name already exists
    if (allFiles.has(newPath) && newPath !== oldPath) {
      warnings.push({
        type: 'rename-target-exists',
        message: `Rename target already exists: ${rename.to}`,
        files: [rename.to],
      });
    }
  }

  // Check for duplicate new names
  for (const [newPath, oldPaths] of newNames) {
    if (oldPaths.length > 1) {
      errors.push({
        type: 'duplicate-destination',
        message: `Multiple files being renamed to: ${path.relative(projectPath, newPath)}`,
        files: oldPaths,
      });
    }
  }
}

/**
 * Validate module splits
 */
async function validateSplits(
  splits: RefactorPlan['splits'],
  projectPath: string,
  allFiles: Set<string>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): Promise<void> {
  for (const split of splits) {
    const filePath = path.resolve(projectPath, split.file);

    // Check source file exists
    if (!allFiles.has(filePath)) {
      errors.push({
        type: 'missing-source',
        message: `File to split does not exist: ${split.file}`,
        files: [split.file],
      });
    }

    // Check proposed files don't conflict
    for (const proposed of split.proposedFiles) {
      const proposedPath = path.resolve(projectPath, proposed);
      if (allFiles.has(proposedPath)) {
        warnings.push({
          type: 'split-target-exists',
          message: `Proposed split file already exists: ${proposed}`,
          files: [proposed],
        });
      }
    }
  }
}

/**
 * Check for conflicts between moves and renames
 */
function checkMoveRenameConflicts(
  plan: RefactorPlan,
  errors: ValidationError[]
): void {
  const moveSources = new Set(plan.moves.map((m) => m.from));
  const renameSources = new Set(plan.renames.map((r) => r.from));

  // Check if same file is both moved and renamed
  for (const source of moveSources) {
    if (renameSources.has(source)) {
      errors.push({
        type: 'conflicting-move',
        message: `File is both moved and renamed: ${source}`,
        files: [source],
      });
    }
  }

  // Check move chains (A->B, B->C)
  const moveMap = new Map(plan.moves.map((m) => [m.from, m.to]));
  for (const [from, to] of moveMap) {
    if (moveMap.has(to)) {
      errors.push({
        type: 'conflicting-move',
        message: `Move chain detected: ${from} -> ${to} -> ${moveMap.get(to)}`,
        files: [from, to],
      });
    }
  }
}