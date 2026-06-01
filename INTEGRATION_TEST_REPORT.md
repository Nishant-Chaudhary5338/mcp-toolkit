# mcp-react-toolkit — Integration Test Report
**Date:** 2026-06-01 | **Version tested:** 1.0.1 + Phase 1 safety patches

## Test Targets

| Target | Type | Packages |
|--------|------|---------|
| my-turborepo | pnpm monorepo (Turbo 2.x) | 54 (apps/web/* nested) |
| dashcraft | pnpm monorepo (library) | 3 |
| ai-builder | Single Vite/React 19 app | 1 |
| tribehq | pnpm "monorepo" (single Next.js 15 app) | 1 |
| digitribe-web | Single Next.js 15 App Router | 1 (66 components) |
| mcp-toolkit | pnpm monorepo (dogfood) | 10 tools |

---

## Tool Results Matrix

### 1. dep-auditor

| Test | Result | Status |
|------|--------|--------|
| `find_unused_deps` — turborepo | 193 potentially unused across **41** packages | ⚠️ BUG: misses 13 apps/web/* packages |
| `find_unused_deps` — dashcraft | 40 unused across 3 packages | ✅ Works |
| `find_unused_deps` — ai-builder (no monorepo) | 0 packages audited — silent skip | ⚠️ Should notify user |
| `find_unused_deps` — tribehq (single-pkg monorepo) | 0 packages — no sub-dirs | ⚠️ Should fall back to root package |
| `find_duplicate_deps` — turborepo | 13 version mismatches (correct) | ✅ Works |
| `analyze_bundle_impact` — turborepo | Per-package breakdown of 41 packages | ⚠️ Same missing 13 packages |

**Root Bug:** `getAllPackages()` hardcodes `['apps', 'packages', 'tools']` dirs at 1-level depth.
The turborepo uses `apps/web/*` (2-level deep). This is read correctly in `pnpm-workspace.yaml`
but dep-auditor ignores it. **Fix: read workspace config patterns like monorepo-manager does.**

---

### 2. monorepo-manager

| Test | Result | Status |
|------|--------|--------|
| `list_packages` — turborepo | 54 packages (correct) | ✅ Works |
| `list_packages` — ai-builder | 0 packages + no error | ⚠️ Should return clear "not a monorepo" message |
| `find_dependents` — @repo/ui | 6 correct dependents | ✅ Works |
| `dependency_graph` — turborepo | Full graph, 0 circular deps | ✅ Works |
| `check_health` — turborepo | 68 issues, 35 warnings (0 errors) | ✅ Works (accurate) |
| `sync_config` | Tool not present in index | ❌ Missing tool |

**Note:** `find_dependents` result object is missing `totalNodes`/`totalEdges` field names  
(uses `dependencies` as the graph key — misleading for API consumers).

---

### 3. typescript-enforcer

| Test | Result | Status |
|------|--------|--------|
| `scan_file` — mcp-talk/SlideEngine.tsx | 1 info, score 9.8/10 | ✅ Works |
| `scan_directory` — @repo/ui/src | 10 files, 18 violations | ✅ Works |
| `scan_directory` — ai-builder/src | Works | ✅ Works |
| `scan_directory` — tribehq (Next.js, 96 files) | 122 violations | ✅ Works |
| `scan_directory` — digitribe-web/components | 66 files, 117 violations | ✅ Works |
| `scan_directory` — dep-auditor/src (dogfood) | 23 violations, score 0! | ✅ Works (ironic find) |
| `list_rules` | 7 rules correctly listed | ✅ Works |

**Gap:** When passed a directory with no `src/` like the turborepo root, the tool tries to scan  
the entire monorepo (would be slow on large repos). **Should accept any directory.**

---

### 4. accessibility-checker

| Test | Result | Status |
|------|--------|--------|
| `check_accessibility` — mcp-talk/slides (10 files) | 0 issues | ✅ Works |
| `check_accessibility` — @repo/ui/src | **3 files scanned** | ⚠️ Misses 47 other .tsx files |
| `check_accessibility` — ai-builder/src | Works | ✅ Works |
| `check_accessibility` — tribehq/app | Works (35 issues found) | ✅ Works |
| `check_accessibility` — digitribe-web/components (66 files) | **0 issues** | ⚠️ Suspicious — 66 components with 0 WCAG issues |

**Bug 1:** `@repo/ui/src` scans only 3 of ~50 .tsx files. Root cause: the SKIP set includes
`__tests__` which is a dir, but there may be a depth or filtering issue with the `.stories.`
filter incorrectly matching files like `Button.stories.tsx` that shouldn't be skipped (they ARE
valid JSX worth checking).

**Bug 2:** digitribe-web 66 components returning 0 issues when quality-pipeline independently
found 8 accessibility issues in the same project. The inline accessibility stage uses a different
(broader) rule set. The standalone tool's rules may be too narrow for modern JSX patterns.

---

### 5. generate-tests

| Test | Result | Status |
|------|--------|--------|
| `generate_tests` — UI Button component | 1 test suite generated | ✅ Works |
| `generate_tests_for_directory` — ai-builder/components | 3 test files generated | ✅ Works |
| `generate_tests_for_directory` — digitribe-web/components | **31 test files generated** | ✅ Works |
| `generate_tests` — tribehq page.tsx (Next.js server component) | Correctly skipped | ✅ Works |

**Gap:** Generated tests are syntactically correct but minimal. A button component with 5 props
generates only 1 `it()` block. Real-world usefulness is low without multi-variant tests.

---

### 6. quality-pipeline

| Test | Target | Grade | Notable |
|------|--------|-------|---------|
| `run_full_pipeline` | @repo/ui | **F** | 191 test failures (TS errors causing failures) |
| `run_full_pipeline` | ai-builder | **F** | Tests: skip (no script), 11 a11y issues, 47 design token violations |
| `run_full_pipeline` | tribehq (Next.js) | **D** | Tests: skip (Playwright only), 35 a11y issues |
| `run_full_pipeline` | dashcraft | **F** | Tests: warn "Could not parse output" |
| `run_full_pipeline` | digitribe-web | **F** | Tests: warn "Could not parse output", 488 hardcoded values |

**Bug 1:** `Tests: warn — Could not parse test output` for dashcraft and digitribe-web.
Both have Playwright (`playwright.config.ts`) but no vitest/jest config. The tool detects
`package.json test script` as present but then can't invoke it (it's `playwright test`, not
vitest/jest). **Fix: detect Playwright-only projects and return `skip` with message.**

**Bug 2:** For tribehq (Playwright config present at root), the tool should detect it and note  
"Playwright e2e tests detected — unit test runner not found" as the stage summary.

**All 5 stages functional.** Output structure is clear and useful.

---

### 7. json-viewer

| Test | Result | Status |
|------|--------|--------|
| `view_json` — simple JSON string | HTML generated, stats correct | ✅ Works |
| `view_json` — from file via inline data | Works | ✅ Works |
| `list_responses` | Lists saved viewers | ✅ Works |

**Gap:** No `view_json_file` tool that accepts a file path directly. Users have to read the file
and pass raw JSON as a string argument — cumbersome for large files.

---

### 8. component-factory

| Test | Result | Status |
|------|--------|--------|
| `list_templates` | 41 templates (correct) | ✅ Works |
| `generate_component` — Button to /tmp | 6 files generated | ✅ Works |
| `check_component_exists` — button in @repo/ui/src | `exists: false` | ⚠️ False negative |

**Bug:** `check_component_exists` looks for `<outputPath>/<name>/<name>.tsx` directory structure.
But @repo/ui stores components as `src/Button.tsx` (flat), not `src/Button/Button.tsx`. The tool
assumes all components use the directory-per-component layout it creates.

**Gap:** `review_component` and `improve_component` tools not tested — need real review output.

---

### 9. code-modernizer

| Test | Result | Status |
|------|--------|--------|
| Convert JSX button component (`.js` → `.tsx`) | File renamed, **no types added** | ❌ Major Gap |
| `dryRun: true` — preview mode | Returns file list but **no content preview** | ❌ Gap |

**Critical Gap:** The tool's core value prop is adding TypeScript type annotations, but the
converted file is byte-for-byte identical to the input (just renamed). The type inference
engine (`ast-parser.ts`) runs but produces no meaningful output.

Example: Input has `function Button({label, onClick, disabled})`. Expected output:
```ts
interface ButtonProps { label: string; onClick: () => void; disabled?: boolean; }
function Button({ label, onClick, disabled }: ButtonProps) { ... }
```
Actual output: unchanged, just `.tsx` extension.

**dryRun missing preview:** When `dryRun: true`, the response should include `previewContent`
showing the would-be TypeScript output. Currently returns file names only.

---

## Summary: Bugs to Fix (by severity)

### Critical
| # | Tool | Bug | Impact |
|---|------|-----|--------|
| 1 | dep-auditor | Hardcoded `apps/`, `packages/`, `tools/` dirs — misses nested workspaces | Wrong audit results |
| 2 | code-modernizer | No type annotations generated — file just gets renamed | Tool is useless |

### High
| # | Tool | Bug | Impact |
|---|------|-----|--------|
| 3 | quality-pipeline | Playwright-only projects → "Could not parse test output" instead of skip | Misleading grade |
| 4 | accessibility-checker | @repo/ui only scans 3/50 .tsx files | Incomplete audit |
| 5 | accessibility-checker | digitribe-web 66 components → 0 issues (false negatives) | Missed violations |
| 6 | component-factory | `check_component_exists` assumes directory layout — false negatives | Wrong result |

### Medium
| # | Tool | Bug | Impact |
|---|------|-----|--------|
| 7 | dep-auditor | No fallback when 0 packages found (single-pkg monorepo) | Silent failure |
| 8 | monorepo-manager | No clear error for non-monorepo paths | Confusing output |
| 9 | code-modernizer | dryRun returns no preview content | Useless dry-run |
| 10 | json-viewer | No `view_json_file` tool (requires passing raw JSON string) | Bad UX |
| 11 | monorepo-manager | Missing `sync_config` tool (registered in plan but absent in index) | Missing feature |

### Low / Enhancement
| # | Tool | Enhancement |
|---|------|-------------|
| 12 | generate-tests | Generated tests too minimal (1 case per exported symbol) |
| 13 | typescript-enforcer | dep-auditor itself scores 0/10 — dogfood cleanup needed |
| 14 | quality-pipeline | Grades are strict (F for 191 test failures in @repo/ui) — expected, but worth noting |
| 15 | quality-pipeline | Design Tokens stage: 488 hardcoded values in digitribe-web — some may be CSS custom properties |

---

## Dynamic Tooling Gaps (cross-cutting)

All tools currently assume one of:
- **Turborepo standard layout**: `apps/`, `packages/`, `tools/` at root
- **Source in `src/`**: Many tools default to or require `src/` directory

Real-world project shapes that currently break or return wrong results:
| Shape | Tools affected |
|-------|---------------|
| Nested workspace paths (`apps/web/*`) | dep-auditor |
| No `src/` dir (Next.js App Router: `app/`, `components/`) | quality-pipeline (scan paths), typescript-enforcer (user must specify path) |
| Single-package monorepo (pnpm-workspace.yaml + no sub-packages) | dep-auditor, monorepo-manager |
| Playwright-only test suite | quality-pipeline Tests stage |
| Flat component files (not directory-per-component) | component-factory `check_component_exists` |

---

## What Works Well

- **monorepo-manager**: Comprehensive, accurate, handles complex real-world monorepos
- **typescript-enforcer**: Fast, accurate, works on any directory
- **quality-pipeline stages**: Type safety, performance, design tokens all give real signal
- **generate-tests**: Correctly skips Next.js server components; batch generation works
- **json-viewer**: Reliable, generates proper HTML viewer
- **component-factory generate**: 41 templates, generates complete component scaffold
- **dep-auditor find_duplicate_deps**: Accurate version conflict detection
- **All tools**: No crashes on any real-world target after Phase 1 safety fixes
