# MCP Showcase

Three working **Model Context Protocol (MCP)** tools with a React demo UI. Clone-and-run — no monorepo, no complex setup.

## Tools

| Tool | Description | Tools Exposed |
|------|-------------|---------------|
| **JSON Viewer** | Saves JSON + generates interactive HTML viewer | `view_json`, `list_responses`, `view_response` |
| **Component Factory** | Generates React components from shadcn/ui templates | `generate_component`, `list_templates`, `review_component`, `fix_component`, `improve_component` |
| **Code Modernizer** | Converts JS/JSX projects to TypeScript | `convert-to-typescript` |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build all tools + server
npm run build

# 3. Start server (port 3002)
npm run dev -w server

# 4. Start UI (port 5173) — in a new terminal
npm run dev -w client
```

Open [http://localhost:5173](http://localhost:5173)

## Connect to Claude Desktop

Add any tool as an MCP server in `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "json-viewer": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-showcase/tools/json-viewer/build/index.js"]
    },
    "component-factory": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-showcase/tools/component-factory/build/index.js"]
    },
    "code-modernizer": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-showcase/tools/code-modernizer/build/index.js"]
    }
  }
}
```

## Structure

```
mcp-showcase/
├── tools/
│   ├── shared/            # McpServerBase, ToolRegistry (shared MCP framework)
│   ├── json-viewer/       # JSON visualization tool
│   ├── component-factory/ # React component generator (41 shadcn/ui templates)
│   └── code-modernizer/   # JS → TypeScript conversion
├── server/                # Express API bridge (port 3002)
└── client/                # Vite + React demo UI (port 5173)
```

## API

The Express server exposes a simple endpoint to call any tool:

```bash
POST http://localhost:3002/api/call
{ "server": "json-viewer", "tool": "view_json", "args": { "data": "{...}", "label": "test" } }
```
