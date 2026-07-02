// ============================================================================
// infer-fields CORE — pure logic (no MCP transport). Testable + workflow-composable.
//
// Turns a JSON API sample or an OpenAPI schema object into a normalized
// FieldSchema — the single data contract every downstream CRUD / form / table /
// detail generator consumes. See docs/CRUD_AUTOMATION_PLAN.md §3.
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

export interface InferInput {
  /** JSON sample response, array of records, or OpenAPI schema — as a JSON string or a value. */
  input: string | Record<string, unknown> | unknown[];
  /** Resource name override, e.g. "article". Inferred from baseEndpoint/title when omitted. */
  resource?: string;
  /** REST base endpoint, e.g. "/api/articles". Defaults to /api/<plural resource>. */
  baseEndpoint?: string;
}

export type InferResult =
  | { ok: true; schema: FieldSchema; source: 'sample' | 'openapi'; count: number }
  | { ok: false; error: string };

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP = new Set([
  'id', '_id', '__v', 'createdAt', 'updatedAt', 'created_at', 'updated_at',
  'deletedAt', 'deleted_at',
]);
const ID_KEYS = ['id', '_id'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;
const FK_RE = /^(.+?)(Id|_id|ID)$/;
const LONG_TEXT_KEYS = ['description', 'body', 'content', 'notes', 'bio', 'summary', 'about'];

// ── String helpers ───────────────────────────────────────────────────────────

function toLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function singular(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, 'y');
  if (/ses$/i.test(word)) return word.replace(/es$/i, '');
  if (/[^s]s$/i.test(word)) return word.replace(/s$/i, '');
  return word;
}

function plural(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return word.replace(/y$/i, 'ies');
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/s$/i.test(word)) return word;
  return `${word}s`;
}

// ── Type inference ───────────────────────────────────────────────────────────

function typeFromValue(key: string, value: unknown): FieldType | null {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    const k = key.toLowerCase();
    if (k.includes('password')) return 'password';
    if (k.includes('email') || EMAIL_RE.test(value)) return 'email';
    if (DATE_RE.test(value) || k.includes('date') || /(_at|At)$/.test(key)) return 'date';
    if (value.length > 120 || LONG_TEXT_KEYS.some((t) => k.includes(t))) return 'textarea';
    return 'text';
  }
  return null;
}

interface OpenApiProp {
  type?: string;
  format?: string;
  enum?: string[];
  $ref?: string;
  items?: OpenApiProp;
}

function typeFromOpenApi(prop: OpenApiProp, key: string): FieldType | null {
  if (prop.enum?.length) return 'select';
  const { type, format } = prop;
  if (type === 'boolean') return 'boolean';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'string') {
    const k = key.toLowerCase();
    if (format === 'email' || k.includes('email')) return 'email';
    if (format === 'password' || k.includes('password')) return 'password';
    if (format === 'date' || format === 'date-time' || k.includes('date')) return 'date';
    if (format === 'textarea' || LONG_TEXT_KEYS.some((t) => k.includes(t))) return 'textarea';
    return 'text';
  }
  return null;
}

/** Foreign-key key name → relation, e.g. "authorId" → { resource: "author", labelKey: "name" }. */
function relationFromKey(key: string): { resource: string; labelKey: string } | null {
  const m = FK_RE.exec(key);
  if (!m || !m[1]) return null;
  const base = m[1].replace(/_$/, '');
  if (!base) return null;
  return { resource: singular(base.toLowerCase()), labelKey: 'name' };
}

/** `$ref: '#/components/schemas/Author'` → relation to "author". */
function relationFromRef(ref: string): { resource: string; labelKey: string } {
  const name = ref.split('/').pop() ?? 'related';
  return { resource: singular(name.toLowerCase()), labelKey: 'name' };
}

// ── Table / form presentation defaults ───────────────────────────────────────

function tableDefaults(type: FieldType): Field['table'] {
  if (type === 'password') return { show: false, sortable: false, filterable: false };
  if (type === 'textarea') return { show: false, sortable: false, filterable: false };
  if (type === 'relation') return { show: true, sortable: false, filterable: true };
  if (type === 'select' || type === 'boolean') return { show: true, sortable: true, filterable: true };
  return { show: true, sortable: true, filterable: type === 'text' || type === 'email' };
}

function formDefaults(type: FieldType, label: string): Field['form'] {
  const placeholder = type === 'text' || type === 'email' || type === 'textarea'
    ? `Enter ${label.toLowerCase()}`
    : undefined;
  return { show: true, ...(placeholder ? { placeholder } : {}) };
}

function buildField(
  name: string,
  type: FieldType,
  required: boolean,
  extra?: Partial<Pick<Field, 'enumValues' | 'relation'>>,
): Field {
  const label = toLabel(name);
  return {
    name,
    label,
    type,
    required,
    ...(extra?.enumValues ? { enumValues: extra.enumValues } : {}),
    ...(extra?.relation ? { relation: extra.relation } : {}),
    table: tableDefaults(type),
    form: formDefaults(type, label),
  };
}

// ── Envelope unwrapping ──────────────────────────────────────────────────────

function unwrap(value: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['data', 'result', 'item', 'response', 'payload', 'record', 'object']) {
    const inner = value[key];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }
  }
  for (const key of ['data', 'items', 'results', 'records', 'list']) {
    const arr = value[key];
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
      return arr[0] as Record<string, unknown>;
    }
  }
  return value;
}

// ── Resource / endpoint inference ────────────────────────────────────────────

function resolveNaming(
  obj: Record<string, unknown>,
  opts: InferInput,
): Pick<FieldSchema, 'resource' | 'baseEndpoint' | 'idKey'> {
  const idKey = ID_KEYS.find((k) => k in obj) ?? 'id';
  let resource = opts.resource?.toLowerCase().trim();
  if (!resource && opts.baseEndpoint) {
    const seg = opts.baseEndpoint.split('/').filter(Boolean).pop();
    if (seg) resource = singular(seg.toLowerCase());
  }
  if (!resource && typeof obj['title'] === 'string') resource = singular(String(obj['title']).toLowerCase());
  resource = resource || 'resource';
  const baseEndpoint = opts.baseEndpoint ?? `/api/${plural(resource)}`;
  return { resource, baseEndpoint, idKey };
}

// ── OpenAPI schema handling ──────────────────────────────────────────────────

function isOpenApiSchema(obj: Record<string, unknown>): boolean {
  return typeof obj['properties'] === 'object' && obj['properties'] !== null;
}

/** If given a full OpenAPI doc ({ components: { schemas: {...} } }), pick the first schema. */
function pickSchema(obj: Record<string, unknown>): Record<string, unknown> {
  const components = obj['components'] as Record<string, unknown> | undefined;
  const schemas = components?.['schemas'] as Record<string, unknown> | undefined;
  if (schemas) {
    const first = Object.values(schemas)[0];
    if (first && typeof first === 'object') return first as Record<string, unknown>;
  }
  return obj;
}

function fieldsFromOpenApi(schema: Record<string, unknown>): Field[] {
  const props = schema['properties'] as Record<string, OpenApiProp>;
  const required = new Set((schema['required'] as string[] | undefined) ?? []);
  const fields: Field[] = [];
  for (const [key, prop] of Object.entries(props)) {
    if (SKIP.has(key) || typeof prop !== 'object' || prop === null) continue;
    const isRequired = required.has(key);
    if (prop.$ref) {
      fields.push(buildField(key, 'relation', isRequired, { relation: relationFromRef(prop.$ref) }));
      continue;
    }
    const rel = relationFromKey(key);
    if (rel && prop.type !== 'boolean') {
      fields.push(buildField(key, 'relation', isRequired, { relation: rel }));
      continue;
    }
    const type = typeFromOpenApi(prop, key);
    if (!type) continue;
    fields.push(buildField(key, type, isRequired, type === 'select' ? { enumValues: prop.enum } : undefined));
  }
  return fields;
}

function fieldsFromSample(obj: Record<string, unknown>): Field[] {
  const fields: Field[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (SKIP.has(key)) continue;
    // Nested object with its own id → relation.
    if (value && typeof value === 'object' && !Array.isArray(value) && ('id' in value || '_id' in value)) {
      fields.push(buildField(key, 'relation', true, { relation: { resource: singular(key.toLowerCase()), labelKey: 'name' } }));
      continue;
    }
    if (value !== null && typeof value === 'object') continue; // skip arrays / opaque objects
    const rel = relationFromKey(key);
    if (rel && typeof value !== 'boolean') {
      fields.push(buildField(key, 'relation', true, { relation: rel }));
      continue;
    }
    const type = typeFromValue(key, value);
    if (!type) continue;
    fields.push(buildField(key, type, true));
  }
  return fields;
}

// ── Public entry point ───────────────────────────────────────────────────────

export function inferFields(opts: InferInput): InferResult {
  let parsed: unknown = opts.input;
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed) return { ok: false, error: 'Empty input — paste a JSON sample response or an OpenAPI schema object.' };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: 'Invalid JSON — paste a JSON sample response or an OpenAPI schema object.' };
    }
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { ok: false, error: 'Empty array — provide at least one sample record.' };
    parsed = parsed[0];
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Expected a JSON object or an array of objects.' };
  }

  const root = pickSchema(parsed as Record<string, unknown>);

  if (isOpenApiSchema(root)) {
    const fields = fieldsFromOpenApi(root);
    if (fields.length === 0) return { ok: false, error: 'No usable fields found in the OpenAPI schema.' };
    const naming = resolveNaming(root, opts);
    return { ok: true, schema: { ...naming, fields }, source: 'openapi', count: fields.length };
  }

  const obj = unwrap(parsed as Record<string, unknown>);
  const fields = fieldsFromSample(obj);
  if (fields.length === 0) return { ok: false, error: 'No usable fields found in the sample — every key was skipped or unsupported.' };
  const naming = resolveNaming(obj, opts);
  return { ok: true, schema: { ...naming, fields }, source: 'sample', count: fields.length };
}
