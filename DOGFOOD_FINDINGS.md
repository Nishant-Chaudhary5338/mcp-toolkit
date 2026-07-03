# mcp-react-toolkit — Dogfood Findings & Fix Backlog

> **Purpose:** a single, agent-actionable backlog of real bugs and improvements found by *using the published-style build* (`npx mcp-react-toolkit <tool>` over MCP stdio) on real projects. Each entry names the tool + sub-tool, a concrete repro, root cause (file:line), and status. When a fix ships it's marked `✅ FIXED` — history is kept, not deleted.

**Last full dogfood pass: 2026-07-03.** Every tool was driven over real MCP stdio against real machine codebases — primarily **my-people** (Vite + React 19 + TS-strict, standalone, Tailwind v4, `@/` alias, `cn` at `src/lib/cn.ts`), **sentineldesk** (Next.js + React 19, Tailwind v4), **my-turborepo** (pnpm workspace, 57 pkgs), and the toolkit itself (npm workspaces). Findings were verified by reading the target source, not taken at face value. All P0/P1 bugs below were then fixed in `tools/<name>/src/` and re-verified against the same real code.

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
