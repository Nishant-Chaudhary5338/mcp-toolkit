import { describe, it, expect } from 'vitest';
import { generateApiClient } from './core.js';
import type { FieldSchema } from '@mcp-showcase/shared';

const schema: FieldSchema = {
  resource: 'article',
  baseEndpoint: '/api/articles',
  idKey: 'id',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true } },
  ],
};

describe('generateApiClient — RTK Query', () => {
  it('generates an api slice with all five endpoints and cache tags', () => {
    const out = generateApiClient(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'");
    expect(code).toContain('export const articleApi = createApi(');
    expect(code).toContain("tagTypes: ['Article']");
    expect(code).toContain('getArticles: builder.query<Article[], void>');
    expect(code).toContain('createArticle: builder.mutation<Article, Partial<Article>>');
    expect(code).toContain('deleteArticle: builder.mutation<void, string>');
    expect(out.result.filename).toBe('Article.api.ts');
  });

  it('exports the typed hooks', () => {
    const out = generateApiClient(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.hooks).toEqual([
      'useGetArticlesQuery', 'useGetArticleQuery', 'useCreateArticleMutation', 'useUpdateArticleMutation', 'useDeleteArticleMutation',
    ]);
    expect(out.result.code).toContain('useGetArticlesQuery,');
  });

  it('defaults to rtk when dataLayer is omitted', () => {
    const out = generateApiClient(schema);
    expect(out.ok && out.result.dataLayer).toBe('rtk');
  });
});

describe('generateApiClient — TanStack Query', () => {
  it('generates hooks over a typed fetch wrapper', () => {
    const out = generateApiClient(schema, { dataLayer: 'tanstack' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'");
    expect(code).toContain('export function useArticles()');
    expect(code).toContain('export function useCreateArticle()');
    expect(code).toContain("queryKey: ['article']");
    expect(code).toContain("const BASE = '/api/articles'");
  });

  it('pluralizes the list hook and singularizes the item hook', () => {
    const out = generateApiClient({ ...schema, resource: 'category', baseEndpoint: '/api/categories' }, { dataLayer: 'tanstack' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('export function useCategories()');
    expect(out.result.code).toContain('export function useCategory(id: string)');
  });
});

describe('generateApiClient — errors', () => {
  it('rejects a non-FieldSchema value', () => {
    expect(generateApiClient({ foo: 1 }).ok).toBe(false);
  });

  it('rejects an unknown dataLayer', () => {
    // @ts-expect-error testing runtime guard
    expect(generateApiClient(schema, { dataLayer: 'graphql' }).ok).toBe(false);
  });
});
