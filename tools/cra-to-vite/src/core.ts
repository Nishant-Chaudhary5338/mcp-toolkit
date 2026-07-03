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
}

export interface ViteScaffoldOptions {
  appName?: string;
  srcAlias?: boolean;
  svgr?: boolean;
  proxyTarget?: string;
  homepage?: string;
}

/** Map a CRA profile to the vite-project-scaffolder options. */
export function deriveScaffoldOptions(profile: CraProfileLike, appName = 'App'): ViteScaffoldOptions {
  return {
    appName,
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
  if (profile.proxy.type === 'setupProxy') review.push('src/setupProxy.js detected: port the proxy rules into vite.config server.proxy by hand.');
  if (profile.serviceWorker) review.push('Service worker / PWA registration detected: decide keep (vite-plugin-pwa) or drop.');
  if (profile.publicUrlUsed) review.push('%PUBLIC_URL% usage detected: rewrite to / or import assets; verify public/ paths.');
  if (dynamicEnv > 0) review.push(`${dynamicEnv} dynamic process.env[...] access(es) can't be statically rewritten — fix by hand.`);
  for (const p of unsupportedPlugins) review.push(`Webpack plugin "${p}" has no known Vite equivalent.`);
  if (profile.absoluteImportsBaseUrl) review.push(`Absolute imports (baseUrl "${profile.absoluteImportsBaseUrl}") mapped to the '@' alias — verify all bare imports resolve.`);
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
