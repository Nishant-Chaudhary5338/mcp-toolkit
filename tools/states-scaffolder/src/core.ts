// states-scaffolder CORE — pure logic (no MCP transport).
//
// A resource name → loading-skeleton, empty-state, and error-state components
// plus an <XStates> switch wrapper. Kills the copy-pasted "3 conditional
// renders per data view" every list/detail page needs.

export interface StatesResult {
  code: string;
  filename: string;
  componentName: string;
}

export type StatesOutcome =
  | { ok: true; result: StatesResult }
  | { ok: false; error: string };

export interface StatesOptions {
  name: string;
  skeletonRows?: number;
}

function pascal(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('') || 'Resource';
}

export function generateStates(opts: StatesOptions): StatesOutcome {
  if (!opts?.name) return { ok: false, error: 'A "name" is required.' };
  const Name = pascal(opts.name);
  const rows = Number.isFinite(opts.skeletonRows) && (opts.skeletonRows as number) > 0 ? Math.floor(opts.skeletonRows as number) : 5;
  const label = Name.replace(/([A-Z])/g, ' $1').trim().toLowerCase();

  const code = `import type { ReactNode } from 'react';

export function ${Name}Loading() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading ${label}">
      {Array.from({ length: ${rows} }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-gray-200" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ${Name}Empty({ message = 'No ${label} yet' }: { message?: string }) {
  return <div className="py-12 text-center text-sm text-gray-500">{message}</div>;
}

export function ${Name}Error({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div className="py-12 text-center" role="alert">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
          Retry
        </button>
      )}
    </div>
  );
}

/** Switch between loading / error / empty / content in one place. */
export function ${Name}States({
  isLoading,
  error,
  isEmpty,
  onRetry,
  children,
}: {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) return <${Name}Loading />;
  if (error) return <${Name}Error error={error} onRetry={onRetry} />;
  if (isEmpty) return <${Name}Empty />;
  return <>{children}</>;
}
`;

  return { ok: true, result: { code, filename: `${Name}States.tsx`, componentName: `${Name}States` } };
}
