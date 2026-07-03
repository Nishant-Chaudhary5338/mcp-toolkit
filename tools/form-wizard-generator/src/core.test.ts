import { describe, it, expect } from 'vitest';
import { generateWizard } from './core.js';
import type { FieldSchema, Field } from '@mcp-showcase/shared';

function f(name: string, type: Field['type']): Field {
  return { name, label: name.charAt(0).toUpperCase() + name.slice(1), type, required: true, table: { show: true, sortable: true, filterable: true }, form: { show: true } };
}
const schema: FieldSchema = {
  resource: 'signup', baseEndpoint: '/api/signups', idKey: 'id',
  fields: [f('email', 'email'), f('password', 'password'), f('company', 'text'), f('role', 'text')],
};

describe('generateWizard', () => {
  it('auto-splits fields into two validated steps', () => {
    const out = generateWizard(schema);
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { useForm } from 'react-hook-form'");
    expect(code).toContain('const steps = [');
    expect(code).toContain('await trigger(steps[step].fields');
    expect(code).toContain('{step === 0 && (');
    expect(code).toContain('{step === 1 && (');
    expect(out.result.componentName).toBe('SignupWizard');
    expect(out.result.steps.length).toBe(2);
  });

  it('honors explicit step grouping', () => {
    const out = generateWizard(schema, { steps: [
      { title: 'Account', fields: ['email', 'password'] },
      { title: 'Company', fields: ['company', 'role'] },
    ] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain("title: \"Account\", fields: ['email', 'password']");
    expect(out.result.steps[0]?.title).toBe('Account');
  });

  it('rejects fewer than two steps', () => {
    const one: FieldSchema = { ...schema, fields: [f('email', 'email')] };
    expect(generateWizard(one).ok).toBe(false);
  });

  it('rejects a non-FieldSchema', () => {
    expect(generateWizard({ x: 1 }).ok).toBe(false);
  });
});
