// ============================================================================
// crud-composer CORE — wire the generated pieces into routes.
//
// Does NOT regenerate the table/detail/form components — it references them by
// their conventional filenames (Type + Table/Detail/CreateForm/EditForm) and
// emits routing that ties list ↔ detail ↔ create ↔ edit together.
//   router: 'rr7'  → one React Router route array + param wrappers
//   router: 'next' → app/ segment page files ('use client')
// ============================================================================

import type { FieldSchema, Router } from '@mcp-showcase/shared';
import { isFieldSchema, pascal } from '@mcp-showcase/shared';

export interface ComposedFile {
  path: string;
  code: string;
}

export interface ComposeCrudResult {
  files: ComposedFile[];
  router: Router;
  routeBase: string;
  components: string[];
}

export type ComposeCrudOutcome =
  | { ok: true; result: ComposeCrudResult }
  | { ok: false; error: string };

export interface ComposeCrudOptions {
  router?: Router;
}

function routeBaseFrom(fs: FieldSchema): string {
  const seg = fs.baseEndpoint.split('/').filter(Boolean).pop() ?? fs.resource;
  return `/${seg.toLowerCase()}`;
}

function names(Type: string) {
  return {
    Table: `${Type}Table`,
    Detail: `${Type}Detail`,
    Create: `${Type}CreateForm`,
    Edit: `${Type}EditForm`,
  };
}

function rr7(fs: FieldSchema, Type: string, base: string): ComposedFile {
  const n = names(Type);
  const code = `import type { RouteObject } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { ${n.Table} } from './${n.Table}';
import { ${n.Detail} } from './${n.Detail}';
import { ${n.Create} } from './${n.Create}';
import { ${n.Edit} } from './${n.Edit}';

function ${Type}DetailRoute() {
  const { id } = useParams();
  return <${n.Detail} id={id ?? ''} />;
}

function ${Type}EditRoute() {
  const { id } = useParams();
  return <${n.Edit} id={id ?? ''} />;
}

export const ${fs.resource}Routes: RouteObject[] = [
  { path: '${base}', element: <${n.Table} /> },
  { path: '${base}/new', element: <${n.Create} /> },
  { path: '${base}/:id', element: <${Type}DetailRoute /> },
  { path: '${base}/:id/edit', element: <${Type}EditRoute /> },
];
`;
  return { path: `${Type}.routes.tsx`, code };
}

function nextFiles(Type: string, base: string): ComposedFile[] {
  const n = names(Type);
  const dir = `app${base}`;
  const page = (importName: string, body: string) =>
    `'use client';\nimport { ${importName} } from '@/components/${importName}';\n\n${body}\n`;

  return [
    { path: `${dir}/page.tsx`, code: page(n.Table, `export default function Page() {\n  return <${n.Table} />;\n}`) },
    { path: `${dir}/new/page.tsx`, code: page(n.Create, `export default function Page() {\n  return <${n.Create} />;\n}`) },
    { path: `${dir}/[id]/page.tsx`, code: page(n.Detail, `export default function Page({ params }: { params: { id: string } }) {\n  return <${n.Detail} id={params.id} />;\n}`) },
    { path: `${dir}/[id]/edit/page.tsx`, code: page(n.Edit, `export default function Page({ params }: { params: { id: string } }) {\n  return <${n.Edit} id={params.id} />;\n}`) },
  ];
}

export function composeCrud(input: unknown, opts: ComposeCrudOptions = {}): ComposeCrudOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return { ok: false, error: 'Invalid JSON for FieldSchema.' }; }
  }
  if (!isFieldSchema(schema)) return { ok: false, error: 'Expected a FieldSchema (from infer-fields).' };
  const fs: FieldSchema = schema;

  const router: Router = opts.router ?? 'rr7';
  if (router !== 'rr7' && router !== 'next') return { ok: false, error: `Unknown router "${router}". Use "rr7" or "next".` };

  const Type = pascal(fs.resource);
  const base = routeBaseFrom(fs);
  const n = names(Type);
  const components = [n.Table, n.Detail, n.Create, n.Edit];

  const files = router === 'rr7' ? [rr7(fs, Type, base)] : nextFiles(Type, base);
  return { ok: true, result: { files, router, routeBase: base, components } };
}
