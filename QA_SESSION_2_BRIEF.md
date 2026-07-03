# QA Session 2 — Scope Brief

> Handoff for the next QA pass. Session 1's full findings live in [`DOGFOOD_FINDINGS.md`](./DOGFOOD_FINDINGS.md) — read that first for context, established conventions (`(QA harness regression)` / `(QA fuzz regression)` test-comment tags, core-first fix discipline, "measure, don't guess" for perf/ReDoS claims), and what's already closed out. This doc lists only what's genuinely still open.

## Already complete (do not re-run)

- FieldSchema fuzz matrix across all 8 CRUD-factory generators — zero findings on final rerun.
- Command-injection audit of every `execSync`/`execFileSync` call — fixed.
- XSS audit of the dashboard `esc()` path — no bug found, regression-tested.
- Path/file adversarial matrix — **all 30 path-taking tools** now empirically tested (2 passes). One real bug (docs-generator OOM), fixed.
- ReDoS timing sweep on the highest-risk regex shapes (nested/adjacent unbounded quantifiers) — 3 real quadratic-blowup bugs found and fixed, with before/after timing proof.
- `workflow-runner`'s 4 dataLayer×router combinations + idempotency — tested, passing.

## Open work for session 2

### 1. Non-functional sweep (not started)
- **Performance on a large synthetic repo** (10k+ files): does any analyzer (`legacy-analyzer`, `render-analyzer`, `dep-auditor`, `monorepo-manager`, `component-reviewer`) degrade non-linearly, or take an unreasonable time, when pointed at a repo of that size? Time it — don't guess.
- **Output idempotency**: for generators/analyzers whose output should be deterministic, confirm identical input → byte-identical output across repeated runs (no embedded timestamps, no `Math.random()`, no unstable object-key/array ordering leaking into generated code or reports).
- **Node 20 vs Node 22 compatibility**: run the full build + test suite under both. Watch for any API used that's version-gated (e.g. newer `fs`/`crypto` APIs) with no fallback.

### 2. Duplicate `pascal()` cleanup (logged, not fixed)
`svg-to-component`, `mcp-tool-factory`, `states-scaffolder`, `type-from-json`, and `zustand-store-generator` each carry a local `pascal()` copy instead of importing the shared, sanitizing helper from `@mcp-showcase/shared` (fixed there this session — see finding F1/F4 in `DOGFOOD_FINDINGS.md`). None were exercised by the FieldSchema fuzz harness (they take non-schema input), so no failure was *measured*, but they carry the same theoretical identifier-unsafety risk. Each has a different fallback word (`'Icon'`, none, `'Resource'`, `'Value'`, `'Store'`) — needs individual attention, not a blanket find-replace. Recommend: for each, fuzz its actual input type (filename / tool spec / free-text name) the same way `fuzz-schema.mjs` did for FieldSchema, confirm whether it's actually reachable, then fix.

### 3. Two logged UX inconsistencies (optional polish, not bugs)
- `dep-auditor`: returns `{success:true, packagesAudited:1...}` even for a non-existent/empty/binary path — arguably too lenient. Decide if this should be a clean error instead.
- `mcp-tool-improviser`: a missing-path error surfaces as a protocol-level `McpError` instead of the tool's own `{success:false}` shape (every sibling tool uses the latter). Cosmetic — but worth fixing for consistency if touching this tool anyway.

### 4. ReDoS residual list (visually reviewed only, not individually timed)
`env-var-migrator`, `jest-to-vitest-migrator`, `i18n-extractor`, `infer-fields`, `svg-to-component`, `type-from-json`, `states-scaffolder`, `zustand-store-generator`, `visual-regression-setup`, `playwright-scaffolder`, `mcp-tool-factory`, `bundle-budget-guard`. All use simple, bounded, anchored patterns with no adjacent/nested unbounded quantifiers — low priority, but "we looked and it seemed fine" isn't the same bar as the 3 bugs this session found by actually timing things. If session 2 has budget, time them the same way `docs-generator`'s and `react-compiler-migrator`'s regexes were timed (standalone Node script, baseline + adversarial input, real numbers).

### 5. Deeper composition/chain testing (not started)
Session 1 only matrix-tested `workflow-runner`'s single routine (`schema_to_feature`) across its 4 dataLayer/router combinations. Not yet tested:
- Chained tool calls across *different* tools, e.g. `review-gate` → `a11y-autofixer` → `review-gate` again (does the second review-gate pass see the fix and clear the finding?).
- `mcp-tool-factory`'s `scaffold_tool` → `wire_tool` → `verify_tool` run **twice** against the same real on-disk toolkit checkout (not just the pure `wirePackageJson`/`wireBinCli` unit-level idempotency already tested) — confirm no corruption of `bin/cli.mjs` or root `package.json` on a repeated real run.

## Kickoff prompt for session 2

Paste this to start the next session:

```
Continue QA dogfooding on mcp-react-toolkit (this repo). Read QA_SESSION_2_BRIEF.md
first — it lists exactly what's open; don't re-run anything marked complete there.
DOGFOOD_FINDINGS.md has full session-1 findings and the established conventions
(core-first fixes, regression-test tagging, "measure don't guess" for perf/ReDoS).

Work through QA_SESSION_2_BRIEF.md's five open items in this order:

1. Non-functional sweep — generate a synthetic repo with 10k+ files (varied,
   realistic component/hook/test file shapes, not just empty stubs) and time
   legacy-analyzer, render-analyzer, dep-auditor, monorepo-manager, and
   component-reviewer against it. Flag anything non-linear or unreasonably
   slow with real numbers. Separately, for 3-4 generators/analyzers whose
   output should be deterministic, run them twice on identical input and
   diff the output byte-for-byte — flag any embedded timestamp, random
   ordering, or Math.random()/Date.now() leaking into results. Then run the
   full build + test suite under both Node 20 and Node 22 (nvm use / volta
   pin, whichever is available) and report any version-specific failure.

2. Fuzz the 5 tools with duplicate local pascal() helpers (svg-to-component,
   mcp-tool-factory, states-scaffolder, type-from-json, zustand-store-generator)
   against adversarial input matching what each actually consumes (filenames
   for svg-to-component, tool-spec names for mcp-tool-factory, free-text names
   for the rest) — non-ASCII, punctuation, empty string, per the pattern
   fuzz-schema.mjs already used for FieldSchema. Fix any tool where it's
   actually reachable and breaks; for the others just confirm and note "not
   reachable, no fix needed" — don't blanket-fix without a measured failure.

3. Decide and fix (or explicitly decline with reasoning) the two logged UX
   inconsistencies: dep-auditor's overly lenient handling of bad paths, and
   mcp-tool-improviser's error-shape mismatch vs its sibling tools.

4. Time the ReDoS residual list (env-var-migrator, jest-to-vitest-migrator,
   i18n-extractor, infer-fields, svg-to-component, type-from-json,
   states-scaffolder, zustand-store-generator, visual-regression-setup,
   playwright-scaffolder, mcp-tool-factory, bundle-budget-guard) the same way
   docs-generator's and react-compiler-migrator's regexes were timed this
   session — standalone Node scripts, baseline + adversarial input, real
   numbers, not visual inspection. Fix anything that measures as a real
   quadratic blowup.

5. Composition/chain testing: run review-gate -> a11y-autofixer -> review-gate
   again on a component with real a11y issues, confirm the second pass
   actually clears the fixed findings. Run mcp-tool-factory's
   scaffold_tool -> wire_tool -> verify_tool sequence twice against a real
   on-disk toolkit checkout (use a git worktree or throwaway clone, not this
   working copy) and confirm no corruption of bin/cli.mjs or root
   package.json on the repeated run.

For every real bug found: fix in src/core.ts (never only in index.ts if a
core.ts split exists), add a regression test tagged "(QA harness regression)"
or "(QA fuzz regression)" matching existing style, then run
`npm run build && npx vitest run` in that tool's directory before moving on.
After all fixes, run the full monorepo `npm run build && npm test` from the
repo root and confirm zero regressions. Update DOGFOOD_FINDINGS.md with a new
dated section following its existing format. Do not commit without asking me
first. Report back with a summary of what was found/fixed and what, if
anything, is still open after this pass.
```

## Working conventions to preserve
- Core-first: fix in `src/core.ts`, thin `index.ts` shell. Never inline a fix only in `index.ts` if a `core.ts` split exists.
- Every fix gets a regression test in the same tool's `core.test.ts`/`index.test.ts`, tagged `(QA harness regression)` or `(QA fuzz regression)` to match existing convention.
- Verify claims empirically (timing scripts, real fs fixtures) — this session caught two cases where "looks fine" would have been wrong (a regex that measured fine at 100k lines but was quadratic, and a size guard nobody had added before a 72MB file actually OOM'd the process).
- Rebuild + run the full monorepo `npm run build && npm test` after each fix, not just the touched tool, before considering it done.
- Never `git commit` without the user's explicit go-ahead in that turn.
