// redux-state-analyzer CORE — pure logic (no MCP transport).
//
// Audit a Redux codebase for shortcomings, anti-patterns, and optimization
// opportunities: classic-vs-RTK style, connect→hooks, createStore→configureStore,
// switch-reducers→createSlice, direct mutations, non-serializable state,
// whole-state / inline-object / unmemoized-derived selectors (re-render churn),
// manual thunks that should be RTK Query, and magic action-type strings.
// Produces issues (severity + suggestion), counts, migration advice, and a grade.

export type Severity = 'error' | 'warn' | 'info';

export interface ReduxIssue {
  file: string;
  line: number;
  rule: string;
  severity: Severity;
  message: string;
  suggestion: string;
}

export interface ReduxCounts {
  connect: number;
  useSelector: number;
  useDispatch: number;
  createStore: number;
  combineReducers: number;
  configureStore: number;
  createSlice: number;
  createAsyncThunk: number;
  createApi: number;
  switchReducers: number;
}

export interface ReduxReport {
  style: 'classic' | 'rtk' | 'rtk-query' | 'mixed' | 'none';
  counts: ReduxCounts;
  issues: ReduxIssue[];
  migrationOpportunities: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  filesAnalyzed: number;
}

function emptyCounts(): ReduxCounts {
  return { connect: 0, useSelector: 0, useDispatch: 0, createStore: 0, combineReducers: 0, configureStore: 0, createSlice: 0, createAsyncThunk: 0, createApi: 0, switchReducers: 0 };
}
const count = (code: string, re: RegExp): number => (code.match(re) ?? []).length;

/** Analyze one file: construct counts + line-level issues. */
export function analyzeReduxCode(code: string, file = 'store'): { counts: ReduxCounts; issues: ReduxIssue[] } {
  const counts = emptyCounts();
  counts.connect = count(code, /\bconnect\s*\(/g);
  counts.useSelector = count(code, /\buseSelector\s*\(/g);
  counts.useDispatch = count(code, /\buseDispatch\s*\(/g);
  counts.createStore = count(code, /\bcreateStore\s*\(/g);
  counts.combineReducers = count(code, /\bcombineReducers\s*\(/g);
  counts.configureStore = count(code, /\bconfigureStore\s*\(/g);
  counts.createSlice = count(code, /\bcreateSlice\s*\(/g);
  counts.createAsyncThunk = count(code, /\bcreateAsyncThunk\s*\(/g);
  counts.createApi = count(code, /\bcreateApi\s*\(/g);
  counts.switchReducers = count(code, /switch\s*\(\s*action\.type\s*\)/g);

  const usesImmer = /\bcreateSlice\s*\(/.test(code);
  const hasThunkFetch = /\bcreateAsyncThunk\s*\(/.test(code) && /\b(fetch|axios)\b/.test(code);
  const issues: ReduxIssue[] = [];
  const add = (line: number, rule: string, severity: Severity, message: string, suggestion: string) =>
    issues.push({ file, line, rule, severity, message, suggestion });

  code.split('\n').forEach((raw, i) => {
    const line = i + 1;

    // Direct state mutation outside createSlice/Immer
    if (!usesImmer && /\bstate\.\w+\s*=(?!=)/.test(raw) && !/return\b/.test(raw)) {
      add(line, 'state-mutation', 'error', 'Direct state mutation in a reducer.', 'Return a new object, or migrate the reducer to createSlice (Immer makes this safe).');
    }
    // Non-serializable value stored in state
    if (/\bstate\.\w+\s*=\s*new\s+(Date|Map|Set|WeakMap|WeakSet)\b/.test(raw)) {
      add(line, 'non-serializable', 'warn', 'Non-serializable value stored in Redux state.', 'Store a primitive (ISO string, array) and reconstruct in a selector/component.');
    }
    // Whole-state selection → subscribes to every change
    if (/useSelector\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\s*\)/.test(raw)) {
      add(line, 'whole-state-select', 'warn', 'useSelector returns the entire state — re-renders on every action.', 'Select the narrowest slice you need.');
    }
    // Inline object/array selector → new reference each render
    if (/useSelector\([^)]*=>\s*[([{]/.test(raw) && !/useSelector\([^)]*=>\s*\w+\.\w+/.test(raw)) {
      add(line, 'object-selector', 'warn', 'Selector returns a new object/array literal — causes re-renders every dispatch.', 'Split into separate useSelector calls, use shallowEqual, or a memoized createSelector.');
    }
    // Expensive derivation inside a selector
    if (/useSelector\([^)]*\.(filter|map|reduce|sort|slice)\(/.test(raw)) {
      add(line, 'unmemoized-derived', 'info', 'Expensive derivation inside useSelector runs every render.', 'Memoize with reselect createSelector.');
    }
    // Magic action-type string
    if (/dispatch\(\s*\{\s*type\s*:\s*['"`]/.test(raw)) {
      add(line, 'magic-action-type', 'info', 'Hand-rolled action object with a string type.', 'Use a createSlice action creator (typed, no magic strings).');
    }
  });

  if (counts.connect > 0) add(1, 'legacy-connect', 'info', `${counts.connect} connect() HOC usage(s).`, 'Replace with useSelector/useDispatch hooks.');
  if (counts.createStore > 0) add(1, 'legacy-createstore', 'warn', 'createStore is deprecated.', 'Use configureStore from @reduxjs/toolkit.');
  if (counts.switchReducers > 0) add(1, 'switch-reducer', 'info', `${counts.switchReducers} switch-statement reducer(s).`, 'Convert to createSlice.');
  if (hasThunkFetch) add(1, 'manual-thunk-fetch', 'info', 'Data fetching in a thunk.', 'Consider RTK Query (createApi) for caching, dedup, and auto-generated hooks.');

  return { counts, issues };
}

function classify(c: ReduxCounts): ReduxReport['style'] {
  const rtk = c.configureStore + c.createSlice + c.createAsyncThunk;
  const classic = c.createStore + c.connect + c.switchReducers + c.combineReducers;
  if (c.createApi > 0 && rtk === 0 && classic === 0) return 'rtk-query';
  if (rtk === 0 && classic === 0 && c.createApi === 0) return 'none';
  if (rtk > 0 && classic > 0) return 'mixed';
  if (rtk > 0 || c.createApi > 0) return 'rtk';
  return 'classic';
}

function grade(issues: ReduxIssue[]): ReduxReport['grade'] {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  if (errors === 0 && warns === 0) return 'A';
  if (errors === 0 && warns <= 3) return 'B';
  if (errors === 0) return 'C';
  if (errors <= 2) return 'D';
  return 'F';
}

/** Aggregate per-file results into a report with migration advice + grade. */
export function buildReport(counts: ReduxCounts, issues: ReduxIssue[], filesAnalyzed: number): ReduxReport {
  const opportunities = [...new Set(issues.filter((i) => i.severity !== 'error').map((i) => i.suggestion))];
  return { style: classify(counts), counts, issues, migrationOpportunities: opportunities, grade: grade(issues), filesAnalyzed };
}

export function mergeCounts(a: ReduxCounts, b: ReduxCounts): ReduxCounts {
  const out = emptyCounts();
  for (const k of Object.keys(out) as (keyof ReduxCounts)[]) out[k] = a[k] + b[k];
  return out;
}
