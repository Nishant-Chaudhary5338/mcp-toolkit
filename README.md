# mcp-toolkit

28 MCP servers for React + TypeScript development automation. One protocol — works with Claude Desktop, Cline, and as plain CLI scripts.

---

## What's here

```
client/     React 19 showcase SPA — all 28 tools, 5 workflow demos, animated flowcharts, embedded article
server/     Express API bridge (port 3002) — proxies tool calls from the UI to MCP servers
tools/      4 built-in MCP server packages (json-viewer, component-factory, code-modernizer, quality-pipeline)
demo/       Sample legacy JS/React project used for live modernization demos
```

---

## Tool catalog

| Category | Tools |
|---|---|
| **Component Dev** | component-factory, component-fixer, component-improver, component-reviewer, storybook-generator, utils-scaffolder, ixd-generator |
| **Code Quality** | quality-pipeline, typescript-enforcer, accessibility-checker, enforce-design-tokens, analyze-ui-design |
| **Analysis** | dep-auditor, monorepo-manager, legacy-analyzer, render-analyzer, performance-audit, lighthouse-runner, test-gap-analyzer |
| **Testing** | generate-tests, fix-failing-tests |
| **Modernization** | code-modernizer, refactor-executor |
| **Utilities** | json-viewer, config-manager, mcp-tool-improviser, docs, cli-wrappers |

---

## Automation workflows

### 1 · Component Pipeline
```
component-factory → component-reviewer → component-fixer → component-improver → storybook-generator
```
*Generate a production-ready component with tests and Storybook stories from a single description.*

### 2 · Code Modernization
```
legacy-analyzer → code-modernizer → typescript-enforcer → generate-tests
```
*Migrate an entire JS codebase to strict TypeScript with auto-generated test coverage.*

### 3 · Quality Audit
```
lighthouse-runner → accessibility-checker → render-analyzer → quality-pipeline
```
*Full production readiness check — performance, WCAG, render efficiency, overall grade.*

### 4 · Dependency Health
```
dep-auditor [unused] → dep-auditor [duplicates] → dep-auditor [bundle-impact] → monorepo-manager
```
*Audit and clean up a monorepo's dependency graph.*

### 5 · New Feature Scaffold
```
utils-scaffolder → generate-tests → storybook-generator → quality-pipeline
```
*Bootstrap a new hook or utility with tests, docs, and a quality grade before merging.*

---

## How MCP works

```
Claude Desktop ──JSON-RPC──► MCP Server ──► tool handlers
                   (stdio)

Same server, two clients:
  MCP Server ──► Cline / Claude Desktop   (interactive AI)
             └──► pnpm scan / CI script   (automation)
```

MCP is JSON-RPC over stdio. The same server that answers Claude's tool_use requests also powers pnpm scan — zero duplication.

---

## Run locally

```sh
git clone https://github.com/Nishant-Chaudhary5338/mcp-toolkit.git
cd mcp-toolkit
npm install
npm run build
npm run dev          # server on :3002, client on :5173
```

### Add to Claude Desktop

```json
{
  "mcpServers": {
    "component-factory": {
      "command": "node",
      "args": ["/path/to/mcp-toolkit/tools/component-factory/build/index.js"]
    }
  }
}
```

---

## Stack

React 19 · TypeScript strict · Vite · Tailwind CSS v4 · Framer Motion · react-markdown · Express · Node.js

---

## Built by

**Nishant Chaudhary** — Senior Frontend Engineer · open to EU remote  
nishantchaudhary.dev@gmail.com

**Also see:** [dashcraft](https://github.com/Nishant-Chaudhary5338/dashcraft) · [react-present](https://github.com/Nishant-Chaudhary5338/react-present) · [ai-builder](https://github.com/Nishant-Chaudhary5338/ai-builder) · [Monorepo](https://github.com/Nishant-Chaudhary5338/Monorepo)

MIT License
