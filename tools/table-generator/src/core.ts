// ============================================================================
// table-generator CORE — FieldSchema → TanStack Table data table.
//
// paginationMode: 'client' | 'server'
// dataLayer:      'rtk' | 'tanstack'   (which list hook to call)
// Columns come from fields where table.show !== false. Sorting/filtering/
// pagination are wired via TanStack's row models. Composes with
// api-client-generator (list hook) and zod-schema-generator (row type).
// ============================================================================

import type { FieldSchema, Field, DataLayer } from '@mcp-showcase/shared';
import { isFieldSchema, pascal, plural } from '@mcp-showcase/shared';

export type PaginationMode = 'client' | 'server';

export interface GenerateTableResult {
  code: string;
  filename: string;
  componentName: string;
  paginationMode: PaginationMode;
  dataLayer: DataLayer;
  columns: string[];
}

export type GenerateTableOutcome =
  | { ok: true; result: GenerateTableResult }
  | { ok: false; error: string };

export interface GenerateTableOptions {
  paginationMode?: PaginationMode;
  dataLayer?: DataLayer;
}

function columnDef(f: Field): string {
  const sort = f.table.sortable ? '' : ', enableSorting: false';
  return `  { accessorKey: '${f.name}', header: '${f.label}'${sort} },`;
}

function listHook(Type: string, dataLayer: DataLayer): { importLine: string; call: string } {
  if (dataLayer === 'rtk') {
    const hook = `useGet${plural(Type)}Query`;
    return { importLine: `import { ${hook} } from './${Type}.api';`, call: `${hook}()` };
  }
  const hook = `use${plural(Type)}`;
  return { importLine: `import { ${hook} } from './${Type}.api';`, call: `${hook}()` };
}

export function generateTable(input: unknown, opts: GenerateTableOptions = {}): GenerateTableOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return { ok: false, error: 'Invalid JSON for FieldSchema.' }; }
  }
  if (!isFieldSchema(schema)) return { ok: false, error: 'Expected a FieldSchema (from infer-fields).' };
  const fs: FieldSchema = schema;

  const paginationMode: PaginationMode = opts.paginationMode ?? 'client';
  const dataLayer: DataLayer = opts.dataLayer ?? 'rtk';
  if (paginationMode !== 'client' && paginationMode !== 'server') return { ok: false, error: `Unknown paginationMode "${paginationMode}". Use "client" or "server".` };
  if (dataLayer !== 'rtk' && dataLayer !== 'tanstack') return { ok: false, error: `Unknown dataLayer "${dataLayer}". Use "rtk" or "tanstack".` };

  const cols = fs.fields.filter((f) => f.table.show !== false);
  if (cols.length === 0) return { ok: false, error: 'FieldSchema has no table-visible columns.' };

  const Type = pascal(fs.resource);
  const componentName = `${Type}Table`;
  const hook = listHook(Type, dataLayer);
  const columnDefs = cols.map(columnDef).join('\n');
  const manual = paginationMode === 'server'
    ? '\n    manualSorting: true,\n    manualPagination: true,'
    : '';
  const serverNote = paginationMode === 'server'
    ? `\n// NOTE: server mode expects the list hook to accept { pageIndex, pageSize, sorting }\n// and return { rows, pageCount }. Wire those params into the generated api hook.\n`
    : '';

  const code = `import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
${hook.importLine}
import type { ${Type} } from './${Type}.schema';
${serverNote}
const columns: ColumnDef<${Type}>[] = [
${columnDefs}
];

export function ${componentName}() {
  const { data = [], isLoading } = ${hook.call};
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),${manual}
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <input
        value={globalFilter}
        onChange={(e) => { setGlobalFilter(e.target.value); }}
        placeholder="Search…"
        className="w-full max-w-xs rounded-md border px-3 py-2 text-sm"
      />
      <table className="w-full text-left text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none px-3 py-2 font-semibold"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">{String((cell.getValue() as string | number | boolean | null | undefined) ?? '—')}</td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">No results</td></tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => { table.previousPage(); }} disabled={!table.getCanPreviousPage()} className="rounded border px-3 py-1 disabled:opacity-50">Prev</button>
        <button onClick={() => { table.nextPage(); }} disabled={!table.getCanNextPage()} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
        <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
      </div>
    </div>
  );
}
`;

  return {
    ok: true,
    result: { code, filename: `${componentName}.tsx`, componentName, paginationMode, dataLayer, columns: cols.map((c) => c.name) },
  };
}
