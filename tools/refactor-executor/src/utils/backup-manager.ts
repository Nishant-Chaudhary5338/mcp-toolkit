// ============================================================================
// BACKUP MANAGER - Manage backups and rollback operations
// ============================================================================

import * as fs from 'fs-extra';
import * as path from 'path';
import type { BackupMetadata, RollbackOperation, RollbackOutput } from '../types.js';

/**
 * Create a full backup of the project
 */
export async function createFullBackup(projectPath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(path.dirname(projectPath), `.refactor-backup-${timestamp}`);
  const projectName = path.basename(projectPath);
  const backupPath = path.join(backupDir, projectName);

  await fs.ensureDir(backupDir);
  await fs.copy(projectPath, backupPath, {
    filter: (src) => {
      const relative = path.relative(projectPath, src);
      return !relative.includes('node_modules') && !relative.includes('.git');
    },
  });

  // Create metadata
  const metadata: BackupMetadata = {
    timestamp,
    originalPath: projectPath,
    backupPath,
    operations: [],
  };

  await fs.writeJson(path.join(backupDir, '.backup-metadata.json'), metadata, { spaces: 2 });

  return backupDir;
}

/**
 * Load backup metadata
 */
export async function loadBackupMetadata(backupDir: string): Promise<BackupMetadata | null> {
  const metadataPath = path.join(backupDir, '.backup-metadata.json');
  try {
    if (await fs.pathExists(metadataPath)) {
      return await fs.readJson(metadataPath);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Save backup metadata
 */
export async function saveBackupMetadata(
  backupDir: string,
  metadata: BackupMetadata
): Promise<void> {
  const metadataPath = path.join(backupDir, '.backup-metadata.json');
  await fs.writeJson(metadataPath, metadata, { spaces: 2 });
}

/**
 * Record an operation in backup metadata
 */
export async function recordOperation(
  backupDir: string,
  operation: BackupMetadata['operations'][0]
): Promise<void> {
  const metadata = await loadBackupMetadata(backupDir);
  if (metadata) {
    metadata.operations.push(operation);
    await saveBackupMetadata(backupDir, metadata);
  }
}

/**
 * Restore original file from backup
 */
async function restoreFromBackup(
  backupDir: string,
  originalPath: string,
  projectName: string
): Promise<boolean> {
  const metadata = await loadBackupMetadata(backupDir);
  if (!metadata) return false;

  const backupProjectPath = metadata.backupPath;
  const relPath = path.relative(metadata.originalPath, originalPath);
  const backupFilePath = path.join(backupProjectPath, relPath);

  if (await fs.pathExists(backupFilePath)) {
    await fs.copy(backupFilePath, originalPath);
    return true;
  }

  return false;
}

/**
 * Rollback all changes from backup
 */
export async function rollbackFromBackup(backupDir: string): Promise<RollbackOutput> {
  const operations: RollbackOperation[] = [];
  const errors: string[] = [];

  const metadata = await loadBackupMetadata(backupDir);
  if (!metadata) {
    return {
      success: false,
      operations: [],
      errors: ['Backup metadata not found'],
    };
  }

  const { originalPath, backupPath, operations: recordedOps } = metadata;

  // Process operations in reverse order
  for (const op of recordedOps.reverse()) {
    try {
      switch (op.type) {
        case 'move':
        case 'rename':
          // Restore original file and delete new location
          if (op.newPath) {
            const relPath = path.relative(originalPath, op.originalPath);
            const backupFilePath = path.join(backupPath, relPath);

            if (await fs.pathExists(backupFilePath)) {
              await fs.ensureDir(path.dirname(op.originalPath));
              await fs.copy(backupFilePath, op.originalPath);
              operations.push({
                action: 'restore-file',
                path: op.originalPath,
                success: true,
              });

              // Delete the moved/renamed file if it exists
              if (await fs.pathExists(op.newPath)) {
                await fs.remove(op.newPath);
                operations.push({
                  action: 'delete-file',
                  path: op.newPath,
                  success: true,
                });
              }
            }
          }
          break;

        case 'create-dir':
          // Remove created directory if empty
          if (op.newPath && await fs.pathExists(op.newPath)) {
            const contents = await fs.readdir(op.newPath);
            if (contents.length === 0) {
              await fs.remove(op.newPath);
              operations.push({
                action: 'delete-directory',
                path: op.newPath,
                success: true,
              });
            }
          }
          break;

        case 'create-index':
          // Remove created index file
          if (op.newPath && await fs.pathExists(op.newPath)) {
            await fs.remove(op.newPath);
            operations.push({
              action: 'delete-file',
              path: op.newPath,
              success: true,
            });
          }
          break;

        case 'split':
          // Restore original file, remove split files
          const relPath = path.relative(originalPath, op.originalPath);
          const backupFilePath = path.join(backupPath, relPath);

          if (await fs.pathExists(backupFilePath)) {
            await fs.ensureDir(path.dirname(op.originalPath));
            await fs.copy(backupFilePath, op.originalPath);
            operations.push({
              action: 'restore-file',
              path: op.originalPath,
              success: true,
            });

            // Remove split files
            if (op.newPath) {
              const splitFiles = op.newPath.split('|');
              for (const splitFile of splitFiles) {
                if (await fs.pathExists(splitFile)) {
                  await fs.remove(splitFile);
                  operations.push({
                    action: 'delete-file',
                    path: splitFile,
                    success: true,
                  });
                }
              }
            }
          }
          break;
      }
    } catch (error) {
      errors.push(
        `Failed to rollback ${op.type} operation on ${op.originalPath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      operations.push({
        action: 'restore-file',
        path: op.originalPath,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Copy entire backup back if needed (nuclear option)
  if (errors.length > 0) {
    try {
      await fs.remove(originalPath);
      await fs.copy(backupPath, originalPath, {
        filter: (src) => {
          const relative = path.relative(backupPath, src);
          return !relative.includes('node_modules') && !relative.includes('.git');
        },
      });
    } catch (nuclearError) {
      errors.push(
        `Nuclear rollback also failed: ${
          nuclearError instanceof Error ? nuclearError.message : 'Unknown error'
        }`
      );
    }
  }

  return {
    success: errors.length === 0,
    operations,
    errors,
  };
}

/**
 * Clean up backup directory
 */
export async function cleanupBackup(backupDir: string): Promise<void> {
  try {
    if (await fs.pathExists(backupDir)) {
      await fs.remove(backupDir);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * List all backups for a project
 */
export async function listBackups(projectPath: string): Promise<string[]> {
  const parentDir = path.dirname(projectPath);
  const projectName = path.basename(projectPath);
  const backupPrefix = `.refactor-backup-`;

  try {
    const entries = await fs.readdir(parentDir);
    return entries
      .filter((entry) => entry.startsWith(backupPrefix))
      .map((entry) => path.join(parentDir, entry))
      .filter(async (backupDir) => {
        const metadata = await loadBackupMetadata(backupDir);
        return metadata && metadata.originalPath === projectPath;
      });
  } catch {
    return [];
  }
}

/**
 * Get backup size in MB
 */
export async function getBackupSize(backupDir: string): Promise<number> {
  try {
    let totalSize = 0;
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          totalSize += stat.size;
        }
      }
    };
    await walk(backupDir);
    return totalSize / (1024 * 1024); // Convert to MB
  } catch {
    return 0;
  }
}