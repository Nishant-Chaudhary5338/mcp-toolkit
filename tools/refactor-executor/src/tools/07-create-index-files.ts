// ============================================================================
// TOOL #7: CREATE INDEX FILES
// Generate barrel exports, simplify imports
// ============================================================================

import * as path from 'path';
import * as fs from 'fs-extra';
import { listFiles, readFile, writeFile, pathExists, createDirectory } from '../utils/file-ops.js';
import { parseFile, extractImports } from '../utils/ast-transform.js';
import { recordOperation } from '../utils/backup-manager.js';
import type {
  CreateIndexFilesInput,
  CreateIndexFilesOutput,
  IndexFile,
} from '../types.js';

/**
 * Create index.ts barrel export files for directories
 */
export async function createIndexFiles(
  input: CreateIndexFilesInput
): Promise<CreateIndexFilesOutput> {
  const { path: projectPath, refactorPlan } = input;
  const createdIndexFiles: IndexFile[] = [];
  const errors: string[] = [];

  // Collect all directories that should have index files
  const targetDirs = new Set<string>();

  // From moves
  for (const move of refactorPlan.moves) {
    const destDir = path.dirname(path.resolve(projectPath, move.to));
    targetDirs.add(destDir);
  }

  // From splits
  for (const split of refactorPlan.splits) {
    for (const proposed of split.proposedFiles) {
      const dir = path.dirname(path.resolve(projectPath, proposed));
      targetDirs.add(dir);
    }
  }

  // Create index files for each directory
  for (const dir of targetDirs) {
    try {
      // Get all TypeScript/JavaScript files in directory
      const files = await listFiles(dir, ['.ts', '.tsx', '.js', '.jsx']);
      const dirFiles = files.filter((f) => path.dirname(f) === dir);

      if (dirFiles.length === 0) continue;

      // Skip if index file already exists
      const indexPath = path.join(dir, 'index.ts');
      if (await pathExists(indexPath)) continue;

      // Generate exports
      const exports: string[] = [];

      for (const file of dirFiles) {
        const fileName = path.basename(file, path.extname(file));
        if (fileName === 'index') continue;

        const content = await readFile(file);
        if (!content) continue;

        const parsed = parseFile(file, content);
        if (!parsed) continue;

        // Re-export everything from the file
        exports.push(`export * from './${fileName}';`);
      }

      if (exports.length > 0) {
        const indexContent = `// Auto-generated barrel export\n${exports.join('\n')}\n`;

        const writeSuccess = await writeFile(indexPath, indexContent);
        if (writeSuccess) {
          const relPath = path.relative(projectPath, indexPath);
          createdIndexFiles.push({
            path: relPath,
            exports,
          });
        } else {
          errors.push(`Failed to write index file: ${indexPath}`);
        }
      }
    } catch (error) {
      errors.push(
        `Error creating index for ${dir}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return {
    success: errors.length === 0,
    createdIndexFiles,
    errors,
  };
}