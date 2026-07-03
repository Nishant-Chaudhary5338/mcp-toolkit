import { describe, it, expect } from 'vitest';
import { McpToolImproviserServer } from './index.js';

// Server class registers its tools (and thus its stdio transport) only on
// run(), so constructing it directly is safe for unit-testing handlers.
function makeServer(): any {
  return new McpToolImproviserServer();
}

describe('McpToolImproviserServer error handling (QA session 2 regression)', () => {
  // analyze_tool previously threw a raw Error for a non-existent path,
  // surfacing as a protocol-level McpError instead of this tool's own
  // { success: false, error } isError result every sibling handler returns.
  it('analyze_tool returns a clean isError result for a non-existent path', async () => {
    const server = makeServer();
    const result = await server.handleAnalyzeTool({ path: '/tmp/does-not-exist-qa-fixture' });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/not found/i);
  });
});
