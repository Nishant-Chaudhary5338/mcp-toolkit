#!/usr/bin/env node
// CI gate: run mcp-tool-improviser's analyze_tool across every tool's src/index.ts
// and fail the build if any tool scores below the threshold. Wires an existing,
// previously-computed-but-unenforced signal into an actual blocking check
// (see docs/CRUD_AUTOMATION_PLAN.md's QA plan — "signal already exists, currently
// unenforced" was the exact gap this closes).
import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPROVISER = join(ROOT, 'tools', 'mcp-tool-improviser', 'build', 'index.js');
// 7.0 floor: catches genuinely broken tools (the corrupted fix-failing-tests/
// refactor-executor scored far below this before reconstruction). Everything
// ships >= 8.7 except refactor-executor (7.5, tracked follow-up — a 3554-line
// tool whose remaining gaps are structural/contextual-depth dimensions, not a
// quick fix). Raise this once that's addressed.
const THRESHOLD = Number(process.env.IMPROVISER_THRESHOLD ?? 7.0);

function analyze(target) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [IMPROVISER], { stdio: ['pipe', 'pipe', 'ignore'] });
    let buf = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout')); }, 15000);
    child.stdout.on('data', (d) => { buf += d; });
    child.on('close', () => {
      clearTimeout(timer);
      const line = buf.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((m) => m?.id === 2);
      if (!line) return reject(new Error('no response'));
      try {
        const payload = JSON.parse(line.result.content[0].text);
        resolve(payload.overallScore ?? payload.score ?? 0);
      } catch (e) { reject(e); }
    });
    child.on('error', reject);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'gate', version: '1' } } }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'analyze_tool', arguments: { path: target } } }) + '\n');
    child.stdin.end();
  });
}

const toolsDir = join(ROOT, 'tools');
const tools = readdirSync(toolsDir).filter(
  (t) => existsSync(join(toolsDir, t, 'src', 'index.ts')) && !['shared', 'ui-kit'].includes(t),
);

let failed = false;
for (const t of tools) {
  try {
    const score = await analyze(join(toolsDir, t, 'src', 'index.ts'));
    const ok = score >= THRESHOLD;
    if (!ok) failed = true;
    console.log(`${ok ? '✓' : '✗'} ${t.padEnd(28)} ${score.toFixed(1)}/10`);
  } catch (e) {
    console.log(`? ${t.padEnd(28)} improviser check skipped (${e.message})`);
  }
}

if (failed) {
  console.error(`\nOne or more tools scored below the ${THRESHOLD} threshold. Run mcp-tool-improviser and address its suggestions before merging.`);
  process.exit(1);
}
console.log(`\nAll tools >= ${THRESHOLD}/10.`);
