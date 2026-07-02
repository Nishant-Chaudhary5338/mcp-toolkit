// ============================================================================
// zod-schema-generator CORE — FieldSchema → Zod schema + inferred TS type.
//
// Enforces "Zod at every boundary". Consumed by form-generator (validation)
// and api-client-generator (request/response typing).
// ============================================================================

import type { FieldSchema, Field } from '@mcp-showcase/shared';
import { isFieldSchema } from '@mcp-showcase/shared';

export interface GenerateZodResult {
  code: string;
  filename: string;
  schemaName: string;
  typeName: string;
}

export type GenerateZodOutcome =
  | { ok: true; result: GenerateZodResult }
  | { ok: false; error: string };

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** PascalCase a resource name, e.g. "blog_post" → "BlogPost". */
function pascal(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(cap)
    .join('');
}

/** The Zod expression for a single field (without the trailing optional). */
function zodBase(field: Field): string {
  switch (field.type) {
    case 'email':
      return 'z.string().email()';
    case 'password':
      return 'z.string().min(8)';
    case 'number':
      return 'z.coerce.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'date':
      return 'z.string()';
    case 'textarea':
    case 'text':
      return field.required ? 'z.string().min(1)' : 'z.string()';
    case 'select': {
      const values = field.enumValues?.filter(Boolean) ?? [];
      if (values.length === 0) return 'z.string()';
      return `z.enum([${values.map((v) => JSON.stringify(v)).join(', ')}])`;
    }
    case 'relation':
      return 'z.union([z.string(), z.number()])';
    default:
      return 'z.string()';
  }
}

function zodForField(field: Field): string {
  let expr = zodBase(field);
  if (!field.required) expr += '.optional()';
  return `  ${field.name}: ${expr},`;
}

export function generateZodSchema(input: unknown): GenerateZodOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try {
      schema = JSON.parse(schema);
    } catch {
      return { ok: false, error: 'Invalid JSON for FieldSchema.' };
    }
  }
  if (!isFieldSchema(schema)) {
    return { ok: false, error: 'Expected a FieldSchema (from infer-fields) with resource/baseEndpoint/idKey/fields.' };
  }
  const fs: FieldSchema = schema;
  if (fs.fields.length === 0) {
    return { ok: false, error: 'FieldSchema has no fields to generate a Zod schema from.' };
  }

  const typeName = pascal(fs.resource);
  const schemaName = `${typeName}Schema`;
  const lines = fs.fields.map(zodForField).join('\n');

  const code = `import { z } from 'zod';

export const ${schemaName} = z.object({
${lines}
});

export type ${typeName} = z.infer<typeof ${schemaName}>;
`;

  return {
    ok: true,
    result: { code, filename: `${typeName}.schema.ts`, schemaName, typeName },
  };
}
