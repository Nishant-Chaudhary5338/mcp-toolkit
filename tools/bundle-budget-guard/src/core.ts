// bundle-budget-guard CORE — pure logic (no MCP transport).
//
// Evaluate built asset sizes against per-pattern budgets and return a pass/fail
// gate. The missing "gate" step for dep-auditor/performance-audit — turns a
// bundle report into a CI blocker.

export interface AssetEntry {
  path: string;
  bytes: number;
}

export interface Budget {
  /** glob-ish pattern matched against the asset path (supports *). */
  pattern: string;
  maxKB: number;
}

export interface BudgetLine {
  path: string;
  kb: number;
  budgetKB: number;
  over: boolean;
}

export interface BudgetResult {
  entries: BudgetLine[];
  violations: BudgetLine[];
  totalKB: number;
  passed: boolean;
}

function globToRe(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(escaped + '$');
}

function budgetFor(path: string, budgets: Budget[], defaultMaxKB: number): number {
  for (const b of budgets) {
    if (globToRe(b.pattern).test(path) || path.includes(b.pattern)) return b.maxKB;
  }
  return defaultMaxKB;
}

export function evaluateBudget(assets: AssetEntry[], budgets: Budget[] = [], defaultMaxKB = 250): BudgetResult {
  const entries: BudgetLine[] = assets.map((a) => {
    const kb = Math.round((a.bytes / 1024) * 100) / 100;
    const budgetKB = budgetFor(a.path, budgets, defaultMaxKB);
    return { path: a.path, kb, budgetKB, over: kb > budgetKB };
  });
  const violations = entries.filter((e) => e.over);
  const totalKB = Math.round(entries.reduce((s, e) => s + e.kb, 0) * 100) / 100;
  return { entries, violations, totalKB, passed: violations.length === 0 };
}
