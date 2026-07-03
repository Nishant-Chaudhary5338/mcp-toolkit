import { describe, it, expect } from 'vitest';
import { migrateSource, migrateEnvFile, shouldSkipEnvRewrite } from './core.js';

describe('migrateSource', () => {
  it('rewrites REACT_APP_ reads to import.meta.env.VITE_', () => {
    const r = migrateSource('const u = process.env.REACT_APP_API_URL; const k = process.env.REACT_APP_KEY;');
    expect(r.code).toContain('import.meta.env.VITE_API_URL');
    expect(r.code).toContain('import.meta.env.VITE_KEY');
    expect(r.count).toBe(2);
  });

  it('flags dynamic process.env access and keeps NODE_ENV count', () => {
    const r = migrateSource('const v = process.env[key];\nif (process.env.NODE_ENV === "test") {}');
    expect(r.dynamicAccess).toHaveLength(1);
    expect(r.nodeEnvReads).toBe(1);
  });
});

describe('shouldSkipEnvRewrite', () => {
  // Found dogfooding the real "apply" path against a genuine create-react-app
  // fixture: env-var-migrator rewrote process.env.REACT_APP_X to
  // import.meta.env.VITE_X inside setupProxy.js, which is loaded by CRA's dev
  // server via plain Node require() — import.meta.env is a hard SyntaxError
  // there. The file is also meant to be ported into vite.config.ts and
  // discarded, not env-rewritten in place.
  it('skips setupProxy.js — a Node-context file, not bundled application code', () => {
    expect(shouldSkipEnvRewrite('setupProxy.js')).toBe(true);
  });
  it('does not skip ordinary application source', () => {
    expect(shouldSkipEnvRewrite('App.tsx')).toBe(false);
    expect(shouldSkipEnvRewrite('setupTests.ts')).toBe(false);
  });
});

describe('migrateEnvFile', () => {
  it('renames REACT_APP_ keys and leaves others', () => {
    const r = migrateEnvFile('REACT_APP_API=http://x\n# comment\nOTHER=1\nREACT_APP_KEY=abc');
    expect(r.text).toContain('VITE_API=http://x');
    expect(r.text).toContain('VITE_KEY=abc');
    expect(r.text).toContain('OTHER=1');
    expect(r.count).toBe(2);
  });
});
