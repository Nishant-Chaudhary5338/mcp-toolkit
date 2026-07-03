// test-data-factory CORE — pure logic (no MCP transport).
//
// FieldSchema → a typed test-fixture factory: makeX(overrides) + makeXs(n).
// Deterministic, override-friendly data for unit tests, Storybook, and seeds.
// Composes with zod-schema-generator's type (imports ./<Type>.schema).

import type { FieldSchema, Field } from '@mcp-showcase/shared';
import { isFieldSchema, pascal, camel, plural } from '@mcp-showcase/shared';

export interface FactoryResult {
  code: string;
  filename: string;
  factoryName: string;
}

export type FactoryOutcome =
  | { ok: true; result: FactoryResult }
  | { ok: false; error: string };

function defaultFor(f: Field): string {
  switch (f.type) {
    case 'email': return '`user${seq}@example.com`';
    case 'password': return "'secret123'";
    case 'number': return 'seq * 10';
    case 'boolean': return 'seq % 2 === 0';
    case 'date': return "'2026-01-01'";
    case 'textarea': return `\`Sample ${f.label.toLowerCase()} \${seq}\``;
    case 'select': return f.enumValues?.length ? JSON.stringify(f.enumValues[0]) : "'option'";
    case 'relation': return 'seq';
    default: return `\`${f.label} \${seq}\``;
  }
}

export function generateFactory(input: unknown): FactoryOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return { ok: false, error: 'Invalid JSON for FieldSchema.' }; }
  }
  if (!isFieldSchema(schema)) return { ok: false, error: 'Expected a FieldSchema (from infer-fields).' };
  const fs: FieldSchema = schema;
  if (fs.fields.length === 0) return { ok: false, error: 'FieldSchema has no fields to build a factory from.' };

  const Type = pascal(fs.resource);
  const one = camel(fs.resource);
  const factoryName = `make${Type}`;

  const fieldLines = fs.fields.map((f) => `    ${f.name}: ${defaultFor(f)},`).join('\n');

  const code = `import type { ${Type} } from './${Type}.schema';

let seq = 0;

/** Build a ${Type} fixture. Pass overrides to pin specific fields. */
export function ${factoryName}(overrides: Partial<${Type}> = {}): ${Type} {
  seq += 1;
  return {
${fieldLines}
    ...overrides,
  };
}

/** Build \`count\` ${Type} fixtures. */
export function make${plural(Type)}(count: number, overrides: Partial<${Type}> = {}): ${Type}[] {
  return Array.from({ length: count }, () => ${factoryName}(overrides));
}

/** Reset the sequence counter (call in beforeEach for deterministic ids). */
export function reset${Type}Seq(): void {
  seq = 0;
}
`;

  return { ok: true, result: { code, filename: `${one}.factory.ts`, factoryName } };
}
