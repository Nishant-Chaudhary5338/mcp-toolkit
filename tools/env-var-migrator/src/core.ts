// env-var-migrator CORE — pure logic (no MCP transport).
//
// CRA → Vite environment migration: rewrite process.env.REACT_APP_X →
// import.meta.env.VITE_X in source, rename REACT_APP_ keys in .env files, and
// flag dynamic access (process.env[expr]) that can't be statically rewritten.

export interface SourceMigration {
  code: string;
  count: number;
  dynamicAccess: { line: number; text: string }[];
  nodeEnvReads: number;
}

export interface EnvFileMigration {
  text: string;
  count: number;
}

/** Rewrite REACT_APP_ env reads in source; flag dynamic access for manual review. */
export function migrateSource(code: string): SourceMigration {
  let count = 0;
  const out = code.replace(/process\.env\.REACT_APP_([A-Z0-9_]+)/g, (_m, name: string) => {
    count += 1;
    return `import.meta.env.VITE_${name}`;
  });

  const dynamicAccess: { line: number; text: string }[] = [];
  out.split('\n').forEach((raw, i) => {
    // process.env[...] computed access cannot be statically rewritten
    if (/process\.env\[/.test(raw)) dynamicAccess.push({ line: i + 1, text: raw.trim().slice(0, 120) });
  });
  const nodeEnvReads = (out.match(/process\.env\.NODE_ENV/g) ?? []).length;

  return { code: out, count, dynamicAccess, nodeEnvReads };
}

// setupProxy.js is loaded by CRA's dev server via plain Node require() — it is
// NOT processed by any bundler, so `import.meta.env` is invalid syntax there
// (a hard SyntaxError under Node's CommonJS loader). It's also superseded by
// vite.config.ts's server.proxy (cra-to-vite's manualReview already tells the
// user to port it by hand and discard the file), not something to env-rewrite
// in place. Found dogfooding the real "apply" path against a genuine CRA fixture.
const SKIP_FILENAMES = new Set(['setupProxy.js']);

/** True if this source filename should be excluded from env-var rewriting. */
export function shouldSkipEnvRewrite(filename: string): boolean {
  return SKIP_FILENAMES.has(filename);
}

/** Rename REACT_APP_ keys to VITE_ in a .env file's contents. */
export function migrateEnvFile(text: string): EnvFileMigration {
  let count = 0;
  const lines = text.split('\n').map((line) => {
    const m = line.match(/^(\s*)REACT_APP_([A-Z0-9_]+)(\s*=.*)$/);
    if (m) {
      count += 1;
      return `${m[1]}VITE_${m[2]}${m[3]}`;
    }
    return line;
  });
  return { text: lines.join('\n'), count };
}
