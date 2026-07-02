// workflow-runner CORE — pure logic (no MCP transport).
//
// Composes the generator cores IN-PROCESS (imported directly, not spawned) into
// named routines. This is the payoff of the core-first split: one tool drives
// the others. Routine "schema_to_feature":
//   infer-fields → zod-schema → api-client → table → detail → form(create+edit)
//   → crud-composer → review-gate (grade the generated code)
// Returns the generated files, a step-by-step journal, and the A–F grade.

import type { FieldSchema, DataLayer, Router } from '@mcp-showcase/shared';
import { isFieldSchema } from '@mcp-showcase/shared';
import { inferFields } from '@mcp-showcase/infer-fields/build/core.js';
import { generateZodSchema } from '@mcp-showcase/zod-schema-generator/build/core.js';
import { generateApiClient } from '@mcp-showcase/api-client-generator/build/core.js';
import { generateTable } from '@mcp-showcase/table-generator/build/core.js';
import { generateDetail } from '@mcp-showcase/detail-generator/build/core.js';
import { generateForm } from '@mcp-showcase/form-generator/build/core.js';
import { composeCrud } from '@mcp-showcase/crud-composer/build/core.js';
import { analyzeSource, gradeIssues } from '@mcp-showcase/review-gate/build/core.js';

export interface GeneratedFile {
  filename: string;
  code: string;
}

export interface JournalEntry {
  step: string;
  ok: boolean;
  note?: string;
}

export interface WorkflowResult {
  routine: string;
  resource: string;
  dataLayer: DataLayer;
  router: Router;
  files: GeneratedFile[];
  journal: JournalEntry[];
  grade: string;
  passed: boolean;
  fileCount: number;
}

export interface RunWorkflowArgs {
  input: string | Record<string, unknown> | unknown[];
  routine?: string;
  dataLayer?: DataLayer;
  router?: Router;
  resource?: string;
  baseEndpoint?: string;
}

/** Fail fast with a partial result carrying the journal so callers see where it stopped. */
class RoutineError extends Error {
  constructor(public readonly journal: JournalEntry[], message: string) {
    super(message);
  }
}

function resolveSchema(args: RunWorkflowArgs, journal: JournalEntry[]): FieldSchema {
  let parsed: unknown = args.input;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { /* inferFields will re-parse strings */ }
  }
  if (isFieldSchema(parsed)) {
    journal.push({ step: 'infer-fields', ok: true, note: 'input already a FieldSchema' });
    return parsed;
  }
  const inf = inferFields({ input: args.input, resource: args.resource, baseEndpoint: args.baseEndpoint });
  if (!inf.ok) {
    journal.push({ step: 'infer-fields', ok: false, note: inf.error });
    throw new RoutineError(journal, inf.error);
  }
  journal.push({ step: 'infer-fields', ok: true, note: `${inf.count} fields (${inf.source})` });
  return inf.schema;
}

export function runWorkflow(rawArgs: unknown): WorkflowResult {
  const args = (rawArgs ?? {}) as RunWorkflowArgs;
  if (args.input === undefined || args.input === null) throw new Error('Missing required argument "input".');
  const routine = args.routine ?? 'schema_to_feature';
  if (routine !== 'schema_to_feature') throw new Error(`Unknown routine "${routine}". Available: schema_to_feature.`);
  const dataLayer: DataLayer = args.dataLayer ?? 'rtk';
  const router: Router = args.router ?? 'rr7';

  const journal: JournalEntry[] = [];
  const files: GeneratedFile[] = [];

  const schema = resolveSchema(args, journal);

  const step = <T extends { code: string; filename: string }>(name: string, outcome: { ok: true; result: T } | { ok: false; error: string }): void => {
    if (!outcome.ok) {
      journal.push({ step: name, ok: false, note: outcome.error });
      throw new RoutineError(journal, `${name} failed: ${outcome.error}`);
    }
    files.push({ filename: outcome.result.filename, code: outcome.result.code });
    journal.push({ step: name, ok: true, note: outcome.result.filename });
  };

  step('zod-schema-generator', generateZodSchema(schema));
  step('api-client-generator', generateApiClient(schema, { dataLayer }));
  step('table-generator', generateTable(schema, { dataLayer }));
  step('detail-generator', generateDetail(schema, { dataLayer }));
  step('form-generator:create', generateForm(schema, { mode: 'create', dataLayer }));
  step('form-generator:edit', generateForm(schema, { mode: 'edit', dataLayer }));

  const crud = composeCrud(schema, { router });
  if (!crud.ok) {
    journal.push({ step: 'crud-composer', ok: false, note: crud.error });
    throw new RoutineError(journal, `crud-composer failed: ${crud.error}`);
  }
  for (const file of crud.result.files) files.push({ filename: file.path, code: file.code });
  journal.push({ step: 'crud-composer', ok: true, note: `${crud.result.files.length} route file(s)` });

  // Gate: grade every generated file's code (review-gate's analyzeSource is pure).
  const issues = files.flatMap((f) => analyzeSource(f.code, f.filename));
  const grade = gradeIssues(issues);
  const passed = issues.filter((i) => i.severity === 'error').length === 0;
  journal.push({ step: 'review-gate', ok: passed, note: `grade ${grade}, ${issues.length} issue(s)` });

  return { routine, resource: schema.resource, dataLayer, router, files, journal, grade, passed, fileCount: files.length };
}
