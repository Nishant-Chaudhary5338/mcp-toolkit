import { describe, it, expect } from 'vitest';
import { generateTable } from './core.js';
import type { FieldSchema, Field } from '@mcp-showcase/shared';

function f(name: string, type: Field['type'], table: Partial<Field['table']> = {}): Field {
  return { name, label: name.charAt(0).toUpperCase() + name.slice(1), type, required: true, table: { show: true, sortable: true, filterable: true, ...table }, form: { show: true } };
}

const schema: FieldSchema = {
  resource: 'article',
  baseEndpoint: '/api/articles',
  idKey: 'id',
  fields: [f('title', 'text'), f('views', 'number'), f('body', 'textarea', { show: false })],
};

describe('generateTable', () => {
  it('builds columns from table-visible fields only', () => {
    const out = generateTable(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.columns).toEqual(['title', 'views']);
    expect(out.result.code).toContain('{ accessorKey: \'title\', header: "Title" }');
    expect(out.result.code).not.toContain("accessorKey: 'body'");
  });

  it('respects enableSorting: false', () => {
    const out = generateTable({ ...schema, fields: [f('title', 'text', { sortable: false })] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('{ accessorKey: \'title\', header: "Title", enableSorting: false }');
  });

  it('wires the rtk list hook', () => {
    const out = generateTable(schema, { dataLayer: 'rtk' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("import { useGetArticlesQuery } from './Article.api'");
    expect(out.result.code).toContain('const { data = [], isLoading } = useGetArticlesQuery();');
  });

  it('wires the tanstack list hook', () => {
    const out = generateTable(schema, { dataLayer: 'tanstack' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("import { useArticles } from './Article.api'");
    expect(out.result.code).toContain('= useArticles();');
  });

  it('includes sorting, filter, and pagination wiring', () => {
    const out = generateTable(schema);
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain('getSortedRowModel: getSortedRowModel()');
    expect(code).toContain('getFilteredRowModel: getFilteredRowModel()');
    expect(code).toContain('getPaginationRowModel: getPaginationRowModel()');
    expect(code).toContain('onGlobalFilterChange: setGlobalFilter');
  });

  it('server mode adds manual flags', () => {
    const out = generateTable(schema, { paginationMode: 'server' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('manualSorting: true');
    expect(out.result.code).toContain('manualPagination: true');
  });

  it('rejects a non-FieldSchema and a table with no visible columns', () => {
    expect(generateTable({ x: 1 }).ok).toBe(false);
    expect(generateTable({ ...schema, fields: [f('body', 'textarea', { show: false })] }).ok).toBe(false);
  });

  it('braces void-returning arrow handlers instead of implicit-returning them (QA harness regression)', () => {
    // no-confusing-void-expression under strictTypeChecked: an arrow shorthand
    // that implicitly "returns" a void expression must use braces instead.
    const out = generateTable(schema);
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain('onChange={(e) => { setGlobalFilter(e.target.value); }}');
    expect(code).toContain('onClick={() => { table.previousPage(); }}');
    expect(code).toContain('onClick={() => { table.nextPage(); }}');
  });

  it('narrows the cell value to a display-safe type before stringifying (QA harness regression)', () => {
    // no-base-to-string: cell.getValue() is `unknown` — stringifying it directly
    // risks "[object Object]" for non-primitive values and is flagged under
    // strictTypeChecked regardless. Cast to the primitive display union first.
    const out = generateTable(schema);
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("String((cell.getValue() as string | number | boolean | null | undefined) ?? '—')");
  });

  it('renders a column header containing a quote via JSON.stringify, not a broken string literal (QA fuzz regression)', () => {
    // Found fuzzing table-generator: a label like "it's" broke the
    // single-quoted `header: '...'` object-literal property when interpolated raw.
    const s: FieldSchema = { ...schema, fields: [{ ...f('title', 'text'), label: "it's" }] };
    const out = generateTable(s);
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('header: "it\'s"');
  });
});
