import { describe, it, expect } from 'vitest';
import { generateMock } from './core.js';
import type { FieldSchema, Field } from '@mcp-showcase/shared';

function f(name: string, type: Field['type'], extra: Partial<Field> = {}): Field {
  return { name, label: name.charAt(0).toUpperCase() + name.slice(1), type, required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true }, ...extra };
}

const schema: FieldSchema = {
  resource: 'article',
  baseEndpoint: '/api/articles',
  idKey: 'id',
  fields: [f('title', 'text'), f('status', 'select', { enumValues: ['draft', 'published'] }), f('views', 'number')],
};

describe('generateMock', () => {
  it('generates five MSW handlers for the collection', () => {
    const out = generateMock(schema);
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { http, HttpResponse } from 'msw'");
    expect(code).toContain("http.get('/api/articles',");
    expect(code).toContain("http.get('/api/articles/:id',");
    expect(code).toContain("http.post('/api/articles',");
    expect(code).toContain("http.put('/api/articles/:id',");
    expect(code).toContain("http.delete('/api/articles/:id',");
    expect(out.result.handlerCount).toBe(5);
    expect(out.result.filename).toBe('Article.handlers.ts');
  });

  it('seeds a deterministic in-memory store', () => {
    const out = generateMock(schema, { count: 2 });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.seedCount).toBe(2);
    expect(out.result.code).toContain('let articles: ArticleRecord[] =');
    expect(out.result.code).toContain('id: 1, title: "Title 1"');
    expect(out.result.code).toContain('status: "draft"');
    expect(out.result.code).toContain('views: 10');
  });

  it('defaults to 3 seed records', () => {
    const out = generateMock(schema);
    expect(out.ok && out.result.seedCount).toBe(3);
  });

  it('imports the resource type from the schema file', () => {
    const out = generateMock(schema);
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("import type { Article } from './Article.schema'");
    expect(out.result.code).toContain('export const articleHandlers =');
  });

  it('rejects a non-FieldSchema and an empty field list', () => {
    expect(generateMock({ x: 1 }).ok).toBe(false);
    expect(generateMock({ ...schema, fields: [] }).ok).toBe(false);
  });
});
