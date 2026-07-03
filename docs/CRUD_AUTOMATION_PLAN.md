# CRUD / Forms / Tables Automation — Build Plan

> **Goal:** Automate the frontend routine work — building **CRUD apps, forms, and data tables with API integration** — as a set of **modular, composable MCP tools**, then chain them into production-grade workflows. Everything here is built **with the mcp-builder tool** (the `mcp-server-builder` skill).
>
> **Status:** Planning. MFE / Module-Federation orchestration is **explicitly out of scope for now** — this focuses purely on the CRUD/form/table feature-factory.
>
> **Stack target:** React 19 · TypeScript (strict) · Vite / Next 15 · RTK Query · React Hook Form + Zod · TanStack Table · Tailwind v4 + Radix.

---

## 0. Current state & mandated build method

**Where we are (end of session 1 — 2026-07-03):** planning + tooling setup complete. **No CRUD tools built yet.** Next session builds Wave 1.

**Setup already done:**
- `code-graph-indexer` (user's own npm pkg v0.3.1) indexed this repo → `.code-graph/graph.json` (520 nodes / 1335 edges, gitignored). Registered as a project MCP server in `.mcp.json`. **Goes live after a session restart**; until then query via CLI.
- `mcp-tool-improviser` (my-turborepo, v2.0.0) verified building; tools: `analyze_tool`, `batch_analyze`, `apply_improvements`, `rollback`.
- `mcp-server-builder` skill hardened with toolkit-integration mode (Step 6), project-context bar (Step 7), dogfood loop (Step 8).

**Mandated method — every tool, no exceptions:**
> **Build** with the `mcp-server-builder` skill → **harden** with `mcp-tool-improviser` → **navigate** the codebase with `code-graph-indexer` (graph queries, not grep). Build **core-first** (`src/core.ts` pure logic + `index.ts` shell). Wire **fully into `mcp-react-toolkit`** (the 7-step definition of done, §3.5). If a build-tool falls short, **improve it** — that's the dogfood contract.

**CLI cheatsheet (works before MCP restart):**
```sh
npx code-graph-indexer index --root .                    # re-index after changes
npx code-graph-indexer query find-references --root . --json
npx code-graph-indexer query blast-radius --id <node-id> --root . --json
# improviser (from my-turborepo/tools/mcp-tool-improviser):
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node build/mcp-tool-improviser/src/index.js
```

## 1. The core idea

One input — **a JSON API sample or an OpenAPI snippet** — should fan out into a complete, typed, tested feature:

```
                         ┌─→ typed API client (RTK Query)
   JSON sample /         ├─→ Zod schema + TS types
   OpenAPI snippet  ──►  ├─→ Form page      (RHF + Zod)
   (infer fields)        ├─→ Table page     (TanStack, sort/filter/paginate)
                         ├─→ Detail page
                         ├─→ CRUD wiring    (list ↔ detail ↔ create ↔ edit)
                         ├─→ Vitest tests
                         └─→ review gate    (typecheck + a11y + grade A–F)
```

This is a **combination workflow**: many atomic tools, orchestrated. The primitives are the reusable MCP tools; the workflow is the routine that composes them.

**Three-tier model:**

| Tier | Name | Role | Example |
|------|------|------|---------|
| 1 | **Primitives** | Atomic MCP tools, do one thing | `component-factory`, `generate-tests` |
| 2 | **Generators** | Feature-shaped generators (schema → page) | `form-generator`, `table-generator` |
| 3 | **Workflows** | Named routines that compose tiers 1–2 with gates + rollback | `schema-to-feature` |

---

## 2. What we already have (inventory across repos)

### 2a. `mcp-toolkit` — published (`mcp-react-toolkit`, 17 tools)

`accessibility-checker` · `code-modernizer` · `component-factory` · `component-fixer` · `component-reviewer` · `dep-auditor` · `generate-tests` · `json-viewer` · `legacy-analyzer` · `lighthouse-runner` · `monorepo-manager` · `performance-audit` · `quality-pipeline` · `render-analyzer` · `storybook-generator` · `test-gap-analyzer` · `typescript-enforcer`

### 2b. `my-turborepo/tools` — 32 tools (the 17 above **+ 15 not yet published**)

| Tool | What it does | Relevance to CRUD factory |
|------|--------------|---------------------------|
| **component-improver** | Adds variants, stories, edge-case tests to a component | ✅ polish step |
| **refactor-executor** | Safely applies refactor plans (rename/split/extract) w/ rollback | ✅ modular rewire |
| **fix-failing-tests** | Root-causes + fixes failing tests | ✅ workflow self-heal |
| **enforce-design-tokens** | Replaces hardcoded colors/spacing with tokens | ✅ table/form styling gate |
| **analyze-ui-design** | Audits hierarchy, spacing, typography consistency | ✅ review gate |
| **config-manager** | Validates package.json / tsconfig / eslint consistency | ✅ scaffold guard |
| **utils-scaffolder** | Scaffolds hooks/utils in `@repo/utils` + tests | ✅ shared helpers |
| **ixd-generator** | Reads PDF/image design → React TSX layout | ➖ design-to-code (later) |
| **mcp-tool-improviser** | Meta-tool: improves other MCP servers (7 dimensions) | ✅ maintain the toolkit |
| **docs** | Generates README / API ref from source | ✅ ship the toolkit |
| **cli-wrappers** | Turns any MCP server into a CLI / CI command | ✅ run in pipelines |
| **analyze-ui-design**, **handoff-to-figma**, wdio-* | design / E2E | ➖ out of scope now |

> Note: `my-turborepo/tools/docs/tools-overview.md` is **stale** (lists 24, missing the wdio trio, ixd, utils-scaffolder, json-viewer). Refresh it when convenient.

### 2c. Harvest candidates — `MicroFrontend/devtools/generators` (proven, but trapped)

These already work end-to-end but are hardcoded to that MFE repo (`localhost:5001`, `apps/<id>`, `@repo/shared-ui`, raw `fetch`). **Harvest the logic, generalize the plumbing:**

| Source file | What it proves | Upgrade on harvest |
|-------------|----------------|--------------------|
| `generators/infer.js` | **Field inference** — JSON/OpenAPI → typed fields; detects email/date/password/textarea/select/enum; unwraps `data`/`items`/`results`/`records` envelopes; skips `id`/`createdAt`/… | Keep as-is — **highest-value primitive we own** |
| `templates/form.js` | RHF-less `AutoForm + Zod`; POST create + PUT edit (fetch record, prepopulate, `:id` swap) | → RHF + Zod + typed submit; RTK Query mutation |
| `templates/list.js` | TanStack `DataTable`, envelope-aware fetch | → sort/filter/paginate, RTK Query, empty/error/loading states |
| `templates/detail.js` | Field-mapped detail view, graceful `—` fallbacks | → typed, RTK Query `useGetXQuery` |
| `templates/crud.js` | Composes List + Detail + Create + Edit + routes | → the tier-3 `crud` workflow |
| `templates/tests.js` | Auto-detects fetch/navigate/form/params → generates matching Vitest mocks | → MSW-backed, RTK Query-aware |
| `review.js` | typecheck + a11y (`<img>` alt) + `any` + `console.log` → **letter grade A–F** | → the **gate** every workflow runs |

**Key upgrade across all of them:** move from **raw `fetch` + `localStorage` token + copy-paste** → **typed RTK Query slices + modular building blocks**, matching the daily stack.

---

## 3. Target: modular CRUD / forms / tables with API integration

"Modular" means every layer is independently generatable and swappable — you can regenerate the table without touching the form, swap the data layer from `fetch` to RTK Query without regenerating pages, etc.

```
┌─────────────────────────────────────────────────────────────┐
│  DATA CONTRACT   field-schema  (the single source of truth)  │  ← infer-fields
├─────────────────────────────────────────────────────────────┤
│  DATA LAYER      api-client-generator → RTK Query slice       │  ← typed endpoints + hooks + cache tags
│                  zod-schema-generator → schema + TS types     │
├─────────────────────────────────────────────────────────────┤
│  UI LAYER        form-generator   (RHF + Zod)                 │  ← create + edit
│                  table-generator  (TanStack, server/client)   │  ← sort/filter/paginate/select
│                  detail-generator (typed view)                │
├─────────────────────────────────────────────────────────────┤
│  WIRING          crud-composer    (routes + nav + links)      │  ← list ↔ detail ↔ create ↔ edit
├─────────────────────────────────────────────────────────────┤
│  QUALITY         generate-tests · review-gate · a11y · tokens │  ← every layer gated
└─────────────────────────────────────────────────────────────┘
```

### The shared data contract (`field-schema`)

Everything keys off one normalized schema so the layers stay decoupled:

```ts
interface FieldSchema {
  resource: string;                 // "article"
  baseEndpoint: string;             // "/api/articles"
  idKey: string;                    // "id"
  fields: Field[];
}
interface Field {
  name: string;                     // "publishedAt"
  label: string;                    // "Published At"
  type: 'text' | 'email' | 'password' | 'number' | 'boolean'
      | 'date' | 'textarea' | 'select' | 'relation';
  required: boolean;
  enumValues?: string[];            // for select
  relation?: { resource: string; labelKey: string };  // for FK
  table?: { show: boolean; sortable: boolean; filterable: boolean };
  form?:  { show: boolean; placeholder?: string };
}
```

`infer-fields` produces this from a JSON sample or OpenAPI. Every downstream generator consumes it. **This is the modularity contract.**

---

## 3.5. How the toolkit is actually built & shipped (the mold to match)

Every new tool ships into the **same `mcp-react-toolkit` npm package** (currently v1.4.0), following the exact pattern the 17 use. No new package.

**Per-tool anatomy** (`tools/<name>/`):
- `package.json` → name `@mcp-showcase/<name>`, `"type": "module"`, `main: build/index.js`, build script `tsc && chmod +x build/index.js`.
- `src/index.ts` → a class `extends McpServerBase` (from `@mcp-showcase/shared`), implements `registerTools()` calling `this.addTool(name, description, inputSchema, handler)` per action; ends with `new XServer().run()`.
- Returns via `this.success(data)`, `this.successWithUI(data, {uri, html})` (MCP Apps inline + `file://` dashboard via `@mcp-showcase/ui-kit`), or `this.error(e)`.
- `inputSchema` is **JSON Schema** (the low-level MCP `Server` + `ToolRegistry`, not the Zod `McpServer` wrapper the MFE repo used). Validate args inside the handler.
- Shared helpers live in `@mcp-showcase/shared`: `safeReadJson`, `isNextJsProject`, `projectContext.ts`. **Project-context detection is the known weak spot** (see dogfood findings) — every generator must detect stack/router/UI-kit robustly, not assume.

**Definition of done — a tool isn't "shipped" until all of these:**
1. `tools/<name>/` created, builds clean (`tsc`).
2. Added to root `package.json` → `workspaces`, `build` script, `test` script.
3. Added to `bin/cli.mjs` `TOOLS` array (this is what makes `npx mcp-react-toolkit <name>` work).
4. Vitest suite passes; behaviour-tested (each test fails without the code).
5. Added to `client/src/data/tools.ts` **only after the server exists** (avoid the past "fake tool" gap).
6. Run `mcp-tool-improviser` on it; refresh `README.md` count + `docs/tools-overview.md`.
7. Bump root `version`, update the `description` tool count, publish.

## 3.6. How automation workflows fit a per-server model

Each tool is its **own stdio MCP server** — they can't cheaply call each other as subprocesses. So workflows require one architectural move: **separate pure core from the server shell.**

```
tools/<name>/src/
  core.ts     ← pure functions:  inferFields(), generateForm(FieldSchema) → { code, filename }
  index.ts    ← McpServerBase shell that wraps core.ts as MCP tools
```

Then two composition paths, both supported:
- **Agent-driven (default):** the agent calls the atomic tools in sequence per a documented routine. Works today, no new runtime.
- **`workflow-runner` server:** one MCP server that **imports the pure `core.ts` functions directly** (same monorepo — no subprocess spawning) and chains them with gates + rollback + a run journal. This is why the pure-core split matters: it's what lets one tool orchestrate the others in-process.

**Action item for the existing 17:** as we touch them, extract a `core.ts` so they're workflow-composable. New tools are built core-first from day one.

## 4. The tools to build (with the mcp-builder tool)

Build order is dependency-first. Each is a standalone MCP server scaffolded via the `mcp-server-builder` skill, following the toolkit's existing `_shared` base + Zod-validated args conventions.

### Wave 1 — Data foundation (unblocks everything)

| # | Tool | Actions | Notes / harvest |
|---|------|---------|-----------------|
| 1 | **infer-fields** | `infer_fields(input)` → `FieldSchema` | **Harvest** `infer.js`. Add relation/FK detection + OpenAPI `$ref` resolution. |
| 2 | **zod-schema-generator** | `generate_schema(FieldSchema)` → Zod + inferred TS types | New. Enforces "Zod at every boundary". |
| 3 | **api-client-generator** | `generate_rtk_slice(FieldSchema)` → RTK Query api slice (list/get/create/update/delete) + typed hooks + cache tags | New — the biggest gap vs the MFE repo's raw `fetch`. |

### Wave 2 — UI generators (depend on Wave 1)

| # | Tool | Actions | Notes / harvest |
|---|------|---------|-----------------|
| 4 | **form-generator** | `generate_form(FieldSchema, mode: create\|edit)` → RHF + Zod form, typed submit, error/loading | **Harvest** `form.js`; swap AutoForm→RHF, fetch→RTK mutation. |
| 5 | **table-generator** | `generate_table(FieldSchema, {mode: client\|server})` → TanStack table: sorting, column filters, pagination, row-select, empty/error/skeleton | **Harvest** `list.js`; add sort/filter/paginate. |
| 6 | **detail-generator** | `generate_detail(FieldSchema)` → typed detail view + edit/delete actions | **Harvest** `detail.js`. |

### Wave 3 — Composition + quality (depend on Waves 1–2)

| # | Tool | Actions | Notes / harvest |
|---|------|---------|-----------------|
| 7 | **crud-composer** | `generate_crud(FieldSchema)` → composes table + detail + create + edit + routes + nav links | **Harvest** `crud.js`; emit RR7/Next routes. |
| 8 | **review-gate** | `run_review(path)` → typecheck + a11y + tokens + `any`/`console.log` → **grade A–F** (blocking) | **Harvest** `review.js`; add `enforce-design-tokens` + `analyze-ui-design`. |
| 9 | **generate-tests** (extend existing) | MSW-backed, RTK-Query-aware component tests | Extend the published tool. |

### Wave 4 — The workflow runner (composes everything)

| # | Tool | Actions | Notes |
|---|------|---------|-------|
| 10 | **workflow-runner** | `run(routine, FieldSchema)` — executes a named routine step-by-step with **gates + rollback + a run journal** | New orchestration layer. Steps = the tools above. |

---

## 5. The composed workflows (routines)

Named, repo-agnostic routines the `workflow-runner` ships with. MFE routines intentionally omitted.

### `schema-to-feature` (the flagship)
```
infer-fields → zod-schema-generator → api-client-generator
            → table-generator → detail-generator → form-generator(create+edit)
            → crud-composer → generate-tests → review-gate(gate: grade ≥ B)
```
**Input:** a JSON sample. **Output:** a fully typed, tested, routed CRUD feature with RTK Query integration. Rollback if the gate fails.

### `add-table` / `add-form` (à la carte)
Single-layer routines for when you only want a table or a form against an existing schema — proves the modularity.

### `legacy-lift` (modernize existing CRUD)
```
legacy-analyzer(plan) → refactor-executor(apply, worktree-isolated)
            → code-modernizer → fix-failing-tests → review-gate
```
Converts hand-rolled `fetch` CRUD into the RTK Query + typed module shape. Rollback on grade < B.

### `pre-merge-gate` (CI, blocking)
```
quality-pipeline → typescript-enforcer → test-gap-analyzer
            → dep-auditor → review-gate → (emit pass/fail + PR comment)
```

---

## 6. Precision requirements (agents depend on this output being correct)

These tools run unattended — an agent invokes them to do real frontend work and trusts the result. That's the bar. The MFE generators prove the logic; bake these in when harvesting so the output is correct every time, on any repo:

- **No hardcoded plumbing** — discover workspace layout, package names, and API base from config (not `localhost:5001` / `@repo/shared-ui`).
- **Typed data layer** — RTK Query slices with cache tags, not raw `fetch` + `localStorage` tokens.
- **Idempotent + dry-run** — every generator previews a diff; safe to re-run without clobbering.
- **Rollback everywhere** — `refactor-executor` already has it; make it a workflow guarantee. Worktree-isolate parallel steps so they don't collide.
- **Gates, not warnings** — `review-gate`'s A–F grade **stops** the pipeline below threshold.
- **Run journal** — every run records: steps, files touched, grade, test result. The enterprise audit trail.
- **Modularity contract** — all layers key off the one `FieldSchema`; regenerate any layer without the others.

---

## 7. Build with the mcp-builder tool — how

Use the **`mcp-server-builder` skill** (a.k.a. the mcp-builder tool) to scaffold each server. For every tool:

1. **Scaffold** — invoke `mcp-server-builder` with the tool name, actions, and Zod arg schemas from §4.
2. **Conform** — match the toolkit's existing conventions: extend `tools/_shared` base, one action = one Zod-validated tool, explicit return types.
3. **Harvest** — port the corresponding `MicroFrontend/devtools/generators` logic (see §2c), upgrading plumbing per §6.
4. **Self-test** — run `generate-tests` + `review-gate` on the generator's own output.
5. **Register** — add to `client/src/data/tools.ts` (only after the server exists — avoid the "fake tool" gap noted in memory), refresh `docs/tools-overview.md`, add a CLI wrapper.
6. **Improve** — run `mcp-tool-improviser` on the finished server before publishing.

**Suggested sequencing:** Wave 1 first (unblocks all), then `table-generator` + `form-generator` (highest visible value), then `crud-composer` + `review-gate`, then `workflow-runner` last.

---

## 8. Decisions

**Locked (2026-07-03):**
- **Data layer:** ✅ **Both**, via a `dataLayer: 'rtk' | 'tanstack'` arg on `api-client-generator`, `form-generator`, `table-generator`, `detail-generator`. Generated code integrates with whichever is passed. Test matrix covers both.
- **Router:** ✅ **Both**, via a `router: 'rr7' | 'next'` arg on `crud-composer`. `rr7` emits `react-router-dom` routes; `next` emits `app/` segments with correct `'use client'` boundaries.
- **Publish target:** ✅ grow the existing **`mcp-react-toolkit`** package (same monorepo, same mold) — no new package.

**Still open:**
- **UI kit:** target the toolkit's own `ui-kit` / shadcn vs a configurable `@repo/*` import (lean: configurable with shadcn default).

---

_Last updated: 2026-07-03. Source of harvest logic: `Nishant-Chaudhary5338/MicroFrontend/devtools/generators`. MFE orchestration deferred._
