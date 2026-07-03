import { describe, it, expect } from 'vitest';
import { deriveScaffoldOptions, collectManualReview, gradeMigration, buildNextSteps, type CraProfileLike } from './core.js';

const base: CraProfileLike = {
  isCRA: true, ejected: false, craco: false, publicUrlUsed: false, svgReactComponentImport: false,
  proxy: { type: 'none' }, serviceWorker: false, envVars: [], testRunner: 'jest',
};

describe('deriveScaffoldOptions', () => {
  it('maps svgr, proxy, homepage from the profile', () => {
    const o = deriveScaffoldOptions({ ...base, svgReactComponentImport: true, proxy: { type: 'package-json', target: 'http://x' }, homepage: '/app' }, 'Shop');
    expect(o.svgr).toBe(true);
    expect(o.proxyTarget).toBe('http://x');
    expect(o.homepage).toBe('/app');
    expect(o.appName).toBe('Shop');
  });
});

describe('collectManualReview', () => {
  it('flags ejection, setupProxy, service worker, publicUrl, dynamic env, unsupported plugins', () => {
    const r = collectManualReview({ ...base, ejected: true, proxy: { type: 'setupProxy' }, serviceWorker: true, publicUrlUsed: true }, ['WeirdPlugin'], 2);
    expect(r.join(' ')).toMatch(/Ejected/);
    expect(r.join(' ')).toMatch(/setupProxy/);
    expect(r.join(' ')).toMatch(/loadEnv/);
    expect(r.join(' ')).toMatch(/[Ss]ervice worker/);
    expect(r.join(' ')).toMatch(/PUBLIC_URL/);
    expect(r.join(' ')).toMatch(/dynamic/);
    expect(r.join(' ')).toMatch(/WeirdPlugin/);
  });

  it('is empty for a clean modern CRA', () => {
    expect(collectManualReview(base)).toEqual([]);
  });

  it('flags eslint-config-react-app since it depends on react-scripts being removed (real-cra-app dogfood finding)', () => {
    // Found dogfooding against a genuine `create-react-app --template typescript`
    // fixture: craconfig-analyzer detects eslintConfigReactApp but nothing
    // surfaced it as an actionable review item — a real user would have no
    // signal that their lint config breaks once react-scripts is removed.
    const r = collectManualReview({ ...base, eslintConfigReactApp: true });
    expect(r.join(' ')).toMatch(/eslint-config-react-app/);
    expect(r.join(' ')).toMatch(/react-scripts/);
  });
});

describe('buildNextSteps', () => {
  it('always tells the user to drop unused React imports before building (QA harness regression)', () => {
    // Found dogfooding the real "apply" path against a genuine create-react-app
    // fixture: vite-project-scaffolder's tsconfig sets noUnusedLocals and uses
    // the react-jsx transform, so `import React from 'react'` (present in
    // virtually every CRA file) becomes a build-breaking TS6133. The toolkit
    // already ships codemod-runner's default-react-import-drop rule for this.
    const steps = buildNextSteps('/app');
    expect(steps.some((s) => s.includes('default-react-import-drop'))).toBe(true);
    expect(steps.some((s) => s.includes('env-var-migrator'))).toBe(true);
    expect(steps.some((s) => s.includes('jest-to-vitest-migrator'))).toBe(true);
  });
});

describe('gradeMigration', () => {
  it('grades A when clean, worse as review items grow, F on failure', () => {
    expect(gradeMigration([{ step: 'a', ok: true, note: '' }], [])).toBe('A');
    expect(gradeMigration([{ step: 'a', ok: true, note: '' }], ['x', 'y', 'z'])).toBe('C');
    expect(gradeMigration([{ step: 'a', ok: false, note: '' }], [])).toBe('F');
  });
});
