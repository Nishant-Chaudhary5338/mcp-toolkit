// ============================================================================
// api-client-generator CORE — FieldSchema → typed data layer.
//
// Emits a full CRUD client for the resource against `dataLayer`:
//   - 'rtk'      → an RTK Query api slice + typed hooks + cache tags
//   - 'tanstack' → TanStack Query hooks over a typed fetch wrapper
// The generated code imports the resource type from the zod-schema-generator
// output (`./<Type>.schema`), so the two compose by filename convention.
// ============================================================================

import type { FieldSchema, DataLayer } from '@mcp-showcase/shared';
import { isFieldSchema, pascal, camel, plural } from '@mcp-showcase/shared';

export interface GenerateApiResult {
  code: string;
  filename: string;
  dataLayer: DataLayer;
  hooks: string[];
}

export type GenerateApiOutcome =
  | { ok: true; result: GenerateApiResult }
  | { ok: false; error: string };

export interface GenerateApiOptions {
  dataLayer?: DataLayer;
}

function parseSchema(input: unknown): FieldSchema | null {
  let schema = input;
  if (typeof schema === 'string') {
    try {
      schema = JSON.parse(schema);
    } catch {
      return null;
    }
  }
  return isFieldSchema(schema) ? schema : null;
}

function rtkClient(fs: FieldSchema): GenerateApiResult {
  const Type = pascal(fs.resource);
  const one = Type;
  const many = plural(Type);
  const api = `${camel(fs.resource)}Api`;
  const endpoint = fs.baseEndpoint;

  const hooks = [
    `useGet${many}Query`,
    `useGet${one}Query`,
    `useCreate${one}Mutation`,
    `useUpdate${one}Mutation`,
    `useDelete${one}Mutation`,
  ];

  const code = `import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { ${Type} } from './${Type}.schema';

export const ${api} = createApi({
  reducerPath: '${api}',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  tagTypes: ['${one}'],
  endpoints: (builder) => ({
    get${many}: builder.query<${Type}[], void>({
      query: () => '${endpoint}',
      providesTags: ['${one}'],
    }),
    get${one}: builder.query<${Type}, string>({
      query: (id) => \`${endpoint}/\${id}\`,
      providesTags: (_r, _e, id) => [{ type: '${one}', id }],
    }),
    create${one}: builder.mutation<${Type}, Partial<${Type}>>({
      query: (body) => ({ url: '${endpoint}', method: 'POST', body }),
      invalidatesTags: ['${one}'],
    }),
    update${one}: builder.mutation<${Type}, { id: string; body: Partial<${Type}> }>({
      query: ({ id, body }) => ({ url: \`${endpoint}/\${id}\`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: '${one}', id }],
    }),
    delete${one}: builder.mutation<void, string>({
      query: (id) => ({ url: \`${endpoint}/\${id}\`, method: 'DELETE' }),
      invalidatesTags: ['${one}'],
    }),
  }),
});

export const {
  ${hooks.join(',\n  ')},
} = ${api};
`;

  return { code, filename: `${Type}.api.ts`, dataLayer: 'rtk', hooks };
}

function tanstackClient(fs: FieldSchema): GenerateApiResult {
  const Type = pascal(fs.resource);
  const many = plural(Type);
  const key = camel(fs.resource);
  const endpoint = fs.baseEndpoint;

  const hooks = [`use${many}`, `use${Type}`, `useCreate${Type}`, `useUpdate${Type}`, `useDelete${Type}`];

  const code = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ${Type} } from './${Type}.schema';

const BASE = '${endpoint}';

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(\`Request failed (\${res.status})\`);
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

export function use${many}() {
  return useQuery({ queryKey: ['${key}'], queryFn: () => http<${Type}[]>(BASE) });
}

export function use${Type}(id: string) {
  return useQuery({ queryKey: ['${key}', id], queryFn: () => http<${Type}>(\`\${BASE}/\${id}\`), enabled: Boolean(id) });
}

export function useCreate${Type}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<${Type}>) => http<${Type}>(BASE, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['${key}'] }),
  });
}

export function useUpdate${Type}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<${Type}> }) =>
      http<${Type}>(\`\${BASE}/\${id}\`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['${key}'] }),
  });
}

export function useDelete${Type}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http<void>(\`\${BASE}/\${id}\`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['${key}'] }),
  });
}
`;

  return { code, filename: `${Type}.api.ts`, dataLayer: 'tanstack', hooks };
}

export function generateApiClient(input: unknown, opts: GenerateApiOptions = {}): GenerateApiOutcome {
  const fs = parseSchema(input);
  if (!fs) return { ok: false, error: 'Expected a FieldSchema (from infer-fields) with resource/baseEndpoint/idKey/fields.' };

  const dataLayer: DataLayer = opts.dataLayer ?? 'rtk';
  if (dataLayer !== 'rtk' && dataLayer !== 'tanstack') {
    return { ok: false, error: `Unknown dataLayer "${dataLayer}". Use "rtk" or "tanstack".` };
  }

  const result = dataLayer === 'rtk' ? rtkClient(fs) : tanstackClient(fs);
  return { ok: true, result };
}
