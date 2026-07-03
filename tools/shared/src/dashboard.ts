// ============================================================================
// renderDashboard — a self-contained, interactive HTML dashboard for any tool
// result. Dark/light toggle, summary chips, code panels with copy, tables for
// issue/finding arrays, and a collapsible raw-JSON view. No external assets.
// ============================================================================

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SCALAR_KEYS_ORDER = ['grade', 'passed', 'score', 'overallScore', 'count', 'total', 'totalMatches', 'totalRewrites', 'filesAnalyzed', 'fileCount'];

function isScalar(v: unknown): boolean {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

function chip(label: string, value: unknown): string {
  const v = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
  const tone = /^(A\+?|A|true|yes|pass)/i.test(v) ? 'ok' : /^(F|D|false|no|fail)/i.test(v) ? 'bad' : /^(B|C|warn)/i.test(v) ? 'warn' : '';
  return `<div class="chip ${tone}"><span class="chip-k">${esc(label)}</span><span class="chip-v">${esc(v)}</span></div>`;
}

function codePanel(filename: string, code: string): string {
  const id = 'c' + Math.abs([...filename].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)).toString(36);
  return `<div class="panel"><div class="panel-h"><span class="fname">${esc(filename)}</span><button class="copy" data-t="${id}">Copy</button></div><pre id="${id}"><code>${esc(code)}</code></pre></div>`;
}

function table(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '<p class="muted">None.</p>';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => rows.some((r) => isScalar(r[c]))).slice(0, 6);
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = rows.slice(0, 200).map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function renderDashboard(title: string, data: Record<string, unknown>): string {
  const scalars = Object.entries(data).filter(([, v]) => isScalar(v));
  scalars.sort(([a], [b]) => (SCALAR_KEYS_ORDER.indexOf(a) + 1 || 99) - (SCALAR_KEYS_ORDER.indexOf(b) + 1 || 99));
  const chips = scalars.map(([k, v]) => chip(k, v)).join('');

  const sections: string[] = [];

  // Generated code: a single `code` field, or a `files: [{path|filename, code}]` array.
  if (typeof data['code'] === 'string') {
    sections.push(codePanel(String(data['filename'] ?? 'output'), data['code'] as string));
  }
  const files = data['files'];
  if (Array.isArray(files) && files.some((f) => f && typeof f === 'object' && 'code' in (f as object))) {
    sections.push('<h2>Files</h2>' + (files as Record<string, unknown>[]).map((f) => codePanel(String(f['path'] ?? f['filename'] ?? 'file'), String(f['code'] ?? ''))).join(''));
  }

  // Arrays of findings/records → tables.
  for (const [key, value] of Object.entries(data)) {
    if (key === 'files') continue;
    if (Array.isArray(value) && value.length > 0 && value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
      sections.push(`<h2>${esc(key)} <span class="muted">(${value.length})</span></h2>${table(value as Record<string, unknown>[])}`);
    } else if (Array.isArray(value) && value.length > 0 && value.every(isScalar)) {
      sections.push(`<h2>${esc(key)}</h2><ul class="list">${value.slice(0, 100).map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`);
    }
  }

  const json = esc(JSON.stringify(data, null, 2));

  return `<div id="dash">
<style>
  #dash{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg);padding:24px;min-height:100vh;--bg:#fff;--fg:#111;--mut:#666;--card:#f6f7f9;--bd:#e5e7eb;--ac:#2563eb}
  #dash.dark{--bg:#0d1117;--fg:#e6edf3;--mut:#8b949e;--card:#161b22;--bd:#30363d;--ac:#58a6ff}
  #dash h1{font-size:20px;margin:0 0 4px;display:flex;align-items:center;gap:10px;justify-content:space-between}
  #dash h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);margin:24px 0 8px}
  .sub{color:var(--mut);margin:0 0 20px}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
  .chip{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:8px 12px;min-width:80px}
  .chip-k{font-size:11px;color:var(--mut);text-transform:uppercase}
  .chip-v{font-size:18px;font-weight:600}
  .chip.ok .chip-v{color:#16a34a}.chip.bad .chip-v{color:#dc2626}.chip.warn .chip-v{color:#d97706}
  .panel{border:1px solid var(--bd);border-radius:10px;overflow:hidden;margin:10px 0}
  .panel-h{display:flex;justify-content:space-between;align-items:center;background:var(--card);padding:8px 12px;border-bottom:1px solid var(--bd)}
  .fname{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  .copy{background:var(--ac);color:#fff;border:0;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}
  pre{margin:0;padding:14px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;max-height:420px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--bd);vertical-align:top}
  th{color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase}
  .list{margin:0;padding-left:18px}.muted{color:var(--mut);font-weight:400}
  .toggle{background:var(--card);border:1px solid var(--bd);color:var(--fg);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px}
  details{margin-top:24px}summary{cursor:pointer;color:var(--mut);font-size:12px}
</style>
<h1>${esc(title)}<button class="toggle" onclick="document.getElementById('dash').classList.toggle('dark')">◑ Theme</button></h1>
<p class="sub">mcp-react-toolkit · interactive result</p>
${chips ? `<div class="chips">${chips}</div>` : ''}
${sections.join('\n')}
<details><summary>Raw JSON</summary><pre><code>${json}</code></pre></details>
<script>
  document.getElementById('dash').querySelectorAll('.copy').forEach(function(b){b.addEventListener('click',function(){var el=document.getElementById(b.dataset.t);navigator.clipboard.writeText(el.innerText);b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1200);});});
</script>
</div>`;
}
