// form-wizard-generator CORE — pure logic (no MCP transport).
//
// FieldSchema + step grouping → a multi-step React Hook Form + Zod wizard:
// per-step validation (trigger), progress, back/next, merged final submit.
// Extends form-generator's single-step output to onboarding/checkout flows.

import type { FieldSchema, Field } from '@mcp-showcase/shared';
import { isFieldSchema, pascal } from '@mcp-showcase/shared';

export interface WizardStep {
  title: string;
  fields: string[];
}

export interface WizardResult {
  code: string;
  filename: string;
  componentName: string;
  steps: WizardStep[];
}

export type WizardOutcome =
  | { ok: true; result: WizardResult }
  | { ok: false; error: string };

export interface WizardOptions {
  steps?: WizardStep[];
}

const INPUT = 'className="w-full rounded-md border px-3 py-2 text-sm"';

function control(f: Field): string {
  const reg = f.type === 'number' ? `{...register('${f.name}', { valueAsNumber: true })}` : `{...register('${f.name}')}`;
  switch (f.type) {
    case 'textarea': return `<textarea ${reg} ${INPUT} rows={4} />`;
    case 'boolean': return `<input type="checkbox" ${reg} className="h-4 w-4 rounded border" />`;
    case 'select': {
      const opts = (f.enumValues ?? []).map((v) => `\n              <option value="${v}">${v}</option>`).join('');
      return `<select ${reg} ${INPUT}>${opts}\n            </select>`;
    }
    case 'number': return `<input type="number" ${reg} ${INPUT} />`;
    case 'date': return `<input type="date" ${reg} ${INPUT} />`;
    case 'email': return `<input type="email" ${reg} ${INPUT} />`;
    case 'password': return `<input type="password" ${reg} ${INPUT} />`;
    default: return `<input type="text" ${reg} ${INPUT} />`;
  }
}

function fieldBlock(f: Field): string {
  return `          <div className="space-y-1">
            <label htmlFor="${f.name}" className="block text-sm font-medium">${f.label}</label>
            ${control(f)}
            {errors.${f.name} && <p className="text-sm text-red-600">{errors.${f.name}?.message as string}</p>}
          </div>`;
}

function autoSteps(fields: Field[]): WizardStep[] {
  const half = Math.ceil(fields.length / 2);
  return [
    { title: 'Step 1', fields: fields.slice(0, half).map((f) => f.name) },
    { title: 'Step 2', fields: fields.slice(half).map((f) => f.name) },
  ].filter((s) => s.fields.length > 0);
}

export function generateWizard(input: unknown, opts: WizardOptions = {}): WizardOutcome {
  let schema = input;
  if (typeof schema === 'string') {
    try { schema = JSON.parse(schema); } catch { return { ok: false, error: 'Invalid JSON for FieldSchema.' }; }
  }
  if (!isFieldSchema(schema)) return { ok: false, error: 'Expected a FieldSchema (from infer-fields).' };
  const fs: FieldSchema = schema;

  const formFields = fs.fields.filter((f) => f.form.show !== false);
  if (formFields.length === 0) return { ok: false, error: 'FieldSchema has no form-visible fields.' };
  const byName = new Map(formFields.map((f) => [f.name, f]));

  let steps = opts.steps && opts.steps.length ? opts.steps : autoSteps(formFields);
  // keep only known fields
  steps = steps.map((s) => ({ title: s.title, fields: s.fields.filter((n) => byName.has(n)) })).filter((s) => s.fields.length > 0);
  if (steps.length < 2) return { ok: false, error: 'A wizard needs at least 2 non-empty steps (provide `steps` or more fields).' };

  const Type = pascal(fs.resource);
  const componentName = `${Type}Wizard`;

  const stepConst = steps
    .map((s) => `  { title: ${JSON.stringify(s.title)}, fields: [${s.fields.map((n) => `'${n}'`).join(', ')}] as const },`)
    .join('\n');

  const stepBlocks = steps
    .map((s, i) => {
      const blocks = s.fields.map((n) => fieldBlock(byName.get(n)!)).join('\n');
      return `        {step === ${i} && (
          <div className="space-y-4">
${blocks}
          </div>
        )}`;
    })
    .join('\n');

  const code = `import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ${Type}Schema, type ${Type} } from './${Type}.schema';

const steps = [
${stepConst}
];

export function ${componentName}({ onSubmit }: { onSubmit: (data: ${Type}) => void | Promise<void> }) {
  const [step, setStep] = useState(0);
  const { register, handleSubmit, trigger, formState: { errors } } = useForm<${Type}>({
    resolver: zodResolver(${Type}Schema),
    mode: 'onBlur',
  });

  const next = async () => {
    const valid = await trigger(steps[step].fields as unknown as (keyof ${Type})[]);
    if (valid) setStep((s) => Math.min(steps.length - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));
  const isLast = step === steps.length - 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <p className="text-sm text-gray-500">Step {step + 1} of {steps.length}: {steps[step].title}</p>

${stepBlocks}

      <div className="flex justify-between">
        <button type="button" onClick={back} disabled={step === 0} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">Back</button>
        {isLast ? (
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white">Submit</button>
        ) : (
          <button type="button" onClick={next} className="rounded-md bg-black px-4 py-2 text-sm text-white">Next</button>
        )}
      </div>
    </form>
  );
}
`;

  return { ok: true, result: { code, filename: `${componentName}.tsx`, componentName, steps } };
}
