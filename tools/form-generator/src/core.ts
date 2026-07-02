// ============================================================================
// form-generator CORE — FieldSchema → React Hook Form + Zod form component.
//
// mode:      'create' | 'edit'   (edit fetches the record and PUTs)
// dataLayer: 'rtk' | 'tanstack'  (which generated hooks to call)
// Composes with zod-schema-generator (./<Type>.schema) and
// api-client-generator (./<Type>.api).
// ============================================================================

import type { FieldSchema, Field, DataLayer } from '@mcp-showcase/shared';
import { isFieldSchema, pascal } from '@mcp-showcase/shared';

export type FormMode = 'create' | 'edit';

export interface GenerateFormResult {
  code: string;
  filename: string;
  componentName: string;
  mode: FormMode;
  dataLayer: DataLayer;
}

export type GenerateFormOutcome =
  | { ok: true; result: GenerateFormResult }
  | { ok: false; error: string };

export interface GenerateFormOptions {
  mode?: FormMode;
  dataLayer?: DataLayer;
}

const INPUT = 'className="w-full rounded-md border px-3 py-2 text-sm"';

function control(f: Field): string {
  const reg = f.type === 'number'
    ? `{...register('${f.name}', { valueAsNumber: true })}`
    : `{...register('${f.name}')}`;
  switch (f.type) {
    case 'textarea':
      return `<textarea ${reg} ${INPUT} rows={4} />`;
    case 'boolean':
      return `<input type="checkbox" ${reg} className="h-4 w-4 rounded border" />`;
    case 'select': {
      const opts = (f.enumValues ?? [])
        .map((v) => `\n            <option value="${v}">${v}</option>`)
        .join('');
      return `<select ${reg} ${INPUT}>${opts}\n          </select>`;
    }
    case 'number':
      return `<input type="number" ${reg} ${INPUT} />`;
    case 'date':
      return `<input type="date" ${reg} ${INPUT} />`;
    case 'email':
      return `<input type="email" ${reg} ${INPUT} />`;
    case 'password':
      return `<input type="password" ${reg} ${INPUT} />`;
    case 'relation':
      return `<input type="text" placeholder="${f.relation?.resource ?? 'related'} id" ${reg} ${INPUT} />`;
    default:
      return `<input type="text" ${reg} ${INPUT} />`;
  }
}

function fieldBlock(f: Field): string {
  return `        <div className="space-y-1">
          <label htmlFor="${f.name}" className="block text-sm font-medium">${f.label}</label>
          ${control(f)}
          {errors.${f.name} && <p className="text-sm text-red-600">{errors.${f.name}?.message as string}</p>}
        </div>`;
}

interface Wiring {
  imports: string;
  hookSetup: string;
  submitBody: string;
  loadingExpr: string;
  formValues: string;
  propsSig: string;
}

function wiring(Type: string, mode: FormMode, dataLayer: DataLayer): Wiring {
  const isEdit = mode === 'edit';
  const propsSig = isEdit ? `{ id }: { id: string }` : '';

  if (dataLayer === 'rtk') {
    const createHook = `useCreate${Type}Mutation`;
    const updateHook = `useUpdate${Type}Mutation`;
    const getHook = `useGet${Type}Query`;
    if (isEdit) {
      return {
        imports: `import { ${getHook}, ${updateHook} } from './${Type}.api';`,
        hookSetup: `  const { data } = ${getHook}(id);\n  const [update${Type}, { isLoading }] = ${updateHook}();`,
        submitBody: `await update${Type}({ id, body }).unwrap();`,
        loadingExpr: 'isLoading',
        formValues: '    values: data,',
        propsSig,
      };
    }
    return {
      imports: `import { ${createHook} } from './${Type}.api';`,
      hookSetup: `  const [create${Type}, { isLoading }] = ${createHook}();`,
      submitBody: `await create${Type}(body).unwrap();`,
      loadingExpr: 'isLoading',
      formValues: '',
      propsSig,
    };
  }

  // tanstack
  const createHook = `useCreate${Type}`;
  const updateHook = `useUpdate${Type}`;
  const getHook = `use${Type}`;
  if (isEdit) {
    return {
      imports: `import { ${getHook}, ${updateHook} } from './${Type}.api';`,
      hookSetup: `  const { data } = ${getHook}(id);\n  const { mutateAsync, isPending } = ${updateHook}();`,
      submitBody: `await mutateAsync({ id, body });`,
      loadingExpr: 'isPending',
      formValues: '    values: data,',
      propsSig,
    };
  }
  return {
    imports: `import { ${createHook} } from './${Type}.api';`,
    hookSetup: `  const { mutateAsync, isPending } = ${createHook}();`,
    submitBody: `await mutateAsync(body);`,
    loadingExpr: 'isPending',
    formValues: '',
    propsSig,
  };
}

export function generateForm(input: unknown, opts: GenerateFormOptions = {}): GenerateFormOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return { ok: false, error: 'Invalid JSON for FieldSchema.' }; }
  }
  if (!isFieldSchema(schema)) {
    return { ok: false, error: 'Expected a FieldSchema (from infer-fields).' };
  }
  const fs: FieldSchema = schema;
  const mode: FormMode = opts.mode ?? 'create';
  const dataLayer: DataLayer = opts.dataLayer ?? 'rtk';
  if (mode !== 'create' && mode !== 'edit') return { ok: false, error: `Unknown mode "${mode}". Use "create" or "edit".` };
  if (dataLayer !== 'rtk' && dataLayer !== 'tanstack') return { ok: false, error: `Unknown dataLayer "${dataLayer}". Use "rtk" or "tanstack".` };

  const shown = fs.fields.filter((f) => f.form.show !== false);
  if (shown.length === 0) return { ok: false, error: 'FieldSchema has no form-visible fields.' };

  const Type = pascal(fs.resource);
  const componentName = `${Type}${mode === 'edit' ? 'Edit' : 'Create'}Form`;
  const w = wiring(Type, mode, dataLayer);
  const submitLabel = `${mode === 'edit' ? 'Save' : 'Create'} ${Type}`;
  const fields = shown.map(fieldBlock).join('\n');

  const resolverOpts = [`    resolver: zodResolver(${Type}Schema),`, w.formValues].filter(Boolean).join('\n');

  const code = `import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ${Type}Schema, type ${Type} } from './${Type}.schema';
${w.imports}

export function ${componentName}(${w.propsSig}) {
${w.hookSetup}
  const { register, handleSubmit, formState: { errors } } = useForm<${Type}>({
${resolverOpts}
  });

  const onSubmit = handleSubmit(async (body) => {
    ${w.submitBody}
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
${fields}
      <button type="submit" disabled={${w.loadingExpr}} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
        ${submitLabel}
      </button>
    </form>
  );
}
`;

  return { ok: true, result: { code, filename: `${componentName}.tsx`, componentName, mode, dataLayer } };
}
