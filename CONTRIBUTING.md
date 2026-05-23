# Contributing to mcp-toolkit

Thanks for your interest. This project is a collection of MCP servers for React + TypeScript development automation. The fastest way to contribute is to implement one of the [planned tools](README.md#roadmap) from the roadmap.

---

## Quick start

```sh
git clone https://github.com/Nishant-Chaudhary5338/mcp-toolkit.git
cd mcp-toolkit
npm install
npm run build
npm test
```

Requires Node.js 20+.

---

## Adding a new MCP tool

Each tool lives in `tools/<tool-name>/` and extends the shared `McpServerBase` class.

### 1. Scaffold the package

```sh
mkdir -p tools/my-tool/src
```

**`tools/my-tool/package.json`**
```json
{
  "name": "@mcp-showcase/my-tool",
  "version": "1.0.0",
  "type": "module",
  "main": "./build/index.js",
  "scripts": {
    "build": "tsc && chmod +x build/index.js",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@mcp-showcase/shared": "*",
    "@modelcontextprotocol/sdk": "^1.12.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

**`tools/my-tool/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./build",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### 2. Implement the server

**`tools/my-tool/src/index.ts`**
```typescript
#!/usr/bin/env node
import { McpServerBase } from '@mcp-showcase/shared';

class MyToolServer extends McpServerBase {
  constructor() {
    super({ name: 'my-tool', version: '1.0.0' });
  }

  protected registerTools(): void {
    this.addTool(
      'my_action',
      'Describe what this tool does in one sentence.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to target directory' },
        },
        required: ['path'],
      },
      async (args) => {
        const { path } = args as { path: string };
        // your logic here
        return this.success({ result: `Processed ${path}` });
      }
    );
  }
}

new MyToolServer().run();
```

### 3. Write tests

**`tools/my-tool/src/index.test.ts`**
```typescript
import { describe, it, expect, vi } from 'vitest';

// Test the tool logic directly — bypass MCP transport entirely
describe('my-tool', () => {
  it('returns success shape on valid input', async () => {
    // Import your handler logic (extract it from the class if needed)
    const result = { success: true, result: 'Processed /some/path' };
    expect(result.success).toBe(true);
    expect(result.result).toContain('/some/path');
  });
});
```

### 4. Add to the workspace

In the root `package.json`, add `"tools/my-tool"` to the `workspaces` array and add the build step to the `build` script.

### 5. Update the roadmap

In `README.md`, change the tool's row from `📋 Planned` to `🚧 In progress`, then to `✅ Done` once merged.

Also update `client/src/data/tools.ts` — set `available: true` for the tool's entry so the UI shows it as real.

---

## Standards

- **TypeScript strict** — no `any`, explicit return types on exports
- **Error handling** — use `this.error(err)` from `McpServerBase`; never let unhandled exceptions crash the server
- **Tests** — minimum 3 test cases per tool (happy path, invalid input, edge case)
- **No comments** that restate the code — comment only non-obvious constraints
- **One tool per file** for tools with complex logic (see `code-modernizer/src/tools/`)

---

## PR checklist

- [ ] `npm run build` passes with no TypeScript errors
- [ ] `npm test` passes
- [ ] README roadmap updated (status changed to ✅ Done)
- [ ] `client/src/data/tools.ts` entry updated (`available: true`)
- [ ] Tool tested manually with Claude Desktop or Cline

---

## Reporting bugs

Use [GitHub Issues](https://github.com/Nishant-Chaudhary5338/mcp-toolkit/issues/new?template=bug_report.md). Include the tool name, the input you passed, and the full error output.

## Questions

Open a [Discussion](https://github.com/Nishant-Chaudhary5338/mcp-toolkit/discussions) — not an issue.
