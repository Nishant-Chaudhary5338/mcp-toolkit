import { describe, it, expect } from 'vitest';
import { deriveScaffoldOptions, collectManualReview, gradeMigration, type CraProfileLike } from './core.js';

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
    expect(r.join(' ')).toMatch(/[Ss]ervice worker/);
    expect(r.join(' ')).toMatch(/PUBLIC_URL/);
    expect(r.join(' ')).toMatch(/dynamic/);
    expect(r.join(' ')).toMatch(/WeirdPlugin/);
  });

  it('is empty for a clean modern CRA', () => {
    expect(collectManualReview(base)).toEqual([]);
  });
});

describe('gradeMigration', () => {
  it('grades A when clean, worse as review items grow, F on failure', () => {
    expect(gradeMigration([{ step: 'a', ok: true, note: '' }], [])).toBe('A');
    expect(gradeMigration([{ step: 'a', ok: true, note: '' }], ['x', 'y', 'z'])).toBe('C');
    expect(gradeMigration([{ step: 'a', ok: false, note: '' }], [])).toBe('F');
  });
});
