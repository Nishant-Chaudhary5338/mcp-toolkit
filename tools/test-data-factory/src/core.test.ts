import { describe, it, expect } from 'vitest';
import { generateFactory } from './core.js';
import type { FieldSchema, Field } from '@mcp-showcase/shared';

function f(name: string, type: Field['type'], extra: Partial<Field> = {}): Field {
  return { name, label: name.charAt(0).toUpperCase() + name.slice(1), type, required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true }, ...extra };
}

const schema: FieldSchema = {
  resource: 'article',
  baseEndpoint: '/api/articles',
  idKey: 'id',
  fields: [f('title', 'text'), f('views', 'number'), f('status', 'select', { enumValues: ['draft', 'published'] })],
};

describe('generateFactory', () => {
  it('generates make/makes/reset with typed overrides', () => {
    const out = generateFactory(schema);
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import type { Article } from './Article.schema'");
    expect(code).toContain('export function makeArticle(overrides: Partial<Article> = {}): Article');
    expect(code).toContain('export function makeArticles(count: number');
    expect(code).toContain('export function resetArticleSeq()');
    expect(code).toContain('...overrides,');
    expect(out.result.factoryName).toBe('makeArticle');
    expect(out.result.filename).toBe('article.factory.ts');
  });

  it('emits sensible per-type defaults', () => {
    const out = generateFactory(schema);
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('title: `Title ${seq}`');
    expect(out.result.code).toContain('views: seq * 10');
    expect(out.result.code).toContain('status: "draft"');
  });

  it('rejects a non-FieldSchema and an empty field list', () => {
    expect(generateFactory({ x: 1 }).ok).toBe(false);
    expect(generateFactory({ ...schema, fields: [] }).ok).toBe(false);
  });
});
