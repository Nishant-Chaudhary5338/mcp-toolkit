# component-fixer

MCP server that applies automated fixes to React component files — resolves issues found by `component-reviewer`, fixes imports, adds missing return types, and refactors inline patterns.

## Tools

| Tool | What it does |
|---|---|
| `fix` | Apply all auto-fixable issues from a `component-reviewer` result |
| `fix_imports` | Resolve broken/missing import paths in a component |
| `fix_types` | Replace `any` with proper types, add missing return type annotations |

## What it fixes automatically

| Issue | Fix |
|---|---|
| Missing return type on exported function | Infers and adds `: ReturnType` |
| `any` type annotation | Replaces with `unknown` + adds comment |
| Inline `style={{ ... }}` in JSX | Extracts to const outside component |
| Broken relative import (`../../../`) | Resolves using `tsconfig.paths` |
| Missing `alt` on `<img>` | Adds `alt=""` with TODO comment |

## Usage

```sh
# Fix all auto-fixable issues
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fix","arguments":{"path":"src/components/Button.tsx"}}}' \
  | node build/index.js
```

## Workflow

Pair with `component-reviewer` for a review-then-fix loop:

```
component-reviewer → review → component-fixer → fix → component-reviewer → verify
```

## Build & test

```sh
npm run build
npm test
```
