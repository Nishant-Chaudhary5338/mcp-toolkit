# storybook-generator

MCP server that auto-generates comprehensive Storybook stories for React components — Default, Playground, per-variant, per-size, callbacks, accessibility, and interactive play functions.

## Tools

| Tool | What it does |
|---|---|
| `generate_stories` | Generate `.stories.tsx` for a component file or directory |
| `check_story_coverage` | Report which components have stories and which don't |

## Usage

```sh
# Generate stories for a single component
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"generate_stories","arguments":{"path":"src/components/Button.tsx"}}}' \
  | node build/index.js

# Check coverage across a directory
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_story_coverage","arguments":{"path":"src/components"}}}' \
  | node build/index.js
```

## Generated stories include

- `Default` — basic render with sensible defaults
- `Playground` — full `argTypes` enabling Storybook controls
- Per-variant stories (extracted from union types or `cva()`)
- Per-size stories
- `Disabled` / `Loading` states (when props exist)
- `WithCallbacks` — `vi.fn()` handlers shown in Actions panel
- `play` function for interactive components (button, input)

## Build & test

```sh
npm run build
npm test
```
