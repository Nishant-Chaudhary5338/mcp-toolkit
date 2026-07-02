// docs-generator CORE — pure logic (no MCP transport).
//
// Generate Markdown docs from source text:
//   generateToolDocs     — an MCP tool's index.ts → README (server + actions)
//   generateApiReference — a TS module → API reference (exports + JSDoc)
// Both are pure (take source text), so they are testable and composable.

export interface ToolDocsResult {
  code: string;
  filename: string;
  toolName: string;
  actions: { name: string; description: string }[];
}

export interface ApiRefResult {
  code: string;
  filename: string;
  symbols: { kind: string; name: string; signature: string; doc: string }[];
}

/** Grab the first two string-literal arguments of each addTool(...) call. */
function extractActions(source: string): { name: string; description: string }[] {
  const actions: { name: string; description: string }[] = [];
  const re = /this\.addTool\(\s*(['"`])([\s\S]*?)\1\s*,\s*(['"`])([\s\S]*?)\3/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const name = m[2];
    const description = m[4].replace(/\s*\+\s*$/, '').replace(/\s+/g, ' ').trim();
    actions.push({ name, description });
  }
  return actions;
}

/** Pull the property names of the inputSchema following an addTool for `action`. */
function extractArgs(source: string, action: string): string[] {
  const at = source.indexOf(`'${action}'`) >= 0 ? source.indexOf(`'${action}'`) : source.indexOf(`"${action}"`);
  if (at < 0) return [];
  const slice = source.slice(at, at + 2000);
  const propsMatch = slice.match(/properties:\s*\{([\s\S]*?)\},?\s*required/);
  if (!propsMatch) return [];
  return [...propsMatch[1].matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{\s*type:/g)].map((x) => x[1]);
}

export function generateToolDocs(source: string): ToolDocsResult {
  const nameMatch = source.match(/super\(\s*\{\s*name:\s*(['"`])([^'"`]+)\1/);
  const toolName = nameMatch ? nameMatch[2] : 'unknown-tool';
  const actions = extractActions(source);

  const sections = actions
    .map((a) => {
      const args = extractArgs(source, a.name);
      const argList = args.length ? args.map((p) => `- \`${p}\``).join('\n') : '_No arguments._';
      return `### \`${a.name}\`\n\n${a.description}\n\n**Arguments:**\n${argList}\n\n**Usage:**\n\`\`\`jsonc\n{ "name": "${a.name}", "arguments": { ${args.map((p) => `"${p}": …`).join(', ')} } }\n\`\`\``;
    })
    .join('\n\n');

  const code = `# ${toolName}

An MCP server exposing ${actions.length} tool${actions.length === 1 ? '' : 's'}.

## Run

\`\`\`bash
npx mcp-react-toolkit ${toolName}
\`\`\`

## Tools

${sections || '_No tools registered._'}
`;

  return { code, filename: `${toolName}.README.md`, toolName, actions };
}

const EXPORT_RE = /(\/\*\*[\s\S]*?\*\/\s*)?export\s+(?:async\s+)?(function|interface|type|const|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)([^\n{=;]*)/g;

function cleanDoc(block: string | undefined): string {
  if (!block) return '';
  return block
    .replace(/\/\*\*|\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .filter((l) => l && !l.startsWith('@'))
    .join(' ')
    .trim();
}

export function generateApiReference(source: string, filename = 'module'): ApiRefResult {
  const symbols: ApiRefResult['symbols'] = [];
  let m: RegExpExecArray | null;
  while ((m = EXPORT_RE.exec(source)) !== null) {
    const [, docBlock, kind, name, tail] = m;
    symbols.push({ kind, name, signature: `${kind} ${name}${(tail ?? '').replace(/\s+/g, ' ').trimEnd()}`.trim(), doc: cleanDoc(docBlock) });
  }

  const base = filename.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') ?? 'module';
  const rows = symbols
    .map((s) => `### \`${s.name}\`\n\n_${s.kind}_ · \`${s.signature}\`\n\n${s.doc || '_No description._'}`)
    .join('\n\n');

  const code = `# ${base} — API reference

${symbols.length} exported symbol${symbols.length === 1 ? '' : 's'}.

${rows || '_No exports found._'}
`;

  return { code, filename: `${base}.api.md`, symbols };
}
