// env-config-generator CORE — pure logic (no MCP transport).
//
// A list of env var names (or an .env.example) → a Zod-validated env module
// that throws on boot with a readable error. Enforces "Zod at every boundary"
// for the one boundary the toolkit didn't cover: environment variables.

export type EnvTarget = 'vite' | 'next';

export interface EnvConfigResult {
  code: string;
  filename: string;
  names: string[];
}

export type EnvConfigOutcome =
  | { ok: true; result: EnvConfigResult }
  | { ok: false; error: string };

export interface EnvConfigOptions {
  names?: string[];
  envExample?: string;
  target?: EnvTarget;
}

function parseEnvExample(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=')[0]!.trim())
    .filter(Boolean);
}

function zodFor(name: string): string {
  const n = name.toLowerCase();
  if (/(url|endpoint|origin|host)/.test(n)) return 'z.string().url()';
  if (/(port|count|max|min|timeout|size)/.test(n)) return 'z.coerce.number()';
  if (/(enable|disable|flag|^is_|_is_|feature)/.test(n)) return "z.enum(['true', 'false']).transform((v) => v === 'true')";
  if (/(key|secret|token|password|dsn)/.test(n)) return 'z.string().min(1)';
  return 'z.string().min(1)';
}

export function generateEnvConfig(opts: EnvConfigOptions = {}): EnvConfigOutcome {
  const target: EnvTarget = opts.target ?? 'vite';
  if (target !== 'vite' && target !== 'next') return { ok: false, error: `Unknown target "${target}". Use "vite" or "next".` };

  let names = opts.names ?? [];
  if ((!names || names.length === 0) && opts.envExample) names = parseEnvExample(opts.envExample);
  names = [...new Set(names.filter(Boolean))];
  if (names.length === 0) return { ok: false, error: 'Provide "names" or an "envExample" with at least one variable.' };

  const prefix = target === 'vite' ? 'VITE_' : 'NEXT_PUBLIC_';
  const source = target === 'vite' ? 'import.meta.env' : 'process.env';

  const lines = names.map((raw) => {
    const name = raw.startsWith(prefix) || raw.startsWith('NEXT_PUBLIC_') || raw.startsWith('VITE_') ? raw : `${prefix}${raw}`;
    return `  ${name}: ${zodFor(name)},`;
  });

  const code = `import { z } from 'zod';

const envSchema = z.object({
${lines.join('\n')}
});

/**
 * Validated, typed environment. Throws on boot if a variable is missing or
 * malformed — fail fast instead of \`undefined\` deep in the app.
 */
export const env = (() => {
  const parsed = envSchema.safeParse(${source});
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
})();

export type Env = z.infer<typeof envSchema>;
`;

  return { ok: true, result: { code, filename: 'env.ts', names } };
}
