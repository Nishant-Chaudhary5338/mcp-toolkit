// ============================================================================
// TOOL #8: VALIDATE BUILD
// Run build/dev server, detect errors
// ============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type {
  ValidateBuildInput,
  ValidateBuildOutput,
  BuildError,
} from '../types.js';

const execAsync = promisify(exec);

/**
 * Validate the project builds successfully after refactoring
 */
export async function validateBuild(
  input: ValidateBuildInput
): Promise<ValidateBuildOutput> {
  const { path: projectPath, buildCommand = 'npm run build' } = input;

  try {
    // Run the build command
    const { stdout, stderr } = await execAsync(buildCommand, {
      cwd: projectPath,
      timeout: 120000, // 2 minute timeout
    });

    const buildOutput = stdout + stderr;
    const errors: BuildError[] = [];
    const warnings: BuildError[] = [];

    // Parse TypeScript errors from output
    const tsErrorRegex = /(.+\.tsx?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g;
    let match;
    while ((match = tsErrorRegex.exec(buildOutput)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5],
      });
    }

    // Parse TypeScript warnings
    const tsWarningRegex = /(.+\.tsx?)\((\d+),(\d+)\):\s*warning\s+(TS\d+):\s*(.+)/g;
    while ((match = tsWarningRegex.exec(buildOutput)) !== null) {
      warnings.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5],
      });
    }

    // Check for module resolution errors
    const moduleErrorRegex = /Cannot find module '(.+)' or its corresponding type/g;
    while ((match = moduleErrorRegex.exec(buildOutput)) !== null) {
      errors.push({
        message: `Cannot find module: ${match[1]}`,
      });
    }

    return {
      success: errors.length === 0,
      buildOutput,
      errors,
      warnings,
    };
  } catch (error: any) {
    // Build failed
    const buildOutput = error.stdout + error.stderr || '';
    const errors: BuildError[] = [];
    const warnings: BuildError[] = [];

    // Parse errors from failed build
    const tsErrorRegex = /(.+\.tsx?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g;
    let match;
    while ((match = tsErrorRegex.exec(buildOutput)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5],
      });
    }

    // Add generic error if no specific errors found
    if (errors.length === 0) {
      errors.push({
        message: error.message || 'Build failed with unknown error',
      });
    }

    return {
      success: false,
      buildOutput,
      errors,
      warnings,
    };
  }
}