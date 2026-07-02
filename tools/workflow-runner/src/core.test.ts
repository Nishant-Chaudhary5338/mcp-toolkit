import { describe, it, expect } from 'vitest';
import { runWorkflow } from './core.js';

const sample = JSON.stringify({ id: 1, title: 'Hello', authorId: 5, body: 'x'.repeat(200), published: true });

describe('runWorkflow — schema_to_feature', () => {
  it('generates the full feature file set from a JSON sample', () => {
    const r = runWorkflow({ input: sample, baseEndpoint: '/api/articles', dataLayer: 'rtk', router: 'rr7' });
    const names = r.files.map((f) => f.filename);
    expect(names).toContain('Article.schema.ts');
    expect(names).toContain('Article.api.ts');
    expect(names).toContain('ArticleTable.tsx');
    expect(names).toContain('ArticleDetail.tsx');
    expect(names).toContain('ArticleCreateForm.tsx');
    expect(names).toContain('ArticleEditForm.tsx');
    expect(names).toContain('Article.routes.tsx');
    expect(r.resource).toBe('article');
  });

  it('records a journal step per generator plus the gate', () => {
    const r = runWorkflow({ input: sample, baseEndpoint: '/api/articles' });
    const steps = r.journal.map((j) => j.step);
    expect(steps).toContain('infer-fields');
    expect(steps).toContain('zod-schema-generator');
    expect(steps).toContain('crud-composer');
    expect(steps[steps.length - 1]).toBe('review-gate');
    expect(r.journal.every((j) => j.ok)).toBe(true);
  });

  it('passes the review gate on its own generated code', () => {
    const r = runWorkflow({ input: sample, baseEndpoint: '/api/articles' });
    expect(r.passed).toBe(true);
    expect(['A', 'B', 'C']).toContain(r.grade);
  });

  it('accepts a FieldSchema directly (skips inference)', () => {
    const schema = { resource: 'tag', baseEndpoint: '/api/tags', idKey: 'id', fields: [{ name: 'name', label: 'Name', type: 'text', required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true } }] };
    const r = runWorkflow({ input: JSON.stringify(schema) });
    expect(r.journal[0]).toMatchObject({ step: 'infer-fields', note: 'input already a FieldSchema' });
    expect(r.resource).toBe('tag');
  });

  it('threads dataLayer + router through to the generated code', () => {
    const r = runWorkflow({ input: sample, baseEndpoint: '/api/articles', dataLayer: 'tanstack', router: 'next' });
    const api = r.files.find((f) => f.filename === 'Article.api.ts')!;
    expect(api.code).toContain('@tanstack/react-query');
    expect(r.files.some((f) => f.filename.startsWith('app/articles'))).toBe(true);
  });

  it('rejects unknown routine and missing input', () => {
    expect(() => runWorkflow({ input: sample, routine: 'nope' })).toThrow();
    expect(() => runWorkflow({})).toThrow();
  });
});
