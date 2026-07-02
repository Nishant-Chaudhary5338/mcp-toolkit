import { describe, it, expect } from 'vitest';
import { generateE2E } from './core.js';
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

describe('generateE2E', () => {
  it('generates a full CRUD flow + a11y test', () => {
    const out = generateE2E(schema);
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { test, expect } from '@playwright/test'");
    expect(code).toContain("import AxeBuilder from '@axe-core/playwright'");
    expect(code).toContain("const BASE = '/articles'");
    expect(code).toContain("await page.goto(`${BASE}/new`)");
    expect(code).toContain("await page.getByLabel('Title').fill('Test Title')");
    expect(code).toContain("await page.getByLabel('Status').selectOption('draft')");
    expect(code).toContain('creates, reads, edits, and deletes a Article');
    expect(code).toContain('no critical accessibility violations');
    expect(out.result.filename).toBe('Article.crud.spec.ts');
  });

  it('asserts the created row appears then the edited value replaces it', () => {
    const out = generateE2E(schema);
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("getByText('Test Title')");
    expect(out.result.code).toContain("getByText('Test Title Updated')");
    expect(out.result.code).toContain('toHaveCount(0)');
  });

  it('respects a routeBase override', () => {
    const out = generateE2E(schema, { routeBase: '/admin/articles' });
    expect(out.ok && out.result.routeBase).toBe('/admin/articles');
  });

  it('rejects a non-FieldSchema and a schema with no form fields', () => {
    expect(generateE2E({ x: 1 }).ok).toBe(false);
    expect(generateE2E({ ...schema, fields: [f('secret', 'password', { form: { show: false } })] }).ok).toBe(false);
  });
});
