// ============================================================================
// detail-generator CORE — FieldSchema → typed detail/view component.
//
// dataLayer: 'rtk' | 'tanstack'  (which get + delete hooks to call)
// Renders every field as a definition row, plus a delete action. Composes
// with api-client-generator (get/delete hooks) and zod-schema-generator (type).
// ============================================================================

import type { FieldSchema, Field, DataLayer } from '@mcp-showcase/shared';
import { isFieldSchema, pascal } from '@mcp-showcase/shared';

export interface GenerateDetailResult {
  code: string;
  filename: string;
  componentName: string;
  dataLayer: DataLayer;
}

export type GenerateDetailOutcome =
  | { ok: true; result: GenerateDetailResult }
  | { ok: false; error: string };

export interface GenerateDetailOptions {
  dataLayer?: DataLayer;
}

// Types whose underlying Zod/TS type is already `string` (see zod-schema-generator):
// text/email/textarea/password -> z.string(); select -> z.enum([...]); date -> z.string()
// (dates are ISO strings, not Date objects). Only number/boolean/relation produce
// a non-string TS type and need String() to render safely in JSX.
const STRINGY_TYPES = new Set(['text', 'email', 'textarea', 'password', 'select', 'date']);

/**
 * Render the value expression for a field. Only optional fields get a `??`
 * fallback (required fields are typed as always-present, so TS — correctly,
 * under strict lint — flags a fallback on them as an unreachable condition).
 * Only non-string-typed fields (number/boolean/date/relation) get wrapped in
 * String(...); wrapping an already-string value is a no-op strict lint flags.
 */
function valueExpr(f: Field): string {
  const accessor = f.required ? `data.${f.name}` : `data.${f.name} ?? '—'`;
  return STRINGY_TYPES.has(f.type) ? `{${accessor}}` : `{String(${accessor})}`;
}

function row(f: Field): string {
  // f.label is arbitrary text — render via a JSX expression container so it
  // can never be parsed as markup (QA fuzz regression, same class of bug as
  // form-generator's field labels).
  return `        <div className="flex justify-between border-b py-2">
          <dt className="font-medium text-gray-600">{${JSON.stringify(f.label)}}</dt>
          <dd className="text-gray-900">${valueExpr(f)}</dd>
        </div>`;
}

function wiring(Type: string, dataLayer: DataLayer): { imports: string; setup: string; deleteCall: string } {
  if (dataLayer === 'rtk') {
    return {
      imports: `import { useGet${Type}Query, useDelete${Type}Mutation } from './${Type}.api';`,
      setup: `  const { data, isLoading, error } = useGet${Type}Query(id);\n  const [delete${Type}] = useDelete${Type}Mutation();`,
      deleteCall: `delete${Type}(id)`,
    };
  }
  return {
    imports: `import { use${Type}, useDelete${Type} } from './${Type}.api';`,
    setup: `  const { data, isLoading, error } = use${Type}(id);\n  const { mutateAsync: delete${Type} } = useDelete${Type}();`,
    deleteCall: `delete${Type}(id)`,
  };
}

export function generateDetail(input: unknown, opts: GenerateDetailOptions = {}): GenerateDetailOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return { ok: false, error: 'Invalid JSON for FieldSchema.' }; }
  }
  if (!isFieldSchema(schema)) return { ok: false, error: 'Expected a FieldSchema (from infer-fields).' };
  const fs: FieldSchema = schema;

  const dataLayer: DataLayer = opts.dataLayer ?? 'rtk';
  if (dataLayer !== 'rtk' && dataLayer !== 'tanstack') return { ok: false, error: `Unknown dataLayer "${dataLayer}". Use "rtk" or "tanstack".` };
  if (fs.fields.length === 0) return { ok: false, error: 'FieldSchema has no fields to display.' };

  const Type = pascal(fs.resource);
  const componentName = `${Type}Detail`;
  const w = wiring(Type, dataLayer);
  const rows = fs.fields.map(row).join('\n');
  const onDeleteType = `onDelete?: () => void`;

  const code = `${w.imports}

export function ${componentName}({ id, onDelete }: { id: string; ${onDeleteType} }) {
${w.setup}

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error || !data) return <p className="text-sm text-red-600">Not found</p>;

  const handleDelete = async () => {
    await ${w.deleteCall};
    onDelete?.();
  };

  return (
    <div className="space-y-4">
      <dl>
${rows}
      </dl>
      <button
        type="button"
        onClick={() => { void handleDelete(); }}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
      >
        Delete ${Type}
      </button>
    </div>
  );
}
`;

  return { ok: true, result: { code, filename: `${componentName}.tsx`, componentName, dataLayer } };
}
