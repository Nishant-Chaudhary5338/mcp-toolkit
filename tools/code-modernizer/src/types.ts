// ============================================================================
// TYPES FOR CODE MODERNIZER
// ============================================================================

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  line: number;
  startColumn: number;
  endColumn: number;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  line: number;
  isExported: boolean;
  isComponent: boolean;
}

export interface ParsedFile {
  filePath: string;
  content: string;
  ast: unknown;
  imports: ImportInfo[];
}

export interface ConvertToTypeScriptInput {
  path: string;
  includeProps?: boolean;
  dryRun?: boolean;
  filePattern?: string;
}

export interface ConvertedFile {
  originalPath: string;
  newPath: string;
  addedTypes: string[];
  issues: string[];
  previewContent?: string;
}

export interface ConvertToTypeScriptOutput {
  success: boolean;
  convertedFiles: ConvertedFile[];
  skippedFiles: string[];
  errors: string[];
  summary: {
    totalFiles: number;
    convertedCount: number;
    skippedCount: number;
    errorCount: number;
  };
  /** Set when the run was a no-op for a reason worth surfacing, e.g. "already TypeScript". */
  message?: string;
}

export interface BackupMetadata {
  timestamp: string;
  originalPath: string;
  backupPath: string;
  operations: {
    type: string;
    originalPath: string;
    newPath?: string;
    content?: string;
  }[];
}
