#!/usr/bin/env node
// Publish gate: inspect exactly what `npm publish` would ship and fail if it is
// wrong. The tarball is built from whatever sits in tools/*/build at the time,
// and the bundled workspaces (shared, ui-kit) are packed by their own rules, so
// stale or leaked files only show up here, never in build or test.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const [pack] = JSON.parse(raw);
const paths = pack.files.map((f) => f.path);
const problems = [];

const leakedTests = paths.filter((p) => /\.(test|spec)\./.test(p));
if (leakedTests.length) problems.push(`${leakedTests.length} test files would ship, e.g. ${leakedTests[0]}`);

const leakedSource = paths.filter((p) => /^node_modules\/@mcp-showcase\/[^/]+\/src\//.test(p));
if (leakedSource.length) problems.push(`${leakedSource.length} bundled source files would ship, e.g. ${leakedSource[0]}`);

if (!paths.includes('bin/cli.mjs')) problems.push('bin/cli.mjs is missing');

const tools = new Set(paths.map((p) => p.match(/^tools\/([^/]+)\/package\.json$/)?.[1]).filter(Boolean));
const built = new Set(paths.map((p) => p.match(/^tools\/([^/]+)\/build\//)?.[1]).filter(Boolean));
const unbuilt = [...tools].filter((t) => !built.has(t));
if (unbuilt.length) problems.push(`no build output for ${unbuilt.length} tools: ${unbuilt.join(', ')} (run npm run build)`);

const summary = `${pack.name}@${pack.version}: ${paths.length} files, ${(pack.size / 1024).toFixed(0)} KB packed, ${tools.size} tools`;
if (problems.length) {
  console.error(`check-pack FAILED for ${summary}`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check-pack OK: ${summary}`);
