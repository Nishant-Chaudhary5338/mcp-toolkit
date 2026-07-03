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
  // Bounded to 2000 chars per capture: names/descriptions are short strings,
  // and an unbounded [\s\S]*? here is quadratic on adversarial input (many
  // "addTool(" occurrences with an unterminated quote) — found via QA fuzz timing.
  const re = /this\.addTool\(\s*(['"`])([\s\S]{0,2000}?)\1\s*,\s*(['"`])([\s\S]{0,2000}?)\3/g;
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

// No leading `(\/\*\*[\s\S]*?\*\/\s*)?` group: that lazy span used to be quadratic on
// adversarial input (many unterminated "/**" comments, each rescanned to end-of-string
// looking for a "*/" that never comes) — found via QA fuzz timing. The optional doc-comment
// is instead recovered below with a bounded, non-backtracking string scan.
const EXPORT_RE = /export\s+(?:async\s+)?(function|interface|type|const|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)([^\n{=;]*)/g;

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

/** Find a `/** ... *\/` block immediately preceding `matchStart` (only whitespace between). */
function findLeadingDocBlock(source: string, matchStart: number): string | undefined {
  let end = matchStart;
  while (end > 0 && /\s/.test(source[end - 1] as string)) end--;
  if (end < 2 || source[end - 2] !== '*' || source[end - 1] !== '/') return undefined;
  const start = source.lastIndexOf('/**', end - 2);
  if (start === -1) return undefined;
  return source.slice(start, end);
}

export function generateApiReference(source: string, filename = 'module'): ApiRefResult {
  const symbols: ApiRefResult['symbols'] = [];
  let m: RegExpExecArray | null;
  while ((m = EXPORT_RE.exec(source)) !== null) {
    const [, kind, name, tail] = m;
    const docBlock = findLeadingDocBlock(source, m.index);
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
