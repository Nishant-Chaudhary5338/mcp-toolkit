import { describe, it, expect } from 'vitest';
import { generateZodSchema } from './core.js';
import type { FieldSchema } from '@mcp-showcase/shared';

function makeSchema(fields: FieldSchema['fields']): FieldSchema {
  return { resource: 'article', baseEndpoint: '/api/articles', idKey: 'id', fields };
}

function field(name: string, type: FieldSchema['fields'][number]['type'], required = true, extra: Partial<FieldSchema['fields'][number]> = {}) {
  return {
    name,
    label: name,
    type,
    required,
    table: { show: true, sortable: true, filterable: true },
    form: { show: true },
    ...extra,
  };
}

describe('generateZodSchema', () => {
  it('maps field types to the right zod expressions', () => {
    const out = generateZodSchema(makeSchema([
      field('title', 'text'),
      field('email', 'email'),
      field('secret', 'password'),
      field('views', 'number'),
      field('active', 'boolean'),
      field('publishedAt', 'date'),
    ]));
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('title: z.string().min(1)');
    expect(out.result.code).toContain('email: z.string().email()');
    expect(out.result.code).toContain('secret: z.string().min(8)');
    expect(out.result.code).toContain('views: z.coerce.number()');
    expect(out.result.code).toContain('active: z.boolean()');
  });

  it('emits z.enum for select fields', () => {
    const out = generateZodSchema(makeSchema([field('status', 'select', true, { enumValues: ['draft', 'published'] })]));
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('status: z.enum(["draft", "published"])');
  });

  it('emits a union for relation fields', () => {
    const out = generateZodSchema(makeSchema([field('authorId', 'relation', true, { relation: { resource: 'author', labelKey: 'name' } })]));
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('authorId: z.union([z.string(), z.number()])');
  });

  it('adds .optional() to non-required fields', () => {
    const out = generateZodSchema(makeSchema([field('subtitle', 'text', false)]));
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('subtitle: z.string().optional()');
  });

  it('names the schema and type from the resource (PascalCase)', () => {
    const out = generateZodSchema({ resource: 'blog_post', baseEndpoint: '/api/blog-posts', idKey: 'id', fields: [field('title', 'text')] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.schemaName).toBe('BlogPostSchema');
    expect(out.result.typeName).toBe('BlogPost');
    expect(out.result.code).toContain('export type BlogPost = z.infer<typeof BlogPostSchema>;');
    expect(out.result.filename).toBe('BlogPost.schema.ts');
  });

  it('accepts a JSON string', () => {
    const out = generateZodSchema(JSON.stringify(makeSchema([field('title', 'text')])));
    expect(out.ok).toBe(true);
  });

  it('rejects a non-FieldSchema value', () => {
    expect(generateZodSchema({ foo: 'bar' }).ok).toBe(false);
    expect(generateZodSchema('not json').ok).toBe(false);
  });

  it('rejects an empty field list', () => {
    expect(generateZodSchema(makeSchema([])).ok).toBe(false);
  });

  it('produces a valid identifier for a resource name with special characters (QA fuzz regression)', () => {
    // Found fuzzing this tool: it had its own local pascal()/cap() duplicate
    // instead of importing the shared, sanitizing helper — so it inherited
    // the pre-fix bug independently and needed its own fix (delete the
    // duplicate, import @mcp-showcase/shared's pascal()).
    const out = generateZodSchema(makeSchema([field('name', 'text')]));
    const weird = { ...makeSchema([field('name', 'text')]), resource: "thing's-2.0!" };
    const r = generateZodSchema(weird);
    if (!out.ok || !r.ok) throw new Error('expected ok');
    expect(r.result.typeName).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    expect(r.result.schemaName).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
  });
});
