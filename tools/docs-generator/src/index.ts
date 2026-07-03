#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import { generateToolDocs, generateApiReference } from './core.js';

class DocsGeneratorServer extends McpServerBase {
  constructor() {
    super({ name: "docs-generator", version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      "generate_tool_docs",
      "Read an MCP tool’s index.ts and generate a Markdown README: the server name, each registered action with its description, argument table, and a usage example. Returns { code, filename, toolName, actions }.",
      {
            "type": "object",
            "properties": {
                  "path": {
                        "type": "string",
                        "description": "Path to the MCP tool directory or its src/index.ts."
                  }
            },
            "required": [
                  "path"
            ]
      },
      async (args) => {
        const { path: p } = (args ?? {}) as { path?: string };
        if (!p) return this.error(new Error('Missing required argument "path".'));
        try {
          const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'src', 'index.ts') : p;
          const source = fs.readFileSync(file, 'utf8');
          return this.successWithDashboard('Docs Generator', { ...generateToolDocs(source) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
    this.addTool(
      "generate_api_reference",
      "Read a TypeScript module and generate a Markdown API reference from its exported functions, interfaces, and type aliases (with leading JSDoc). Returns { code, filename, symbols }.",
      {
            "type": "object",
            "properties": {
                  "path": {
                        "type": "string",
                        "description": "Path to a .ts/.tsx source file."
                  }
            },
            "required": [
                  "path"
            ]
      },
      async (args) => {
        const { path: p } = (args ?? {}) as { path?: string };
        if (!p) return this.error(new Error('Missing required argument "path".'));
        try {
          const source = fs.readFileSync(p, 'utf8');
          return this.successWithDashboard('Docs Generator', { ...generateApiReference(source, p) });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new DocsGeneratorServer().run().catch(console.error);
