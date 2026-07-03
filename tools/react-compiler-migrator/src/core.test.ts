import { describe, it, expect } from 'vitest';
import { analyzeCompiler, stripMemoization } from './core.js';

describe('analyzeCompiler', () => {
  it('flags useMemo/useCallback/memo as redundant', () => {
    const src = `const a = useMemo(() => x + 1, [x]);\nconst f = useCallback((e) => g(e), [g]);\nexport default memo(Comp);`;
    const r = analyzeCompiler(src);
    const kinds = r.hints.map((h) => h.kind);
    expect(kinds).toContain('useMemo');
    expect(kinds).toContain('useCallback');
    expect(kinds).toContain('memo');
    expect(r.redundantMemoization).toBe(3);
    expect(r.compilerReady).toBe(true);
  });

  it('flags conditional hooks as blockers', () => {
    const r = analyzeCompiler('if (ready) useEffect(() => {}, []);');
    expect(r.blockers).toBe(1);
    expect(r.compilerReady).toBe(false);
  });
});

describe('stripMemoization', () => {
  it('strips a useMemo single expression', () => {
    expect(stripMemoization('const a = useMemo(() => x + 1, [x]);')).toContain('const a = x + 1;');
  });
  it('strips a useCallback wrapper', () => {
    expect(stripMemoization('const f = useCallback((e) => g(e), [g]);')).toContain('const f = (e) => g(e);');
  });
});
