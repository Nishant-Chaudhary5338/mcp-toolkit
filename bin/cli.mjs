#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOOLS = [
  "component-factory",
  "component-reviewer",
  "component-fixer",
  "storybook-generator",
  "code-modernizer",
  "typescript-enforcer",
  "accessibility-checker",
  "generate-tests",
  "quality-pipeline",
  "render-analyzer",
  "performance-audit",
  "test-gap-analyzer",
  "legacy-analyzer",
  "dep-auditor",
  "monorepo-manager",
  "lighthouse-runner",
  "json-viewer",
  "infer-fields",
  "zod-schema-generator",
  "api-client-generator",
];

const requested = process.argv[2];

if (!requested || requested === "--list" || requested === "-l" || requested === "list") {
  const lines = TOOLS.map((t) => `  • ${t}`).join("\n");
  process.stdout.write(
    `mcp-react-toolkit — 18 MCP servers for React + TypeScript\n\n` +
      `Usage:\n  npx mcp-react-toolkit <tool>\n\nAvailable tools:\n${lines}\n\n` +
      `Add one to Claude Desktop / Cursor:\n` +
      `  "legacy-analyzer": { "command": "npx", "args": ["-y", "mcp-react-toolkit", "legacy-analyzer"] }\n`,
  );
  process.exit(requested ? 0 : 1);
}

if (!TOOLS.includes(requested)) {
  process.stderr.write(
    `Unknown tool: "${requested}".\nRun \`npx mcp-react-toolkit --list\` to see all 18 tools.\n`,
  );
  process.exit(1);
}

const entry = path.join(ROOT, "tools", requested, "build", "index.js");
if (!existsSync(entry)) {
  process.stderr.write(`Tool "${requested}" is missing its build at ${entry}.\n`);
  process.exit(1);
}

// Importing the tool's entry boots its MCP server on stdio.
await import(pathToFileUrl(entry));

function pathToFileUrl(p) {
  return new URL(`file://${p}`).href;
}
