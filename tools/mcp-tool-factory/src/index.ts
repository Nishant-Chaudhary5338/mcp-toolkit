#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import { scaffold, wirePackageJson, wireBinCli, validateToolName, type ToolSpec } from './core.js';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

/** Walk up from `start` to the mcp-react-toolkit package root. */
function findToolkitRoot(start: string): string | null {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'mcp-react-toolkit') return dir;
      } catch { /* keep walking */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

class McpToolFactoryServer extends McpServerBase {
  constructor() {
    super({ name: 'mcp-tool-factory', version: '1.0.0' });
  }

  private resolveRoot(explicit?: string): string {
    const root = explicit ? path.resolve(explicit) : findToolkitRoot(process.cwd());
    if (!root) throw new Error('Could not locate the mcp-react-toolkit package root. Pass toolkitRoot explicitly.');
    return root;
  }

  protected registerTools(): void {
    this.addTool(
      'scaffold_tool',
      'Scaffold a new MCP tool into the mcp-react-toolkit package: writes package.json, tsconfig.json, a McpServerBase index.ts shell wired to every action, a src/core.ts stub, and a test stub. Fill in src/core.ts afterwards. Kills the boilerplate; leaves only the logic.',
      {
        type: 'object',
        properties: {
          spec: {
            type: 'object',
            description: 'ToolSpec: { name (kebab-case), description, actions: [{ name (snake_case), description, properties?, required? }], deps? }.',
          },
          toolkitRoot: { type: 'string', description: 'Package root override. Auto-detected if omitted.' },
          overwrite: { type: 'boolean', description: 'Overwrite an existing tool directory. Default false.' },
        },
        required: ['spec'],
      },
      async (args) => {
        const { spec, toolkitRoot, overwrite } = (args ?? {}) as { spec?: ToolSpec; toolkitRoot?: string; overwrite?: boolean };
        try {
          if (!spec) throw new Error('Missing required argument "spec".');
          const outcome = scaffold(spec);
          if (!outcome.ok) return this.error(new Error(outcome.error));
          const root = this.resolveRoot(toolkitRoot);
          const toolDir = path.join(root, 'tools', spec.name);
          if (fs.existsSync(path.join(toolDir, 'src', 'index.ts')) && !overwrite) {
            return this.error(new Error(`tools/${spec.name} already exists. Pass overwrite:true to replace.`));
          }
          const written: string[] = [];
          for (const file of outcome.files) {
            const abs = path.join(toolDir, file.path);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, file.content, 'utf8');
            written.push(path.relative(root, abs));
          }
          return this.successWithDashboard('Mcp Tool Factory', {
            tool: spec.name,
            written,
            nextSteps: [
              `Implement logic in tools/${spec.name}/src/core.ts`,
              `Wire it: wire_tool { name: "${spec.name}", prev: "<previous-tool>" }`,
              `Verify it: verify_tool { name: "${spec.name}" }`,
            ],
          });
        } catch (err) {
          return this.error(err);
        }
      },
    );

    this.addTool(
      'wire_tool',
      'Wire an already-scaffolded tool into the root package.json (workspaces + build/test scripts) and bin/cli.mjs TOOLS array, after `prev`. Idempotent.',
      {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'kebab-case tool name to wire in.' },
          prev: { type: 'string', description: 'The tool it should be inserted after (workspaces/scripts/bin ordering).' },
          toolkitRoot: { type: 'string', description: 'Package root override. Auto-detected if omitted.' },
        },
        required: ['name', 'prev'],
      },
      async (args) => {
        const { name, prev, toolkitRoot } = (args ?? {}) as { name?: string; prev?: string; toolkitRoot?: string };
        try {
          if (!name || !validateToolName(name)) throw new Error('Invalid or missing "name" (kebab-case).');
          if (!prev || !validateToolName(prev)) throw new Error('Invalid or missing "prev" (kebab-case).');
          const root = this.resolveRoot(toolkitRoot);
          const pkgPath = path.join(root, 'package.json');
          const binPath = path.join(root, 'bin', 'cli.mjs');
          fs.writeFileSync(pkgPath, wirePackageJson(fs.readFileSync(pkgPath, 'utf8'), name, prev), 'utf8');
          fs.writeFileSync(binPath, wireBinCli(fs.readFileSync(binPath, 'utf8'), name, prev), 'utf8');
          return this.successWithDashboard('Mcp Tool Factory', { wired: name, after: prev });
        } catch (err) {
          return this.error(err);
        }
      },
    );

    this.addTool(
      'verify_tool',
      'Build the tool, run its tests, and JSON-RPC smoke-test its MCP server (tools/list). Returns pass/fail for each step.',
      {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'kebab-case tool name to verify.' },
          toolkitRoot: { type: 'string', description: 'Package root override. Auto-detected if omitted.' },
        },
        required: ['name'],
      },
      async (args) => {
        const { name, toolkitRoot } = (args ?? {}) as { name?: string; toolkitRoot?: string };
        try {
          if (!name || !validateToolName(name)) throw new Error('Invalid or missing "name" (kebab-case).');
          const root = this.resolveRoot(toolkitRoot);
          const toolDir = path.join(root, 'tools', name);
          if (!fs.existsSync(toolDir)) throw new Error(`tools/${name} does not exist.`);

          const run = (file: string, argv: string[]): { ok: boolean; output: string } => {
            try {
              const out = execFileSync(file, argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
              return { ok: true, output: out.slice(-600) };
            } catch (e) {
              const err = e as { stdout?: string; stderr?: string; message?: string };
              return { ok: false, output: (err.stdout ?? '' + (err.stderr ?? '') + (err.message ?? '')).slice(-600) };
            }
          };

          const build = run('npm', ['run', 'build', '-w', `tools/${name}`]);
          const test = build.ok ? run('npm', ['run', 'test', '-w', `tools/${name}`]) : { ok: false, output: 'skipped (build failed)' };
          let smoke = { ok: false, output: 'skipped (build failed)' };
          if (build.ok) {
            const entry = path.join(toolDir, 'build', 'index.js');
            try {
              const out = execFileSync('node', [entry], {
                cwd: root,
                input: '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n',
                encoding: 'utf8',
                timeout: 8000,
              });
              smoke = { ok: out.includes('"tools"'), output: out.slice(-400) };
            } catch (e) {
              smoke = { ok: false, output: String((e as Error).message).slice(-400) };
            }
          }
          const passed = build.ok && test.ok && smoke.ok;
          return this.successWithDashboard('Mcp Tool Factory', { tool: name, passed, build, test, smoke });
        } catch (err) {
          return this.error(err);
        }
      },
    );
  }
}

new McpToolFactoryServer().run().catch(console.error);
