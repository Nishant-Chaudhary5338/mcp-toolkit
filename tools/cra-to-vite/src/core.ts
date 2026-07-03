// cra-to-vite CORE — pure logic (no MCP transport).
//
// The orchestration brain for the CRA→Vite migration. Pure functions that turn
// the craconfig-analyzer profile into scaffolder options and a human-review
// checklist. The index.ts composes the six CRA-tool cores in-process (analyze →
// plan → scaffold → migrate) and assembles the ModernizationReport.

export interface CraProfileLike {
  isCRA: boolean;
  ejected: boolean;
  craco: boolean;
  homepage?: string;
  publicUrlUsed: boolean;
  svgReactComponentImport: boolean;
  proxy: { type: string; target?: string };
  serviceWorker: boolean;
  absoluteImportsBaseUrl?: string;
  envVars: string[];
  testRunner: string;
  eslintConfigReactApp?: boolean;
  hasSetupTests?: boolean;
}

export interface ViteScaffoldOptions {
  appName?: string;
  srcAlias?: boolean;
  svgr?: boolean;
  proxyTarget?: string;
  homepage?: string;
  vitest?: boolean;
  vitestSetupFile?: string;
}

/**
 * Map a CRA profile to the vite-project-scaffolder options. Always requests a
 * Vitest test block (dependency-remapper always adds vitest+jsdom for a CRA
 * source), wiring setupTests.ts when the source project had one. Missing
 * before — found dogfooding the real "apply" path against a genuine
 * create-react-app fixture: without it, every migrated app's tests fail with
 * no jsdom environment configured.
 */
export function deriveScaffoldOptions(profile: CraProfileLike, appName = 'App'): ViteScaffoldOptions {
  return {
    appName,
    vitest: true,
    vitestSetupFile: profile.hasSetupTests ? './src/setupTests.ts' : undefined,
    srcAlias: Boolean(profile.absoluteImportsBaseUrl) || true,
    svgr: profile.svgReactComponentImport,
    proxyTarget: profile.proxy.type === 'package-json' ? profile.proxy.target : undefined,
    homepage: profile.homepage,
  };
}

/** Build the human-review checklist — the things the pipeline can't safely auto-do. */
export function collectManualReview(profile: CraProfileLike, unsupportedPlugins: string[] = [], dynamicEnv = 0): string[] {
  const review: string[] = [];
  if (profile.ejected) review.push('Ejected CRA: the hand-edited webpack config must be reviewed and translated by hand.');
  if (profile.proxy.type === 'setupProxy') review.push("src/setupProxy.js detected: port the proxy rules into vite.config server.proxy by hand. Note: vite.config.ts runs in Node, not the browser — use Vite's loadEnv(mode, process.cwd(), '') to read .env values there, not bare process.env or import.meta.env (neither sees your .env file at config-eval time). loadEnv must be imported from 'vite' — the scaffolded vite.config.ts imports defineConfig from 'vitest/config', which does NOT re-export loadEnv (a real, easy mistake: `import { defineConfig } from 'vitest/config'; import { loadEnv } from 'vite';`).");
  if (profile.serviceWorker) review.push('Service worker / PWA registration detected: decide keep (vite-plugin-pwa) or drop.');
  if (profile.publicUrlUsed) review.push('%PUBLIC_URL% usage detected: rewrite to / or import assets; verify public/ paths.');
  if (dynamicEnv > 0) review.push(`${dynamicEnv} dynamic process.env[...] access(es) can't be statically rewritten — fix by hand.`);
  for (const p of unsupportedPlugins) review.push(`Webpack plugin "${p}" has no known Vite equivalent.`);
  if (profile.absoluteImportsBaseUrl) review.push(`Absolute imports (baseUrl "${profile.absoluteImportsBaseUrl}") mapped to the '@' alias — verify all bare imports resolve.`);
  if (profile.eslintConfigReactApp) review.push('eslint-config-react-app detected: it depends on react-scripts (being removed) — migrate to a flat ESLint config (e.g. typescript-eslint + eslint-plugin-react-hooks).');
  return review;
}

export interface JournalEntry { step: string; ok: boolean; note: string }

export function gradeMigration(journal: JournalEntry[], manualReview: string[]): 'A' | 'B' | 'C' | 'D' | 'F' {
  const failed = journal.filter((j) => !j.ok).length;
  if (failed > 0) return 'F';
  if (manualReview.length === 0) return 'A';
  if (manualReview.length <= 2) return 'B';
  if (manualReview.length <= 4) return 'C';
  return 'D';
}

/**
 * The commands/actions a user should run after this report, in order. Always
 * includes the react-jsx / noUnusedLocals codemod step: vite-project-scaffolder's
 * tsconfig sets noUnusedLocals and the modern react-jsx transform, which makes
 * `import React from 'react'` both unneeded and a build-breaking TS6133 in
 * virtually every CRA file — found dogfooding the real "apply" path against a
 * genuine create-react-app fixture. The toolkit already ships the exact fix.
 */
export function buildNextSteps(root: string): string[] {
  return [
    `env-var-migrator migrate_env { path: "${root}", dryRun: false }`,
    `jest-to-vitest-migrator migrate_tests { path: "${root}/src", dryRun: false }`,
    'Copy src/ into the Vite project, install the remapped deps, and run `vite build`.',
    "Run codemod-runner's default-react-import-drop rule on the copied src/ — the react-jsx transform makes `import React from 'react'` both unnecessary and, under the scaffolded tsconfig's noUnusedLocals, a build-breaking error.",
  ];
}
