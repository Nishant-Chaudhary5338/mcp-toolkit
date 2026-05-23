import type { RuleCheckResult } from '../types.js';

export function checkDiscriminatedUnions(_source: string, _filePath: string): RuleCheckResult {
  return { violations: [] };
}
