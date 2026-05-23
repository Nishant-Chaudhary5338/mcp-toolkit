# mcp-toolkit

MCP servers for React + TypeScript development automation. Works with Claude Desktop, Cline, Cursor — and as plain CLI scripts — one protocol, zero duplication.

[![CI](https://github.com/Nishant-Chaudhary5338/mcp-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Nishant-Chaudhary5338/mcp-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.12.0-blue)](https://github.com/modelcontextprotocol/typescript-sdk)
[![Tests](https://img.shields.io/badge/tests-134%20passing-brightgreen)](#testing)

---

## What's here

```
tools/      9 MCP server packages — each independently buildable and runnable
server/     Express bridge (port 3002) — proxies calls from the UI to MCP servers
client/     React 19 showcase SPA — tool catalog, workflow demos, animated flowcharts
```

---

## Tools

All 9 tools are production-ready: built, tested, and CI-verified on Node 20 + 22.

| Tool | What it does | MCP tools exposed |
|---|---|---|
| `component-factory` | Scaffold React components from 41 shadcn/ui templates — with tests + Storybook | 6 |
| `code-modernizer` | AST-based JS/JSX → TypeScript conversion, PropTypes → interfaces | 1 |
| `quality-pipeline` | 5-stage audit (tests · types · perf · a11y · design tokens) graded A–F | 2 |
| `json-viewer` | Generate an interactive HTML JSON viewer — collapsible, searchable, dark/light | 3 |
| `dep-auditor` | Unused deps, duplicate versions, circular imports, bundle impact analysis | 4 |
| `accessibility-checker` | WCAG 2.1 audit — alt text, label associations, ARIA roles, keyboard navigation | 3 |
| `generate-tests` | Analyze a TypeScript/React source file and generate a Vitest test suite | 2 |
| `typescript-enforcer` | Scan for `any` types, unsafe casts, missing modifiers — 7 rules, scored 0–10 | 4 |
| `monorepo-manager` | Workspace listing, dependency graph, health check, shared dep finder | 6 |

### Roadmap

| Tool | Description | Status |
|---|---|---|
| `render-analyzer` | React render profiling — detect unnecessary renders, missing memo | 📋 Planned |
| `storybook-generator` | Auto-generate Storybook stories for existing components | 📋 Planned |
| `legacy-analyzer` | Tech debt detection — anti-patterns, duplication, refactor plans | 📋 Planned |
| `test-gap-analyzer` | Find unimplemented functions, uncovered branches, missing edge cases | 📋 Planned |
| `performance-audit` | Bundle size analysis, memory leaks, slow component detection | 📋 Planned |
| `lighthouse-runner` | Web Vitals / Lighthouse audit via CLI | 📋 Planned |
| `component-reviewer` | Audit TypeScript errors, test coverage gaps, a11y issues | 📋 Planned |
| `component-fixer` | Auto-fix broken imports, missing dependencies, export corrections | 📋 Planned |

Want to implement one of these? See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Automation workflows

### 1 · Code Modernization
```
legacy-analyzer → code-modernizer → typescript-enforcer → generate-tests
```
Migrate a JS codebase to strict TypeScript with auto-generated test coverage.

### 2 · Dependency Health
```
dep-auditor [unused] → dep-auditor [duplicates] → dep-auditor [bundle-impact] → monorepo-manager
```
Audit and clean up a monorepo's dependency graph end-to-end.

### 3 · Component Pipeline
```
component-factory → accessibility-checker → quality-pipeline
```
Generate a production-ready component and verify it before shipping.

### 4 · Quality Audit
```
accessibility-checker → typescript-enforcer → quality-pipeline
```
Full code quality check — WCAG compliance, type safety score, overall grade.

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

## Run locally

```sh
git clone https://github.com/Nishant-Chaudhary5338/mcp-toolkit.git
cd mcp-toolkit
npm install
npm run build
npm test          # 134 tests across all 9 tools
npm run dev       # server on :3002, client on :5173
```

### Add to Claude Desktop

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "component-factory": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/component-factory/build/index.js"]
    },
    "code-modernizer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/code-modernizer/build/index.js"]
    },
    "quality-pipeline": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/quality-pipeline/build/index.js"]
    },
    "json-viewer": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/json-viewer/build/index.js"]
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
    "monorepo-manager": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/monorepo-manager/build/index.js"]
    }
  }
}
```

### Use as a CLI / in CI

```sh
# Scan a file for TypeScript issues
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"scan_file","arguments":{"path":"src/App.tsx"}}}' \
  | node tools/typescript-enforcer/build/index.js

# Run a full WCAG audit
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_accessibility","arguments":{"path":"src/components"}}}' \
  | node tools/accessibility-checker/build/index.js
```

---

## Testing

Each tool has a dedicated test file covering its core logic directly — no MCP transport required.

```sh
npm test                                    # all tools
npm run test -w tools/typescript-enforcer  # single tool
```

| Tool | Tests |
|---|---|
| json-viewer | 16 |
| quality-pipeline | 8 |
| component-factory | 6 |
| code-modernizer | 8 |
| dep-auditor | 15 |
| accessibility-checker | 15 |
| generate-tests | 14 |
| typescript-enforcer | 22 |
| monorepo-manager | 30 |

CI runs on every push and PR against Node 20 and 22.

---

## Architecture

```
tools/
  shared/                McpServerBase, ToolRegistry, shared types
  component-factory/     41 shadcn/ui templates
  code-modernizer/       AST-based TS conversion
  quality-pipeline/      5-stage grading system
  json-viewer/           HTML generation
  dep-auditor/           Dependency graph analysis
  accessibility-checker/ WCAG rule engine (9 rules)
  generate-tests/        Source analyzer + test generator
  typescript-enforcer/   7-rule type safety scanner
  monorepo-manager/      Workspace operations

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
