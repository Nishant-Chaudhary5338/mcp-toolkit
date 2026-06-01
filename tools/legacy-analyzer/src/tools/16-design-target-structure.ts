// ============================================================================
// TOOL #16: design-target-structure
// Generates scalable folder structure based on detected features
// ============================================================================

import type { DesignTargetStructureOutput, AnalyzerConfig } from '../types.js';
import { FEATURE_SUBDIRS, SHARED_DIRS, APP_DIRS } from '../utils/refactor-helpers.js';

export async function designTargetStructure(
  appPath: string,
  config?: Partial<AnalyzerConfig>,
  features?: string[]
): Promise<DesignTargetStructureOutput> {
  const featureList = features || [];

  // Build feature structure
  const featuresStructure: Record<string, string[]> = {};

  for (const feature of featureList) {
    featuresStructure[feature] = [...FEATURE_SUBDIRS];
  }

  // If no features detected, create a default structure
  if (featureList.length === 0) {
    featuresStructure['common'] = ['components', 'hooks', 'api'];
  }

  const structure: DesignTargetStructureOutput['structure'] = {
    src: {
      features: featuresStructure,
      shared: SHARED_DIRS,
      app: APP_DIRS,
    },
  };

  return { structure };
}