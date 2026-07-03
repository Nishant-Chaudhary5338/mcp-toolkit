// react-compiler-migrator CORE — pure logic (no MCP transport).
//
// React 19 Compiler makes most manual memoization redundant. This flags
// useMemo / useCallback / React.memo sites to remove, plus rules-of-hooks red
// flags that would BLOCK the compiler, and produces a best-effort transformed
// source for the simple single-expression cases (complex ones are reported).

export type HintKind = 'useMemo' | 'useCallback' | 'memo' | 'rules-of-hooks';

export interface CompilerHint {
  line: number;
  kind: HintKind;
  message: string;
  autoFixable: boolean;
}

export interface CompilerResult {
  hints: CompilerHint[];
  redundantMemoization: number;
  blockers: number;
  compilerReady: boolean;
}

const HOOK_CALL = /\buse[A-Z]\w*\(/;

/** Analyze source for React-Compiler readiness. Pure — takes source text. */
export function analyzeCompiler(code: string, _file = 'component'): CompilerResult {
  const hints: CompilerHint[] = [];
  const lines = code.split('\n');

  lines.forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    if (t.startsWith('//') || t.startsWith('*')) return;

    if (/\buseMemo\s*\(/.test(raw)) {
      hints.push({ line, kind: 'useMemo', message: 'useMemo is redundant under the React 19 Compiler — remove and let the compiler memoize.', autoFixable: /=\s*useMemo\(\(\)\s*=>/.test(raw) });
    }
    if (/\buseCallback\s*\(/.test(raw)) {
      hints.push({ line, kind: 'useCallback', message: 'useCallback is redundant under the React 19 Compiler — inline the function.', autoFixable: true });
    }
    if (/\b(React\.)?memo\s*\(/.test(raw) && !/\buseMemo\b/.test(raw)) {
      hints.push({ line, kind: 'memo', message: 'React.memo is redundant under the React 19 Compiler — export the component directly.', autoFixable: false });
    }
    // rules-of-hooks: a hook call gated by a condition or after `&&` / inside an if on the same line
    if ((/\bif\s*\(.*\)\s*\{?.*use[A-Z]/.test(raw) || /(&&|\?\s*).*use[A-Z]\w*\(/.test(raw)) && HOOK_CALL.test(raw)) {
      hints.push({ line, kind: 'rules-of-hooks', message: 'Hook appears to be called conditionally — this BLOCKS the React Compiler. Move it to the top level.', autoFixable: false });
    }
  });

  const redundantMemoization = hints.filter((h) => h.kind !== 'rules-of-hooks').length;
  const blockers = hints.filter((h) => h.kind === 'rules-of-hooks').length;
  return { hints, redundantMemoization, blockers, compilerReady: blockers === 0 };
}

/** Best-effort strip of the auto-fixable single-expression memoization patterns. */
export function stripMemoization(code: string): string {
  let out = code;
  // const x = useMemo(() => EXPR, [deps]);  ->  const x = EXPR;
  out = out.replace(/=\s*useMemo\(\(\)\s*=>\s*([\s\S]*?),\s*\[[^\]]*\]\s*\)/g, '= $1');
  // const f = useCallback((args) => {...}, [deps]);  ->  const f = (args) => {...};
  out = out.replace(/=\s*useCallback\((\([^)]*\)\s*=>\s*[\s\S]*?),\s*\[[^\]]*\]\s*\)/g, '= $1');
  return out;
}
