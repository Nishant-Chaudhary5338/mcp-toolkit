import * as fs from 'fs';
import * as path from 'path';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const DEFAULT_SKIP_DIRS = new Set([
  'node_modules', 'build', 'dist', '.next', '.turbo', '__tests__',
  '.git', 'coverage', '.cache', 'out', '.vercel', '.svelte-kit',
]);

export function safeReadJson<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeReadFile(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function isNextJsProject(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'next.config.js')) ||
    fs.existsSync(path.join(dir, 'next.config.ts')) ||
    fs.existsSync(path.join(dir, 'next.config.mjs'))
  );
}

export const NEXTJS_ROUTE_FILES = new Set([
  'page.tsx', 'page.ts', 'layout.tsx', 'layout.ts',
  'loading.tsx', 'loading.ts', 'error.tsx', 'error.ts',
  'not-found.tsx', 'not-found.ts', 'template.tsx', 'template.ts',
  'route.ts', 'route.tsx',
]);

export function isServerComponent(filePath: string, content: string): boolean {
  const name = path.basename(filePath);
  if (!NEXTJS_ROUTE_FILES.has(name)) return false;
  return !content.includes("'use client'") && !content.includes('"use client"');
}
