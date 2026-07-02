// type-from-json CORE — pure logic (no MCP transport).
//
// JSON sample → plain TypeScript interfaces (nested objects become their own
// interfaces). The general-purpose sibling of infer-fields (which produces a
// FieldSchema for the CRUD factory); this just gives you clean TS types.

export interface TypeFromJsonResult {
  code: string;
  filename: string;
  rootName: string;
}

export type TypeFromJsonOutcome =
  | { ok: true; result: TypeFromJsonResult }
  | { ok: false; error: string };

function pascal(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).replace(/[^a-zA-Z0-9]/g, '')).join('') || 'Value';
}

function singular(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, 'y');
  if (/[^s]s$/i.test(word)) return word.replace(/s$/i, '');
  return word;
}

interface Ctx {
  interfaces: Map<string, string>; // name -> body
}

function typeOf(value: unknown, keyHint: string, ctx: Ctx): string {
  if (value === null || value === undefined) return 'unknown';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]';
    const inner = typeOf(value[0], singular(keyHint), ctx);
    return `${inner}[]`;
  }
  if (typeof value === 'object') {
    const name = pascal(keyHint);
    buildInterface(name, value as Record<string, unknown>, ctx);
    return name;
  }
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function buildInterface(name: string, obj: Record<string, unknown>, ctx: Ctx): void {
  if (ctx.interfaces.has(name)) return;
  ctx.interfaces.set(name, ''); // reserve to avoid infinite recursion on cyclic hints
  const lines = Object.entries(obj).map(([key, value]) => {
    const optional = value === null || value === undefined ? '?' : '';
    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    return `  ${safeKey}${optional}: ${typeOf(value, key, ctx)};`;
  });
  ctx.interfaces.set(name, `export interface ${name} {\n${lines.join('\n')}\n}`);
}

export function generateTypes(input: unknown, rootName = 'Root'): TypeFromJsonOutcome {
  let parsed: unknown = input;
  if (typeof parsed === 'string') {
    const t = parsed.trim();
    if (!t) return { ok: false, error: 'Empty input.' };
    try { parsed = JSON.parse(t); } catch { return { ok: false, error: 'Invalid JSON.' }; }
  }
  if (Array.isArray(parsed)) parsed = parsed[0];
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, error: 'Expected a JSON object or array of objects.' };

  const name = pascal(rootName);
  const ctx: Ctx = { interfaces: new Map() };
  buildInterface(name, parsed as Record<string, unknown>, ctx);

  // Root first, then the rest in insertion order.
  const bodies = [ctx.interfaces.get(name)!, ...[...ctx.interfaces.entries()].filter(([n]) => n !== name).map(([, b]) => b)];
  return { ok: true, result: { code: `${bodies.join('\n\n')}\n`, filename: `${name}.types.ts`, rootName: name } };
}
