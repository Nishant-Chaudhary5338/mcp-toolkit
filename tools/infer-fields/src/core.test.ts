import { describe, it, expect } from 'vitest';
import { inferFields, type FieldSchema } from './core.js';

function schema(result: ReturnType<typeof inferFields>): FieldSchema {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.schema;
}

describe('inferFields — JSON sample', () => {
  it('infers field types from a raw sample and skips id/timestamps', () => {
    const r = inferFields({
      input: JSON.stringify({
        id: 1,
        title: 'Hello',
        email: 'a@b.com',
        publishedAt: '2026-01-01T00:00:00Z',
        views: 42,
        featured: true,
        createdAt: '2026-01-01',
      }),
    });
    const s = schema(r);
    expect(r.ok && r.source).toBe('sample');
    const byName = Object.fromEntries(s.fields.map((f) => [f.name, f.type]));
    expect(byName).toEqual({ title: 'text', email: 'email', publishedAt: 'date', views: 'number', featured: 'boolean' });
    expect(s.fields.find((f) => f.name === 'id')).toBeUndefined();
    expect(s.fields.find((f) => f.name === 'createdAt')).toBeUndefined();
  });

  it('classifies long strings and known keys as textarea', () => {
    const s = schema(inferFields({ input: { description: 'x'.repeat(200), body: 'short' } }));
    expect(s.fields.every((f) => f.type === 'textarea')).toBe(true);
  });

  it('detects foreign keys as relations', () => {
    const s = schema(inferFields({ input: { authorId: 7, name: 'Post' } }));
    const author = s.fields.find((f) => f.name === 'authorId');
    expect(author?.type).toBe('relation');
    expect(author?.relation).toEqual({ resource: 'author', labelKey: 'name' });
  });

  it('detects nested objects with an id as relations', () => {
    const s = schema(inferFields({ input: { title: 'P', category: { id: 3, name: 'Tech' } } }));
    expect(s.fields.find((f) => f.name === 'category')?.type).toBe('relation');
  });

  it('unwraps envelope responses ({data:{...}})', () => {
    const s = schema(inferFields({ input: { data: { title: 'X' } } }));
    expect(s.fields.map((f) => f.name)).toEqual(['title']);
  });

  it('uses the first record of an array', () => {
    const s = schema(inferFields({ input: [{ title: 'A' }, { title: 'B' }] }));
    expect(s.fields.map((f) => f.name)).toEqual(['title']);
  });
});

describe('inferFields — OpenAPI schema', () => {
  it('reads properties, required set, enums, and $ref relations', () => {
    const r = inferFields({
      input: {
        required: ['title'],
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'published'] },
          author: { $ref: '#/components/schemas/Author' },
        },
      },
    });
    const s = schema(r);
    expect(r.ok && r.source).toBe('openapi');
    const title = s.fields.find((f) => f.name === 'title');
    const status = s.fields.find((f) => f.name === 'status');
    const author = s.fields.find((f) => f.name === 'author');
    expect(title?.required).toBe(true);
    expect(status?.type).toBe('select');
    expect(status?.enumValues).toEqual(['draft', 'published']);
    expect(author?.type).toBe('relation');
    expect(author?.relation?.resource).toBe('author');
  });
});

describe('inferFields — naming + presentation defaults', () => {
  it('infers resource + endpoint from baseEndpoint', () => {
    const s = schema(inferFields({ input: { name: 'x' }, baseEndpoint: '/api/articles' }));
    expect(s.resource).toBe('article');
    expect(s.baseEndpoint).toBe('/api/articles');
  });

  it('defaults the endpoint from an explicit resource', () => {
    const s = schema(inferFields({ input: { name: 'x' }, resource: 'category' }));
    expect(s.baseEndpoint).toBe('/api/categories');
  });

  it('hides passwords and textareas from tables', () => {
    const s = schema(inferFields({ input: { password: 'secret', bio: 'y'.repeat(200) } }));
    expect(s.fields.every((f) => f.table.show === false)).toBe(true);
  });
});

describe('inferFields — identifier-unsafe field names (QA fuzz regression)', () => {
  // Found fuzzing the CRUD-factory generators with adversarial FieldSchemas:
  // field.name is interpolated as a bare identifier / object key / register()
  // argument across every downstream generator, none of which validate it.
  // infer-fields is the single entry point that turns arbitrary API keys into
  // field names, so it sanitizes here rather than pushing validation into
  // every consumer.
  it('sanitizes names with spaces and hyphens into valid identifiers', () => {
    const s = schema(inferFields({ input: { 'first name': 'Ann', 'last-name': 'Lee' } }));
    for (const f of s.fields) expect(f.name).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
  });

  it('sanitizes non-ASCII field names instead of emitting them raw', () => {
    const s = schema(inferFields({ input: { '名前': 'x', 'emoji😀': 'y' } }));
    for (const f of s.fields) expect(f.name).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
  });

  it('skips a field whose name has nothing alphanumeric left after sanitizing', () => {
    const r = inferFields({ input: { '!!!': 'x', title: 'ok' } });
    const s = schema(r);
    expect(s.fields.map((f) => f.name)).toEqual(['title']);
  });

  it('dedupes field names that collide after sanitizing', () => {
    const s = schema(inferFields({ input: { 'first-name': 'a', first_name: 'b' } }));
    const names = s.fields.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps the human-readable label derived from the original key, not the sanitized name', () => {
    const s = schema(inferFields({ input: { 'first name': 'Ann' } }));
    expect(s.fields[0]?.label).toBe('First Name');
  });
});

describe('inferFields — errors', () => {
  it('rejects invalid JSON strings', () => {
    const r = inferFields({ input: '{not json' });
    expect(r.ok).toBe(false);
  });

  it('rejects empty input', () => {
    expect(inferFields({ input: '' }).ok).toBe(false);
  });

  it('rejects objects with no usable fields', () => {
    expect(inferFields({ input: { id: 1, createdAt: '2026-01-01' } }).ok).toBe(false);
  });
});
