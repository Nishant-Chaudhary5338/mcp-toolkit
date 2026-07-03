import { describe, it, expect } from 'vitest';
import { analyzeReduxCode, buildReport } from './core.js';

describe('analyzeReduxCode — anti-patterns', () => {
  it('flags direct mutation in a classic reducer', () => {
    const { issues } = analyzeReduxCode('function reducer(state, action) { state.count = action.payload; }');
    expect(issues.find((i) => i.rule === 'state-mutation')?.severity).toBe('error');
  });

  it('does NOT flag mutation inside createSlice (Immer)', () => {
    const { issues } = analyzeReduxCode('createSlice({ reducers: { inc(state){ state.count = state.count + 1; } } })');
    expect(issues.find((i) => i.rule === 'state-mutation')).toBeUndefined();
  });

  it('flags whole-state, inline-object, and unmemoized-derived selectors', () => {
    const code = [
      'const all = useSelector(state => state);',
      'const obj = useSelector(s => ({ a: s.a, b: s.b }));',
      'const done = useSelector(s => s.todos.filter(t => t.done));',
    ].join('\n');
    const rules = analyzeReduxCode(code).issues.map((i) => i.rule);
    expect(rules).toContain('whole-state-select');
    expect(rules).toContain('object-selector');
    expect(rules).toContain('unmemoized-derived');
  });

  it('flags non-serializable state and magic action types', () => {
    const code = 'state.when = new Date();\ndispatch({ type: "ADD_TODO", payload: 1 });';
    const rules = analyzeReduxCode(code).issues.map((i) => i.rule);
    expect(rules).toContain('non-serializable');
    expect(rules).toContain('magic-action-type');
  });

  it('suggests RTK Query for data-fetching thunks', () => {
    const code = 'const load = createAsyncThunk("x", async () => { const r = await fetch("/api"); return r.json(); });';
    expect(analyzeReduxCode(code).issues.map((i) => i.rule)).toContain('manual-thunk-fetch');
  });
});

describe('classification, migration advice, grade', () => {
  it('classifies classic vs rtk and grades severity', () => {
    const classic = analyzeReduxCode('const store = createStore(rootReducer);\nexport default connect(mapState)(App);\nswitch (action.type) {}');
    const report = buildReport(classic.counts, classic.issues, 1);
    expect(report.style).toBe('classic');
    expect(report.migrationOpportunities.length).toBeGreaterThan(0);
    expect(['B', 'C', 'D', 'F']).toContain(report.grade);
  });

  it('grades clean RTK code A', () => {
    const rtk = analyzeReduxCode('const store = configureStore({ reducer });\nconst slice = createSlice({ name: "x", initialState, reducers: {} });');
    const report = buildReport(rtk.counts, rtk.issues, 1);
    expect(report.style).toBe('rtk');
    expect(report.grade).toBe('A');
  });
});
