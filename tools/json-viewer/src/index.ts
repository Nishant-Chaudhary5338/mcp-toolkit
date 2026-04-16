#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';
import type { ToolResult } from '@mcp-showcase/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

interface SavedResponse {
  id: string;
  label: string;
  timestamp: string;
  jsonPath: string;
  htmlPath: string;
  sizeBytes: number;
  keyCount: number;
  maxDepth: number;
}

// ============================================================================
// HELPERS
// ============================================================================

const RESPONSES_DIR = path.join(os.homedir(), '.mcp-responses');

function ensureDir(): void {
  if (!fs.existsSync(RESPONSES_DIR)) {
    fs.mkdirSync(RESPONSES_DIR, { recursive: true });
  }
}

function generateId(label: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeLabel = label.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 50);
  return `${safeLabel}-${ts}`;
}

function countKeys(obj: unknown): number {
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

function getMaxDepth(obj: unknown, current = 0): number {
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================================
// HTML TEMPLATE
// ============================================================================

function generateHtml(label: string, parsed: unknown, timestamp: string): string {
  const compactJson = JSON.stringify(parsed).replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JSON Viewer — ${escapeHtml(label)}</title>
<style>
  :root {
    --bg: #1e1e2e; --surface: #282840; --surface2: #313150; --border: #44447a;
    --text: #cdd6f4; --text-dim: #8888b0; --key: #89b4fa; --string: #a6e3a1;
    --number: #fab387; --boolean: #cba6f7; --null: #f38ba8; --bracket: #8888b0;
    --search-bg: #f9e2af33;
  }
  [data-theme="light"] {
    --bg: #eff1f5; --surface: #e6e9ef; --surface2: #dce0e8; --border: #bcc0cc;
    --text: #4c4f69; --text-dim: #8c8fa1; --key: #1e66f5; --string: #40a02b;
    --number: #fe640b; --boolean: #8839ef; --null: #d20f39; --bracket: #8c8fa1;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: var(--bg); color: var(--text); min-height: 100vh; }
  .header { position: sticky; top: 0; z-index: 100; background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .header h1 { font-size: 14px; font-weight: 600; color: var(--key); }
  .header .meta { font-size: 11px; color: var(--text-dim); }
  .search-box { flex: 1; min-width: 200px; }
  .search-box input { width: 100%; padding: 6px 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: inherit; font-size: 12px; outline: none; }
  .search-box input:focus { border-color: var(--key); }
  .btn { padding: 4px 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: inherit; font-size: 11px; cursor: pointer; }
  .btn:hover { background: var(--border); }
  .container { padding: 20px; }
  .json-tree { font-size: 13px; line-height: 1.6; }
  .json-line { display: flex; align-items: flex-start; }
  .line-number { color: var(--text-dim); min-width: 40px; text-align: right; padding-right: 12px; user-select: none; font-size: 11px; }
  .json-content { flex: 1; white-space: pre; }
  .json-key { color: var(--key); }
  .json-string { color: var(--string); }
  .json-number { color: var(--number); }
  .json-boolean { color: var(--boolean); }
  .json-null { color: var(--null); }
  .json-bracket { color: var(--bracket); }
  .json-colon, .json-comma { color: var(--text-dim); }
  .collapsible { cursor: pointer; user-select: none; }
  .collapsible::before { content: '▼'; display: inline-block; margin-right: 4px; font-size: 8px; transition: transform 0.15s; color: var(--text-dim); }
  .collapsed::before { transform: rotate(-90deg); }
  .collapsed + .json-summary + .json-children { display: none; }
  .json-children { padding-left: 20px; }
  .json-summary { color: var(--text-dim); font-style: italic; font-size: 11px; }
  .highlight { background: var(--search-bg); border-radius: 2px; }
  .hidden { display: none !important; }
  .copy-toast { position: fixed; bottom: 20px; right: 20px; background: var(--string); color: var(--bg); padding: 8px 16px; border-radius: 6px; font-size: 12px; opacity: 0; transition: opacity 0.3s; z-index: 1000; }
  .copy-toast.show { opacity: 1; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(label)}</h1>
  <span class="meta">${timestamp}</span>
  <div class="search-box"><input type="text" id="search" placeholder="Search keys or values..." /></div>
  <button class="btn" onclick="toggleTheme()">Theme</button>
  <button class="btn" onclick="copyAll()">Copy All</button>
  <button class="btn" onclick="expandAll()">Expand All</button>
  <button class="btn" onclick="collapseAll()">Collapse All</button>
</div>
<div class="container"><div id="treeView" class="json-tree"></div></div>
<div class="copy-toast" id="copyToast">Copied!</div>
<script>
const RAW_JSON = ${compactJson};
let lineNum = 0;

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toggleTheme() {
  const b = document.body;
  b.getAttribute('data-theme') === 'light' ? b.removeAttribute('data-theme') : b.setAttribute('data-theme', 'light');
}
function showCopyToast() {
  const t = document.getElementById('copyToast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1500);
}
function copyAll() { navigator.clipboard.writeText(JSON.stringify(RAW_JSON, null, 2)); showCopyToast(); }
function expandAll() { document.querySelectorAll('.collapsed').forEach(el => el.classList.remove('collapsed')); }
function collapseAll() { document.querySelectorAll('.collapsible').forEach(el => el.classList.add('collapsed')); }

function renderValue(val, path, depth) {
  if (val === null) return '<span class="json-null">null</span>';
  if (typeof val === 'boolean') return '<span class="json-boolean">' + val + '</span>';
  if (typeof val === 'number') return '<span class="json-number">' + val + '</span>';
  if (typeof val === 'string') {
    const escaped = escapeHtml(val);
    const display = val.length > 200 ? escaped.slice(0, 200) + '...' : escaped;
    return '<span class="json-string">"' + display + '"</span>';
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '<span class="json-bracket">[]</span>';
    const items = val.map((item, i) => {
      const ln = ++lineNum;
      return '<div class="json-line"><span class="line-number">' + ln + '</span><span class="json-content">' +
        renderValue(item, path + '[' + i + ']', depth + 1) + (i < val.length - 1 ? '<span class="json-comma">,</span>' : '') + '</span></div>';
    }).join('');
    return '<span class="collapsible" onclick="this.classList.toggle(\'collapsed\')"><span class="json-bracket">[</span></span>' +
      '<span class="json-summary"> ' + val.length + ' items</span>' +
      '<div class="json-children">' + items + '</div><span class="json-bracket">]</span>';
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return '<span class="json-bracket">{}</span>';
    const items = keys.map((key, i) => {
      const ln = ++lineNum;
      return '<div class="json-line"><span class="line-number">' + ln + '</span><span class="json-content">' +
        '<span class="json-key" data-key="' + escapeHtml(key) + '">"' + escapeHtml(key) + '"</span>' +
        '<span class="json-colon">: </span>' +
        renderValue(val[key], path + '.' + key, depth + 1) + (i < keys.length - 1 ? '<span class="json-comma">,</span>' : '') + '</span></div>';
    }).join('');
    return '<span class="collapsible" onclick="this.classList.toggle(\'collapsed\')"><span class="json-bracket">{</span></span>' +
      '<span class="json-summary"> ' + keys.length + ' keys</span>' +
      '<div class="json-children">' + items + '</div><span class="json-bracket">}</span>';
  }
  return '<span class="json-null">' + escapeHtml(String(val)) + '</span>';
}

let searchTimeout;
document.getElementById('search').addEventListener('input', function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    const q = this.value.toLowerCase();
    if (!q) return;
    document.querySelectorAll('.json-key,.json-string').forEach(el => {
      if (el.textContent.toLowerCase().includes(q)) el.classList.add('highlight');
    });
  }, 150);
});

const tree = document.getElementById('treeView');
lineNum = 1;
tree.innerHTML = '<div class="json-line"><span class="line-number">1</span><span class="json-content">' + renderValue(RAW_JSON, 'root', 0) + '</span></div>';
</script>
</body>
</html>`;
}

// ============================================================================
// SERVER
// ============================================================================

class JsonViewerServer extends McpServerBase {
  constructor() {
    super({ name: 'json-viewer', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'view_json',
      'Save JSON data and generate an interactive HTML viewer. Opens in browser for easy visualization of complex JSON responses.',
      {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'JSON string to visualize' },
          label: { type: 'string', description: 'Label for this response (used in filename and title)' },
          open: { type: 'boolean', description: 'Automatically open in browser (default: true)', default: true },
        },
        required: ['data'],
      },
      this.handleViewJson.bind(this)
    );

    this.addTool(
      'list_responses',
      'List all saved JSON responses with timestamps and metadata.',
      {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of responses to return (default: 20)', default: 20 },
        },
      },
      this.handleListResponses.bind(this)
    );

    this.addTool(
      'view_response',
      'Re-open a previously saved JSON response by its ID.',
      {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Response ID (from list_responses)' },
        },
        required: ['id'],
      },
      this.handleViewResponse.bind(this)
    );
  }

  private async handleViewJson(args: unknown): Promise<ToolResult> {
    const { data, label = 'response', open = true } = args as {
      data: string;
      label?: string;
      open?: boolean;
    };

    try {
      ensureDir();

      let parsed: unknown;
      let jsonStr: string;
      try {
        parsed = typeof data === 'string' ? JSON.parse(data) : data;
        jsonStr = JSON.stringify(parsed, null, 2);
      } catch {
        throw new Error('Invalid JSON data provided');
      }

      const id = generateId(label);
      const timestamp = new Date().toISOString();
      const jsonPath = path.join(RESPONSES_DIR, `${id}.json`);
      const htmlPath = path.join(RESPONSES_DIR, `${id}.html`);

      fs.writeFileSync(jsonPath, jsonStr, 'utf-8');

      const html = generateHtml(label, parsed, timestamp);
      fs.writeFileSync(htmlPath, html, 'utf-8');

      const meta: SavedResponse = {
        id, label, timestamp, jsonPath, htmlPath,
        sizeBytes: Buffer.byteLength(jsonStr, 'utf-8'),
        keyCount: countKeys(parsed),
        maxDepth: getMaxDepth(parsed),
      };
      fs.writeFileSync(path.join(RESPONSES_DIR, `${id}.meta.json`), JSON.stringify(meta, null, 2), 'utf-8');

      if (open) {
        const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        const { execSync } = await import('child_process');
        try { execSync(`${cmd} "${htmlPath}"`, { stdio: 'ignore' }); } catch { /* silent */ }
      }

      return this.success({
        id, jsonPath, htmlPath,
        message: `JSON saved and viewer generated. Open: ${htmlPath}`,
        stats: { sizeBytes: meta.sizeBytes, keyCount: meta.keyCount, maxDepth: meta.maxDepth },
      });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleListResponses(args: unknown): Promise<ToolResult> {
    const { limit = 20 } = (args || {}) as { limit?: number };
    try {
      ensureDir();
      const files = fs.readdirSync(RESPONSES_DIR)
        .filter(f => f.endsWith('.meta.json'))
        .sort().reverse().slice(0, limit);

      const responses: SavedResponse[] = [];
      for (const file of files) {
        try {
          responses.push(JSON.parse(fs.readFileSync(path.join(RESPONSES_DIR, file), 'utf-8')));
        } catch { /* skip corrupted */ }
      }
      return this.success({ total: responses.length, responses });
    } catch (error) {
      return this.error(error);
    }
  }

  private async handleViewResponse(args: unknown): Promise<ToolResult> {
    const { id } = args as { id: string };
    try {
      ensureDir();
      const metaPath = path.join(RESPONSES_DIR, `${id}.meta.json`);
      if (!fs.existsSync(metaPath)) throw new Error(`Response not found: ${id}`);

      const meta: SavedResponse = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (!fs.existsSync(meta.htmlPath)) throw new Error(`HTML viewer not found for: ${id}`);

      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      const { execSync } = await import('child_process');
      try { execSync(`${cmd} "${meta.htmlPath}"`, { stdio: 'ignore' }); } catch { /* silent */ }

      return this.success({ id: meta.id, label: meta.label, htmlPath: meta.htmlPath, message: `Opened viewer for: ${meta.label}` });
    } catch (error) {
      return this.error(error);
    }
  }
}

new JsonViewerServer().run().catch(console.error);
