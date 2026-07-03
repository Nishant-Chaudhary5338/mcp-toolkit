import { describe, it, expect } from 'vitest';
import { renderDashboard } from './dashboard.js';

// QA XSS sweep: renderDashboard renders arbitrary tool-result data (titles,
// filenames, generated code, table rows, list items) into an HTML string
// returned to an MCP Apps host / written to a file:// dashboard. Any of those
// fields could contain attacker-controlled text (e.g. a field label plumbed
// through from a scanned repo). Confirm every injection-shaped payload comes
// out HTML-escaped, never as live markup.
const PAYLOAD = '</script><img src=x onerror=alert(1)>&"\'';
const ESCAPED_FRAGMENT = '&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;';

function assertNeverRaw(html: string) {
  expect(html).not.toContain('<img src=x onerror=alert(1)>');
  expect(html).not.toContain('</script><img');
}

describe('renderDashboard — XSS escaping', () => {
  it('escapes an injection payload in the title', () => {
    const html = renderDashboard(PAYLOAD, {});
    assertNeverRaw(html);
    expect(html).toContain(ESCAPED_FRAGMENT);
  });

  it('escapes an injection payload in a code filename and code body', () => {
    const html = renderDashboard('Report', { code: PAYLOAD, filename: PAYLOAD });
    assertNeverRaw(html);
  });

  it('escapes an injection payload in files[].path and files[].code', () => {
    const html = renderDashboard('Report', { files: [{ path: PAYLOAD, code: PAYLOAD }] });
    assertNeverRaw(html);
  });

  it('escapes an injection payload in a scalar chip value and its key', () => {
    const html = renderDashboard('Report', { [PAYLOAD]: PAYLOAD });
    assertNeverRaw(html);
  });

  it('escapes an injection payload inside a findings-table row (object array)', () => {
    const html = renderDashboard('Report', { findings: [{ [PAYLOAD]: PAYLOAD, note: PAYLOAD }] });
    assertNeverRaw(html);
  });

  it('escapes an injection payload inside a scalar-array list', () => {
    const html = renderDashboard('Report', { tags: [PAYLOAD, 'safe'] });
    assertNeverRaw(html);
  });

  it('escapes an injection payload embedded in the raw-JSON dump', () => {
    const html = renderDashboard('Report', { note: PAYLOAD });
    // the raw JSON <pre> block re-serializes the whole data object — must
    // also be escaped, not just the structured sections above it.
    assertNeverRaw(html);
  });
});
