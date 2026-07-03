// barrel-generator CORE — pure logic (no MCP transport).
//
// Build an index.ts barrel that re-exports every module in a folder. Kills the
// hand-maintained "export * from './X'" list that drifts out of sync.

export interface BarrelResult {
  code: string;
  filename: string;
  count: number;
}

const SKIP_RE = /(^index\.)|(\.test\.)|(\.spec\.)|(\.stories\.)|(\.d\.ts$)|(\.css$)|(\.scss$)/;
const SRC_RE = /\.(tsx?|jsx?)$/;

function moduleName(file: string): string {
  return file.replace(SRC_RE, '');
}

/** Given the file names in a folder, build the barrel source. */
export function buildBarrel(files: string[], opts: { named?: boolean } = {}): BarrelResult {
  const modules = files
    .filter((f) => SRC_RE.test(f) && !SKIP_RE.test(f))
    .map(moduleName)
    .sort((a, b) => a.localeCompare(b));

  const unique = [...new Set(modules)];
  const lines = unique.map((m) => {
    // PascalCase modules → likely a named component/type export; still safest to star-export.
    if (opts.named && /^[A-Z]/.test(m)) return `export { ${m} } from './${m}';`;
    return `export * from './${m}';`;
  });

  const code = lines.length
    ? `${lines.join('\n')}\n`
    : '// no modules to re-export\nexport {};\n';

  return { code, filename: 'index.ts', count: unique.length };
}
