// ============================================================================
// FILE OPERATIONS
// ============================================================================

import fs from 'fs-extra';
import { readdir } from 'fs/promises';
import * as path from 'path';

export async function readFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function writeFile(filePath: string, content: string): Promise<boolean> {
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export async function renameFile(
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await fs.pathExists(oldPath))) {
      return { success: false, error: `File does not exist: ${oldPath}` };
    }
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function listFiles(dirPath: string, extensions?: string[]): Promise<string[]> {
  try {
    const files: string[] = [];
    async function walk(currentPath: string) {
      const entries = await readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'build', 'dist'].includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          if (!extensions || extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    }
    await walk(dirPath);
    return files;
  } catch {
    return [];
  }
}
