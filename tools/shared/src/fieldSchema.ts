// ============================================================================
// FieldSchema — the shared data contract for the CRUD factory.
//
// infer-fields produces it; every generator (zod / api-client / form / table /
// detail / crud-composer) consumes it. Keeping it here means one source of
// truth and lets workflow-runner compose the generators in-process.
// See docs/CRUD_AUTOMATION_PLAN.md §3.
// ============================================================================

export type FieldType =
  | 'text' | 'email' | 'password' | 'number' | 'boolean'
  | 'date' | 'textarea' | 'select' | 'relation';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Present when type === 'select'. */
  enumValues?: string[];
  /** Present when type === 'relation' (foreign key or nested object). */
  relation?: { resource: string; labelKey: string };
  /** How this field should appear in a generated data table. */
  table: { show: boolean; sortable: boolean; filterable: boolean };
  /** How this field should appear in a generated form. */
  form: { show: boolean; placeholder?: string };
}

export interface FieldSchema {
  resource: string;
  baseEndpoint: string;
  idKey: string;
  fields: Field[];
}

/** Data-layer target for generated API integration. */
export type DataLayer = 'rtk' | 'tanstack';

/** Router target for generated routes. */
export type Router = 'rr7' | 'next';

const VALID_IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Runtime guard — validate an untrusted value is a usable FieldSchema.
 * Every generator (zod / api-client / form / table / detail / crud-composer /
 * msw-mock / test-data-factory) calls this first, so it's the single point to
 * enforce field.name is a valid JS identifier — found fuzzing every generator
 * with hand-built FieldSchemas containing spaces/non-ASCII/empty names, which
 * are interpolated as bare identifiers, object keys, and register() args
 * downstream with no validation of their own. infer-fields already sanitizes
 * names it produces; this rejects (rather than silently rewrites) names from
 * any other producer, since silently rewriting risks a mismatch between the
 * generated identifier and the real API field key.
 */
export function isFieldSchema(value: unknown): value is FieldSchema {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v['resource'] !== 'string' ||
    typeof v['baseEndpoint'] !== 'string' ||
    typeof v['idKey'] !== 'string' ||
    !Array.isArray(v['fields'])
  ) {
    return false;
  }
  return (v['fields'] as unknown[]).every(
    (f) => f && typeof f === 'object' && typeof (f as Record<string, unknown>)['name'] === 'string'
      && VALID_IDENTIFIER_RE.test((f as Record<string, unknown>)['name'] as string),
  );
}
