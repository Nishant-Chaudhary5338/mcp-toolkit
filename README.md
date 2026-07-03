# mcp-toolkit

MCP servers for React + TypeScript development automation. Works with Claude Desktop, Cline, Cursor — and as plain CLI scripts — one protocol, zero duplication.

[![npm](https://img.shields.io/npm/v/mcp-react-toolkit?color=cb3837&logo=npm)](https://www.npmjs.com/package/mcp-react-toolkit)
[![CI](https://github.com/Nishant-Chaudhary5338/mcp-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Nishant-Chaudhary5338/mcp-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.12.0-blue)](https://github.com/modelcontextprotocol/typescript-sdk)

59 tools across 9 categories — component scaffolding, code quality, a full CRUD-feature factory, CRA→Vite migration, and more. Every tool ships as its own MCP server, built and tested independently.

---

## Why this exists — the token math

Here's the thing nobody tells you when you start building agentic workflows: the loop itself is what's expensive, not the model. An agent working without any composed tools does everything the slow way — read a file, think, write a file, read it back to check its own work, repeat — and every single one of those turns re-sends the whole conversation so far as input tokens. By the time you're 20 steps into a real multi-file task, that resent context alone can be running 50K+ tokens per call. It adds up fast, and it's not really about which model you're using.

I didn't just take that on faith — a few sources back it up with real numbers. [LeanOps measured](https://leanopstech.com/blog/agentic-ai-cost-runaway-token-budget-2026/) agent loops running about 3.2× the tokens of a single direct call at 5 steps, ~30× at 50 steps, and past 100× once you're deep into a typical build-and-debug session — because re-sent context is roughly 62% of the bill. [Vantage found](https://www.vantage.sh/blog/agentic-coding-costs) similar: real agentic sessions run an input-to-output ratio around 25:1 (a direct call is closer to 1:1), with a 50-turn session routinely hitting a million input tokens, and non-agentic usage on comparable work costing something like 200× less per interaction on the same team. And a [recent arXiv paper on agentic tokenomics](https://arxiv.org/html/2601.14470v1) puts agentic tasks at roughly 1000× the tokens of single-turn work, with up to 30× variance run to run on the exact same task — so it's not just expensive, it's unpredictable.

That's the problem this toolkit's composed tools are built to get rid of. `workflow-runner`'s `schema_to_feature` and `cra-to-vite` don't add one more tool call into an agent's existing loop — they replace what would otherwise be 7 or 8 separate read/write/verify turns with a single in-process call that runs the whole generator or migration pipeline and hands back the finished result. That's the "50-turn loop collapses into 1 call" shape the research above says saves 10–100×, which is a very different thing from just bolting one extra tool onto an unchanged loop (that only gets you the 20–40% range).

To keep myself honest, I also ran a real, measured benchmark rather than just trusting the theory — `ax-benchmark`, 6 tasks, `claude -p` running headless, three arms (agent alone, agent with one MCP tool call added into its loop, and the tool called directly with no agent at all). This is a conservative baseline on purpose, since it only tests adding a single tool call into an otherwise unchanged loop, not the deeper pipeline collapse described above:

| | Agent alone | Agent + one MCP tool | Tool called directly |
|---|---|---|---|
| Analysis tasks (review, a11y, legacy-code) | baseline | ~41% lower cost | ~100% free, ~15× faster (when in scope) |
| All 6 tasks, blended | baseline | ~19% lower cost | — |
| New code (component, tests) | baseline | roughly cost-neutral | not applicable to novel work |

Two things worth being upfront about: cost is the fair metric here, not wall-time — the agent-alone arm ran headless with no shell access and over-explored on open-ended tasks, which inflated its time without touching its actual cost. And on small, novel, single-file work, the overhead of the tool's structured output can offset what it saves — the real win shows up on repetitive, mechanical, multi-file work, which also happens to be exactly where the multi-turn-loop tax above hits hardest.

---

## Install

Published on npm as [`mcp-react-toolkit`](https://www.npmjs.com/package/mcp-react-toolkit). No clone or build required:

```bash
npx mcp-react-toolkit --list            # list all 59 tools
npx mcp-react-toolkit legacy-analyzer   # run one as an MCP server (stdio)
```

Add it to Claude Desktop / Cursor / Cline:

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "legacy-analyzer": { "command": "npx", "args": ["-y", "mcp-react-toolkit", "legacy-analyzer"] }
  }
}
```

Swap in any tool name from `npx mcp-react-toolkit --list`. Restart your client and the tool appears.

---

## Interactive dashboards

Most MCP tools return raw JSON. These return that JSON **plus an interactive HTML dashboard** — health score, sortable issue triage, light/dark toggle, and one-click fix actions that call other tools in the toolkit. One self-contained artifact, no server, no external requests:

| Where you run it | What you get |
|---|---|
| Claude Desktop (MCP Apps) | Renders **inline in the conversation** (sandboxed iframe) |
| Claude Code · Cursor · CLI | JSON plus a clickable `file://` link to the same dashboard |
| Any browser | The same HTML, standalone |

Analysis tools (`legacy-analyzer`, `component-reviewer`, `dep-auditor`, etc.) get an audit view — grade, category cards, filterable issue table. Generators (`component-factory`, `code-modernizer`, etc.) get a result view — files created/changed, diffs, follow-ups. Powered by the internal `@mcp-showcase/ui-kit` package: dependency-free, ~30 KB per report.

---

## Tools

### Component Development

| Tool | What it does |
|---|---|
| `component-factory` | Scaffold React components from 41 shadcn/ui templates — with tests + Storybook |
| `component-reviewer` | Audit TypeScript errors, a11y issues, test coverage — graded A+ to F |
| `component-fixer` | Auto-fix broken imports, missing deps, inline style refactors |
| `component-improver` | Extend a component with variants, comprehensive stories, and edge-case tests |
| `storybook-generator` | Auto-generate Storybook stories — Default, variants, sizes, callbacks, play functions |

### Code Quality & Modernisation

| Tool | What it does |
|---|---|
| `typescript-enforcer` | Scan for `any` types, unsafe casts, missing modifiers — 7 rules, scored 0–10 |
| `accessibility-checker` | WCAG 2.1 audit — alt text, label associations, ARIA roles, keyboard navigation |
| `a11y-autofixer` | Apply safe a11y fixes (img alt, blank rel, htmlFor, tabIndex) |
| `quality-pipeline` | 5-stage audit (tests · types · perf · a11y · design tokens), graded A–F |
| `review-gate` | Static A–F quality gate for generated/changed code |
| `enforce-design-tokens` | Flag hardcoded colors/spacing/radii/shadows, suggest tokens, grade A–F |
| `render-analyzer` | Detect unnecessary re-renders, missing memo, inline objects/functions |
| `performance-audit` | Memory leaks, heavy imports, unoptimized images, deep nesting |
| `bundle-budget-guard` | Gate gzipped asset sizes against per-pattern budgets — fail CI on regressions |
| `code-modernizer` | AST-based JS/JSX → TypeScript conversion, PropTypes → interfaces |
| `react-compiler-migrator` | Flag redundant useMemo/useCallback/memo for the React 19 Compiler |
| `codemod-runner` | Generic regex codemod engine + named built-ins; dry-run by default |
| `refactor-executor` | Execute refactor plans safely — move/rename/split, update imports, rollback |
| `redux-state-analyzer` | Audit Redux for anti-patterns (selectors, mutations, RTK Query migration hints) |
| `api-contract-differ` | Diff two API snapshots → breaking vs additive changes — CI gate against breaks |
| `i18n-extractor` | Scan JSX for hardcoded strings → i18n keys + message catalog |
| `generate-tests` | Analyze a TS/React source file and generate a Vitest test suite |
| `test-gap-analyzer` | Find unimplemented functions, uncovered branches, missing edge cases |
| `test-data-factory` | `FieldSchema` → typed fixture factory for tests/stories |
| `fix-failing-tests` | Run the suite, classify failures by root cause, generate targeted fixes |
| `legacy-analyzer` | 22-tool health audit for any React/Next.js/Remix app — scores 0–100, migration hints |

### Monorepo & Infrastructure

| Tool | What it does |
|---|---|
| `dep-auditor` | Unused deps, duplicate versions, circular imports, bundle impact analysis |
| `monorepo-manager` | Workspace listing, dependency graph, health check, shared dep finder |
| `lighthouse-runner` | Static HTML audit — meta tags, a11y, OG/Twitter cards, canonical, JSON-LD |
| `json-viewer` | Interactive HTML JSON viewer — collapsible, searchable, dark/light |

### CRUD Factory

One JSON API sample (or OpenAPI schema) fans out into a full, typed CRUD feature. Every generator keys off the shared `FieldSchema` contract, so the pieces compose.

| Tool | What it does |
|---|---|
| `infer-fields` | JSON sample / OpenAPI → typed `FieldSchema` (types, FK relations, table/form defaults) |
| `zod-schema-generator` | `FieldSchema` → Zod schema + inferred TS type |
| `api-client-generator` | `FieldSchema` → RTK Query slice **or** TanStack Query hooks, with cache tags |
| `form-generator` | `FieldSchema` → React Hook Form + Zod form (create / edit) |
| `table-generator` | `FieldSchema` → TanStack Table (sort / filter / paginate) |
| `detail-generator` | `FieldSchema` → typed detail view + delete action |
| `crud-composer` | Wire the pieces into routes — React Router 7 or Next App Router |
| `form-wizard-generator` | `FieldSchema` → multi-step RHF+Zod wizard with per-step validation |
| `msw-mock-generator` | `FieldSchema` → MSW handlers + seed data, so the feature runs against a mock API |
| `workflow-runner` | Runs the whole chain end-to-end, gated by `review-gate` — files + journal + A–F grade |
| `e2e-generator` | `FieldSchema` → Playwright CRUD flow spec (create→edit→delete + a11y) |
| `playwright-scaffolder` | Scaffold the Playwright harness — config, fixtures, base POM, auth setup |
| `visual-regression-setup` | Playwright `toHaveScreenshot` specs for routes/stories — catch CSS drift |

### CRA → Vite

Migrate a Create React App project to Vite: analyze → plan → scaffold → migrate → verify.

| Tool | What it does |
|---|---|
| `cra-to-vite` | **Orchestrator** — runs the six tools below in sequence, one call, graded report |
| `craconfig-analyzer` | Deep CRA config inspection (react-scripts, env, proxy, jest, browserslist, SVG) |
| `dependency-remapper` | CRA deps → Vite plan (remove/add with versions + unmapped) |
| `env-var-migrator` | `REACT_APP_*` → `import.meta.env.VITE_*`, in source and `.env` files |
| `jest-to-vitest-migrator` | `jest.*` → `vi.*`, adds the right imports, flags manual-review cases |
| `vite-project-scaffolder` | Generates `vite.config.ts`, `main.tsx`, strict tsconfig, a Vitest block |
| `webpack-config-translator` | Best-effort webpack/CRACO → Vite translation + manual-review list |

### Boilerplate

| Tool | What it does |
|---|---|
| `barrel-generator` | Generate an `index.ts` barrel re-exporting a folder — no drifting export lists |
| `type-from-json` | JSON sample → plain TS interfaces (nested objects become their own interfaces) |
| `zustand-store-generator` | State shape → typed Zustand store (setters, reset, persist/devtools) |
| `svg-to-component` | Raw SVG → typed React component (SVGProps, currentColor) — SVGR-grade |
| `env-config-generator` | Zod-validated typed env module (Vite/Next) — fail fast on missing/bad vars |
| `states-scaffolder` | Loading/empty/error state components + a switch wrapper for a data view |

### Meta

| Tool | What it does |
|---|---|
| `mcp-tool-factory` | Scaffold + wire + verify new MCP tools in this package |
| `mcp-tool-improviser` | Analyze + improve MCP tools across 7 dimensions — proposed diffs, apply, rollback |
| `docs-generator` | Generate a README (from an MCP tool) or an API reference (from a TS module + JSDoc) |

---

## Automation workflows

Chain tools together for common tasks:

| Workflow | Chain |
|---|---|
| Code Modernization | `legacy-analyzer → code-modernizer → typescript-enforcer → generate-tests` |
| Component Quality Pipeline | `component-factory → component-reviewer → accessibility-checker → storybook-generator` |
| Render Performance Audit | `render-analyzer → performance-audit → quality-pipeline` |
| App Health Check | `legacy-analyzer → component-reviewer → generate-tests` |
| Dependency Health | `dep-auditor [unused → duplicates → bundle-impact] → monorepo-manager` |
| Full CRUD feature | `workflow-runner` (composes the whole CRUD Factory chain in one call) |
| CRA → Vite migration | `cra-to-vite` (composes the whole CRA→Vite chain in one call) |

---

## How MCP works

```
Claude Desktop / Cline / Cursor
        │  JSON-RPC over stdio
        ▼
   MCP Server (e.g. typescript-enforcer)
        │
        ▼
   Tool handlers (your code)
```

Each server extends `McpServerBase` from `tools/shared/` — handles transport, routing, and error formatting. Adding a new tool is ~50 lines:

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

Point Claude Desktop at a local build the same way as [Install](#install), swapping `npx -y mcp-react-toolkit <name>` for `node /path/to/mcp-toolkit/tools/<name>/build/index.js`.

### Use as a CLI / in CI

Every tool's `build/index.js` has a `#!/usr/bin/env node` shebang — pipe a JSON-RPC message to it on stdin:

```sh
# Health score + migration hints for a full app
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze-legacy-app","arguments":{"path":"/path/to/app"}}}' \
  | node tools/legacy-analyzer/build/index.js

# Review a component — grade A+ to F
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"review","arguments":{"path":"src/components/Button.tsx"}}}' \
  | node tools/component-reviewer/build/index.js

# List a tool's available commands
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node tools/legacy-analyzer/build/index.js
```

---

## Testing

Every tool has a co-located Vitest suite covering its core logic directly — no MCP transport required.

```sh
npm test                              # all tools
npm run test -w tools/legacy-analyzer # single tool
```

CI runs on every push and PR against Node 20 and 22.

---

## Companion package

[`code-graph-indexer`](https://www.npmjs.com/package/code-graph-indexer) — indexes any TS/React/Next.js repo into a queryable code graph (files, components, functions, and the edges between them) and answers structural questions: who calls this, blast radius, dead code, semantic search. Same family, separate package.

```bash
npx code-graph-indexer ui --root .
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — how to scaffold a new tool, write tests, and open a PR.

## Stack

TypeScript strict · Node.js · MCP SDK 1.12 · Vitest · React 19 · Vite · Tailwind CSS · Express

## Built by

**Nishant Chaudhary** — Senior Frontend Engineer · nishantchaudhary.dev@gmail.com

Also see: [dashcraft](https://github.com/Nishant-Chaudhary5338/dashcraft) · [react-present](https://github.com/Nishant-Chaudhary5338/react-present) · [ai-builder](https://github.com/Nishant-Chaudhary5338/ai-builder)

MIT License
