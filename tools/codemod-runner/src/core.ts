// codemod-runner CORE — pure logic (no MCP transport).
//
// A generic, rule-based codemod engine: apply a find→replace (regex, with $1
// backrefs) across source, with named built-in rules for common migrations.
// Dry-run by default. The execution engine behind ad-hoc + migration transforms.

export interface CodemodRule {
  find: string;
  replace: string;
  flags?: string;
}

export interface ApplyResult {
  code: string;
  count: number;
}

/** Named built-in codemods for common React/TS migrations. */
export const BUILTIN_RULES: Record<string, CodemodRule> = {
  'cra-env-to-vite': { find: 'process\\.env\\.REACT_APP_([A-Z0-9_]+)', replace: 'import.meta.env.VITE_$1', flags: 'g' },
  'react-render-to-createroot': { find: "ReactDOM\\.render\\(\\s*([\\s\\S]*?),\\s*document\\.getElementById\\(['\"]root['\"]\\)\\s*\\)", replace: "ReactDOM.createRoot(document.getElementById('root')!).render($1)", flags: 'g' },
  'jest-fn-to-vi': { find: '\\bjest\\.(fn|mock|spyOn|clearAllMocks|resetAllMocks)\\b', replace: 'vi.$1', flags: 'g' },
  'default-react-import-drop': { find: "import React from 'react';\\n", replace: '', flags: 'g' },
  'test-id-to-testid': { find: 'data-test-id=', replace: 'data-testid=', flags: 'g' },
};

/** Apply a single find→replace rule to source text. */
export function applyCodemod(code: string, rule: CodemodRule): ApplyResult {
  const flags = rule.flags && rule.flags.includes('g') ? rule.flags : `${rule.flags ?? ''}g`;
  let re: RegExp;
  try {
    re = new RegExp(rule.find, flags);
  } catch (e) {
    throw new Error(`Invalid regex: ${(e as Error).message}`);
  }
  const matches = code.match(re);
  const count = matches ? matches.length : 0;
  const out = count > 0 ? code.replace(re, rule.replace) : code;
  return { code: out, count };
}

/** Resolve a rule by built-in name or from an explicit find/replace. */
export function resolveRule(input: { rule?: string; find?: string; replace?: string; flags?: string }): CodemodRule | { error: string } {
  if (input.rule) {
    const found = BUILTIN_RULES[input.rule];
    if (!found) return { error: `Unknown built-in rule "${input.rule}". Available: ${Object.keys(BUILTIN_RULES).join(', ')}.` };
    return found;
  }
  if (typeof input.find === 'string' && typeof input.replace === 'string') {
    return { find: input.find, replace: input.replace, flags: input.flags };
  }
  return { error: 'Provide a built-in `rule` name, or both `find` and `replace`.' };
}
