import { describe, it, expect } from 'vitest';
import { composeCrud } from './core.js';
import type { FieldSchema } from '@mcp-showcase/shared';

const schema: FieldSchema = {
  resource: 'article',
  baseEndpoint: '/api/articles',
  idKey: 'id',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true } },
  ],
};

describe('composeCrud — React Router 7', () => {
  it('emits one routes file with the four routes and param wrappers', () => {
    const out = composeCrud(schema, { router: 'rr7' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.files).toHaveLength(1);
    const { code } = out.result.files[0]!;
    expect(code).toContain('export const articleRoutes: RouteObject[]');
    expect(code).toContain("{ path: '/articles', element: <ArticleTable /> }");
    expect(code).toContain("{ path: '/articles/new', element: <ArticleCreateForm /> }");
    expect(code).toContain("{ path: '/articles/:id', element: <ArticleDetailRoute /> }");
    expect(code).toContain("{ path: '/articles/:id/edit', element: <ArticleEditRoute /> }");
    expect(code).toContain('const { id } = useParams();');
  });

  it('reports the composed component names and route base', () => {
    const out = composeCrud(schema, { router: 'rr7' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.components).toEqual(['ArticleTable', 'ArticleDetail', 'ArticleCreateForm', 'ArticleEditForm']);
    expect(out.result.routeBase).toBe('/articles');
  });
});

describe('composeCrud — Next App Router', () => {
  it('emits four app/ segment page files with use client', () => {
    const out = composeCrud(schema, { router: 'next' });
    if (!out.ok) throw new Error(out.error);
    const paths = out.result.files.map((f) => f.path);
    expect(paths).toEqual([
      'app/articles/page.tsx',
      'app/articles/new/page.tsx',
      'app/articles/[id]/page.tsx',
      'app/articles/[id]/edit/page.tsx',
    ]);
    const detail = out.result.files.find((f) => f.path === 'app/articles/[id]/page.tsx')!;
    expect(detail.code).toContain("'use client';");
    expect(detail.code).toContain('params }: { params: { id: string } }');
    expect(detail.code).toContain('<ArticleDetail id={params.id} />');
  });
});

describe('composeCrud — errors', () => {
  it('rejects a non-FieldSchema and unknown router', () => {
    expect(composeCrud({ x: 1 }).ok).toBe(false);
    // @ts-expect-error runtime guard
    expect(composeCrud(schema, { router: 'tanstack-router' }).ok).toBe(false);
  });
});
