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
    expect(out.result.code).toContain("{ accessorKey: 'title', header: 'Title' }");
    expect(out.result.code).not.toContain("accessorKey: 'body'");
  });

  it('respects enableSorting: false', () => {
    const out = generateTable({ ...schema, fields: [f('title', 'text', { sortable: false })] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("{ accessorKey: 'title', header: 'Title', enableSorting: false }");
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
});
