import { describe, it, expect } from 'vitest';
import { isFieldSchema } from './fieldSchema.js';

function field(name: string) {
  return { name, label: name, type: 'text', required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true } };
}

const base = { resource: 'article', baseEndpoint: '/api/articles', idKey: 'id' };

describe('isFieldSchema', () => {
  it('accepts a well-formed schema', () => {
    expect(isFieldSchema({ ...base, fields: [field('title')] })).toBe(true);
  });

  it('accepts an empty fields array (callers reject that separately)', () => {
    expect(isFieldSchema({ ...base, fields: [] })).toBe(true);
  });

  it('rejects a value missing required top-level keys', () => {
    expect(isFieldSchema({ resource: 'article' })).toBe(false);
    expect(isFieldSchema(null)).toBe(false);
    expect(isFieldSchema('not an object')).toBe(false);
  });

  it('rejects field names that are not valid JS identifiers (QA fuzz regression)', () => {
    // Found fuzzing every CRUD-factory generator with hand-built FieldSchemas:
    // field.name is interpolated as a bare identifier / object key / register()
    // argument downstream with no validation of its own. infer-fields already
    // sanitizes names it produces, but a hand-built schema bypasses that — so
    // this shared guard, which every generator already calls first, rejects
    // (rather than silently rewrites) unsafe names at the one common gate.
    expect(isFieldSchema({ ...base, fields: [field('first name')] })).toBe(false);
    expect(isFieldSchema({ ...base, fields: [field('名前')] })).toBe(false);
    expect(isFieldSchema({ ...base, fields: [field('')] })).toBe(false);
    expect(isFieldSchema({ ...base, fields: [field("thing's")] })).toBe(false);
  });

  it('accepts valid identifiers including underscore/dollar-prefixed and digit-containing names', () => {
    expect(isFieldSchema({ ...base, fields: [field('_private'), field('$id'), field('field2')] })).toBe(true);
  });
});
