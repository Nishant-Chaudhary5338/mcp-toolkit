# render-analyzer

MCP server that profiles React components for unnecessary re-renders, missing memoization, and inline object/function patterns.

## Tools

| Tool | What it does |
|---|---|
| `detect_rerenders` | Scan a directory for inline objects, inline functions, and missing `React.memo` |
| `check_memo` | Report memoization rate — how many components use `memo`, `useMemo`, `useCallback` |
| `analyze_props` | Analyze prop counts and patterns across all components |

## Usage

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"detect_rerenders","arguments":{"path":"/path/to/src"}}}' \
  | node build/index.js
```

## Output

```json
{
  "success": true,
  "summary": { "totalComponents": 40, "totalIssues": 12, "componentsWithIssues": 8 },
  "profiles": [
    {
      "name": "PostCard",
      "hasMemo": false,
      "inlineObjects": 3,
      "inlineFunctions": 2,
      "issues": [...]
    }
  ]
}
```

## Build & test

```sh
npm run build
npm test
```
