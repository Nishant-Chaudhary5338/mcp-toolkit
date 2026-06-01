# test-gap-analyzer

MCP server that finds untested code paths — missing test files, unimplemented function stubs, and edge cases that aren't covered.

## Tools

| Tool | What it does |
|---|---|
| `analyze_test_gaps` | Find all exports without a corresponding test file |
| `detect_missing_edge_cases` | For each untested export, suggest edge cases (null input, empty input, boundary values, etc.) |
| `coverage_report` | Summary: total exports, tested vs untested, coverage % |

## Usage

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_test_gaps","arguments":{"path":"/path/to/src"}}}' \
  | node build/index.js
```

## Output

```json
{
  "success": true,
  "summary": { "totalFiles": 50, "coveragePercent": 0, "untestedExports": 105 },
  "gaps": [
    {
      "sourceFile": "src/utils/format.ts",
      "testFile": null,
      "gaps": [{ "name": "formatDate", "type": "function", "line": 12 }]
    }
  ]
}
```

## Build & test

```sh
npm run build
npm test
```
