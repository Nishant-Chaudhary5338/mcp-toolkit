import { describe, it, expect } from 'vitest';
import { ComponentFactoryServer } from './index.js';

// Server class registers its tools (and thus its stdio transport) only on
// run(), so constructing it directly is safe for unit-testing handlers.
function makeServer(): any {
  return new ComponentFactoryServer();
}

describe('ComponentFactoryServer error handling (QA harness regression)', () => {
  // review_component / fix_component / improve_component previously threw a
  // raw Error for a non-existent path instead of catching it, so the MCP
  // transport surfaced a protocol-level error instead of the standard
  // { success: false, error } isError tool result every other handler in
  // this file returns. Found dogfooding via the QA harness (call-tool.mjs).
  it('review_component returns a clean isError result for a non-existent path', async () => {
    const server = makeServer();
    const result = await server.handleReviewComponent({ path: '/tmp/does-not-exist-qa-fixture' });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/does not exist/);
  });

  it('fix_component returns a clean isError result for a non-existent path', async () => {
    const server = makeServer();
    const result = await server.handleFixComponent({ path: '/tmp/does-not-exist-qa-fixture' });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/does not exist/);
  });

  it('improve_component returns a clean isError result for a non-existent path', async () => {
    const server = makeServer();
    const result = await server.handleImproveComponent({ path: '/tmp/does-not-exist-qa-fixture' });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toMatch(/does not exist/);
  });
});
