// ============================================================================
// TYPES FOR REFACTOR EXECUTOR MCP TOOLS
// ============================================================================

/**
 * Refactor plan input (from generate-refactor-plan output)
 */
export interface FileMove {
  from: string;
  to: string;
  reason: string;
}

export interface ModuleSplit {
  file: string;
  suggestion: string;
  reason: string;
  proposedFiles: string[];
}

export interface FileRename {
  from: string;
  to: string;
  reason: string;
}

export interface RefactorPlan {
  moves: FileMove[];
  renames: FileRename[];
  splits: ModuleSplit[];
}

/**
 * Tool input types
 */
export interface ValidateRefactorPlanInput {
  path: string;
  refactorPlan: RefactorPlan;
}

export interface CreateTargetStructureInput {
  path: string;
  refactorPlan: RefactorPlan;
  backupPath?: string;
}

export interface MoveFilesInput {
  path: string;
  refactorPlan: RefactorPlan;
  backupPath?: string;
}

export interface UpdateImportsInput {
  path: string;
  refactorPlan: RefactorPlan;
  movedFiles?: Record<string, string>; // old path -> new path
}

export interface RenameFilesInput {
  path: string;
  refactorPlan: RefactorPlan;
  backupPath?: string;
}

export interface SplitModulesInput {
  path: string;
  refactorPlan: RefactorPlan;
  backupPath?: string;
}

export interface CreateIndexFilesInput {
  path: string;
  refactorPlan: RefactorPlan;
}

export interface ValidateBuildInput {
  path: string;
  buildCommand?: string;
}

export interface RollbackInput {
  path: string;
  backupPath: string;
}

export interface ApplyRefactorInput {
  path: string;
  refactorPlan: RefactorPlan;
  dryRun?: boolean;
  buildCommand?: string;
}

/**
 * Tool output types
 */
export interface ValidationError {
  type: 'missing-source' | 'duplicate-destination' | 'conflicting-move' | 'invalid-path';
  message: string;
  files?: string[];
}

export interface ValidationWarning {
  type: string;
  message: string;
  files?: string[];
}

export interface ValidateRefactorPlanOutput {
  readonly valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalMoves: number;
    totalRenames: number;
    totalSplits: number;
    affectedFiles: number;
  };
}

export interface CreateTargetStructureOutput {
  success: boolean;
  createdDirectories: string[];
  errors: string[];
}

export interface MoveOperation {
  source: string;
  destination: string;
  success: boolean;
  error?: string;
}

export interface MoveFilesOutput {
  success: boolean;
  movedFiles: MoveOperation[];
  errors: string[];
}

export interface ImportUpdate {
  file: string;
  oldImport: string;
  newImport: string;
  line: number;
}

export interface UpdateImportsOutput {
  success: boolean;
  updatedFiles: string[];
  importUpdates: ImportUpdate[];
  errors: string[];
}

export interface RenameOperation {
  oldPath: string;
  newPath: string;
  success: boolean;
  error?: string;
}

export interface RenameFilesOutput {
  success: boolean;
  renamedFiles: RenameOperation[];
  errors: string[];
}

export interface SplitOperation {
  originalFile: string;
  createdFiles: string[];
  success: boolean;
  error?: string;
}

export interface SplitModulesOutput {
  success: boolean;
  splitOperations: SplitOperation[];
  errors: string[];
}

export interface IndexFile {
  path: string;
  exports: string[];
}

export interface CreateIndexFilesOutput {
  success: boolean;
  createdIndexFiles: IndexFile[];
  errors: string[];
}

export interface BuildError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
}

export interface ValidateBuildOutput {
  success: boolean;
  buildOutput: string;
  errors: BuildError[];
  warnings: BuildError[];
}

export interface RollbackOperation {
  action: 'restore-file' | 'delete-file' | 'restore-directory' | 'delete-directory';
  path: string;
  success: boolean;
  error?: string;
}

export interface RollbackOutput {
  success: boolean;
  operations: RollbackOperation[];
  errors: string[];
}

export interface ApplyRefactorOutput {
  success: boolean;
  dryRun: boolean;
  steps: {
    name: string;
    success: boolean;
    output: unknown;
  }[];
  backupPath?: string;
  buildValidation?: ValidateBuildOutput;
  rollbackPerformed?: boolean;
  summary: {
    filesMoved: number;
    filesRenamed: number;
    filesSplit: number;
    importsUpdated: number;
    indexFilesCreated: number;
  };
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  timestamp: string;
  originalPath: string;
  backupPath: string;
  operations: {
    type: 'move' | 'rename' | 'split' | 'create-dir' | 'create-index';
    originalPath: string;
    newPath?: string;
    content?: string;
  }[];
}

/**
 * Import info for AST processing
 */
export interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  line: number;
  startColumn: number;
  endColumn: number;
}

export interface ParsedFile {
  filePath: string;
  content: string;
  ast: unknown;
  imports: ImportInfo[];
}