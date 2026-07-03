import { describe, it, expect } from 'vitest';
import { generateEnvConfig } from './core.js';

describe('generateEnvConfig', () => {
  it('generates a Zod env module for Vite with a safeParse boot check', () => {
    const out = generateEnvConfig({ names: ['API_URL', 'FEATURE_FLAG', 'SECRET_KEY'], target: 'vite' });
    if (!out.ok) throw new Error(out.error);
    const { code } = out.result;
    expect(code).toContain("import { z } from 'zod'");
    expect(code).toContain('const envSchema = z.object({');
    expect(code).toContain('VITE_API_URL: z.string().url(),');
    expect(code).toContain('envSchema.safeParse(import.meta.env)');
    expect(code).toContain('export type Env = z.infer<typeof envSchema>;');
    expect(out.result.filename).toBe('env.ts');
  });

  it('infers zod validators from the name', () => {
    const out = generateEnvConfig({ names: ['PORT', 'ENABLE_ANALYTICS', 'API_TOKEN'] });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('z.coerce.number()');
    expect(out.result.code).toContain("z.enum(['true', 'false'])");
    expect(out.result.code).toContain('z.string().min(1)');
  });

  it('targets Next with process.env and NEXT_PUBLIC_ prefix', () => {
    const out = generateEnvConfig({ names: ['APP_NAME'], target: 'next' });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.code).toContain('process.env');
    expect(out.result.code).toContain('NEXT_PUBLIC_APP_NAME');
  });

  it('parses an .env.example', () => {
    const out = generateEnvConfig({ envExample: '# comment\nVITE_API_URL=http://x\nVITE_KEY=abc\n' });
    expect(out.ok && out.result.names).toEqual(['VITE_API_URL', 'VITE_KEY']);
  });

  it('rejects when no vars are given', () => {
    expect(generateEnvConfig({}).ok).toBe(false);
  });
});
