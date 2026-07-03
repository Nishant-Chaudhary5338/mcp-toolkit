#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import type { ToolResult, ToolDefinition } from '@mcp-showcase/shared';
import { validateRefactorPlan } from './tools/01-validate-refactor-plan.js';
import { createTargetStructure } from './tools/02-create-target-structure.js';
import { moveFiles } from './tools/03-move-files.js';
import { updateImports } from './tools/04-update-imports.js';
import { renameFiles } from './tools/05-rename-files.js';
import { splitModules } from './tools/06-split-modules.js';
import { createIndexFiles } from './tools/07-create-index-files.js';
import { validateBuild } from './tools/08-validate-build.js';
import { rollbackOnFailure } from './tools/09-rollback-on-failure.js';
import { applyRefactor } from './tools/10-apply-refactor.js';
import type { RefactorPlan } from './types.js';

const REFACTOR_PLAN_SCHEMA = {
  type: 'object',
  description: 'Refactor plan with moves, renames, and splits',
  properties: {
    moves: {
      type: 'array',
      description: 'Files to move',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source path' },
          to: { type: 'string', description: 'Destination path' },
          reason: { type: 'string', description: 'Reason for move' },
        },
        required: ['from', 'to'],
      },
    },
    renames: {
      type: 'array',
      description: 'Files to rename',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Current path' },
          to: { type: 'string', description: 'New path' },
          reason: { type: 'string', description: 'Reason for rename' },
        },
        required: ['from', 'to'],
      },
    },
    splits: {
      type: 'array',
      description: 'Files to split into smaller modules',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'File to split' },
          suggestion: { type: 'string', description: 'Split suggestion' },
          reason: { type: 'string', description: 'Reason for split' },
          proposedFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Proposed split file paths',
          },
        },
        required: ['file', 'proposedFiles'],
      },
    },
  },
};

const TOOLS = [
  {
    name: 'validate-refactor-plan',
    description: "Validate a refactor plan before executing it — checks that every source path exists, destinations are unique, and no moves conflict. Returns { valid, errors, warnings }. Run this first; a plan must pass here before create-target-structure/move-files. Example: { path: '/app', refactorPlan: { moves: [{ from, to }] } }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        refactorPlan: REFACTOR_PLAN_SCHEMA,
      },
      required: ['path', 'refactorPlan'],
    },
  },
  {
    name: 'create-target-structure',
    description: "Create the destination directory structure for a refactor plan (and an optional backup first). Returns { created: string[], backupPath }. Safe/idempotent — existing directories are left untouched. Example: { path: '/app', refactorPlan, backupPath: '/app/.backup' }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        refactorPlan: REFACTOR_PLAN_SCHEMA,
        backupPath: { type: 'string', description: 'Optional backup directory path' },
      },
      required: ['path', 'refactorPlan'],
    },
  },
  {
    name: 'move-files',
    description: "Move files to their planned destinations (backing up first). Returns { moved: Record<oldPath,newPath>, backupPath }. Pair with update-imports afterward so references stay valid; use rollback-on-failure if a later step fails. Example: { path: '/app', refactorPlan, backupPath }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        refactorPlan: REFACTOR_PLAN_SCHEMA,
        backupPath: { type: 'string', description: 'Optional backup directory path' },
      },
      required: ['path', 'refactorPlan'],
    },
  },
  {
    name: 'update-imports',
    description: "Rewrite relative import paths across the project after files move, using an AST (not regex) so only real imports change. Returns { updatedFiles, importsUpdated }. Pass the movedFiles map from move-files. Example: { path: '/app', refactorPlan, movedFiles: { 'src/a.ts': 'src/x/a.ts' } }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        refactorPlan: REFACTOR_PLAN_SCHEMA,
        movedFiles: {
          type: 'object',
          description: 'Optional mapping of old path to new path',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['path', 'refactorPlan'],
    },
  },
  {
    name: 'rename-files',
    description: "Rename files per the plan's `renames` (backing up first) and update their imports. Returns { renamed, backupPath }. Example: { path: '/app', refactorPlan: { renames: [{ from, to }] }, backupPath }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        refactorPlan: REFACTOR_PLAN_SCHEMA,
        backupPath: { type: 'string', description: 'Optional backup directory path' },
      },
      required: ['path', 'refactorPlan'],
    },
  },
  {
    name: 'split-modules',
    description: "Split oversized modules into smaller files per the plan's `splits`, creating the new files and leaving TODO markers for content to move. Returns { splitFiles, created }. Review the output before committing. Example: { path: '/app', refactorPlan: { splits: [{ file, proposedFiles }] }, backupPath }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        refactorPlan: REFACTOR_PLAN_SCHEMA,
        backupPath: { type: 'string', description: 'Optional backup directory path' },
      },
      required: ['path', 'refactorPlan'],
    },
  },
  {
    name: 'create-index-files',
    description: "Generate barrel `index.ts` re-export files for the refactored directories so imports stay clean. Returns { indexFiles: string[] }. Example: { path: '/app', refactorPlan }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        refactorPlan: REFACTOR_PLAN_SCHEMA,
      },
      required: ['path', 'refactorPlan'],
    },
  },
  {
    name: 'validate-build',
    description: "Run the project's build command and detect errors — the safety gate after a refactor. Returns { success, errors: string[], output }. If it fails, call rollback-on-failure. Example: { path: '/app', buildCommand: 'npm run build' }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        buildCommand: { type: 'string', description: 'Build command to run (default: npm run build)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'rollback-on-failure',
    description: "Restore the project from a backup after a failed refactor — reverses moves/renames and falls back to a full re-copy from the backup. Returns { restored, backupPath }. Called automatically by apply-refactor on build failure, or manually. Example: { path: '/app', backupPath: '/app/.backup' }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        backupPath: { type: 'string', description: 'Backup directory path' },
      },
      required: ['path', 'backupPath'],
    },
  },
  {
    name: 'apply-refactor',
    description: "Execute the entire refactor pipeline end-to-end (validate -> backup -> create structure -> move -> update imports -> rename -> split -> barrels -> validate build) and automatically roll back to the backup if the build fails. Returns { success, steps, rolledBack, backupPath }. Set dryRun:true to preview. Example: { path: '/app', refactorPlan, dryRun: true, buildCommand: 'npm run build' }.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to legacy app root directory' },
        refactorPlan: REFACTOR_PLAN_SCHEMA,
        dryRun: { type: 'boolean', description: 'If true, only validate without making changes' },
        buildCommand: { type: 'string', description: 'Build command to run (default: npm run build)' },
      },
      required: ['path', 'refactorPlan'],
    },
  },
];

class RefactorExecutorServer extends McpServerBase {
  constructor() {
    super({ name: 'refactor-executor', version: '1.0.0' });
  }

  protected registerTools(): void {
    for (const t of TOOLS) {
      // TOOLS is config-driven; its schema literals are structurally the tool inputSchema.
      this.addTool(t.name, t.description, t.inputSchema as unknown as ToolDefinition['inputSchema'], (args) => this.dispatch(t.name, args));
    }
  }

  private async dispatch(name: string, rawArgs: unknown): Promise<ToolResult> {
    const args = (rawArgs ?? {}) as Record<string, unknown>;
    const appPath = args.path as string;
    const refactorPlan = args.refactorPlan as RefactorPlan | undefined;
    try {
      let result: unknown;
        switch (name) {
          case 'validate-refactor-plan':
            result = await validateRefactorPlan({ path: appPath, refactorPlan: refactorPlan! });
            break;
          case 'create-target-structure':
            result = await createTargetStructure({
              path: appPath,
              refactorPlan: refactorPlan!,
              backupPath: args.backupPath as string,
            });
            break;
          case 'move-files':
            result = await moveFiles({
              path: appPath,
              refactorPlan: refactorPlan!,
              backupPath: args.backupPath as string,
            });
            break;
          case 'update-imports':
            result = await updateImports({
              path: appPath,
              refactorPlan: refactorPlan!,
              movedFiles: args.movedFiles as Record<string, string>,
            });
            break;
          case 'rename-files':
            result = await renameFiles({
              path: appPath,
              refactorPlan: refactorPlan!,
              backupPath: args.backupPath as string,
            });
            break;
          case 'split-modules':
            result = await splitModules({
              path: appPath,
              refactorPlan: refactorPlan!,
              backupPath: args.backupPath as string,
            });
            break;
          case 'create-index-files':
            result = await createIndexFiles({ path: appPath, refactorPlan: refactorPlan! });
            break;
          case 'validate-build':
            result = await validateBuild({
              path: appPath,
              buildCommand: args.buildCommand as string,
            });
            break;
          case 'rollback-on-failure':
            result = await rollbackOnFailure({
              path: appPath,
              backupPath: args.backupPath as string,
            });
            break;
          case 'apply-refactor':
            result = await applyRefactor({
              path: appPath,
              refactorPlan: refactorPlan!,
              dryRun: args.dryRun as boolean,
              buildCommand: args.buildCommand as string,
            });
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      return this.successWithDashboard('Refactor Executor', result as Record<string, unknown>);
    } catch (err) {
      return this.error(err);
    }
  }
}

new RefactorExecutorServer().run().catch(console.error);
