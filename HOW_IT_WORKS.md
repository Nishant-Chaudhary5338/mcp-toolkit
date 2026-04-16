# How DevForge Works

> A plain-English explanation of the architecture, the protocol, and why everything runs fast.

---

## The 30-Second Version

When you click "Run" in the UI, this happens:

```
Your Browser  →  Express Server  →  Node.js subprocess  →  your files on disk
     ↑                                                              ↓
  Results  ←────────────────────────────────────────────────────────
```

No cloud. No AI model. No API keys. Everything executes locally on your machine in ~200–500ms.

---

## What Is MCP?

MCP stands for **Model Context Protocol**. It's a standard created by Anthropic so that AI models (like Claude) can call external tools — read files, run commands, search databases — in a safe, structured way.

Think of it like a job posting system:
- The **tool** says: "I can do these things, here's what I need as input"
- The **client** (normally an AI model, here our server) says: "Great, do this specific thing with these arguments"
- The **tool** does the work and returns a result

The protocol itself is just JSON messages sent back and forth. That's it.

---

## The Full Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React + Vite, port 5177)                          │
│                                                             │
│  [Component Factory]  [Code Modernizer]  [Quality Pipeline] │
│         ↓                    ↓                   ↓          │
│         └──────────── POST /api/call ────────────┘          │
└─────────────────────────────┬───────────────────────────────┘
                              │  { server, tool, args }
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Express Server (port 3002)  server/src/index.ts            │
│                                                             │
│  Receives the request, looks up which tool to run,          │
│  spawns it as a child process, speaks MCP protocol          │
│  over stdin/stdout, returns the JSON result                 │
└─────────────────────────────┬───────────────────────────────┘
                              │  node tools/<name>/build/index.js
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MCP Tool (Node.js subprocess)                              │
│                                                             │
│  • Reads files from disk                                    │
│  • Runs regex / AST analysis                                │
│  • Executes shell commands (tsc, vitest)                    │
│  • Returns structured JSON                                  │
│  • Process exits when done                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Why Is It Fast?

Because **nothing leaves your machine**.

A typical AI-powered tool makes an HTTP request to a cloud API, waits for inference (500ms–3s), and returns. DevForge tools don't call any AI. They are just Node.js programs doing:

- `fs.readFileSync()` — read a file
- `RegExp.exec()` — match patterns
- `execSync('tsc --noEmit')` — run a command

Your CPU can do millions of regex matches per second. Reading 5 files off an SSD takes under 5ms. That's why the quality pipeline runs 5 checks across a project in under 500ms.

---

## The MCP Wire Protocol

This is what actually goes over stdin/stdout between the server and each tool. It's boring on purpose — just JSON lines.

```
Server → Tool:  { "jsonrpc": "2.0", "method": "initialize", "id": 1, "params": { ... } }
Tool → Server:  { "jsonrpc": "2.0", "id": 1, "result": { "capabilities": {} } }

Server → Tool:  { "jsonrpc": "2.0", "method": "initialized" }

Server → Tool:  {
                  "jsonrpc": "2.0",
                  "method": "tools/call",
                  "id": 2,
                  "params": {
                    "name": "run_partial_pipeline",
                    "arguments": { "projectRoot": "/some/path", "stages": ["performance"] }
                  }
                }

Tool → Server:  {
                  "jsonrpc": "2.0",
                  "id": 2,
                  "result": {
                    "content": [{ "type": "text", "text": "{...your result as JSON string...}" }]
                  }
                }
```

The tool process starts, does a handshake, handles one tool call, returns the result, and exits. The server kills it. Next request = new process. Clean, isolated, no shared state.

---

## How Each Tool Works Internally

### Component Factory

**What it does:** Generates production-ready React components from real shadcn/ui templates.

**How:**
1. Reads the 41 `.tsx` template files from `tools/component-factory/templates/` at runtime
2. Takes the template source code and transforms it — renames the component, adjusts imports, generates TypeScript prop interfaces
3. Generates test files (Vitest) and story files (Storybook) as string templates
4. Writes all files to the output path you specify

**The key insight:** These are real, working component files — not AI-hallucinated code. The template is already correct. The tool just adapts it and wires it together.

```
button.tsx (template)  →  transform  →  /tmp/mcp-demo-components/Button/
                                          Button.tsx       ← the component
                                          Button.test.tsx  ← vitest tests
                                          Button.stories.tsx ← storybook
                                          Button.types.ts  ← interfaces
```

---

### Code Modernizer

**What it does:** Converts JavaScript/JSX files to TypeScript automatically.

**How:**
1. Uses `@typescript-eslint/parser` to parse JS/JSX into an **AST** (Abstract Syntax Tree) — a structured tree representation of the code
2. Walks the AST to find:
   - Function declarations → what parameters they take
   - `PropTypes` definitions → convert to TypeScript interfaces (`PropTypes.string` → `string`)
   - React hooks → infer state types from initial values
3. Rewrites the file with proper TypeScript annotations and saves it as `.ts`/`.tsx`

**Why AST instead of regex?**
Regex sees code as text. An AST sees code as structure. Regex can't tell the difference between a string `"PropTypes.string"` in a comment vs actual PropTypes usage. An AST can.

```
// Input (JS)                    // Output (TS)
function UserCard(props) {        interface UserCardProps {
  const { name, age } = props;      name: string
  return <div>{name}</div>          age: number
}                                 }
UserCard.propTypes = {            function UserCard({ name, age }: UserCardProps) {
  name: PropTypes.string,           return <div>{name}</div>
  age: PropTypes.number,          }
}
```

---

### Quality Pipeline

**What it does:** Runs 5 automated checks on a project and gives an overall grade (A–F).

**How each stage works:**

| Stage | Mechanism |
|---|---|
| **Tests** | Runs `npx vitest --reporter=json --outputFile=/tmp/result.json`, reads the JSON file for pass/fail counts |
| **Type Safety** | Runs `tsc --noEmit`, counts lines matching `error TS` in the output |
| **Performance** | Scans import statements for known heavy libraries; scans 50 lines after each `useEffect` for missing cleanup (`removeEventListener`, `clearInterval`) |
| **Accessibility** | Runs multiline regex across full file content — catches `<img>` without alt, buttons without accessible text, inputs without labels, `onClick` without keyboard handlers |
| **Design Tokens** | Regex `/\d+px/` in style contexts catches *any* hardcoded pixel value — not a fixed list |

**Grading:**

```
0 fails, 0 warns  → A
0 fails, 1 warn   → B
0 fails, 2 warns  → C
1 fail            → D
2+ fails          → F
```

---

## The Subprocess Model (Why Tools Don't Have Ports)

Most people expect a backend service to bind to a port and stay running. MCP tools don't do that.

Each tool is just a script. The server spawns it fresh per request:

```typescript
// server/src/mcp-client.ts
const child = spawn('node', ['tools/quality-pipeline/build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']   // control stdin/stdout/stderr
})

// Write JSON-RPC messages to stdin
child.stdin.write(JSON.stringify({ method: 'initialize', ... }) + '\n')

// Read responses from stdout
child.stdout.on('data', chunk => {
  const response = JSON.parse(chunk)
  // ... handle handshake, then send tool call, then resolve promise
})

// Process auto-exits after responding
// Server calls child.kill() to be safe
```

Benefits of this model:
- **No port conflicts** — tools don't need network ports
- **Perfect isolation** — one failed request can't corrupt the next
- **Easy to add tools** — drop a new folder in `tools/`, no server config needed
- **Cheap to run** — processes live for ~200ms, not forever

---

## Workspace Structure

```
mcp-showcase/
├── tools/
│   ├── shared/           ← McpServerBase class all tools extend
│   ├── component-factory/
│   ├── code-modernizer/
│   └── quality-pipeline/
├── server/               ← Express API bridge (port 3002)
├── client/               ← Vite + React UI (port 5177)
└── demo/
    └── legacy-app/src/   ← Sample JS project for Code Modernizer + Quality Pipeline demos
```

It's an npm workspace. `npm install` at the root installs everything. Each package builds independently with `tsc`.

---

## In Production: Where the AI Fits In

DevForge demos the tools layer in isolation. But in a real MCP setup, an AI model sits between the user and the tools:

```
User: "Review my Button component and fix any issues"
                    ↓
              Claude (or any LLM)
                    ↓
    Decides to call: review_component({ path: '/src/Button' })
                    ↓
              Component Factory tool
                    ↓
    Returns: { grade: "C", issues: ["missing displayName", "broken import"] }
                    ↓
    Decides to call: fix_component({ path: '/src/Button' })
                    ↓
              Component Factory tool
                    ↓
    Returns: { fixed: true, changes: [...] }
                    ↓
Claude: "Done — fixed 2 issues: added displayName and corrected the import path"
```

The AI doesn't write the code or run the analysis. It just decides *which tool to call* and *with what arguments*, based on the user's intent. The tools do the actual work — exactly as you've seen in this demo.
