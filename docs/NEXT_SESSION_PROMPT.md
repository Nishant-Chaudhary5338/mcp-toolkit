# Next-session kickoff prompt

Paste the block below as your first message next session (after restarting so the code-graph MCP loads).

---

We're building the CRUD/forms/tables automation tools into the published `mcp-react-toolkit` npm package. Read `docs/CRUD_AUTOMATION_PLAN.md` fully before doing anything — §0 (mandated method), §3.5 (7-step ship checklist), §4 (build waves) and §8 (locked decisions) are the contract. Also check MEMORY.md pointers: `project_crud_factory`, `reference_mcp_toolkit_dogfood_method`.

Rules for this whole project (do not deviate):
1. Build every tool by invoking my `mcp-server-builder` skill. Harden every finished tool with `mcp-tool-improviser`. Navigate the codebase with the `code-graph-indexer` MCP (graph queries, not grep). If either build-tool falls short, improve it — that's the dogfood contract.
2. Core-first: all logic in `src/core.ts` (pure, testable, workflow-composable); `index.ts` is only the McpServerBase shell.
3. Wire each tool fully into `mcp-react-toolkit` (workspaces → build/test scripts → bin/cli.mjs → client tools.ts → docs → version). A tool isn't done until all 7 steps pass and its Vitest suite is green.
4. Locked decisions: dataLayer = arg `'rtk'|'tanstack'` (both); router = arg `'rr7'|'next'` (both); publish into existing `mcp-react-toolkit` (no new package).
5. Precision bar: generated code must typecheck under TS strict, detect the target repo's stack (never hardcode), and the tool reports failure honestly if it can't. Reuse/extend `@mcp-showcase/shared` projectContext.

Start with Wave 1, tool 1: **`infer-fields`**. Harvest the logic from `Nishant-Chaudhary5338/MicroFrontend/devtools/generators/infer.js` (JSON/OpenAPI → typed FieldSchema; email/date/password/textarea/select/enum detection; unwraps data/items/results envelopes; skips id/createdAt). Upgrade it: add relation/FK detection and OpenAPI `$ref` resolution. Output the `FieldSchema` contract defined in the plan doc §3. Build it core-first, wire it in, test it, run it through the improviser, re-index, and show me the result before moving to tool 2.

First, confirm the code-graph MCP is live (list its tools) and give me a one-paragraph plan for `infer-fields` for my OK. Then build.

---

## Quick context (what exists)
- **Published:** `mcp-react-toolkit` v1.4.0, 17 tools, monorepo of per-tool stdio MCP servers extending `McpServerBase` (`@mcp-showcase/shared`).
- **To build:** the CRUD factory — Wave 1 infer-fields/zod-schema-generator/api-client-generator → Wave 2 form/table/detail generators → Wave 3 crud-composer/review-gate → Wave 4 workflow-runner (see plan §4).
- **Harvest source:** `MicroFrontend/devtools/generators` (infer.js, form/list/detail/crud/tests templates, review.js A–F grader) — proven logic, hardcoded plumbing; harvest logic, upgrade to RTK/TanStack + config-discovery + gates + rollback.
- **15 tools already exist in my-turborepo/tools** but are unshipped (incl. mcp-tool-improviser itself) — port them into the package over time too.
- **Deferred:** MFE / Module Federation orchestration — not now.

## Before you build (session-start checklist)
1. Restart done? Confirm `code-graph` MCP tools are available. If not, re-index: `npx code-graph-indexer index --root .` and query via CLI.
2. Read `docs/CRUD_AUTOMATION_PLAN.md`.
3. Confirm `mcp-tool-improviser` still builds (`my-turborepo/tools/mcp-tool-improviser`).
