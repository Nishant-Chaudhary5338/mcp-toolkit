// ============================================================================
// GENERATOR - Diff Application Engine
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import type { ProposedDiff, ApplyResult, DiffChange } from './types.js';

// ============================================================================
// BACKUP
// ============================================================================

function createBackup(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.bak.${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

// ============================================================================
// CHANGE APPLICATION
// ============================================================================

function applyChange(source: string, change: DiffChange): { result: string; applied: boolean } {
  switch (change.type) {
    case 'replace': {
      if (!change.search) return { result: source, applied: false };
      const idx = source.indexOf(change.search);
      if (idx === -1) return { result: source, applied: false };
      const before = source.slice(0, idx);
      const after = source.slice(idx + change.search.length);
      return { result: before + (change.insert || '') + after, applied: true };
    }

    case 'insert_after': {
      if (!change.search || !change.insert) return { result: source, applied: false };
      const idx = source.indexOf(change.search);
      if (idx === -1) return { result: source, applied: false };
      const insertPoint = idx + change.search.length;
      return {
        result: source.slice(0, insertPoint) + '\n' + change.insert + source.slice(insertPoint),
        applied: true,
      };
    }

    case 'insert_before': {
      if (!change.search || !change.insert) return { result: source, applied: false };
      const idx = source.indexOf(change.search);
      if (idx === -1) return { result: source, applied: false };
      return {
        result: source.slice(0, idx) + change.insert + '\n' + source.slice(idx),
        applied: true,
      };
    }

    case 'delete': {
      if (!change.search) return { result: source, applied: false };
      const idx = source.indexOf(change.search);
      if (idx === -1) return { result: source, applied: false };
      return {
        result: source.slice(0, idx) + source.slice(idx + change.search.length),
        applied: true,
      };
    }

    default:
      return { result: source, applied: false };
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function applyDiffs(diffs: ProposedDiff[]): ApplyResult[] {
  const results: ApplyResult[] = [];

  // Group diffs by file
  const diffsByFile = new Map<string, ProposedDiff[]>();
  for (const diff of diffs) {
    if (!diffsByFile.has(diff.file)) diffsByFile.set(diff.file, []);
    diffsByFile.get(diff.file)!.push(diff);
  }

  for (const [filePath, fileDiffs] of diffsByFile) {
    try {
      if (!fs.existsSync(filePath)) {
        results.push({
          tool: path.basename(path.dirname(filePath)),
          file: filePath,
          backupPath: '',
          appliedChanges: 0,
          success: false,
          error: `File not found: ${filePath}`,
        });
        continue;
      }

      // Create backup
      const backupPath = createBackup(filePath);
      let source = fs.readFileSync(filePath, 'utf-8');
      let appliedCount = 0;

      // Apply all changes
      for (const diff of fileDiffs) {
        for (const change of diff.changes) {
          const { result, applied } = applyChange(source, change);
          if (applied) {
            source = result;
            appliedCount++;
          }
        }
      }

      // Write modified source
      fs.writeFileSync(filePath, source, 'utf-8');

      results.push({
        tool: path.basename(path.dirname(filePath)),
        file: filePath,
        backupPath,
        appliedChanges: appliedCount,
        success: true,
      });
    } catch (error) {
      results.push({
        tool: path.basename(path.dirname(filePath)),
        file: filePath,
        backupPath: '',
        appliedChanges: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

export function applyDiffToSingleFile(filePath: string, diffs: ProposedDiff[]): ApplyResult {
  const fileDiffs = diffs.filter(d => d.file === filePath);
  return applyDiffs(fileDiffs)[0] || {
    tool: path.basename(path.dirname(filePath)),
    file: filePath,
    backupPath: '',
    appliedChanges: 0,
    success: false,
    error: 'No diffs found for this file',
  };
}

export function rollbackFromBackup(backupPath: string, originalPath: string): boolean {
  try {
    if (!fs.existsSync(backupPath)) return false;
    fs.copyFileSync(backupPath, originalPath);
    return true;
  } catch {
    return false;
  }
}