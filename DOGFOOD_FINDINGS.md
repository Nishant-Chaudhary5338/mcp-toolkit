# mcp-react-toolkit — Dogfood Findings & Fix Backlog

> **Purpose:** a single, agent-actionable backlog of real bugs and improvements found by *using the published-style build* (`npx mcp-react-toolkit <tool>` over MCP stdio) on real projects. Each entry names the tool + sub-tool, a concrete repro, root cause (file:line), and status. When a fix ships it's marked `✅ FIXED` — history is kept, not deleted.

**Last full dogfood pass: 2026-07-03.** Every tool was driven over real MCP stdio against real machine codebases — primarily **my-people** (Vite + React 19 + TS-strict, standalone, Tailwind v4, `@/` alias, `cn` at `src/lib/cn.ts`), **sentineldesk** (Next.js + React 19, Tailwind v4), **my-turborepo** (pnpm workspace, 57 pkgs), and the toolkit itself (npm workspaces). Findings were verified by reading the target source, not taken at face value. All P0/P1 bugs below were then fixed in `tools/<name>/src/` and re-verified against the same real code.

---

## 🟢 QA session 2 — non-functional sweep (perf, idempotency, Node compat) — ✅ FIXED + 1 CAUGHT-AND-REVERTED

### Perf on a large synthetic repo (item 1)

Generated a 10k-file synthetic repo and timed `legacy-analyzer`'s `analyze-legacy-app` against it. Two real O(n²) hotspots found and fixed:

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| N1 | 🟠 P1 | `legacy-analyzer` | `resolveImportPath` did an `allFiles.includes(candidate)` linear scan, up to 9× per call, called once per import statement across every file — on a 10k-file repo, up to ~90k comparisons per import. | ✅ FIXED — `toFileSet()` caches a `Set` per distinct `allFiles` array reference (`WeakMap`), turning each lookup O(1). No behavior change (`Set.has`/`Array.includes` are equivalent for exact-match lookups). |
| N2 | 🟠 P1 | `legacy-analyzer` (`detect-duplication`) | Compared every `(component, component)` pair unconditionally before checking `hooksMatch` — O(n²) file reads + tokenization. | ✅ FIXED — bucket components by their exact sorted hook-signature *first* (mathematically equivalent to the original set-equality check — two sets are equal iff their sorted-and-joined string forms are equal), then only compare within buckets. Turns it into O(Σ bucket_size²), cheap in practice. |

**One fix attempt was caught as incorrect and reverted before landing** — the process is worth recording because it's exactly the kind of mistake "looks like a valid optimization" can hide:

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| N3 | — | `legacy-analyzer` (`detect-anti-patterns`) | An initial fix for the same tight-coupling O(n²) hotspot restricted candidate pairs to resolved import-graph edges, reasoning "`calculateCoupling` can only score nonzero when an import edge exists." **That reasoning is false**: `calculateCoupling` does a raw substring check (`imp.source.includes(basename(other))`), which can be true with *no resolved edge at all* — e.g. a file importing `./formatter` (resolves to `formatter.ts`) scores nonzero coupling against an unrelated `format.ts`, since `'formatter'.includes('format')`. Confirmed with a standalone repro before touching anything, not just by reasoning about it — the "optimization" would have silently dropped real findings. | ❌ REVERTED — restored the full pairwise scan (correctness over speed for a diagnostic tool), and added an explicit `MAX_FILES_FOR_COUPLING_CHECK = 2000` guard that skips the check cleanly with a note on huge repos, instead of a shortcut that can silently produce a wrong answer. A regression test locks in the exact substring-without-resolved-edge scenario. |

Both `resolveImportPath`'s caching and `detect-duplication`'s bucketing were independently re-verified as correctness-preserving before being kept. Full `npm run build && npx vitest run` in `legacy-analyzer`: 44/44 pass (was 42, +2 new: a scaling regression test and the coupling-correctness regression test). Full monorepo `npm run build && npm test`: zero regressions.

### Output idempotency (item 1)

Ran `zod-schema-generator`, `table-generator`, and `legacy-analyzer` twice each on identical input and diffed output byte-for-byte. `zod-schema-generator` and `table-generator`: byte-identical. `legacy-analyzer`'s `analyze-legacy-app` report differs only in its own `summary.analysisDate` field (an intentional `new Date().toISOString()` report timestamp, documented as report metadata, not embedded into any generated code) — confirmed by stripping that one field and diffing the rest, which then matched exactly. No hidden non-determinism found.

### Node 20 vs Node 22 (item 1)

Full `npm run build && npm test` from the repo root under both Node 20.19.4 and Node 22.18.0 (via `nvm`): zero errors, zero failures under either version.

---

## 🟢 QA session 2 — duplicate-pascal fuzz, UX fixes, composition/chain testing — ✅ FIXED

### Duplicate `pascal()` fuzz (items 2, `QA_SESSION_2_BRIEF.md`)

Fuzzed each of the 5 tools flagged in session 1 as carrying a local `pascal()` duplicate, with adversarial input matching what each actually consumes (not generic garbage) — confirmed 4 were genuinely reachable and broke, 1 was not.

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| D1 | 🟠 P1 | `svg-to-component` | Local `pascal()` didn't sanitize punctuation/non-ASCII — `pascal("thing's-2.0!")` → `"Thing's2.0!"`, an invalid identifier, directly reachable via the free-text `name` tool-call argument. | ✅ FIXED — delegates to `@mcp-showcase/shared`'s `pascal()`, keeping the tool's own `"Icon"` empty-input fallback. Regression test added. |
| D2 | 🟠 P1 | `states-scaffolder` | Same bug, same reachability (`opts.name` is a free-text tool-call argument). | ✅ FIXED — swapped to the shared `pascal()` (fallback word `"Resource"` already matched, clean swap). Regression test added. |
| D3 | 🟠 P1 | `zustand-store-generator` | Same `pascal()` bug (`opts.name`), **plus** a separate, more severe issue: `state[].name` field names were interpolated as bare identifiers (interface keys, setter args, `set({ name })`) with **zero** sanitization — worse than the pascal bug, since there wasn't even an attempted fix. `{ name: "first name" }` produced `setFirst name: (first name: string) => void;` — broken on every line that used it. | ✅ FIXED — `pascal()` delegates to shared (custom `"Store"` fallback preserved); field names are now validated against a JS-identifier regex and the request is cleanly rejected if any fails (matching the `isFieldSchema` precedent from session 1 — reject rather than silently rewrite, since a rewritten name could mismatch what a hand-written call site expects). 2 regression tests added. |
| D4 | 🟡 P2 | `type-from-json` | Local `pascal()` stripped non-alphanumeric characters from the *tail* of each word only (never the first character) and had no leading-digit guard — `pascal("2fast2furious")` (a plausible numeric-prefixed JSON key) produced an invalid identifier. | ✅ FIXED — delegates to shared `pascal()` (custom `"Value"` fallback preserved). Regression test added. |
| — | — | `mcp-tool-factory` | Theoretical same-shape risk in its local `pascal()`. | ❌ NOT REACHABLE — `scaffold()` gates on `validateToolName()`'s kebab-case regex (`^[a-z][a-z0-9-]*$`) before `pascal()` is ever called on `spec.name`. Confirmed by reading the call graph; left as-is per the brief's explicit "don't fix without a measured failure" instruction. |

### Two logged UX inconsistencies (item 3)

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| U1 | 🟡 P2 | `dep-auditor` | `find_unused_deps` and `check_outdated` (and 2 other handlers sharing the same root-resolution line) silently returned `{success:true, packagesAudited:0, results:[]}` for a non-existent/empty root — indistinguishable from "audited 0 packages, found nothing to flag." | ✅ FIXED — extracted a shared `rootExistsError()` helper, called first in all 4 handlers; returns a clean `{success:false}` error instead. Regression tests added. |
| U2 | 🟡 P2 | `mcp-tool-improviser` | `analyze_tool`'s missing-path case threw a raw `Error`, bubbling past this tool's own handlers straight to `McpServerBase`'s transport catch — a valid but protocol-level `McpError`, inconsistent with every sibling handler's `{success:false}` shape. | ✅ FIXED — wrapped in try/catch, routed through `this.error()`. Server class exported for testability (matching the `component-factory` fix's pattern from session 1); regression test added. |

### Composition/chain testing (item 5)

Two integration scenarios not covered by session 1's single-tool matrix testing, run against real built tools over stdio:

1. **`review-gate` → `a11y-autofixer` → `review-gate` again**: a component with `<img src="/icon.png" />` (no `alt`) — pass 1 correctly flags 1 `a11y` error; `a11y-autofixer` adds `alt=""`; pass 2 on the fixed file returns grade `A`, `errorCount: 0`. **PASS** — the fix genuinely clears the finding, not just superficially.
2. **`mcp-tool-factory`'s `scaffold_tool` → `wire_tool` run twice** against a real on-disk checkout (isolated `git worktree`, not the working copy): first run succeeds; second `scaffold_tool` call is cleanly rejected (`already exists. Pass overwrite:true`) rather than corrupting anything; with `overwrite:true` it succeeds again; `wire_tool` run twice leaves exactly one entry for the tool in both `bin/cli.mjs` and root `package.json` (verified by grep count), and both files remain syntactically valid (`node -c`, `JSON.parse`) after the repeated run. **PASS** — no corruption.

---

## 🟢 ReDoS residual sweep (QA session 2, item 4) — 2026-07-03 — ✅ FIXED

Individually timed every regex in the 12 tools left "visually reviewed only" by the session-1 ReDoS sweep: `env-var-migrator`, `jest-to-vitest-migrator`, `i18n-extractor`, `infer-fields`, `svg-to-component`, `type-from-json`, `states-scaffolder`, `zustand-store-generator`, `visual-regression-setup`, `playwright-scaffolder`, `mcp-tool-factory`, `bundle-budget-guard`. Standalone Node scripts, realistic domain input + adversarial input per regex, real ms readings (not guessed).

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| R4 | 🟠 P1 | `svg-to-component` | `jsxify`'s `<?xml…?>`/`<!DOCTYPE…>`/`<!--…-->` stripper regexes each had an unbounded `[\s\S]*?` span — same shape as R1/R3. Measured (many repeated unterminated `<!--`/`<?xml` openers, no closer anywhere): reps=8,000 (40–48KB) → 53–72ms; reps=20,000 (100–120KB) → 329–449ms; reps=40,000 (200–240KB) → **1.3–1.8s**, clean quadratic growth. | ✅ FIXED — all three bounded to `[\s\S]{0,5000}?` (real xml decls/doctypes/comments are short). Post-fix, full `generateSvgComponent()` (not just the raw regex) on reps=40,000 → 468ms; reps=80,000 → 944ms — linear. Regression test added (`core.test.ts`, "does not catastrophically backtrack on many unterminated `<!--` comments (QA harness regression)"). |

All other 11 tools measured safe — largest realistic-input timing was 264ms (`bundle-budget-guard`, 200k patterns), largest adversarial-input timing was 331ms (`bundle-budget-guard`, huge special-char pattern); everything else single/double-digit ms. Rebuilt + retested `svg-to-component` (`npm run build && npx vitest run` — 6/6 pass) and the full monorepo (`npm run build && npm test` from repo root — all packages green, zero regressions).

---

## 🟢 cra-to-vite real apply + FieldSchema fuzz matrix + security hardening — ✅ FIXED

Deepest QA pass yet: ran `cra-to-vite` end-to-end with a **real `dryRun:false` apply** (not just dry-run review) against a genuine `create-react-app` CLI output — real `npm install`, real `vite build`, real `vitest run` — then built a fuzz harness (`mcp-toolkit-qa/harness/fuzz-schema.mjs`) that feeds 14 adversarial `FieldSchema`s and 8 adversarial JSON samples into every CRUD-factory generator and syntax-checks the output via `ts.transpileModule`. Separately audited every `execSync`/`readFileSync` call for injection and traversal risk.

### cra-to-vite real-apply pipeline (7 bugs)

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| C1 | P1 | `env-var-migrator` | Rewrote `process.env.REACT_APP_X` → `import.meta.env.VITE_X` **inside `setupProxy.js`** — a Node/CommonJS file loaded via `require()` by the dev server, not bundled by Vite. Produces a hard SyntaxError; only found by running the real apply, not dry-run. | ✅ FIXED — `shouldSkipEnvRewrite()` predicate skips `setupProxy.js`. |
| C2 | P1 | `jest-to-vitest-migrator` | Fixed import list `{ describe, it, expect, vi, beforeEach, afterEach }` never included `test` — CRA's default `App.test.tsx` uses global `test()`, not `it()` → `ReferenceError` at runtime. | ✅ FIXED — import list built dynamically from which globals are actually referenced in the file. |
| C3 | P2 | `jest-to-vitest-migrator` | "used globals" scan read raw source **including comments** — CRA's own `setupTests.ts` has `// expect(...)` in a comment, injecting an unused `import { expect }` that trips `noUnusedLocals`. | ✅ FIXED — scans a comment-stripped copy of the source. |
| C4 | P1 | `jest-to-vitest-migrator` | `@testing-library/jest-dom`'s bare import only patches Jest's global `expect` — under Vitest's separate Chai-based `expect`, every custom matcher throws `Invalid Chai property`. | ✅ FIXED — rewrites to the `/vitest` subpath (both `import '...'` and `from '...'` forms). |
| C5 | P1 | `jest-to-vitest-migrator` | `setupTests.ts` — exactly where the jest-dom import lives — was never scanned at all; the file-match glob only covered `*.test.*`/`*.spec.*`. | ✅ FIXED — `isMigratableTestFile()` also matches `setupTests.ts`/`.js`. |
| C6 | P1 | `vite-project-scaffolder` | No tool in the pipeline ever generated a Vitest config (jsdom environment, setupFiles) — every migrated app's tests failed immediately with no test environment. | ✅ FIXED — added `vitest`/`vitestSetupFile` options; `defineConfig` sourced from `vitest/config` when requested; generates a `test: {...}` block. |
| C7 | P1 | `codemod-runner` | `default-react-import-drop` blindly stripped `import React from 'react'` even when the file still used `React.StrictMode`/`.Fragment`/`.forwardRef` — broke `main.tsx`, including the scaffolder's **own** generated `main.tsx`. | ✅ FIXED — negative-lookahead regex `(?![\s\S]*React\.)`; verified for both correctness and ReDoS-safety (8ms on a 200k-line synthetic file) before shipping. |

Also fixed: `cra-to-vite`'s `deriveScaffoldOptions(profile, ...)` silently dropped `hasSetupTests` because the real profile nests it under `profile.jestConfig.hasSetupTests` — TypeScript's structural typing allowed this to compile without error. Caught by code review before it caused a runtime bug, not by a failing test. Improved `manualReview` guidance to warn that `loadEnv` must be imported from `'vite'`, not `'vitest/config'` (the scaffolded `vite.config.ts`'s `defineConfig` source, an easy real mistake to make by hand).

### FieldSchema fuzz matrix (systemic identifier-safety bug, ~8 tools)

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| F1 | P0 | `@mcp-showcase/shared` (`naming.ts`) | `pascal()`/`camel()` only normalized `_`/`-` to spaces — any other punctuation, apostrophe, or non-ASCII character rode along untouched, e.g. `pascal("thing's-2.0!")` → `"Thing's2.0!"`, an invalid TS identifier. Broke the resource-name class of bug across **every** generator that names a type from `pascal(resource)`. | ✅ FIXED — strips all non-alphanumeric characters per word, falls back to `"Resource"` if nothing survives, prefixes `_` if the result would start with a digit. |
| F2 | P0 | `infer-fields` | Field names come straight from arbitrary API-response/OpenAPI keys and are interpolated as bare identifiers/object-keys/`register()` args downstream — no generator validates them. | ✅ FIXED — `toSafeIdentifier()` sanitizes at the one point field names enter the pipeline; empty-after-sanitizing fields are skipped; collisions after sanitizing are deduped; the human-readable `label` is still derived from the original, un-sanitized key. |
| F3 | P0 | `@mcp-showcase/shared` (`fieldSchema.ts`) | A **hand-built** `FieldSchema` (bypassing `infer-fields`) can still carry unsafe field names — silently rewriting them risks a mismatch between the generated identifier and the real API key, which is worse than a clean rejection. | ✅ FIXED — `isFieldSchema()` (already called first by every generator) now also rejects any field whose `name` isn't a valid JS identifier. |
| F4 | P1 | `zod-schema-generator` | Had its own **local duplicate** of `pascal()`/`cap()` instead of importing the shared, sanitizing helper — inherited the F1 bug independently even after F1 was fixed elsewhere. | ✅ FIXED — duplicate deleted, imports `pascal` from `@mcp-showcase/shared`. |
| F5 | P1 | `crud-composer` | `export const ${fs.resource}Routes` used the raw, un-sanitized `resource` string directly instead of going through `pascal()`/`camel()` like every other identifier in the file. | ✅ FIXED — `camel(fs.resource)`. |
| F6 | P2 | `form-generator`, `detail-generator` | Field `label`s and `<select>` `enumValues` are arbitrary text (quotes, backticks, markup like `</script><script>`) interpolated raw into JSX text/attributes — broke the generated component's syntax and, for markup, would have rendered as live HTML. | ✅ FIXED — rendered via JSX expression containers + `JSON.stringify()` instead of raw interpolation (`{${JSON.stringify(label)}}`), which is always syntactically valid and can never be parsed as markup. |
| F7 | P2 | `table-generator` | Column `header` interpolated `label` into a single-quoted JS string literal — broke on an embedded apostrophe (e.g. `"it's"`). | ✅ FIXED — `JSON.stringify(f.label)` instead of raw interpolation. |

Final fuzz-matrix rerun: **zero findings** (no crashes, timeouts, or syntax errors) across all 14 schema cases × 8 generators + 8 `infer-fields` edge-JSON cases. Every fix has a dedicated regression test; full monorepo build + test suite green after each fix.

**Duplicate-`pascal()` follow-up (not fixed — logged for a future pass):** `svg-to-component`, `mcp-tool-factory`, `states-scaffolder`, `type-from-json`, and `zustand-store-generator` each carry their own local `pascal()` copy (with 4 different fallback words: `'Icon'`, none, `'Resource'`, `'Value'`, `'Store'`) instead of importing the shared, sanitizing helper. None of these were exercised by the FieldSchema fuzz harness (they take non-schema input — filenames, tool specs, arbitrary names), so no failure was measured, but they carry the same theoretical identifier-unsafety risk F1 fixed centrally. Left out of this pass because each needs individual attention to its fallback behavior, not a blanket find-replace.

### Security hardening — command injection (CWE-78)

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| S1 | 🔴 P0 | `lighthouse-runner` | `url` and `outputPath` are **direct MCP tool-call arguments**, interpolated into a shell string wrapped in double-quotes with no escaping — a crafted `url`/`outputPath` (embedded quote, backtick, or `$(...)`) breaks out of the quoting and executes arbitrary shell commands. The most directly reachable injection vector found this session — no crafted repo needed, just a malicious tool call. | ✅ FIXED — `execSync` → `execFileSync` with an argv array; no shell, nothing to escape. |
| S2 | 🟠 P1 | `dep-auditor` | `check_outdated` interpolated `dep` — a dependency-name **key read from the scanned repo's `package.json`** — directly into `npm view ${dep} version`. A malicious/crafted `package.json` (realistic if auditing a third-party or untrusted repo) could inject shell commands. | ✅ FIXED — `execFileSync('npm', ['view', dep, 'version'], ...)`. |
| S3 | 🟡 P2 | `component-factory`, `component-fixer`, `component-reviewer` | All three built `npx tsc --noEmit --project ${tsconfigPath}` (and `component-reviewer` also `npx vitest run ${testFile}`) via string interpolation of a path derived from the caller's `path` argument. Lower severity than S1/S2 (requires an actual directory *named* with shell metacharacters, not just malicious file contents) but the same anti-pattern. | ✅ FIXED — `execFileSync` with argv arrays in all four call sites across the three tools. |

`quality-pipeline`'s `execSync` calls were checked and are **not** vulnerable — their command strings are static; the only interpolated value is an internally-generated tmp-file path (`os.tmpdir()` + `Date.now()`), never caller-controlled. `json-viewer`'s `open`/`open_response` commands were also checked and are safe — the path is built from an `id` that's already sanitized to `[a-zA-Z0-9-_]` at generation (`generateId()`), so it can never carry shell metacharacters. `mcp-tool-factory` already used `execFileSync` correctly.

### XSS — dashboard `esc()` path (no bug found, verified empirically)

Read through `@mcp-showcase/shared`'s `renderDashboard` and `@mcp-showcase/ui-kit`'s `renderReportHTML`/`renderResultHTML` (including their embedded client-side runtime scripts) end-to-end: every dynamic value — titles, filenames, code, table cells, list items, drawer fields — is consistently routed through the same `esc()`/`E()` helper (escapes `&<>"'`) before HTML interpolation, both server-side and in the client-side `innerHTML`-building JS. No unescaped path found. Added `tools/shared/src/dashboard.test.ts` (7 tests) empirically confirming an XSS-shaped payload (`</script><img src=x onerror=alert(1)>&"'`) never survives unescaped through the title, code panel, files array, chip key/value, findings table, scalar list, or raw-JSON dump — so this is now a regression-guarded guarantee, not just a code-reading conclusion.

### Composition testing

Added a 4-combination (`dataLayer` × `router`) matrix test plus an explicit idempotency test (same input run twice → byte-identical `files`/`journal`/`grade`) to `workflow-runner/src/core.test.ts`. All 4 combinations pass the review gate.

### Path/file adversarial matrix (complete — 30/30 path-taking tools empirically tested)

Two passes, same adversarial matrix (path traversal, symlink escapes, missing paths, ~50–72MB files, binary content, empty files/dirs), via a batch stdio JSON-RPC harness:

**Pass 1 (11 tools):** `a11y-autofixer`, `accessibility-checker`, `json-viewer`, `svg-to-component`, `dependency-remapper`, `review-gate`, `component-factory`, `react-compiler-migrator`, `codemod-runner`, `monorepo-manager`, `api-contract-differ`.

**Pass 2 (19 tools):** `barrel-generator`, `bundle-budget-guard`, `cra-to-vite`, `craconfig-analyzer`, `dep-auditor`, `docs-generator`, `env-var-migrator`, `i18n-extractor`, `lighthouse-runner`, `mcp-tool-factory`, `mcp-tool-improviser`, `performance-audit`, `quality-pipeline`, `redux-state-analyzer`, `render-analyzer`, `storybook-generator`, `webpack-config-translator`, `component-fixer`, `component-reviewer`.

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| P1 | 🟡 P2 | `component-factory` | `review_component`/`fix_component`/`improve_component` threw raw, uncaught exceptions on a non-existent path instead of returning the tool's own structured `{ok:false,...}` error shape. (`McpServerBase`'s transport layer already catches any thrown exception and converts it to a valid MCP protocol error — never a process crash, just an inconsistent error shape.) | ✅ FIXED — wrapped all three handlers in try/catch, routed through `this.error()`. 3 regression tests added. |
| P2 | 🟠 P1 | `docs-generator` | `generate_api_reference`/`generate_tool_docs` **OOM-crashed the Node process** (`FATAL ERROR: Reached heap limit`) on a 72MB single-file input — the export/action-extraction regexes had no size guard. This is the one genuine crash (not just an inconsistent error shape) found across all 30 tools. | ✅ FIXED — `MAX_SOURCE_LENGTH` guard fails fast with a clean error before the regexes run; `index.ts` also switched to the shared `safeReadFile`/`MAX_FILE_BYTES` as defense-in-depth at the I/O boundary. Regression tests added. |

**All other 28 tools: PASS** — no crashes, hangs, OOM, or path/symlink escapes. Two notes logged but not treated as bugs (below the "crash/hang/OOM/raw stack trace" bar this sweep used): `dep-auditor` returns `{success:true, packagesAudited:1...}` even for a non-existent/empty/binary path — arguably too lenient, worth a UX look but not unsafe; `mcp-tool-improviser` converts a missing-path error into a protocol-level `McpError` rather than its own `{success:false}` shape (stylistically inconsistent with sibling tools, functionally fine). `mcp-tool-factory`'s `scaffold_tool` was specifically checked for path-traversal-via-tool-name and correctly rejects it (`validateToolName`'s kebab-case regex blocks `../../../etc`-style names).

### ReDoS timing sweep (quadratic blowup found + fixed)

Empirically timed every regex flagged as having a catastrophic-backtracking shape (nested/adjacent unbounded quantifiers) across `tools/*/src/core.ts`.

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| R1 | 🟠 P1 | `docs-generator` | `EXPORT_RE`'s leading optional doc-comment group `(\/\*\*[\s\S]*?\*\/\s*)?` re-scans to end-of-string for every unterminated `/**` occurrence — quadratic. Measured: 8,000 reps (248KB) → 3.0s; 20,000–40,000 reps → hung past 8s. | ✅ FIXED — dropped the lazy leading group from the regex entirely; the doc-comment is now recovered via a bounded, linear backward string scan (`findLeadingDocBlock`). Verified byte-identical `cleanDoc()` output on valid input; adversarial 200k-line input now ~2ms. |
| R2 | 🟠 P1 | `docs-generator` | `extractActions`'s `addTool(...)` regex had two sequential unbounded `[\s\S]*?` capture spans. Measured: 4,000 reps of an unterminated `addTool("` quote → 1.3s; 8,000 reps → 5.5s. | ✅ FIXED — both captures bounded to `[\s\S]{0,2000}?` (tool names/descriptions are realistically short strings). Post-fix: 50,000-line adversarial input → ~361ms. |
| R3 | 🟠 P1 | `react-compiler-migrator` | `stripMemoization`'s `useMemo`/`useCallback` strip regexes each had an unbounded `[\s\S]*?` body span. Measured (adversarial unterminated `useMemo(`/`useCallback(` lines): n=1000→17-18ms, n=2000→68-71ms, n=4000→276-310ms, n=8000→1.1-1.3s, clean quadratic growth; n=50,000 hung past an 8s kill timeout. | ✅ FIXED — both bounded to `[\s\S]{0,2000}?` (memoized bodies are realistically short). Post-fix: 50,000-line adversarial input → ~362-367ms, comfortably under the 2s regression bound. |

Also verified (measured, not just read) as safe: `codemod-runner`'s `default-react-import-drop` (fix C7 above, 8ms on a 200k-line synthetic file, verified earlier this session), `fix-failing-tests`'s parsing regexes (500KB–3MB adversarial inputs, ≤10ms), and `a11y-autofixer`'s img-alt regex (500KB adversarial single line, 0-1ms — the lookahead-based repetition isn't nested and stays linear) and `enforce-design-tokens`'s spacing lookaround regex (fixed-width literal, 0-1ms). The remaining regex inventory (`env-var-migrator`, `jest-to-vitest-migrator`, `i18n-extractor`, `infer-fields`, `svg-to-component`, `type-from-json`, `states-scaffolder`, `zustand-store-generator`, `visual-regression-setup`, `playwright-scaffolder`, `mcp-tool-factory`, `bundle-budget-guard`) was visually reviewed and confirmed to use simple, bounded, anchored patterns with no adjacent/nested unbounded quantifiers — not individually timed, since none matched the risk shape this sweep was looking for.

---

## 🟢 Cross-app compile QA pass — 2026-07-04 — ✅ FIXED

New QA infrastructure: [`mcp-toolkit-qa`](../mcp-toolkit-qa) (sibling repo) — 8 real, `npm install`-able fixture apps (default Vite+RTK+Tailwind, TanStack-only, Next 15 App Router, non-Vite/`tsc`-only, no-Tailwind/CSS-Modules, pnpm monorepo, real `create-react-app` CLI output, strict-`typescript-eslint`) plus a harness (`harness/run-qa.mjs`) that drives `workflow-runner`'s `schema_to_feature` against each and runs the fixture's **real build** — the layer-4 gap unit tests alone can't close (generated code compiling in an app with real, installed peer deps). This is distinct from the dogfood passes above, which drive tools against existing hand-written codebases; this harness generates fresh code into disposable fixtures on every run.

| # | Sev | Tool | Bug | Status |
|---|---|---|---|---|
| 1 | P1 | `detail-generator` | Emitted `{ id, onDelete?: () => void }` — a type annotation inside the destructuring pattern itself (invalid syntax, TS1005/TS1138). Failed in every fixture immediately. | ✅ FIXED — destructure `{ id, onDelete }`, keep the type only in the `: { ... }` block. Regression test added. |
| 2 | P2 | `detail-generator` | `import type { Article } from './Article.schema'` was emitted but never referenced anywhere in the component body (the RTK/TanStack hooks already carry full type inference) — TS6133 under any tsconfig with `noUnusedLocals`. The toolkit's own build config doesn't set that flag, which is why 1064 existing unit tests never caught it. | ✅ FIXED — import removed entirely. Regression test added. |
| 3 | P1 | `crud-composer` | Next-router dynamic-route pages (`[id]/page.tsx`, `[id]/edit/page.tsx`) typed `params` as a plain `{ id: string }` object. Next 15 requires `params` to be a `Promise` on **all** page components, including client-component pages — real error: `Type '{ params: { id: string } }' does not satisfy 'PageProps'`. Only surfaced against a real Next 15.5 build; nothing in the unit suite exercises an actual Next compiler. | ✅ FIXED — kept `'use client'`, unwrapped with React 19's `use(params)` instead of making the page async. Regression test added. |

All 3 fixes are regression-tested in their tool's own suite and re-verified: all 6 workflow-runner-driven fixtures (`vite-rtk-tailwind`, `vite-tanstack`, `rr7-non-vite`, `no-tailwind-css-modules`, `next15-app-router`, `pnpm-monorepo`) pass their real build end-to-end. `real-cra-app` and `strict-eslint-repo` verified independently (real CRA CLI build; strict lint+build both clean) but not yet wired into `run-qa.mjs`.

Also wired: `scripts/improviser-gate.mjs` in CI — runs `mcp-tool-improviser` across every tool and fails the build below a 7.0 floor (was a manually-run, unenforced signal before tonight). Every tool is ≥8.7 except `refactor-executor` (7.5, tracked follow-up — see its own section below for context on why it's the outlier).

---

## 🟢 P0 ROOT CAUSE — shared project-context detection — ✅ FIXED

Every generator/analyzer independently (and wrongly) guessed the target project's shape — where `cn` lives, whether a tsconfig exists up-tree, the token system, monorepo-ness. This one weakness caused a whole class of bugs across 5 tools.

**Fix:** new `tools/shared/src/projectContext.ts` (exported from `@mcp-showcase/shared`), string-aware and tested (13 unit tests):
- `resolveCnImport(file)` → the project's real `cn` specifier (`@/lib/cn`, a correctly-nested relative path, or a flagged `needsCreation`).
- `resolveRelativeImport(from, to)` → correct source import for generated tests.
- `findTsconfig` / `findPackageRoot` / `findUp` → walk up (not error at dir level).
- `readAliases` → tsconfig `paths`, following **`extends` AND `references`** (Vite's split-config puts `@/*` in `tsconfig.app.json`).
- `parseJsonc` → string-aware JSONC (does NOT corrupt `"@/*"`/`"**/*.ts"` globs — a naive strip did).
- `detectFramework` (react-scripts/config-overrides ⇒ CRA only), `detectMonorepo`, `hasRepoUiPackage`, `detectTokenSystem` (shadcn vs Tailwind-v4 `@theme`/css-vars vs none).

Now consumed by component-factory, generate-tests, dep-auditor, and (via detection) legacy-analyzer.

---

## component-factory (v2.0.0)

Generates authentic shadcn/ui source. Structure was always good; the integration bugs are fixed.

| # | Sev | Bug | Status |
|---|---|---|---|
| 1 | 🔴 P0 | **cn import off-by-one** — emitted `../../lib/utils` from the nested `Name/Name.tsx` folder → resolved to the wrong dir; real project uses `@/lib/cn`. | ✅ FIXED — `readTemplate` now calls `resolveCnImport(targetFile)`. Verified: generating `Badge` into my-people emits `import { cn } from "@/lib/cn"` (exact match). |
| 2 | 🟠 P1 | **Undeclared peer deps** (CVA, @radix-ui/react-slot) not surfaced. | ✅ FIXED — result now returns `dependencies[]` + `warnings` with an `npm install …` hint (`extractPeerDeps`). |
| 3 | 🟠 P1 | **Assumes `shadcn init`** — emits `bg-primary`/`*-foreground`; renders unstyled in a custom Tailwind project. | ✅ FIXED — result returns detected `tokenSystem` and warns when it isn't `shadcn`. |
| 4 | 🟡 P2 | `review_component` false "No tsconfig.json found". | ❌ REFUTED — `findTsconfig` already walks parents. The real cause of the D-grade was the broken cn import (#1) failing `tsc`. |
| 5 | 🟡 P2 | `review_component` reports "tsc not installed" ANSI garbage as TS errors; ARIA hint on native elements. | ⚠️ KNOWN — signal-only; low priority. |
| 6 | 🟡 P2 | `generate_component_library` returns `success:false` per component while writing valid files. | ⚠️ KNOWN — cosmetic status mismatch. |
| 7 | 🟠 P1 | `fix_component` rewrote `@/lib/utils` → same wrong `../../lib/utils`. | ✅ FIXED — now uses `resolveCnImport(mainFile)`. |

---

## generate-tests (v1.0.0) — ✅ substantially fixed

Was a scaffolder emitting non-compiling tests. Now emits parseable, type-plausible tests.

| # | Sev | Bug | Status |
|---|---|---|---|
| G1 | 🔴 P0 | **Wrong import** — `import { X } from './<symbolName>'` not the source basename. | ✅ FIXED — `resolveRelativeImport(dest, source)` threaded into every generator. Verified `./phone`, `./cn`, `./Button`. |
| G2 | 🔴 P0 | **JSX parse break** — className test emitted `</Foo)` (missing `>`). | ✅ FIXED — rewrote the className render; verified no `</Button)`. |
| G3 | 🔴 P0 | **Phantom class** — `class names` in a JSDoc comment became a fake `names` test suite. | ✅ FIXED — class regex now requires PascalCase + `{`. |
| G4 | 🟠 P1 | **Tailwind `hover:` extracted as a cva variant** → `variant="hover"`, duplicates, missing real variants. | ✅ FIXED — string-literal contents blanked before key extraction (+ dedup). Verified Button → primary/subtle/secondary/ghost/outline/danger/solid. |
| G5 | 🟠 P1 | **Type-violating args** — `fn(undefined)`/`fn(null)` on typed sigs; `null.trim()` threw at runtime. | ✅ FIXED — `mockValue` is now type-aware (string→`"test"`, number→`0`, `()=>`→`vi.fn()`, …); the unsafe null-args test was removed. |
| G6 | 🟠 P1 | **Duplicate imports** — multi-suite files repeated `import … from 'vitest'`/source. | ✅ FIXED — `assembleTestFile` merges named+default specifiers per module. |
| G7 | 🟡 P2 | Placeholder assertions + brittle `toMatchSnapshot()`. | ⚠️ partially — snapshot kept; assertions are now prop-driven where possible. |

---

## storybook-generator — ✅ FIXED

| # | Sev | Bug | Status |
|---|---|---|---|
| S1 | 🔴 P0 | **Duplicate `export const Hover`** (from the same `hover:` extraction bug) → won't compile. | ✅ FIXED — shared variant-regex fix; verified Button stories have one export per real variant, no `Hover`. |
| S2 | 🟠 P1 | **Loading story hardcoded `loading: true`** even when the real prop is `isLoading`. | ✅ FIXED — captures the actual `loadingProp`; verified emits `isLoading: true`. |

---

## component-fixer (v3.0.0) — 🔴 P0 file corruption — ✅ FIXED

The worst offender: it **corrupted valid files while reporting `success:true`**.

| # | Sev | Bug | Status |
|---|---|---|---|
| F1 | 🔴 P0 | **Inline-arrow "fix"** rewrote `onClick={()=>…}` to `onClick={handleClick}` (undefined) and spliced a `// TODO` line into JSX-children position → file no longer parses. | ✅ FIXED — now a non-destructive suggestion (no edit). |
| F2 | 🔴 P0 | **Inline-style "fix"** replaced `style={{…}}` with `style={styles}` (undefined) + a `//` comment that swallowed the tag's `>`. | ✅ FIXED — non-destructive suggestion. |
| F3 | 🟠 P1 | **Line-shift** — splicing shifted later issues' line numbers so subsequent fixes silently missed. | ✅ FIXED — issues applied bottom-up (descending line). |
| F4 | 🔴 P0 | **`success:true` while corrupting.** | ✅ FIXED — result is parse-validated (`@typescript-eslint/parser` via `createRequire`); on failure the write is rolled back and `success:false` is reported honestly. |

Verified: reviewing + fixing copies of ConfirmDialog.tsx and PhoneInput.tsx now leaves them parsing cleanly with zero corruption markers; the safe displayName fix still applies. 42 tests (incl. 4 regression guards).

---

## legacy-analyzer (v1.4.0) — 🔴 P0 dead AST engine + 7 P1s — ✅ ALL FIXED

| # | Sev | Bug | Status |
|---|---|---|---|
| L0 | 🔴 P0 | **AST parser always returned null** — `ast-parser.ts` is ESM but called a bare `require('@typescript-eslint/parser')`; the throw was swallowed. Killed jsxMaxDepth, hook counts, import-based detection. | ✅ FIXED — `createRequire(import.meta.url)`. Verified: jsxMaxDepth now real (ImportDialog=6, AddContactDialog=4, SideNav=3; was all 0); complexComponents populated. |
| L1 | 🟠 P1 | jsxMaxDepth always 0. | ✅ FIXED by L0. |
| L2 | 🟠 P1 | `totalComponents` is a raw FILE count (hooks/tests/model files included) — my-people reported 91. | ✅ FIXED — counts real components only (AST-aware). my-people 91→59. |
| L3 | 🟠 P1 | **Tailwind v4 not detected** (only JS `import 'tailwindcss'`, never true in v4). | ✅ FIXED — scans CSS for `@import "tailwindcss"`/`@tailwind`/`@theme` + package.json dep. Both repos now report "Tailwind". |
| L4 | 🟠 P1 | **`@repo/ui` monorepo hint in standalone repos.** | ✅ FIXED — gated on `detectMonorepo`+`hasRepoUiPackage`; my-people no longer gets it. |
| L5 | 🟠 P1 | `detect-features` ignores the real `features/` tree, invents keyword buckets. | ✅ FIXED — reads actual `features/`/`modules/`/`domains/` dir; my-people → `["contacts"]`. |
| L6 | 🟠 P1 | **routing falsely reports `next/navigation`** for any `app/` dir with no `next` dep (my-people uses react-router). | ✅ FIXED — requires `next` in deps; my-people → react-router, sentineldesk → Next. |
| L7 | 🟠 P1 | Only ONE source dir scanned → Next `components/`+`lib/` invisible (sentineldesk `totalComponents:6`). | ✅ FIXED — unions src/app/pages/components/lib; sentineldesk 6→20, folders detected. |
| L8 | 🟡 P2 | Generated dirs (`coverage/`, `out/`, `playwright-report/`) scanned as source. | ✅ FIXED — shared generated-dir ignore set; my-people assets 1 (favicon), no noise. |
| — | — | api-layer flagging CDN URLs; CRA-on-`.env` false positives. | ❌ REFUTED — both already correct in 1.4.0. |

**Genuinely useful today:** healthScore, real a11y detection (unlabeled inputs, td-onClick w/o keyboard), anti-pattern detection, the `ui://` dashboard.

---

## The already-clean tools (verified correct on real code)

These held up well under dogfooding — the fixes below are the exceptions, not the rule.

**performance-audit** — ✅ FIXED: `check_render_performance`/`audit_bundle` counted every `?` char as a nested ternary (fired on `?.` / `??` on ordinary modern TS). Now strips `?.`/`??` first. detect_heavy_imports was already correct (0 false positives on my-people).

**render-analyzer** — ✅ FIXED: (a) each component's body was sliced to EOF → issues mis-attributed to earlier components + file-wide `React.memo` detection; now bounded to the next component's start and computed per-body. (b) SCREAMING_SNAKE consts counted as components on `.ts` files; now excluded. Line numbers were already accurate.

**typescript-enforcer** — ✅ FIXED: (a) `ignore` param REPLACED the built-in excludes and only matched basenames; now merges with defaults + glob-matches the relative path. (b) `modifiers` suggested `as const` on arrays that already had it / typed return objects. `no-any` on clean strict code = 0 false positives (correct).

**component-reviewer** — ✅ FIXED: (a) `import * as X` flagged as a "type assertion"; now excluded. (b) "Missing displayName" noise on named function components; now only for forwardRef/memo/anonymous. Scores/line numbers were sound.

**accessibility-checker** — ✅ FIXED: (a) valid ARIA roles (`meter`, etc.) reported invalid — role list completed to WAI-ARIA 1.2. (b) context-blind "missing label" on `{...props}`-spreading primitives; now skipped. It is NOT a generic "add ARIA everywhere" stub — the axe-style rules and line numbers are accurate.

**dep-auditor** — ✅ FIXED: `find_unused_deps` only scanned `<pkg>/src` (missed config/CSS/test/server dirs) → 14 false positives on my-people (eslint/vite/tailwind/cors/express/playwright/jsdom/coverage-v8). Now scans the whole package incl. config + `.css` + test files; my-people false positives 22→7 (remaining 7 are genuinely unused). Root autodetect now handles npm-workspaces + standalone.

**monorepo-manager** — ✅ FIXED: never read npm `workspaces` (hardcoded globs) → dropped `server` + `client`; now lists all 21 mcp-toolkit packages (pnpm still 57). `sync_config` no longer crashes on a missing `configFile`.

**code-modernizer** — ✅ FIXED: `convert-to-typescript` targeted minified vendor JS in `coverage/`. Now ignores generated dirs and no-ops on an already-TS project ("Project is already TypeScript — no .js/.jsx source files found to convert.").

**lighthouse-runner** — ✅ FIXED: `static_audit` flagged `<script type="module">` as render-blocking (module scripts are deferred). SEO/landmark findings on the static shell are accurate.

**quality-pipeline**, **json-viewer**, **test-gap-analyzer** — mostly sound. test-gap's one real defect: "tested" is derived only from `describe('name')` titles, so a function tested under a shared describe is falsely "untested" (my-people `filterContacts` utils under-counted). Candidate for a follow-up fix.

---

## Test hygiene

- ✅ FIXED a flaky tmp-file collision in `typescript-enforcer/scanner.test.ts` — `Date.now()`-named temp files collided when vitest ran the compiled `build/*.test.js` and `src/*.test.ts` copies concurrently. Now uses a unique dir per file. Full suite: **870 tests, 0 failures**, deterministic across repeated runs.

## Follow-up backlog (not yet fixed)

1. **test-gap-analyzer** — stop deriving "tested" from `describe()` titles alone; match on imported/exercised symbols.
2. component-factory `generate_component_library` status mismatch; `review_component` tsc-missing handling.
3. generate-tests G7 — replace remaining placeholder assertions / snapshot.
4. New tools this dogfood justified: `a11y-fixer` (auto-apply accessibility-checker findings), `zod-schema-generator`, realtime-hook-generator, and the AWS/serverless scaffolders SentinelDesk needed.
