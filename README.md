# mcp-toolkit

MCP servers for React + TypeScript development automation. Works with Claude Desktop, Cline, Cursor — and as plain CLI scripts — one protocol, zero duplication.

[![npm](https://img.shields.io/npm/v/mcp-react-toolkit?color=cb3837&logo=npm)](https://www.npmjs.com/package/mcp-react-toolkit)
[![CI](https://github.com/Nishant-Chaudhary5338/mcp-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Nishant-Chaudhary5338/mcp-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.12.0-blue)](https://github.com/modelcontextprotocol/typescript-sdk)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](#testing)

---

## Install

Published on npm as [`mcp-react-toolkit`](https://www.npmjs.com/package/mcp-react-toolkit). No clone or build required — run any of the 43 servers straight from npm:

```bash
npx mcp-react-toolkit --list            # list all 43 tools
npx mcp-react-toolkit legacy-analyzer   # run one as an MCP server (stdio)
```

### Add to Claude Desktop / Cursor / Cline

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "legacy-analyzer": {
      "command": "npx",
      "args": ["-y", "mcp-react-toolkit", "legacy-analyzer"]
    },
    "component-factory": {
      "command": "npx",
      "args": ["-y", "mcp-react-toolkit", "component-factory"]
    }
  }
}
```

Swap in any tool name from `npx mcp-react-toolkit --list`. Restart your client and the tools appear.

---

## 🖥️ Interactive dashboards

Most MCP tools return raw JSON. The tools here return that JSON **plus a premium, interactive HTML dashboard** — a 0–100 health score, sortable issue triage, light/dark toggle, and one-click *fix* actions that call other tools in the toolkit.

It works three ways from a single self-contained artifact (no server, no external requests):

| Where you run it | What you get |
|---|---|
| **Claude Desktop** (MCP Apps) | The dashboard renders **inline in the conversation** (sandboxed iframe); action buttons drive the agent. |
| **Claude Code (VS Code) · Cursor · CLI** | The JSON **plus a clickable `file://` link** — open it to view the full dashboard in your browser. |
| **Any browser** | The same HTML opens standalone — fully interactive. |

Two dashboard styles:

- **Audit view** — `legacy-analyzer`, `component-reviewer`, `accessibility-checker`, `dep-auditor`, `typescript-enforcer`, `performance-audit`, `render-analyzer`, `test-gap-analyzer`, `quality-pipeline`, `lighthouse-runner`. Health score, grade, category cards, filter/sort issue table.
- **Result view** — `component-factory`, `component-fixer`, `code-modernizer`, `storybook-generator`, `generate-tests`, `monorepo-manager`. Files created/changed, diffs, and follow-up actions.

**How it renders:** the tool returns an MCP `resource` with a `ui://` URI and `mimeType: text/html`. Hosts that support [MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) render it inline; for every other client the toolkit also writes the HTML to a temp file and returns a `file://` link so you can open it in a browser. Powered by the internal `@mcp-showcase/ui-kit` package — dependency-free, dual light/dark, ~30 KB per report.

---

## What's here

```
tools/      43 MCP server packages — each independently buildable and runnable
server/     Express bridge (port 3002) — proxies calls from the UI to MCP servers
client/     React 19 showcase SPA — tool catalog, workflow demos, animated flowcharts
```

---

## Companion package

[`code-graph-indexer`](https://www.npmjs.com/package/code-graph-indexer) — a standalone code-intelligence engine that indexes any TS / React / Next.js repo into a queryable **code graph** (files · components · functions, and the `imports`/`renders`/`calls`/`references`/`depends-on` edges between them) and answers structural questions — *who renders this, who calls this, find references, blast radius, cycles, dead code* — plus **semantic search** by meaning. Use it over a CLI, an MCP server, an HTTP/WS server, and a 3D web explorer. Separate package, same family:

```bash
npx code-graph-indexer mcp                       # stdio MCP server (13 tools)
npx code-graph-indexer index --root .            # one-shot index → .code-graph/graph.json
npx code-graph-indexer query who-renders --id "cmp:src/Button.tsx#Button" --root .
```

---

## Tools

All 43 tools are production-ready: built, tested, and CI-verified on Node 20 + 22.

### Component Development

| Tool | What it does | MCP tools exposed |
|---|---|---|
| `component-factory` | Scaffold React components from 41 shadcn/ui templates — with tests + Storybook | 6 |
| `component-reviewer` | Audit TypeScript errors, a11y issues, test coverage — graded A+ to F | 3 |
| `component-fixer` | Auto-fix broken imports, missing deps, inline style refactors | 3 |
| `storybook-generator` | Auto-generate Storybook stories — Default, variants, sizes, callbacks, play functions | 2 |
| `component-improver` | Extend a component with variants, comprehensive stories, and edge-case tests | 1 |

### Code Quality & Modernisation

| Tool | What it does | MCP tools exposed |
|---|---|---|
| `code-modernizer` | AST-based JS/JSX → TypeScript conversion, PropTypes → interfaces | 1 |
| `refactor-executor` | Execute refactor plans safely — move/rename/split, update imports, validate build, rollback | 10 |
| `typescript-enforcer` | Scan for `any` types, unsafe casts, missing modifiers — 7 rules, scored 0–10 | 4 |
| `accessibility-checker` | WCAG 2.1 audit — alt text, label associations, ARIA roles, keyboard navigation | 3 |
| `generate-tests` | Analyze a TypeScript/React source file and generate a Vitest test suite | 2 |
| `quality-pipeline` | 5-stage audit (tests · types · perf · a11y · design tokens) graded A–F | 2 |
| `render-analyzer` | Detect unnecessary re-renders, missing memo, inline objects/functions | 3 |
| `performance-audit` | Memory leaks, heavy imports, unoptimized images, deep nesting | 3 |
| `test-gap-analyzer` | Find unimplemented functions, uncovered branches, missing edge cases | 3 |
| `enforce-design-tokens` | Flag hardcoded colors/spacing/radii/shadows, suggest tokens, grade A–F | 3 |
| `test-data-factory` | `FieldSchema` → typed fixture factory (makeX/makeXs + overrides) for tests/stories | 1 |
| `fix-failing-tests` | Run the suite, classify failures by root cause, generate targeted fixes | 3 |
| `legacy-analyzer` | 22-tool health audit for any React/Next.js/Remix app — scores 0–100, migration hints | 22 |

### Monorepo & Infrastructure

| Tool | What it does | MCP tools exposed |
|---|---|---|
| `dep-auditor` | Unused deps, duplicate versions, circular imports, bundle impact analysis | 4 |
| `monorepo-manager` | Workspace listing, dependency graph, health check, shared dep finder | 6 |
| `lighthouse-runner` | Static HTML audit — meta tags, a11y, OG/Twitter cards, canonical, JSON-LD | 4 |
| `json-viewer` | Generate an interactive HTML JSON viewer — collapsible, searchable, dark/light | 3 |

### CRUD Factory

One JSON API sample (or OpenAPI schema) fans out into a full, typed CRUD feature. Every generator keys off the shared `FieldSchema` contract, so the pieces compose.

| Tool | What it does | MCP tools exposed |
|---|---|---|
| `infer-fields` | JSON sample / OpenAPI → typed `FieldSchema` (types, FK relations, table/form defaults) | 1 |
| `zod-schema-generator` | `FieldSchema` → Zod schema + inferred TS type | 1 |
| `api-client-generator` | `FieldSchema` → RTK Query slice **or** TanStack Query hooks, with cache tags | 1 |
| `form-generator` | `FieldSchema` → React Hook Form + Zod form (create / edit) | 1 |
| `table-generator` | `FieldSchema` → TanStack Table (sort / filter / paginate) | 1 |
| `detail-generator` | `FieldSchema` → typed detail view + delete action | 1 |
| `crud-composer` | Wire the pieces into routes — React Router 7 or Next App Router | 1 |
| `msw-mock-generator` | `FieldSchema` → MSW handlers + seed data, so the generated CRUD runs against a mock API | 1 |
| `workflow-runner` | Run `schema_to_feature` end-to-end, gated by `review-gate` — returns files + journal + A–F grade | 1 |
| `e2e-generator` | `FieldSchema` → Playwright CRUD flow spec (create→edit→delete + a11y) | 1 |
| `playwright-scaffolder` | Scaffold the Playwright harness — config, fixtures, base POM, auth setup | 1 |
| `visual-regression-setup` | Playwright toHaveScreenshot specs for routes/stories — catch CSS drift | 1 |
| `review-gate` | Static A–F quality gate for generated/changed code (a11y, tokens, smells, stubs) | 1 |

### Boilerplate

| Tool | What it does | MCP tools exposed |
|---|---|---|
| `barrel-generator` | Generate an index.ts barrel re-exporting a folder — no more drifting export lists | 1 |
| `type-from-json` | JSON sample → plain TS interfaces (nested objects → their own interfaces) | 1 |
| `zustand-store-generator` | State shape → typed Zustand store (setters, reset, persist/devtools) | 1 |
| `svg-to-component` | Raw SVG → typed React component (SVGProps, currentColor) — SVGR-grade | 1 |
| `env-config-generator` | Zod-validated typed env module (Vite/Next) — fail fast on missing/bad vars | 1 |

### Meta

| Tool | What it does | MCP tools exposed |
|---|---|---|
| `mcp-tool-factory` | Scaffold + wire + verify new MCP tools in this package — the executable form of the mcp-server-builder skill | 3 |
| `mcp-tool-improviser` | Analyze + improve MCP tools across 7 dimensions — proposed diffs, apply, rollback | 4 |
| `docs-generator` | Generate a README (from an MCP tool) or an API reference (from a TS module + JSDoc) | 2 |

---

## Automation workflows

### 1 · Code Modernization
```
legacy-analyzer → code-modernizer → typescript-enforcer → generate-tests
```
Migrate a JS codebase to strict TypeScript with auto-generated test coverage.

### 2 · Component Quality Pipeline
```
component-factory → component-reviewer → accessibility-checker → storybook-generator
```
Generate a production-ready component, review it, fix a11y issues, and add full story coverage.

### 3 · Render Performance Audit
```
render-analyzer → performance-audit → quality-pipeline
```
Find unnecessary re-renders, memory leaks, and heavy imports — graded A–F.

### 4 · App Health Check
```
legacy-analyzer [analyze-legacy-app] → component-reviewer → generate-tests
```
Full health score (0–100) with prioritized migration hints, then fix the top issues.

### 5 · Dependency Health
```
dep-auditor [unused] → dep-auditor [duplicates] → dep-auditor [bundle-impact] → monorepo-manager
```
Audit and clean up a monorepo's dependency graph end-to-end.

---

## How MCP works

```
Claude Desktop / Cline / Cursor
        │
        │ JSON-RPC over stdio
        ▼
   MCP Server (e.g. typescript-enforcer)
        │
        ▼
   Tool handlers (your code)
```

Each server in this repo extends `McpServerBase` from `tools/shared/` — an abstract class that handles transport, routing, and error formatting. Adding a new tool is ~50 lines.

```typescript
import { McpServerBase } from '@mcp-showcase/shared';

class MyTool extends McpServerBase {
  constructor() {
    super({ name: 'my-tool', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool('do_thing', 'Does a thing', {
      type: 'object',
      properties: { path: { type: 'string', description: 'Target path' } },
      required: ['path'],
    }, async (args) => {
      const { path } = args as { path: string };
      return this.success({ result: `Processed ${path}` });
    });
  }
}

new MyTool().run();
```

---

## Run from source (contributors)

Prefer npm for everyday use (see [Install](#install)). Clone only to hack on the tools or run the showcase UI:

```sh
git clone https://github.com/Nishant-Chaudhary5338/mcp-toolkit.git
cd mcp-toolkit
npm install
npm run build
npm test          # run the full suite across all tools
npm run dev       # server on :3002, client on :5173
```

### Point Claude Desktop at a local build

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "component-factory": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/component-factory/build/index.js"]
    },
    "component-reviewer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/component-reviewer/build/index.js"]
    },
    "component-fixer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/component-fixer/build/index.js"]
    },
    "storybook-generator": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/storybook-generator/build/index.js"]
    },
    "render-analyzer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/render-analyzer/build/index.js"]
    },
    "performance-audit": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/performance-audit/build/index.js"]
    },
    "legacy-analyzer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/legacy-analyzer/build/index.js"]
    },
    "test-gap-analyzer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/test-gap-analyzer/build/index.js"]
    },
    "lighthouse-runner": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/lighthouse-runner/build/index.js"]
    },
    "dep-auditor": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/dep-auditor/build/index.js"]
    },
    "accessibility-checker": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/accessibility-checker/build/index.js"]
    },
    "generate-tests": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/generate-tests/build/index.js"]
    },
    "typescript-enforcer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/typescript-enforcer/build/index.js"]
    },
    "code-modernizer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/code-modernizer/build/index.js"]
    },
    "quality-pipeline": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/quality-pipeline/build/index.js"]
    },
    "monorepo-manager": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/monorepo-manager/build/index.js"]
    },
    "json-viewer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/json-viewer/build/index.js"]
    }
  }
}
```

### Use as a CLI / in CI

Every tool's `build/index.js` has a `#!/usr/bin/env node` shebang and is `chmod +x` — pipe a JSON-RPC message to it on stdin and it writes the result to stdout.

```sh
# Analyze a full React/Next.js/Vite app — health score 0–100 + migration hints
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze-legacy-app","arguments":{"path":"/path/to/app"}}}' \
  | node tools/legacy-analyzer/build/index.js

# Detect unnecessary re-renders (missing memo, inline objects)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"detect_rerenders","arguments":{"path":"src/components"}}}' \
  | node tools/render-analyzer/build/index.js

# Audit for memory leaks and heavy imports
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"audit_bundle","arguments":{"path":"src"}}}' \
  | node tools/performance-audit/build/index.js

# Review a component — grade A+ to F
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"review","arguments":{"path":"src/components/Button.tsx"}}}' \
  | node tools/component-reviewer/build/index.js

# Auto-fix a component
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fix","arguments":{"path":"src/components/Button.tsx"}}}' \
  | node tools/component-fixer/build/index.js

# Find untested exports
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_test_gaps","arguments":{"path":"src"}}}' \
  | node tools/test-gap-analyzer/build/index.js

# Generate Storybook stories for all components in a directory
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate_stories","arguments":{"path":"src/components"}}}' \
  | node tools/storybook-generator/build/index.js

# Audit an HTML file — SEO, a11y, OG tags, canonical
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"static_audit","arguments":{"path":"public/index.html"}}}' \
  | node tools/lighthouse-runner/build/index.js

# Run a WCAG audit
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_accessibility","arguments":{"path":"src/components"}}}' \
  | node tools/accessibility-checker/build/index.js

# Scan for TypeScript violations
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"scan_directory","arguments":{"path":"src"}}}' \
  | node tools/typescript-enforcer/build/index.js

# Find unused and outdated dependencies
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_unused_deps","arguments":{"root":"."}}}' \
  | node tools/dep-auditor/build/index.js
```

#### List a tool's available commands

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node tools/legacy-analyzer/build/index.js
```

---

## Testing

Every tool has a co-located Vitest suite covering its core logic directly — no MCP transport required — plus tests for the dashboard renderers and per-tool report mappers.

```sh
npm test                                    # all tools
npm run test -w tools/legacy-analyzer      # single tool
```

CI runs on every push and PR against Node 20 and 22.

---

## Architecture

```
tools/
  shared/                McpServerBase, ToolRegistry, shared types
  component-factory/     41 shadcn/ui templates
  component-reviewer/    Review rules engine (7 categories)
  component-fixer/       Fix strategies per issue type
  storybook-generator/   Story generator (Default, variants, play functions)
  render-analyzer/       Re-render profile + memo checker
  performance-audit/     Memory leak + heavy import detector
  legacy-analyzer/       22-tool analysis engine + health scorer
  test-gap-analyzer/     Export extractor + edge case detector
  lighthouse-runner/     Static HTML auditor
  code-modernizer/       AST-based TS conversion
  quality-pipeline/      5-stage grading system
  dep-auditor/           Dependency graph analysis
  accessibility-checker/ WCAG rule engine (9 rules)
  generate-tests/        Source analyzer + test generator
  typescript-enforcer/   7-rule type safety scanner
  monorepo-manager/      Workspace operations
  json-viewer/           HTML generation

server/                  Express bridge — spawns tools as child processes
client/                  React 19 SPA — tool catalog and live demos
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — how to scaffold a new tool, write tests, and open a PR.

---

## Stack

TypeScript strict · Node.js · MCP SDK 1.12 · Vitest · React 19 · Vite · Tailwind CSS · Express

---

## Built by

**Nishant Chaudhary** — Senior Frontend Engineer  
nishantchaudhary.dev@gmail.com

**Also see:** [dashcraft](https://github.com/Nishant-Chaudhary5338/dashcraft) · [react-present](https://github.com/Nishant-Chaudhary5338/react-present) · [ai-builder](https://github.com/Nishant-Chaudhary5338/ai-builder)

MIT License
