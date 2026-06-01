# component-reviewer

MCP server that audits a React component file across 7 categories and produces a grade (A+ to F) with actionable fix suggestions.

## Tools

| Tool | What it does |
|---|---|
| `review` | Full review of a component file — type safety, React patterns, a11y, performance, code quality, security, testing |

## Grading scale

| Grade | Score |
|---|---|
| A+ | ≥ 95 |
| A | ≥ 85 |
| B | ≥ 70 |
| C | ≥ 55 |
| D | ≥ 40 |
| F | < 40 |

## Detected issues

- **Type safety** — `any` usage, unsafe casts, missing return types, non-null assertions
- **React patterns** — inline arrow functions in JSX, missing `useCallback`/`useMemo`
- **Accessibility** — missing `alt`, unlabeled inputs, clickable `<div>` without `role`
- **Code quality** — component over 300 lines, high cyclomatic complexity
- **Security** — `dangerouslySetInnerHTML`, unvalidated user input rendering
- **Testing** — missing test file

## Usage

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"review","arguments":{"path":"src/components/Button.tsx"}}}' \
  | node build/index.js
```

## Output

```json
{
  "success": true,
  "summary": { "component": "Button", "overallScore": 87, "grade": "A", "totalIssues": 2 },
  "issues": [...],
  "quickFixes": [...]
}
```

## Build & test

```sh
npm run build
npm test
```
