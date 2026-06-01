// ============================================================================
// TOOL #21: generate-refactor-plan
// Combines all outputs from tools 13-20 into a single unified refactor plan
// ============================================================================

import { detectFeatures } from './13-detect-features.js';
import { classifyFiles } from './14-classify-files.js';
import { detectSharedModules } from './15-detect-shared-modules.js';
import { designTargetStructure } from './16-design-target-structure.js';
import { mapFilesToTarget } from './17-map-files-to-target.js';
import { detectBoundaryViolations } from './18-detect-boundary-violations.js';
import { suggestModuleSplitting } from './19-suggest-module-splitting.js';
import { namingStandardizer } from './20-naming-standardizer.js';
import type { GenerateRefactorPlanOutput, RefactorStep, AnalyzerConfig } from '../types.js';

export async function generateRefactorPlan(
  appPath: string,
  config?: Partial<AnalyzerConfig>
): Promise<GenerateRefactorPlanOutput> {
  // Run all tools in parallel where possible
  const [
    featuresResult,
    classificationResult,
    sharedResult,
    violationsResult,
    splitsResult,
    namingResult,
  ] = await Promise.all([
    detectFeatures(appPath, config),
    classifyFiles(appPath, config),
    detectSharedModules(appPath, config),
    detectBoundaryViolations(appPath, config),
    suggestModuleSplitting(appPath, config),
    namingStandardizer(appPath, config),
  ]);

  // Design target structure based on detected features
  const structureResult = await designTargetStructure(
    appPath,
    config,
    featuresResult.features
  );

  // Map files to target structure
  const mappingResult = await mapFilesToTarget(appPath, config);

  // Generate ordered refactor steps
  const steps: RefactorStep[] = [];
  let order = 1;

  // Step 1: Fix boundary violations first (prerequisite for clean moves)
  if (violationsResult.violations.length > 0) {
    steps.push({
      order: order++,
      action: 'fix-boundary-violations',
      description: `Fix ${violationsResult.violations.length} boundary violations (cross-feature imports, circular deps, etc.)`,
      affectedFiles: [
        ...new Set(
          violationsResult.violations.flatMap((v) => [v.from, v.to])
        ),
      ],
      priority: 'high',
    });
  }

  // Step 2: Split large/generic modules
  if (splitsResult.splits.length > 0) {
    steps.push({
      order: order++,
      action: 'split-modules',
      description: `Split ${splitsResult.splits.length} large/generic files into focused modules`,
      affectedFiles: splitsResult.splits.map((s) => s.file),
      priority: 'high',
    });
  }

  // Step 3: Create target folder structure
  steps.push({
    order: order++,
    action: 'create-structure',
    description: `Create feature-based folder structure with ${featuresResult.features.length} features`,
    affectedFiles: [],
    priority: 'medium',
  });

  // Step 4: Move files to target locations
  if (mappingResult.moves.length > 0) {
    steps.push({
      order: order++,
      action: 'move-files',
      description: `Move ${mappingResult.moves.length} files to their target locations`,
      affectedFiles: mappingResult.moves.map((m) => m.from),
      priority: 'medium',
    });
  }

  // Step 5: Rename files for consistency
  if (namingResult.renames.length > 0) {
    steps.push({
      order: order++,
      action: 'rename-files',
      description: `Rename ${namingResult.renames.length} files/folders for consistent naming`,
      affectedFiles: namingResult.renames.map((r) => r.from),
      priority: 'low',
    });
  }

  // Step 6: Update imports
  if (mappingResult.moves.length > 0) {
    steps.push({
      order: order++,
      action: 'update-imports',
      description: `Update import paths after file moves`,
      affectedFiles: mappingResult.moves.map((m) => m.to),
      priority: 'medium',
    });
  }

  // Calculate estimated effort
  const estimatedEffort = {
    filesToMove: mappingResult.moves.length,
    filesToSplit: splitsResult.splits.length,
    filesToRename: namingResult.renames.filter((r) => r.from !== r.to).length,
    violationsToFix: violationsResult.violations.filter((v) => v.severity === 'error').length,
  };

  return {
    features: featuresResult.features,
    targetStructure: structureResult.structure,
    fileMoves: mappingResult.moves,
    splits: splitsResult.splits,
    renames: namingResult.renames,
    violations: violationsResult.violations,
    steps,
    estimatedEffort,
  };
}