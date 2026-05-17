---
title: "One Protocol, Two Surfaces: Building a Frontend MCP Toolkit"
description: "~30 MCP server packages, 60+ tools, 27 CLI wrappers. The same JSON-RPC server that powers Cline also powers your parallel automation pipeline. One protocol, two clients."
slug: "one-protocol-two-surfaces"
coverImage: "https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?fm=jpg&q=80&w=1200&h=630&fit=crop"
coverImageAlt: "Abstract glowing network nodes on dark background representing interconnected protocol layers"
ogImage: "https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?fm=jpg&q=80&w=1200&h=630&fit=crop"
date: "2026-05-03"
lastUpdated: "2026-05-03"
author: "Nishant Chaudhary"
authorBio: "Nishant Chaudhary is a frontend platform engineer specialising in React monorepos, MCP server architecture, and AI-native developer tooling. He built ~30 MCP servers and 27 CLI wrappers powering a 12-team engineering organisation."
tags: ["mcp", "typescript", "ai-tooling", "monorepo", "developer-experience"]
---

I watched a senior engineer scaffold a new component for the thirtieth time this quarter. Same folder structure, same five imports from the design system, same Storybook story file with the same three variants we use everywhere. She was using Cline. The AI was generating the code. She was still spending twelve minutes per component on plumbing — because Cline didn't know our conventions, couldn't read our internal design-system source of truth, and produced the kind of "generic React component" that we'd reject in code review.

The fix is well-trodden by 2026: build MCP servers that expose your team's source of truth to the AI. I built a lot of them. Around thirty MCP server packages in our monorepo, sixty-some registered tools across them, plus a separate plugin-aware server for our micro-frontend platform.

The thing nobody told me until I'd already shipped it: an MCP server isn't AI-specific. JSON-RPC over stdio is just a protocol. Once you've built a server that exposes `generate_component` to Cline, you can spawn the same server from a Node.js script, send the same JSON-RPC message, and get the same result. **The AI host is one of two possible clients.**

So I built CLI wrappers. Twenty-seven of them, one per tool. The same MCP servers that power the team's AI workflow now power the team's command-line automation — including a parallel pipeline that reviews and fixes every component in the monorepo using the same code paths Cline would use to do it one component at a time.

One protocol, two surfaces. This post is what I built, what surprised me, and the architectural pattern that has the most leverage long-term.

---

> **Key Takeaways**
> - MCP is JSON-RPC over stdio, not AI-specific. The same server Cline invokes can be called from a Node.js script with identical results.
> - ~30 servers, 60+ tools, 27 CLI wrappers — one shared protocol connecting both surfaces.
> - In 2025, 80% of developers use AI tools in their workflows ([Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/ai)) — yet most teams hit the same wall: the AI doesn't know your conventions.
> - Domain-specific MCP servers (MFE-aware, platform-aware) are the next frontier; generic AI coding tools won't get better at *your* platform.
> - MCP servers must stay deterministic. Reasoning belongs in the AI host, not the server.

---

## 1. The team-vs-individual gap in AI coding tools

Every post on AI coding misses this framing.

In 2025, 80% of developers use AI tools in their daily workflow, with 50.6% using them daily ([Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/ai)). They're popular for good reason — for individuals, they work. Cline, Cursor, Claude Code, Copilot — they're great for individuals because the individual *is* the source of context. You hold your team's conventions in your head. You know which folder new files go in. You know which design-system import the AI should use. The AI generates; you correct.

This breaks down for *teams* because the team's conventions live in dozens of places — Notion docs, the design-system repo, the linter config, the senior engineer's pull request comments, tribal knowledge that's never written down. The AI can't read your team. So it produces code that's technically correct and culturally wrong. You spend the same time editing the AI's output as you would have writing it yourself.

The instinct is to fix this with prompts. Maintain a `.cursorrules` file. Stuff conventions into a system prompt. Add a 4,000-word "team conventions" preamble to every Cline session.

Prompts go stale. They drift. Six weeks in, the prompt says "use `@platform/Button`" and the design system has renamed the import to `@platform/ui/button`. The AI generates code against a path that doesn't exist. Worse: the engineer doesn't know whether to trust the prompt or the source of truth, because they contradict.

The fix isn't a better prompt. It's giving the AI a *programmatic, live* connection to your actual source of truth. That's what MCP is.

> **Citation Capsule:** In 2025, Stack Overflow found 80% of developers use AI tools in their workflows, with 50.6% relying on them daily ([Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/ai)). Yet the tools still generate "culturally wrong" code for teams because they can't read team-specific conventions. MCP solves this by giving the AI a programmatic, live connection to your actual source of truth — not a stale prompt.

<!-- [INTERNAL-LINK: Vite Module Federation micro-frontend platform → plugin-onboarding-vite-module-federation] -->

---

## 2. What MCP actually is, in 90 seconds

The Model Context Protocol is an open standard from Anthropic, released late 2024. By 2026 it's the way Claude, Cursor, Cline, VS Code, ChatGPT, and most agent frameworks integrate with external systems.

Three primitives matter:

- **Tools** — callable functions the AI can invoke. The AI decides when to call them based on the user's request. `generate_component(name, outputPath)` is a tool.
- **Resources** — read-only data the AI can pull into context. `team://design-tokens` is a resource.
- **Prompts** — reusable templates. Less interesting for our use case.

The crucial property: **MCP servers are local processes by default**, communicating with the AI host via JSON-RPC over stdio. Giving the AI access to your team's conventions doesn't mean uploading anything to a vendor. The server reads from your local filesystem, your monorepo, your private API; data flows AI ↔ MCP server ↔ source of truth, all local. Nothing leaves the box.

That last sentence — "JSON-RPC over stdio" — is the seed of the whole post. Hold onto it. We'll come back.

The TypeScript SDK (`@modelcontextprotocol/sdk`) gets you to a working server in about twenty lines. Everything I describe below is built on it.

<!-- [INTERNAL-LINK: @repo/ui shared component library → production-grade-ui-library-react-monorepo] -->

---

## 3. The architecture: families, one server per concern, and `McpServerBase`

My instinct was one mega-server with all the team's tools registered as a flat list. I'm glad I didn't ship that.

The rule I landed on after some thrashing: **split servers by operational concern, not by tidiness.** Two tools that need the same in-memory state, the same dependency loading, and the same release cadence belong in the same server. Two tools that diverge on any of those three should be in different servers.

A frontend team's tooling has several genuinely distinct operational concerns. Component-level work needs the design system loaded in memory. Code-quality scans need their own static-analysis libraries. Monorepo ops need the workspace graph in memory. Utilities are utilities. Each concern has its own update cadence — the design system changes weekly; static-analysis rules change quarterly; monorepo structure changes when you re-org the codebase, which is rarely.

So the architecture groups roughly as:

| Family | What it owns | Tool count |
|---|---|---|
| Component Development | Creating, fixing, reviewing, improving components | ~12 |
| Code Quality & Modernisation | TS migration, a11y, perf, testing, design tokens | ~25 |
| Monorepo Management | Workspace ops, deps, refactors, config | ~8 |
| Utilities | Docs, viewers, scaffolders, meta-tooling | ~10 |

That's the logical grouping. The literal layout is more granular: about thirty MCP server *packages* live in a single `tools/` directory in the monorepo, each with its own `package.json`, its own `build/index.js`, its own version pin. Most servers expose between one and four tools; a few expose more. Component-factory alone exposes eight. The "family" framing is a way to think about them; on disk it's flat.

What ties them together is `McpServerBase` — a custom abstract class in `tools/_shared/` that handles server setup, tool registration, request routing, error formatting, and SIGINT shutdown. Every server except one extends it. Adding a new server is roughly:

```typescript
import { McpServerBase } from '../../_shared/index.js';

class ComponentFactory extends McpServerBase {
  registerTools() {
    this.addTool('generate_component', generateComponentSchema, this.handleGenerate);
    this.addTool('review_component', reviewComponentSchema, this.handleReview);
    // ...
  }
}

new ComponentFactory().run();
```

The one outlier is `typescript-enforcer`, which uses the low-level `Server` class directly because it pre-dates the base class. It's also the server I'd most like to refactor — the inconsistency confuses new contributors. It works, the migration is roughly two hundred lines of busywork, and I keep prioritizing things that don't work over things that work and could be tidier. Tech debt is what you call the things you've decided not to fix today.

Plus a **separate MFE-aware server** that lives outside the turborepo and gets its own section because it's a different beast — domain-specific tools for the micro-frontend platform from my last post. Twelve tools that know about plugin scaffolding, registry registration, and the federated build pipeline.

<!-- [INTERNAL-LINK: @repo/ui shared component library → production-grade-ui-library-react-monorepo] -->

---

## 4. A representative tour: one tool per family

Don't try to cover all sixty. Cover four. The pattern matters more than the count.

### `component-factory` — the code-generation anchor

Generates a new `@repo/ui` component, its Storybook story, its Vitest spec, its TypeScript types, and its MDX documentation. Reads from a templates directory at runtime — when the team renames "outline" to "ghost" in our Button variant set, we update the templates and `component-factory` immediately generates components against the new convention. No re-prompting, no `.cursorrules` update.

```typescript
this.addTool('generate_component', {
  name: z.string(),
  outputPath: z.string(),
  includeTests: z.boolean().default(true),
  includeStories: z.boolean().default(true),
  includeTypes: z.boolean().default(true),
  includeDocs: z.boolean().default(true),
}, this.handleGenerate);
```

The handler doesn't *generate* code in any creative sense. It assembles templates with team-specific imports already wired. The AI's job is to decide *that* a component should exist; the tool's job is to make sure it looks like the team's other components. That separation is the single most important thing this post can teach you about building MCP tools.

### `quality-pipeline` — multi-stage runner, not orchestration

Five stages, run in sequence: tests (vitest detection + execSync), type safety (`tsc --noEmit`), performance (static analysis for heavy imports, memory-leak patterns, console.log in prod code), accessibility (multiline-aware regex for missing alt text, button labels, input labels), design tokens (regex scan for hardcoded hex colors, px values, font families).

Each stage produces a result. The pipeline aggregates them into a letter grade:

```typescript
// Aggregation — A if all pass, F if any fail with errors, scaled in between
function gradeFrom(stages: StageResult[]): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (stages.some(s => s.errors > 0)) return 'F';
  const warns = stages.reduce((n, s) => n + s.warnings, 0);
  if (warns === 0) return 'A';
  if (warns <= 2) return 'B';
  if (warns <= 5) return 'C';
  return 'D';
}
```

I want to flag something important about this design. My first instinct was to build `quality-pipeline` as an *orchestrator* — an MCP tool that calls *other* MCP tools (`typescript-enforcer`, `accessibility-checker`, etc.) over JSON-RPC. I'm glad I didn't. Spawning four child processes per audit and marshalling their JSON-RPC handshakes is dramatically slower than running the same checks in-process. MCP-as-fan-out is a tempting pattern; for compute-bound work that doesn't need isolation, it's the wrong one. Use composition where it costs you nothing; use direct calls where it doesn't.

### `monorepo-manager` — workspace queries the AI can ask in real time

Reads `pnpm-workspace.yaml`, every package's `package.json`, the `turbo.json` config. Exposes four tools: `list_packages`, `find_dependents`, `dependency_graph` (with circular-dep detection), `check_health` (version mismatches, missing scripts).

The interesting use is conversational. Cline can answer "what packages depend on `@repo/auth`?" by calling `find_dependents`, getting the list, and using it to inform the next decision (which packages need to be updated alongside an auth-context refactor). Without this tool, the same question requires the engineer to context-switch into a terminal and run a `pnpm` query manually. With it, the AI just asks.

There's an honest detail buried in this server: three handler methods exist in the source — `handleRunAcrossPackages`, `handleFindSharedDeps`, `handleSyncConfig` — that aren't registered as tools. I'll come back to those in section 8.

### `mcp-tool-improviser` — the meta-tool

This one I'm not going to one-line. It's a quality-assurance system for MCP tools themselves. Given any tool's TypeScript source, it scores it across seven dimensions, identifies specific issues with each dimension, proposes concrete diffs to fix them, and can apply those diffs with automatic timestamped backups.

The seven dimensions are weighted:

```typescript
const DIMENSION_WEIGHTS = {
  descriptionQuality:  2.0,  // does the AI understand what the tool does?
  schemaCompleteness:  2.0,  // are parameters fully described?
  errorHandling:       1.5,  // structured errors or generic catch?
  contextualDepth:     1.5,  // explanations, confidence, actionable output?
  edgeCaseCoverage:    1.0,  // empty dirs, large files, symlinks?
  responseStructure:   1.0,  // consistent JSON, success field, metadata?
  codeQuality:         1.0,  // duplication, long functions, `any` types?
};
```

The `descriptionQuality` and `schemaCompleteness` dimensions are weighted highest because those are what the AI host actually *sees* — the tool's description and its input schema are the AI's only documentation. A tool whose description says "scaffold a component" is going to be invoked less often, and less correctly, than one whose description includes when to use it, what it produces, and a worked example.

A 590-line pattern library backs the scoring — seven pattern modules, one per dimension, each with specific heuristics. The diff/apply system writes timestamped `.bak` files before any modification; rollback is one tool call.

The thing I find genuinely interesting about this tool is the recursion. It's an MCP tool that audits MCP tools, using the same JSON-RPC-over-stdio pattern Claude uses to call any of its peers. The protocol is reflexive. Once you build the abstraction, applying it to itself is free.

There are 26 more tools across the four families. Most follow the `McpServerBase` pattern, expose between one and four tools, and read from a single specific source of truth (the design system, the lint config, the workspace graph). The pattern matters more than the count.

---

## 5. The MFE-aware MCP server: domain-specific tools for a plugin platform

The frontend-quality servers are general-purpose. Drop them into any React monorepo and they work. The MFE-specific server is different. It knows about a particular *micro-frontend platform* — the one I described in my last post. The registry, the federation config, the plugin-build pipeline. It treats plugins as first-class entities.

Twelve tools, grouped by what they do:

- **Plugin lifecycle:** `list_plugins`, `scaffold_plugin`, `build_plugin`, `run_review`
- **Code generation inside a plugin:** `add_route`, `generate_login`, `generate_form`, `generate_detail`, `generate_crud`, `generate_tests`
- **Schema awareness:** `infer_fields` (from JSON sample or OpenAPI schema)
- **Composition:** `smart_generate` — combines `infer_fields` with the page generators in one call

The most interesting tool is `scaffold_plugin`, because it shows the architectural pattern that makes the whole MFE-aware server work:

```javascript
server.tool('scaffold_plugin', 'Scaffold a new MFE plugin app', {
  id: z.string().describe('Plugin identifier (e.g. "analytics")'),
  label: z.string().describe('Human-readable label'),
  port: z.number().describe('Dev server port'),
  color: z.string().optional().describe('Accent color hex'),
  routes: z.array(z.string()).optional().describe('Initial route names'),
}, async ({ id, label, port, color, routes }) => {
  const res = await fetch('http://localhost:5001/api/scaffold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, label, port, color, routes }),
  });
  const data = await res.json();
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});
```

The MCP tool doesn't scaffold the plugin itself. It POSTs to the DevTools Express server at port 5001. The DevTools server creates the directory structure, runs `pnpm install`, runs `pnpm build`, registers the plugin in the registry, and returns the result. The MCP tool is a thin proxy.

So the chain is:

```
Cline asks the AI to scaffold a plugin
  → AI calls scaffold_plugin (MCP tool)
    → MCP server POSTs to DevTools REST API at :5001
      → Express server creates files, installs, builds, registers
        → Shell's revision poller detects new build, auto-reloads
```

Three layers, two protocols (JSON-RPC + HTTP), one outcome. The MCP server has zero filesystem access of its own — every action goes through the DevTools API that already existed before the MCP work began.

This is the architectural pattern worth internalizing: **MCP tools are best when they're thin proxies over your existing infrastructure.** If your team already has a REST API, a CLI, or a database, your MCP tool's job is to translate the AI's request into a call against that existing surface. Don't reimplement filesystem operations in your MCP server. Don't put business logic there. Translate, don't recreate.

The bigger lesson, the one I want this section to carry: **domain-specific MCP servers are the next interesting frontier.** General-purpose AI coding tools will keep getting better at generic React. They will not get better at *your* React, at *your* MFE platform, at *your* registry's specific tagging conventions. That's the layer you have to build. The MFE-aware server is what that layer looks like.

<!-- [INTERNAL-LINK: MFE platform architecture → plugin-onboarding-vite-module-federation] -->

---

## 6. One protocol, two surfaces: the CLI wrapper pattern

This is the section that earns the post.

I built the MCP servers for Cline. They speak JSON-RPC over stdio because that's the protocol Cline (and Claude, and Cursor) use to invoke them. But JSON-RPC over stdio isn't AI-specific — it's just a protocol. Once I had a server exposing `generate_component` to Cline, I realized I could spawn the same server from a Node.js script, send the same JSON-RPC message, and get the same result. The AI host is one of two possible clients.

So I built CLI wrappers. Twenty-seven of them.

### The architecture

```
$ component-factory generate Button packages/ui/components
       │
       ▼
  CLI wrapper (component-factory-cli.ts)
       │
       │ spawn('node', ['tools/component-factory/build/index.js'])
       ▼
  MCP server process (stdin/stdout pipes)
       │
       │  1. → initialize           (JSON-RPC)
       │  2. ← initialize response
       │  3. → initialized          (notification)
       │  4. → tools/call { name, arguments }
       │  5. ← result { content: [{ text }] }
       ▼
  Print result, exit
```

The same server, with the same tool implementations, can now be invoked by:

- **Cline** — when the engineer is in an AI-driven flow.
- **The CLI** — when the engineer wants the same operation deterministically, scripted, in CI, or chained.

<figure>
<svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram showing AI Surface and CLI Surface both connecting to MCP Server via JSON-RPC over stdio">
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#3b82f6"/>
    </marker>
  </defs>
  <rect width="560" height="260" rx="12" style="fill:var(--bg-secondary);stroke:var(--border-color)" stroke-width="1"/>
  <text x="280" y="28" text-anchor="middle" font-family="monospace" font-size="14" font-weight="600" style="fill:var(--text-primary)">One Protocol, Two Surfaces</text>
  <!-- Left box: AI Surface -->
  <rect x="40" y="50" width="180" height="70" rx="6" fill="#3b82f6"/>
  <text x="130" y="80" text-anchor="middle" font-family="monospace" font-size="13" font-weight="600" fill="#ffffff">AI Surface</text>
  <text x="130" y="100" text-anchor="middle" font-family="monospace" font-size="10" fill="#ffffff" opacity="0.85">Cline / Claude Code / Cursor</text>
  <!-- Right box: CLI Surface -->
  <rect x="340" y="50" width="180" height="70" rx="6" fill="#3b82f6"/>
  <text x="430" y="80" text-anchor="middle" font-family="monospace" font-size="13" font-weight="600" fill="#ffffff">CLI Surface</text>
  <text x="430" y="100" text-anchor="middle" font-family="monospace" font-size="10" fill="#ffffff" opacity="0.85">27 wrappers + pnpm scan</text>
  <!-- Center box: MCP Server -->
  <rect x="180" y="155" width="200" height="60" rx="6" style="fill:var(--bg-secondary);stroke:#3b82f6" stroke-width="2"/>
  <text x="280" y="180" text-anchor="middle" font-family="monospace" font-size="13" font-weight="600" style="fill:var(--text-primary)">MCP Server</text>
  <text x="280" y="200" text-anchor="middle" font-family="monospace" font-size="10" style="fill:var(--text-muted)">JSON-RPC over stdio</text>
  <!-- Arrow from left box to center box -->
  <line x1="130" y1="120" x2="230" y2="155" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowhead)"/>
  <!-- Arrow from right box to center box -->
  <line x1="430" y1="120" x2="330" y2="155" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowhead)"/>
</svg>
<figcaption>The dual-surface pattern — one MCP server, two clients. Build it once; invoke it from Cline or the terminal.</figcaption>
</figure>

### The handshake, in code

The shared `mcp-client.ts` library handles every CLI's communication with its server. Here's the core of `MCPClient.callTool()`:

```typescript
async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPResponse> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [this.serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    let initialized = false;
    let responded = false;

    child.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      for (const line of buffer.split('\n')) {
        if (!line.trim() || !line.includes('"jsonrpc"')) continue;
        try {
          const response = JSON.parse(line);

          // Stage 2: initialize response → send initialized + tools/call
          if (response.id === 1 && response.result && !initialized) {
            initialized = true;
            child.stdin?.write(JSON.stringify({
              jsonrpc: '2.0', method: 'initialized', params: {},
            }) + '\n');
            // 50ms delay — empirically needed for some servers to settle
            setTimeout(() => {
              child.stdin?.write(JSON.stringify({
                jsonrpc: '2.0',
                id: this.requestId,
                method: 'tools/call',
                params: { name: toolName, arguments: args },
              }) + '\n');
            }, 50);
            continue;
          }

          // Stage 4: tool response → resolve and clean up
          if (response.id === this.requestId && response.result) {
            responded = true;
            const text = response.result.content?.[0]?.text;
            resolve(text ? JSON.parse(text) : { success: true, ...response.result });
            child.kill();
            return;
          }
        } catch { /* not valid JSON, keep buffering */ }
      }
    });

    // Stage 1: kick off the handshake
    child.stdin?.write(JSON.stringify({
      jsonrpc: '2.0', id: this.requestId++, method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'cli-wrapper', version: '1.0.0' },
      },
    }) + '\n');

    setTimeout(() => {
      if (!responded) { child.kill(); reject(new Error('Timeout waiting for MCP response')); }
    }, 120_000);
  });
}
```

A few things in there are worth dwelling on.

[PERSONAL EXPERIENCE] The 50ms delay between sending `initialized` and sending `tools/call` is empirical. Without it, some servers — the ones that load larger in-memory state at startup, like `monorepo-manager` — drop the `tools/call` message because the handler isn't fully ready. With it, every server I have works reliably. Fifty milliseconds is the kind of magic number that should be a reasoned timeout based on a server-readiness signal; in practice it's a setTimeout. I'm not proud of this, but I've shipped things I'm less proud of.

The 120-second timeout is generous because some tools — `lighthouse-runner`, `quality-pipeline` against a large package — take real time. The kill-on-timeout cleanup is non-negotiable; without it you accumulate zombie Node processes during long-running CLI sessions.

The buffer-and-line-split approach to stdout parsing is the right pattern for stdio JSON-RPC. Don't try to parse stdout as a single JSON document; it isn't one. It's newline-delimited messages.

### Making the wrappers globally available

The seven most-used CLIs are registered as `bin` entries in the workspace's root `package.json`:

```json
"bin": {
  "component-factory":  "build/component-factory-cli.js",
  "component-fixer":    "build/component-fixer-cli.js",
  "component-improver": "build/component-improver-cli.js",
  "component-reviewer": "build/component-reviewer-cli.js",
  "json-viewer":        "build/json-viewer-cli.js",
  "review-and-fix":     "build/review-and-fix-cli.js",
  "utils-scaffolder":   "build/utils-scaffolder-cli.js"
}
```

After `pnpm install`, every engineer has these as global commands. The remaining twenty CLIs are invoked via `npx tsx tools/cli-wrappers/src/<name>.ts` — appropriate for ones that get called from scripts rather than from the terminal directly.

### The surface that breaks something open: `pnpm scan`

The CLI surface isn't the killer feature on its own. It's nice; it's not transformative. The killer feature is what you can build on top of it.

```bash
pnpm scan packages/ui/components
```

That command runs `scan-all.ts`, which is a three-phase parallel pipeline:

```
Phase 1: REVIEW   — every component in parallel (concurrency = CPU cores)
                    each one: MCPClient → component-reviewer → review()
Phase 2: FIX      — every component that had issues, in parallel
                    each one: MCPClient → component-fixer → fix_from_review()
Phase 3: RE-REVIEW — only the fixed components, in parallel
                    verify the fixes actually fixed things
                    output: scan-report.json at monorepo root
```

[PERSONAL EXPERIENCE] Each phase uses a worker-pool — a `runInParallel` helper, not `Promise.all`, because we want to cap concurrency at CPU count rather than spawning N child processes for N components. On the design system's 60-component package, this finishes in under two minutes. Sequentially through Cline, the same operation would take an hour and require an engineer to babysit it.

This is the moment the dual-surface pattern paid for itself. The same `component-reviewer` and `component-fixer` MCP servers that Cline calls one tool at a time are now driving an automated parallel pipeline that an engineer triggers with one command. Same code paths. Same servers. Different surface.

### Why this matters beyond convenience

The CLI surface is the ground truth. Anything Cline can do via MCP, the CLI can do via stdin. That property has consequences:

- **You can test your tools without involving an AI.** Unit tests of MCP handlers via direct invocation; integration tests via the CLI. No mocking the model.
- **You can build CI pipelines that use MCP tools as building blocks.** `pnpm scan` runs in pre-commit hooks. The scan report becomes a code-review artifact.
- **You can give engineers who don't use AI tools the same automation surface as engineers who do.** The skeptics get the same productivity boost as the believers, with no behavioral change required.
- **You're not locked in.** If Cline disappears tomorrow — if Anthropic changes the protocol, if the tooling ecosystem fragments — the CLI surface keeps working. Your investment in MCP servers is preserved regardless of what happens to the AI tooling layer.

That last point is the one I wish I'd internalized earlier. Building for a single AI host is fragile. Building for a protocol — and treating the AI host as one of the protocol's clients — is durable.

> **Citation Capsule:** The CLI wrapper pattern turns MCP servers into general-purpose JSON-RPC backends. The same server that powers Cline's interactive AI flow drives `pnpm scan` — a parallel pipeline that reviews and fixes 60 components in under two minutes. Same code paths, same servers, different surface. Building for the protocol preserves the investment regardless of which AI host survives.

---

## 7. How Cline finds it

The reproducibility story is more honest if I show what I actually have rather than what I'd like to claim. The Cline config:

```json
{
  "mcpServers": {
    "ixd-generator": {
      "disabled": false, "timeout": 120, "type": "stdio",
      "command": "node",
      "args": ["~/Desktop/my-turborepo/tools/ixd-generator/build/.../index.js"]
    },
    "component-factory": {
      "disabled": false, "timeout": 60, "type": "stdio",
      "command": "node",
      "args": ["~/Desktop/my-turborepo/tools/component-factory/build/.../index.js"]
    },
    "mcp-tool-improviser": { "disabled": true,  /* ... */ },
    "typescript-enforcer": { "disabled": true,  /* ... */ },
    "memory":              { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] }
  }
}
```

Two custom servers actively enabled. Two more wired but disabled. One third-party server (`@modelcontextprotocol/server-memory`) for cross-session memory. That's it. The reality is that the AI surface is a starter kit; the CLI surface is where most of the breadth lives.

For a team, the absolute paths would need to be parameterized — `${workspaceFolder}` substitution, an env var, or an onboarding script that templates the config from a workspace-relative source. I haven't built that yet. For a one-engineer setup the hardcoded paths are fine; for a team it's the obvious next thing.

The disabled servers exist for a reason: they're more useful via the CLI than via the AI host. `typescript-enforcer` produces lots of small, mechanical fixes that don't benefit from AI judgment — running it as a script in CI is the right surface. `mcp-tool-improviser` runs against my own MCP code, which I work on outside the AI loop. The dual-surface pattern means choosing the right surface for the right context, not enabling everything everywhere.

---

## 8. What I tried that didn't work

Four anti-patterns. Some of these are inferred from artifacts in the codebase rather than from clean memories of failure; I'll flag where.

### a) The mega-server temptation

My first instinct, before any of this existed, was one MCP server with every tool registered as a flat list. I built a prototype. It lasted about two weeks. The problem wasn't conceptual — it was operational. Updating a single tool's logic forced a redeploy of the whole server, which interrupted the AI session. Two tools that needed conflicting versions of a dependency couldn't coexist in one process. Adding a tool meant editing a thousand-line registration file. The pain was concrete; the split was inevitable.

The split-by-operational-concern rule from section 3 is a generalization of what I learned the hard way.

### b) Tools too broad to call

[PERSONAL EXPERIENCE] `monorepo-manager` has three handler methods that exist in the source but were never registered as tools: `handleRunAcrossPackages`, `handleFindSharedDeps`, `handleSyncConfig`. I built them. I tested them. I removed their registration before shipping.

The reason: they were too broad. "Run a command across all packages" is a tool whose signature could mean anything; the AI couldn't reliably decide *when* to call it. "Find shared dependencies" sounded useful but its output wasn't actionable — the AI couldn't do anything with the result that was better than what `find_dependents` already enabled.

The lesson: a tool the AI can't decide when to call is a tool the AI ignores. Narrow, well-scoped tools with clear use cases beat broad, "powerful" tools every time. If you find yourself writing a tool description that says "use this when you want to do various things related to X," delete the tool.

### c) Tools that returned entire generated files

Early versions of `generate_component` returned the full text of the generated component, story, and tests as a single multi-thousand-token blob in the tool response. Cline would then either re-emit that text (doubling the context cost) or summarize it (losing detail). Neither was useful.

The fix: return *plans* and *patches*, not artifacts. The tool writes the files to disk. The response is a JSON summary — files created, lines changed, next suggested step. The AI works with metadata; the filesystem holds the artifact. Context budget is preserved.

### d) Tools that called LLMs internally

I tried this once. A tool that, given a vague description, would call an LLM to refine the description before doing its work. It felt like progress — "smarter tools!" — until I realized I'd built a system where the AI host's reasoning was running on top of *another* AI's reasoning, with no way to inspect or constrain the inner one. Latency doubled. Determinism collapsed. Debug logs became unintelligible.

[UNIQUE INSIGHT] I removed it. **MCP servers should be deterministic.** The AI host is the only place reasoning belongs. Servers do; AI decides. Cross that line and you get systems where it's impossible to tell which layer is responsible for any given behavior.

> **Citation Capsule:** MCP servers should be deterministic processing layers. The AI host is the only place where reasoning belongs. Mixing LLM calls into MCP server handlers creates an uninspectable double-reasoning system — latency doubles, debug logs become meaningless, and it's impossible to tell which layer produced any given output. Servers do; AI decides. That boundary is the architecture.

---

## 9. What this architecture unlocks (and what it costs)

What unlocks:

- **Team-aware AI generation.** Cline writes code that looks like the team's code. First-round review feedback drops accordingly.
- **Dual-surface automation.** The same tools serve interactive AI flows and deterministic CI pipelines.
- **Domain-specific intelligence.** The MFE-aware server lets the AI reason about the platform, not just about React.
- **Versioned conventions in code, not prompts.** Conventions live in the MCP server's templates and rule modules. Updates ship via `pnpm update`, not prompt-engineering rituals.

What costs:

- **Many servers to operate.** Each is one more build pipeline, one more test suite, one more versioning story. The shared `McpServerBase` reduces this dramatically but doesn't eliminate it.
- **MCP versioning churn.** When the SDK or protocol moves, everything needs to update in lockstep. The `^1.0.0` pin across all servers helps; the lockstep is still real.
- **Cognitive overhead for new contributors.** The dual-surface pattern is unusual. New engineers need a thirty-minute walkthrough before it clicks.
- **Tooling on tooling.** Building MCP servers required building meta-tools to debug them. `mcp-tool-improviser` exists because writing good MCP tool descriptions is harder than it looks, and humans need a reviewer.

---

## 10. What I'd do differently

A few things, with the benefit of having shipped most of it.

**Build the CLI wrappers from day one, not as an afterthought.** The dual-surface pattern catches design issues earlier. CLI surfaces force you to think about argument shape and output format — about whether your tool is *callable*, not just *invocable* — in ways AI hosts don't. If I'd built `component-factory-cli.ts` before `component-factory.ts`, I'd have caught five interface decisions that I had to revisit later.

**Treat resources as carefully as tools.** I underinvested in MCP resources. Tools get the AI to *do* things; resources get the AI to *know* things. The AI's context-quality is bounded by what's in resources, and a well-designed resource (the design system's component manifest, the team's lint config, recent code-review comments) makes every subsequent tool call sharper. Spend equal time on them.

**Document the *pattern*, not just the *tools*.** The most valuable artifact for new contributors isn't the tool API documentation — it's a one-page explanation of the dual-surface architecture, the shared base class, and the JSON-RPC handshake. Write that document first. Refer to it in every PR review.

**Resist the temptation to make tools "smart" with internal LLM calls.** I covered this in section 8. Worth repeating: keep MCP servers deterministic. The AI is one layer above; let it reason.

> **Citation Capsule:** Domain-specific MCP servers — ones that understand your platform, your registry, your federated build pipeline — are the next competitive edge for engineering teams. General-purpose AI coding tools will get better at generic React. They won't get better at your React. In 2025, 80% of developers use AI tools daily ([Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/ai)); the teams that win are the ones that taught the AI their specific conventions.

<!-- [INTERNAL-LINK: headless dashboard library @repo/dashcraft → headless-dashboard-library] -->

---

If you've built MCP servers for a team and disagree with any of this — especially the four-families split, the dual-surface CLI pattern, or my call that quality-pipeline shouldn't orchestrate other MCP tools — I'd genuinely like to hear it. The MCP ecosystem is still young enough in 2026 that the patterns aren't settled. The corners that aren't well-documented are the ones I most want to learn from.

Write to me at <a href="mailto:nishantchaudhary5338@gmail.com">nishantchaudhary5338@gmail.com</a>.

— Nishant
