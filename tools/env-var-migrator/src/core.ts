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
