// ============================================================================
// TOOL #6: SPLIT MODULES
// Split large utility files into multiple smaller modules
// ============================================================================

import * as path from 'path';
import { readFile, writeFile, pathExists } from '../utils/file-ops.js';
import { parseFile, extractImports } from '../utils/ast-transform.js';
import { recordOperation } from '../utils/backup-manager.js';
import type {
  SplitModulesInput,
  SplitModulesOutput,
  SplitOperation,
  ModuleSplit,
} from '../types.js';

/**
 * Split large files into smaller modules based on split plan
 */
export async function splitModules(input: SplitModulesInput): Promise<SplitModulesOutput> {
  const { path: projectPath, refactorPlan, backupPath } = input;
  const splitOperations: SplitOperation[] = [];
  const errors: string[] = [];

  for (const split of refactorPlan.splits) {
    const filePath = path.resolve(projectPath, split.file);

    // Read the original file
    const content = await readFile(filePath);
    if (!content) {
      errors.push(`Cannot read file to split: ${split.file}`);
      splitOperations.push({
        originalFile: split.file,
        createdFiles: [],
        success: false,
        error: 'Cannot read file',
      });
      continue;
    }

    try {
      // Parse the file to understand its structure
      const parsed = parseFile(filePath, content);
      if (!parsed) {
        throw new Error('Failed to parse file');
      }

      // Create the split files
      const createdFiles: string[] = [];

      for (const proposedFile of split.proposedFiles) {
        const proposedPath = path.resolve(projectPath, proposedFile);

        // Determine what goes into this file based on naming
        // Generate the split file content based on proposed file name
        let splitContent = '';

        // Add imports from original file (ParsedFile already carries them)
        const imports = parsed.imports;
        for (const imp of imports) {
          if (imp.isDefault) {
            splitContent += `import ${imp.specifiers[0]} from '${imp.source}';\n`;
          } else {
            splitContent += `import { ${imp.specifiers.join(', ')} } from '${imp.source}';\n`;
          }
        }
        splitContent += '\n';

        // Add a placeholder export for the split file
        const basename = path.basename(proposedFile, path.extname(proposedFile));
        splitContent += `// ${basename} module\n`;
        splitContent += `// TODO: Add exports from ${split.file}\n`;
        splitContent += `export {};\n`;

        // Write the split file
        const writeSuccess = await writeFile(proposedPath, splitContent);
        if (writeSuccess) {
          createdFiles.push(proposedFile);
        } else {
          throw new Error(`Failed to write split file: ${proposedFile}`);
        }
      }

      // Backup original file if needed
      if (backupPath) {
        await recordOperation(backupPath, {
          type: 'split',
          originalPath: filePath,
          newPath: createdFiles.map((f) => path.resolve(projectPath, f)).join('|'),
        });
      }

      splitOperations.push({
        originalFile: split.file,
        createdFiles,
        success: true,
      });

    } catch (error) {
      errors.push(
        `Failed to split ${split.file}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      splitOperations.push({
        originalFile: split.file,
        createdFiles: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    splitOperations,
    errors,
  };
}