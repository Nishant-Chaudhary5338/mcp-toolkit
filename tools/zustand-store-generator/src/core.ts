// zustand-store-generator CORE — pure logic (no MCP transport).
//
// A state shape → a typed Zustand store (state + per-field setters + reset),
// with optional persist/devtools middleware. The client-state complement to
// api-client-generator (which only does server state).

import { pascal, cap } from '@mcp-showcase/shared';

export interface StoreField {
  name: string;
  /** A TS type string, e.g. "string", "number", "boolean", "string[]", "'a' | 'b'". */
  type: string;
}

export interface StoreResult {
  code: string;
  filename: string;
  hookName: string;
}

export type StoreOutcome =
  | { ok: true; result: StoreResult }
  | { ok: false; error: string };

export interface StoreOptions {
  name: string;
  state: StoreField[];
  persist?: boolean;
  devtools?: boolean;
}

const VALID_IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function initialValue(type: string): string {
  const t = type.trim();
  if (t.endsWith('[]')) return '[]';
  if (t === 'string') return "''";
  if (t === 'number') return '0';
  if (t === 'boolean') return 'false';
  if (/^['"]/.test(t)) return t.split('|')[0]!.trim(); // union of literals → first
  return 'undefined';
}

export function generateStore(opts: StoreOptions): StoreOutcome {
  if (!opts?.name) return { ok: false, error: 'Store "name" is required.' };
  if (!Array.isArray(opts.state) || opts.state.length === 0) return { ok: false, error: 'Store "state" must have at least one field.' };
  for (const f of opts.state) {
    if (!f?.name || !f?.type) return { ok: false, error: 'Each state field needs a name and type.' };
    // field.name is interpolated as a bare identifier (interface key, setter
    // arg, destructured `set({ name })` key) with no sanitization elsewhere —
    // reject rather than silently rewrite, since a rewritten name would no
    // longer match what a hand-written call site might expect (QA fuzz
    // regression: "first name" broke every generated line that used it).
    if (!VALID_IDENTIFIER_RE.test(f.name)) return { ok: false, error: `Invalid field name "${f.name}" — must be a valid JS identifier.` };
  }

  const Name = pascal(opts.name) === 'Resource' && !/[a-zA-Z0-9]/.test(opts.name) ? 'Store' : pascal(opts.name);
  const StateType = `${Name}State`;
  const hookName = `use${Name}`;
  const useDevtools = opts.devtools !== false;
  const usePersist = opts.persist === true;

  const stateLines = opts.state.map((f) => `  ${f.name}: ${f.type};`);
  const setterLines = opts.state.map((f) => `  set${cap(f.name)}: (${f.name}: ${f.type}) => void;`);
  const initialLines = opts.state.map((f) => `  ${f.name}: ${initialValue(f.type)},`);
  const setterImpls = opts.state.map((f) => `    set${cap(f.name)}: (${f.name}) => set({ ${f.name} }),`);

  let creator = `(set) => ({
    ...initial,
${setterImpls.join('\n')}
    reset: () => set(initial),
  })`;

  const imports: string[] = ["import { create } from 'zustand';"];
  const mw: string[] = [];
  if (usePersist) mw.push('persist');
  if (useDevtools) mw.push('devtools');
  if (mw.length) imports.push(`import { ${mw.sort().join(', ')} } from 'zustand/middleware';`);

  if (usePersist) creator = `persist(${creator}, { name: '${opts.name}' })`;
  if (useDevtools) creator = `devtools(${creator})`;

  const code = `${imports.join('\n')}

interface ${StateType} {
${stateLines.join('\n')}
${setterLines.join('\n')}
  reset: () => void;
}

const initial = {
${initialLines.join('\n')}
};

export const ${hookName} = create<${StateType}>()(
  ${creator}
);
`;

  return { ok: true, result: { code, filename: `${hookName}.ts`, hookName } };
}
