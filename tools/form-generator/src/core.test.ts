import { describe, it, expect } from 'vitest';
import { generateForm } from './core.js';
import type { FieldSchema, Field } from '@mcp-showcase/shared';

function f(name: string, type: Field['type'], extra: Partial<Field> = {}): Field {
  return { name, label: name, type, required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true }, ...extra };
}

const schema: FieldSchema = {
  resource: 'article',
  baseEndpoint: '/api/articles',
  idKey: 'id',
  fields: [
    f('title', 'text'),
    f('body', 'textarea'),
    f('status', 'select', { enumValues: ['draft', 'published'] }),
    f('views', 'number'),
    f('featured', 'boolean'),
  ],
};

describe('generateForm — create / rtk', () => {
  it('wires RHF + zodResolver + the create mutation', () => {
    const out = generateForm(schema, { mode: 'create', dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { useForm } from 'react-hook-form'");
    expect(code).toContain("import { zodResolver } from '@hookform/resolvers/zod'");
    expect(code).toContain("import { ArticleSchema, type Article } from './Article.schema'");
    expect(code).toContain("import { useCreateArticleMutation } from './Article.api'");
    expect(code).toContain('resolver: zodResolver(ArticleSchema)');
    expect(code).toContain('await createArticle(body).unwrap();');
    expect(out.result.componentName).toBe('ArticleCreateForm');
  });

  it('renders the right control per field type', () => {
    const out = generateForm(schema, { mode: 'create' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain('<textarea {...register(\'body\')}');
    expect(code).toContain('<select {...register(\'status\')}');
    expect(code).toContain('<option value="draft">draft</option>');
    expect(code).toContain("valueAsNumber: true");
    expect(code).toContain('<input type="checkbox"');
  });
});

describe('generateForm — edit', () => {
  it('rtk edit fetches the record and PUTs by id', () => {
    const out = generateForm(schema, { mode: 'edit', dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain('({ id }: { id: string })');
    expect(code).toContain('useGetArticleQuery(id)');
    expect(code).toContain('await updateArticle({ id, body }).unwrap();');
    expect(code).toContain('values: data,');
    expect(out.result.componentName).toBe('ArticleEditForm');
  });

  it('tanstack edit uses mutateAsync + isPending', () => {
    const out = generateForm(schema, { mode: 'edit', dataLayer: 'tanstack' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain('const { data } = useArticle(id);');
    expect(code).toContain('await mutateAsync({ id, body });');
    expect(code).toContain('disabled={isPending}');
  });
});

describe('generateForm — errors', () => {
  it('rejects a non-FieldSchema', () => {
    expect(generateForm({ nope: 1 }).ok).toBe(false);
  });
  it('rejects unknown mode', () => {
    // @ts-expect-error runtime guard
    expect(generateForm(schema, { mode: 'delete' }).ok).toBe(false);
  });
  it('rejects when no form-visible fields', () => {
    const hidden: FieldSchema = { ...schema, fields: [f('secret', 'password', { form: { show: false } })] };
    expect(generateForm(hidden).ok).toBe(false);
  });
});
