#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import { fixA11y } from './core.js';

class A11yAutofixerServer extends McpServerBase {
  constructor() {
    super({ name: 'a11y-autofixer', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'fix_a11y',
      'Apply safe, mechanical accessibility fixes to a JSX/TSX file (img alt="", target=_blank rel, label for->htmlFor, tabindex->tabIndex) and return the fixed code plus a list of what changed. Review before writing. Returns { code, fixes, count }.',
      { type: 'object', properties: { path: { type: 'string', description: 'Path to a .tsx/.jsx file.' } }, required: ['path'] },
      async (args) => {
        const { path: p } = (args ?? {}) as { path?: string };
        if (!p) return this.error(new Error('Missing required argument "path".'));
        try { return this.success({ ...fixA11y(fs.readFileSync(p, 'utf8')) }); }
        catch (err) { return this.error(err); }
      },
    );
  }
}

new A11yAutofixerServer().run().catch(console.error);
