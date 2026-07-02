// e2e-generator CORE — pure logic (no MCP transport).
//
// FieldSchema → a Playwright end-to-end CRUD flow spec (create → list → edit →
// delete) plus an a11y check. Tests the feature the CRUD factory generates,
// closing the loop: factory → feature → mock → E2E.

import type { FieldSchema, Field } from '@mcp-showcase/shared';
import { isFieldSchema, pascal } from '@mcp-showcase/shared';

export interface GenerateE2EResult {
  code: string;
  filename: string;
  routeBase: string;
}

export type GenerateE2EOutcome =
  | { ok: true; result: GenerateE2EResult }
  | { ok: false; error: string };

export interface GenerateE2EOptions {
  /** App base path for routes (defaults to the resource collection, e.g. /articles). */
  routeBase?: string;
}

function sampleValue(f: Field, variant: 'create' | 'edit'): string {
  const suffix = variant === 'edit' ? ' Updated' : '';
  switch (f.type) {
    case 'email': return `test${variant === 'edit' ? '2' : ''}@example.com`;
    case 'password': return 'secret123';
    case 'number': return variant === 'edit' ? '84' : '42';
    case 'date': return '2026-01-01';
    case 'select': return f.enumValues?.[variant === 'edit' ? Math.min(1, (f.enumValues.length || 1) - 1) : 0] ?? 'option';
    case 'relation': return '1';
    default: return `Test ${f.label}${suffix}`;
  }
}

function fill(f: Field, variant: 'create' | 'edit'): string {
  const label = f.label;
  if (f.type === 'boolean') return `    await page.getByLabel('${label}').${variant === 'edit' ? 'uncheck' : 'check'}();`;
  if (f.type === 'select') return `    await page.getByLabel('${label}').selectOption('${sampleValue(f, variant)}');`;
  return `    await page.getByLabel('${label}').fill('${sampleValue(f, variant)}');`;
}

export function generateE2E(input: unknown, opts: GenerateE2EOptions = {}): GenerateE2EOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return { ok: false, error: 'Invalid JSON for FieldSchema.' }; }
  }
  if (!isFieldSchema(schema)) return { ok: false, error: 'Expected a FieldSchema (from infer-fields).' };
  const fs: FieldSchema = schema;

  const formFields = fs.fields.filter((f) => f.form.show !== false);
  if (formFields.length === 0) return { ok: false, error: 'FieldSchema has no form-visible fields to exercise.' };

  const Type = pascal(fs.resource);
  const seg = fs.baseEndpoint.split('/').filter(Boolean).pop() ?? fs.resource;
  const routeBase = opts.routeBase ?? `/${seg.toLowerCase()}`;

  // Use the first non-relation text-ish field as the row/detail assertion anchor.
  const anchor = formFields.find((f) => ['text', 'email', 'textarea'].includes(f.type)) ?? formFields[0]!;
  const anchorCreate = sampleValue(anchor, 'create');
  const anchorEdit = sampleValue(anchor, 'edit');

  const createFills = formFields.map((f) => fill(f, 'create')).join('\n');
  const editFill = fill(anchor, 'edit');

  const code = `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = '${routeBase}';

test.describe('${Type} CRUD', () => {
  test('creates, reads, edits, and deletes a ${Type}', async ({ page }) => {
    // CREATE
    await page.goto(\`\${BASE}/new\`);
${createFills}
    await page.getByRole('button', { name: /create ${Type.toLowerCase()}/i }).click();

    // LIST — the new row is visible
    await page.goto(BASE);
    await expect(page.getByText('${anchorCreate}')).toBeVisible();

    // READ — open the detail
    await page.getByText('${anchorCreate}').click();
    await expect(page.getByText('${anchorCreate}')).toBeVisible();

    // EDIT
    await page.getByRole('link', { name: /edit/i }).click();
${editFill}
    await page.getByRole('button', { name: /save ${Type.toLowerCase()}/i }).click();
    await page.goto(BASE);
    await expect(page.getByText('${anchorEdit}')).toBeVisible();

    // DELETE
    await page.getByText('${anchorEdit}').click();
    await page.getByRole('button', { name: /delete ${Type.toLowerCase()}/i }).click();
    await page.goto(BASE);
    await expect(page.getByText('${anchorEdit}')).toHaveCount(0);
  });

  test('${routeBase} has no critical accessibility violations', async ({ page }) => {
    await page.goto(BASE);
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
});
`;

  return { ok: true, result: { code, filename: `${Type}.crud.spec.ts`, routeBase } };
}
