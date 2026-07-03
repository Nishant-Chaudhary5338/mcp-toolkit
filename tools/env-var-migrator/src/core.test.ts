import { describe, it, expect } from 'vitest';
import { migrateSource, migrateEnvFile } from './core.js';

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

describe('migrateEnvFile', () => {
  it('renames REACT_APP_ keys and leaves others', () => {
    const r = migrateEnvFile('REACT_APP_API=http://x\n# comment\nOTHER=1\nREACT_APP_KEY=abc');
    expect(r.text).toContain('VITE_API=http://x');
    expect(r.text).toContain('VITE_KEY=abc');
    expect(r.text).toContain('OTHER=1');
    expect(r.count).toBe(2);
  });
});
