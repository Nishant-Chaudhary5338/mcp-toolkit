# performance-audit

MCP server that audits React source files for runtime performance issues — memory leaks, heavy library imports, unoptimized images, and deeply nested code.

## Tools

| Tool | What it does |
|---|---|
| `audit_bundle` | Scan a directory for heavy imports, memory leaks, and console statements |
| `detect_heavy_imports` | Report libraries that significantly increase bundle size (moment, lodash, etc.) |
| `check_render_performance` | Find deep nesting and synchronous operations inside components |

## Detected patterns

| Issue | Severity |
|---|---|
| `useEffect` with `addEventListener` and no cleanup | high |
| `setInterval` / `setTimeout` without cleanup | high/medium |
| Full `lodash` or `moment` import | high |
| `<img>` without `loading="lazy"` | medium |
| 3+ nested ternary operators | medium |
| `console.log` in production code | low |
| Dynamic import without `React.lazy` | low |

## Usage

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"audit_bundle","arguments":{"path":"/path/to/src"}}}' \
  | node build/index.js
```

## Build & test

```sh
npm run build
npm test
```
