const BASE = '/api';

export interface CallResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration?: number;
}

export async function callTool(
  server: string,
  tool: string,
  args: Record<string, unknown>
): Promise<CallResult> {
  const res = await fetch(`${BASE}/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ server, tool, args }),
  });
  return res.json();
}
