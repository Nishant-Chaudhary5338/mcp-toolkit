#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { generateWizard, type WizardStep } from './core.js';

class FormWizardGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: 'form-wizard-generator', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'generate_wizard',
      'Generate a multi-step RHF + Zod wizard from a FieldSchema: per-step validation (trigger), progress indicator, back/next, and a merged final submit. Pass `steps` to group fields, or it auto-splits into two. Returns { code, filename, componentName, steps }.',
      {
        type: 'object',
        properties: {
          schema: { type: 'object', description: 'A FieldSchema object from infer-fields (or a JSON string).' },
          steps: { type: 'array', description: 'Step grouping.', items: { type: 'object', properties: { title: { type: 'string' }, fields: { type: 'array', items: { type: 'string' } } } } },
        },
        required: ['schema'],
      },
      async (args) => {
        const { schema, steps } = (args ?? {}) as { schema?: unknown; steps?: WizardStep[] };
        if (schema === undefined || schema === null) return this.error(new Error('Missing required argument "schema".'));
        const outcome = generateWizard(schema, { steps });
        if (!outcome.ok) return this.error(new Error(outcome.error));
        return this.successWithDashboard('Form Wizard Generator', { ...outcome.result });
      },
    );
  }
}

new FormWizardGeneratorServer().run().catch(console.error);
