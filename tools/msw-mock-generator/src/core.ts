// msw-mock-generator CORE — pure logic (no MCP transport).
//
// FieldSchema → MSW request handlers (GET list, GET :id, POST, PUT, DELETE) +
// a deterministic in-memory seed. Drop the handlers into an MSW worker/server
// and the generated CRUD feature runs against a mock API in dev and tests —
// closing the loop with the CRUD factory.

import type { FieldSchema, Field } from '@mcp-showcase/shared';
import { isFieldSchema, pascal, camel, plural } from '@mcp-showcase/shared';

export interface GenerateMockResult {
  code: string;
  filename: string;
  seedCount: number;
  handlerCount: number;
}

export type GenerateMockOutcome =
  | { ok: true; result: GenerateMockResult }
  | { ok: false; error: string };

export interface GenerateMockOptions {
  count?: number;
}

/** Deterministic fake value for a field at seed index i (no randomness → stable tests). */
function fakeValue(field: Field, i: number): string {
  switch (field.type) {
    case 'email':
      return JSON.stringify(`user${i + 1}@example.com`);
    case 'password':
      return JSON.stringify('secret123');
    case 'number':
      return String((i + 1) * 10);
    case 'boolean':
      return String(i % 2 === 0);
    case 'date':
      return JSON.stringify(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`);
    case 'textarea':
      return JSON.stringify(`Sample ${field.label.toLowerCase()} content for record ${i + 1}.`);
    case 'select':
      return JSON.stringify(field.enumValues?.[i % (field.enumValues.length || 1)] ?? 'option');
    case 'relation':
      return String(i + 1);
    default:
      return JSON.stringify(`${field.label} ${i + 1}`);
  }
}

function seedRecords(fs: FieldSchema, count: number): string {
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const fields = fs.fields.map((f) => `${f.name}: ${fakeValue(f, i)}`);
    rows.push(`  { ${fs.idKey}: ${i + 1}, ${fields.join(', ')} }`);
  }
  return `[\n${rows.join(',\n')},\n]`;
}

export function generateMock(input: unknown, opts: GenerateMockOptions = {}): GenerateMockOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return { ok: false, error: 'Invalid JSON for FieldSchema.' }; }
  }
  if (!isFieldSchema(schema)) return { ok: false, error: 'Expected a FieldSchema (from infer-fields).' };
  const fs: FieldSchema = schema;

  const count = Number.isFinite(opts.count) && (opts.count as number) > 0 ? Math.floor(opts.count as number) : 3;
  if (fs.fields.length === 0) return { ok: false, error: 'FieldSchema has no fields to seed.' };

  const Type = pascal(fs.resource);
  const store = camel(plural(fs.resource));
  const collection = fs.baseEndpoint;
  const idKey = fs.idKey;
  const seed = seedRecords(fs, count);

  const code = `import { http, HttpResponse } from 'msw';
import type { ${Type} } from './${Type}.schema';

type ${Type}Record = ${Type} & { ${idKey}: number };

let ${store}: ${Type}Record[] = ${seed};

export const ${camel(fs.resource)}Handlers = [
  http.get('${collection}', () => HttpResponse.json(${store})),

  http.get('${collection}/:id', ({ params }) => {
    const item = ${store}.find((r) => String(r.${idKey}) === params.id);
    return item ? HttpResponse.json(item) : new HttpResponse(null, { status: 404 });
  }),

  http.post('${collection}', async ({ request }) => {
    const body = (await request.json()) as ${Type};
    const item: ${Type}Record = { ${idKey}: ${store}.length + 1, ...body };
    ${store}.push(item);
    return HttpResponse.json(item, { status: 201 });
  }),

  http.put('${collection}/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<${Type}>;
    ${store} = ${store}.map((r) => (String(r.${idKey}) === params.id ? { ...r, ...body } : r));
    const updated = ${store}.find((r) => String(r.${idKey}) === params.id);
    return updated ? HttpResponse.json(updated) : new HttpResponse(null, { status: 404 });
  }),

  http.delete('${collection}/:id', ({ params }) => {
    ${store} = ${store}.filter((r) => String(r.${idKey}) !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
`;

  return { ok: true, result: { code, filename: `${Type}.handlers.ts`, seedCount: count, handlerCount: 5 } };
}
