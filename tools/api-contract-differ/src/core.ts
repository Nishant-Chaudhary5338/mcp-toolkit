// api-contract-differ CORE — pure logic (no MCP transport).
//
// Diff two API contract snapshots (JSON response samples or OpenAPI schema
// objects) and classify changes as breaking (removed field, type change) vs
// additive (new field). A CI gate against accidental contract breaks.

export type ChangeKind = 'removed' | 'type-changed' | 'added';

export interface ContractChange {
  path: string;
  kind: ChangeKind;
  from?: string;
  to?: string;
  breaking: boolean;
}

export interface ContractDiffResult {
  changes: ContractChange[];
  breaking: ContractChange[];
  additive: ContractChange[];
  passed: boolean;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Flatten an object to dot-paths → type. Arrays recurse into element [0]. */
function flatten(value: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (Array.isArray(value)) {
    out[prefix || '.'] = 'array';
    if (value.length > 0) flatten(value[0], `${prefix}[]`, out);
    return out;
  }
  if (value && typeof value === 'object') {
    if (prefix) out[prefix] = 'object';
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  out[prefix || '.'] = typeOf(value);
  return out;
}

function parse(input: unknown, label: string): Record<string, string> {
  let obj = input;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { throw new Error(`Invalid JSON for ${label} contract.`); }
  }
  if (Array.isArray(obj)) obj = obj[0];
  if (typeof obj !== 'object' || obj === null) throw new Error(`${label} contract must be a JSON object or array of objects.`);
  // OpenAPI schema → use its properties shape if present
  const record = obj as Record<string, unknown>;
  const shape = record['properties'] && typeof record['properties'] === 'object' ? record['properties'] : record;
  return flatten(shape);
}

export function diffContracts(oldInput: unknown, newInput: unknown): ContractDiffResult {
  const oldFlat = parse(oldInput, 'old');
  const newFlat = parse(newInput, 'new');
  const changes: ContractChange[] = [];

  for (const [path, type] of Object.entries(oldFlat)) {
    if (!(path in newFlat)) {
      changes.push({ path, kind: 'removed', from: type, breaking: true });
    } else if (newFlat[path] !== type) {
      changes.push({ path, kind: 'type-changed', from: type, to: newFlat[path], breaking: true });
    }
  }
  for (const [path, type] of Object.entries(newFlat)) {
    if (!(path in oldFlat)) {
      changes.push({ path, kind: 'added', to: type, breaking: false });
    }
  }

  const breaking = changes.filter((c) => c.breaking);
  const additive = changes.filter((c) => !c.breaking);
  return { changes, breaking, additive, passed: breaking.length === 0 };
}
