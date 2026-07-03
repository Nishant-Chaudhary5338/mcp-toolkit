import { describe, it, expect } from 'vitest';
import { generateDetail } from './core.js';
import type { FieldSchema, Field } from '@mcp-showcase/shared';

function f(name: string, type: Field['type'], extra: Partial<Field> = {}): Field {
  return { name, label: name.charAt(0).toUpperCase() + name.slice(1), type, required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true }, ...extra };
}

const schema: FieldSchema = {
  resource: 'article',
  baseEndpoint: '/api/articles',
  idKey: 'id',
  fields: [f('title', 'text'), f('body', 'textarea')],
};

describe('generateDetail', () => {
  it('renders a definition row per field', () => {
    const out = generateDetail(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain('<dt className="font-medium text-gray-600">{"Title"}</dt>');
    expect(code).toContain('{data.title}');
    expect(code).toContain('{data.body}');
    expect(out.result.componentName).toBe('ArticleDetail');
  });

  it('wires rtk get + delete hooks', () => {
    const out = generateDetail(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { useGetArticleQuery, useDeleteArticleMutation } from './Article.api'");
    expect(code).toContain('useGetArticleQuery(id)');
    expect(code).toContain('const [deleteArticle] = useDeleteArticleMutation();');
  });

  it('wires tanstack get + delete hooks', () => {
    const out = generateDetail(schema, { dataLayer: 'tanstack' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { useArticle, useDeleteArticle } from './Article.api'");
    expect(code).toContain('const { mutateAsync: deleteArticle } = useDeleteArticle();');
  });

  it('handles loading and not-found states', () => {
    const out = generateDetail(schema);
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('if (isLoading) return');
    expect(out.result.code).toContain('if (error || !data) return');
  });

  it('does not import the resource type — nothing in the output references it (QA harness regression)', () => {
    // Found by the cross-app compile QA harness under strict tsconfigs (noUnusedLocals):
    // `import type { Article } from './Article.schema'` was emitted but never referenced —
    // the hooks already carry full type inference. TS6133 under strict settings.
    const out = generateDetail(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).not.toContain("from './Article.schema'");
  });

  it('emits a valid destructuring pattern for the onDelete prop (QA harness regression)', () => {
    // Found by the cross-app compile QA harness: the type annotation was previously
    // interpolated into both the destructuring pattern and the type block, producing
    // `{ id, onDelete?: () => void }` — invalid syntax (TS1005/TS1138).
    const out = generateDetail(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('export function ArticleDetail({ id, onDelete }: { id: string; onDelete?: () => void }) {');
    expect(out.result.code).not.toContain('{ id, onDelete?:');
  });

  it('does not add a String()/?? fallback for a required string field (QA harness regression)', () => {
    // Found under typescript-eslint strictTypeChecked: a required field's TS type
    // can never be undefined, so `data.title ?? '—'` was flagged no-unnecessary-
    // condition, and String() around an already-string value was flagged
    // no-unnecessary-type-conversion.
    const out = generateDetail({ ...schema, fields: [f('title', 'text', { required: true })] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('{data.title}');
    expect(out.result.code).not.toContain('String(data.title');
    expect(out.result.code).not.toContain("data.title ?? '—'");
  });

  it('keeps the ?? fallback for an optional string field, still without String()', () => {
    const out = generateDetail({ ...schema, fields: [f('subtitle', 'text', { required: false })] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("{data.subtitle ?? '—'}");
    expect(out.result.code).not.toContain('String(data.subtitle');
  });

  it('does not wrap a date field in String() — zod-schema-generator types dates as plain strings', () => {
    // Second QA harness finding on the same root cause: `date` fields are typed
    // z.string() (ISO strings, not Date objects) by zod-schema-generator, so
    // String(data.publishedAt) was also a no-op flagged by no-unnecessary-type-conversion.
    const out = generateDetail({ ...schema, fields: [f('publishedAt', 'date', { required: true })] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('{data.publishedAt}');
    expect(out.result.code).not.toContain('String(data.publishedAt');
  });

  it('wraps non-string fields (number/boolean/relation) in String() since JSX cannot render them directly', () => {
    const out = generateDetail({
      ...schema,
      fields: [
        f('views', 'number', { required: true }),
        f('featured', 'boolean', { required: true }),
        f('authorId', 'relation', { required: false, relation: { resource: 'author', labelKey: 'name' } }),
      ],
    });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('{String(data.views)}');
    expect(out.result.code).toContain('{String(data.featured)}');
    expect(out.result.code).toContain("{String(data.authorId ?? '—')}");
  });

  it('wraps the delete handler so onClick resolves to void, not a Promise (QA harness regression)', () => {
    // no-misused-promises: onClick expects (e) => void, not () => Promise<void>.
    const out = generateDetail(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('onClick={() => { void handleDelete(); }}');
    expect(out.result.code).not.toContain('onClick={handleDelete}');
  });

  it('rejects a non-FieldSchema and unknown dataLayer', () => {
    expect(generateDetail({ x: 1 }).ok).toBe(false);
    // @ts-expect-error runtime guard
    expect(generateDetail(schema, { dataLayer: 'swr' }).ok).toBe(false);
  });

  it('renders a label containing markup as a JSX expression, not raw JSX text (QA fuzz regression)', () => {
    // Found fuzzing detail-generator: a label like "</script><script>..."
    // broke the generated component's JSX structure when interpolated raw.
    const s: FieldSchema = { ...schema, fields: [f('x', 'text', { label: '</script><script>alert(1)</script>' })] };
    const out = generateDetail(s, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('{"</script><script>alert(1)</script>"}');
  });
});
