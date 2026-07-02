// ============================================================================
// mcp-tool-factory CORE — generate the boilerplate for a new MCP tool.
//
// Pure functions: given a ToolSpec, produce the exact file contents and the
// root-file edits needed to wire the tool into the mcp-react-toolkit package.
// The index.ts (io layer) writes these to disk and runs build/test.
//
// This is the executable form of the mcp-server-builder skill: it kills the
// deterministic boilerplate (package.json, tsconfig, McpServerBase shell,
// wiring) and leaves only src/core.ts logic for a human/agent to fill in.
// ============================================================================

export interface ActionSpec {
  /** snake_case tool action name, e.g. "generate_thing". */
  name: string;
  description: string;
  /** JSON-Schema properties object for the action's arguments. */
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface ToolSpec {
  /** kebab-case tool/package name, e.g. "review-gate". */
  name: string;
  description: string;
  actions: ActionSpec[];
  /** Extra npm dependencies beyond @mcp-showcase/shared + the MCP SDK. */
  deps?: Record<string, string>;
}

export interface FileSpec {
  /** Path relative to the tool directory, e.g. "src/core.ts". */
  path: string;
  content: string;
}

export type ScaffoldOutcome =
  | { ok: true; files: FileSpec[] }
  | { ok: false; error: string };

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const ACTION_RE = /^[a-z][a-z0-9_]*$/;

export function validateToolName(name: string): boolean {
  return NAME_RE.test(name);
}

function pascal(s: string): string {
  return s.replace(/[_-]+/g, ' ').split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

function packageJson(spec: ToolSpec): string {
  const deps: Record<string, string> = {
    '@mcp-showcase/shared': '*',
    '@modelcontextprotocol/sdk': '^1.12.0',
    ...(spec.deps ?? {}),
  };
  const pkg = {
    name: `@mcp-showcase/${spec.name}`,
    version: '1.0.0',
    description: spec.description,
    type: 'module',
    main: './build/index.js',
    scripts: { build: 'tsc && chmod +x build/index.js', dev: 'tsc --watch', test: 'vitest run' },
    dependencies: deps,
    devDependencies: { '@types/node': '^20.0.0', typescript: '^5.0.0', vitest: '^2.0.0' },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function tsconfig(): string {
  return JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: './build', rootDir: './src' },
      include: ['src/**/*'],
      exclude: ['node_modules', 'build', '**/*.test.ts'],
    },
    null,
    2,
  ) + '\n';
}

function coreStub(spec: ToolSpec): string {
  const fns = spec.actions
    .map((a) => {
      const fn = snakeToCamel(a.name);
      return `/** ${a.description} */
export function ${fn}(args: unknown): Record<string, unknown> {
  // TODO: implement ${a.name}. Keep this pure and testable (no MCP transport).
  void args;
  throw new Error('${fn} not implemented');
}`;
    })
    .join('\n\n');
  return `// ${spec.name} CORE — pure logic (no MCP transport). Fill these in.\n\n${fns}\n`;
}

function indexShell(spec: ToolSpec): string {
  const Server = `${pascal(spec.name)}Server`;
  const fns = spec.actions.map((a) => snakeToCamel(a.name));
  const importLine = `import { ${fns.join(', ')} } from './core.js';`;
  const registrations = spec.actions
    .map((a) => {
      const fn = snakeToCamel(a.name);
      const inputSchema = JSON.stringify(
        { type: 'object', properties: a.properties ?? {}, required: a.required ?? [] },
        null,
        6,
      ).replace(/\n/g, '\n      ');
      return `    this.addTool(
      ${JSON.stringify(a.name)},
      ${JSON.stringify(a.description)},
      ${inputSchema},
      async (args) => {
        try {
          return this.success(${fn}(args));
        } catch (err) {
          return this.error(err);
        }
      },
    );`;
    })
    .join('\n');

  return `#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
${importLine}

class ${Server} extends McpServerBase {
  constructor() {
    super({ name: ${JSON.stringify(spec.name)}, version: '1.0.0' });
  }

  protected registerTools(): void {
${registrations}
  }
}

new ${Server}().run().catch(console.error);
`;
}

function testStub(spec: ToolSpec): string {
  const fns = spec.actions.map((a) => snakeToCamel(a.name));
  return `import { describe, it, expect } from 'vitest';
import { ${fns.join(', ')} } from './core.js';

${spec.actions
  .map((a) => {
    const fn = snakeToCamel(a.name);
    return `describe('${fn}', () => {
  it('throws until implemented', () => {
    expect(() => ${fn}(undefined)).toThrow();
  });
});`;
  })
  .join('\n\n')}
`;
}

export function scaffold(spec: ToolSpec): ScaffoldOutcome {
  if (!spec || typeof spec !== 'object') return { ok: false, error: 'Expected a ToolSpec object.' };
  if (!validateToolName(spec.name)) return { ok: false, error: `Invalid tool name "${spec.name}". Use kebab-case (e.g. "my-tool").` };
  if (!spec.description) return { ok: false, error: 'ToolSpec.description is required.' };
  if (!Array.isArray(spec.actions) || spec.actions.length === 0) return { ok: false, error: 'ToolSpec.actions must have at least one action.' };
  for (const a of spec.actions) {
    if (!a.name || !ACTION_RE.test(a.name)) return { ok: false, error: `Invalid action name "${a?.name}". Use snake_case.` };
    if (!a.description) return { ok: false, error: `Action "${a.name}" needs a description.` };
  }

  const files: FileSpec[] = [
    { path: 'package.json', content: packageJson(spec) },
    { path: 'tsconfig.json', content: tsconfig() },
    { path: 'src/core.ts', content: coreStub(spec) },
    { path: 'src/index.ts', content: indexShell(spec) },
    { path: 'src/core.test.ts', content: testStub(spec) },
  ];
  return { ok: true, files };
}

// ── Root-file wiring (pure string transforms) ────────────────────────────────

/** Insert a workspace + build/test script for `name` after `prev` in root package.json text. */
export function wirePackageJson(pkgText: string, name: string, prev: string): string {
  const pkg = JSON.parse(pkgText);
  const wsPrev = `tools/${prev}`;
  const wsCur = `tools/${name}`;
  const i = pkg.workspaces.indexOf(wsPrev);
  if (i !== -1 && !pkg.workspaces.includes(wsCur)) pkg.workspaces.splice(i + 1, 0, wsCur);
  const bPrev = `npm run build -w tools/${prev}`;
  const tPrev = `npm run test -w tools/${prev}`;
  if (!pkg.scripts.build.includes(`tools/${name}`)) {
    pkg.scripts.build = pkg.scripts.build.replace(bPrev, `${bPrev} && npm run build -w tools/${name}`);
  }
  if (!pkg.scripts.test.includes(`tools/${name}`)) {
    pkg.scripts.test = pkg.scripts.test.replace(tPrev, `${tPrev} && npm run test -w tools/${name}`);
  }
  return JSON.stringify(pkg, null, 2) + '\n';
}

/** Insert `name` into the TOOLS array of bin/cli.mjs after `prev`. */
export function wireBinCli(binText: string, name: string, prev: string): string {
  if (binText.includes(`"${name}"`)) return binText;
  return binText.replace(`  "${prev}",\n];`, `  "${prev}",\n  "${name}",\n];`);
}
