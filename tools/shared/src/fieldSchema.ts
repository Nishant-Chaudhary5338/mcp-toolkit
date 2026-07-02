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

/** Runtime guard — validate an untrusted value is a usable FieldSchema. */
export function isFieldSchema(value: unknown): value is FieldSchema {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['resource'] === 'string' &&
    typeof v['baseEndpoint'] === 'string' &&
    typeof v['idKey'] === 'string' &&
    Array.isArray(v['fields'])
  );
}
