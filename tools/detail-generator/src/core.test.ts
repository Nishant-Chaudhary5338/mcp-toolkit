import { describe, it, expect } from 'vitest';
import { generateDetail } from './core.js';
import type { FieldSchema, Field } from '@mcp-showcase/shared';

function f(name: string, type: Field['type']): Field {
  return { name, label: name.charAt(0).toUpperCase() + name.slice(1), type, required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true } };
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
    expect(code).toContain("<dt className=\"font-medium text-gray-600\">Title</dt>");
    expect(code).toContain("{String(data.title ?? '—')}");
    expect(code).toContain("{String(data.body ?? '—')}");
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

  it('rejects a non-FieldSchema and unknown dataLayer', () => {
    expect(generateDetail({ x: 1 }).ok).toBe(false);
    // @ts-expect-error runtime guard
    expect(generateDetail(schema, { dataLayer: 'swr' }).ok).toBe(false);
  });
});
