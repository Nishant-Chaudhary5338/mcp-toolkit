# legacy-analyzer

MCP server with 22 analysis sub-tools that produce a health score (0–100) and prioritized migration hints for any React-based app — CRA, Vite, Next.js (app or pages router), Remix, Gatsby.

## Tools (22)

| Tool | What it does |
|---|---|
| `analyze-legacy-app` | Run all 22 tools and produce a unified health report |
| `detect-project-tech` | Detect React version, language, framework, major deps |
| `analyze-folder-structure` | Flat vs feature-based, standard folders, nesting depth |
| `analyze-components` | Count, large (>300L), complex (multiple responsibilities) |
| `analyze-state-management` | Redux, Context, Zustand, local state patterns |
| `analyze-api-layer` | HTTP clients, centralized vs scattered, duplicate endpoints |
| `analyze-routing` | Router library, flat vs nested, lazy loading |
| `analyze-styling` | CSS/SCSS/Tailwind, inline styles, hardcoded colors |
| `analyze-assets` | Large images/videos, assets inside src, unused assets |
| `detect-anti-patterns` | Prop drilling, tight coupling, god components, a11y |
| `detect-duplication` | Duplicate components (Jaccard similarity), duplicate utils |
| `analyze-dependencies-usage` | Import anti-patterns, UI package usage |
| `detect-features` | Identify logical domains via file names + import clustering |
| `classify-files` | Feature-specific vs shared vs utility vs config |
| `detect-shared-modules` | Files imported by multiple features |
| `design-target-structure` | Suggest scalable feature-based folder structure |
| `map-files-to-target` | Map current files to proposed structure |
| `detect-boundary-violations` | Cross-feature imports, deep relative imports |
| `suggest-module-splitting` | Split large/generic files into focused modules |
| `naming-standardizer` | Suggest consistent file and folder naming |
| `generate-refactor-plan` | Combine all outputs into a structured refactor plan |
| `refactor-folder-structure` | Aggregated restructure plan |

## Usage

```sh
# Full health audit
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze-legacy-app","arguments":{"path":"/path/to/your/app"}}}' \
  | node build/index.js
```

## Output

```json
{
  "success": true,
  "summary": { "healthScore": 72, "totalIssues": 18 },
  "tech": { "framework": "Next.js", "reactVersion": "18", "language": "TypeScript" },
  "migrationHints": [
    { "priority": "high", "category": "API Layer", "description": "..." }
  ]
}
```

## Framework support

Automatically detects the correct source directory:
- `src/` → CRA, Vite
- `app/` → Next.js App Router
- `pages/` → Next.js Pages Router
- root → bare React projects

## Build & test

```sh
npm run build
npm test
```
