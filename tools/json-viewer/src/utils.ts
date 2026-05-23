export function countKeys(obj: unknown): number {
  if (obj === null || typeof obj !== 'object') return 0;
  let count = 0;
  if (Array.isArray(obj)) {
    for (const item of obj) count += countKeys(item);
  } else {
    const record = obj as Record<string, unknown>;
    count += Object.keys(record).length;
    for (const value of Object.values(record)) count += countKeys(value);
  }
  return count;
}

export function getMaxDepth(obj: unknown, current = 0): number {
  if (obj === null || typeof obj !== 'object') return current;
  let max = current;
  if (Array.isArray(obj)) {
    for (const item of obj) max = Math.max(max, getMaxDepth(item, current + 1));
  } else {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      max = Math.max(max, getMaxDepth(value, current + 1));
    }
  }
  return max;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateId(label: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeLabel = label.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 50);
  return `${safeLabel}-${ts}`;
}
