export type ToolCategory =
  | 'Component Dev'
  | 'Code Quality'
  | 'Analysis'
  | 'Testing'
  | 'Modernization'
  | 'CRUD Factory'
  | 'Boilerplate'
  | 'Meta'
  | 'Utilities'

export interface McpTool {
  id: string
  name: string
  category: ToolCategory
  description: string
  actions: string[]
  serverPath: string
  example?: string
}

export const tools: McpTool[] = [
  // ── Component Dev ─────────────────────────────────────────────────────────
  {
    id: 'component-factory',
    name: 'component-factory',
    category: 'Component Dev',
    description: 'Scaffold a new React component from a description using 41 shadcn/ui templates. Generates TSX, test file, Storybook story, and type definitions.',
    actions: ['generate_component', 'list_templates'],
    serverPath: 'tools/component-factory',
    example: '{ "name": "DataGrid", "description": "sortable data table with pagination" }',
  },
  {
    id: 'component-reviewer',
    name: 'component-reviewer',
    category: 'Component Dev',
    description: 'Comprehensive component audit across 7 categories — TypeScript errors, React patterns, accessibility (WCAG 2.1), code quality, security, and testing. Returns an A+ to F grade.',
    actions: ['review'],
    serverPath: 'tools/component-reviewer',
    example: '{ "path": "src/components/DataGrid.tsx" }',
  },
  {
    id: 'component-fixer',
    name: 'component-fixer',
    category: 'Component Dev',
    description: 'Auto-fix broken React components — resolves missing imports, replaces any types, extracts inline styles, and adds missing alt attributes.',
    actions: ['fix', 'fix_imports', 'fix_types'],
    serverPath: 'tools/component-fixer',
    example: '{ "path": "src/components/DataGrid.tsx" }',
  },
  {
    id: 'storybook-generator',
    name: 'storybook-generator',
    category: 'Component Dev',
    description: 'Auto-generate Storybook stories for any React component. Infers props from TypeScript interfaces and creates Default, variant, size, callback, and play-function stories.',
    actions: ['generate_stories', 'check_story_coverage'],
    serverPath: 'tools/storybook-generator',
    example: '{ "path": "src/components/Badge.tsx" }',
  },

  {
    id: 'component-improver',
    name: 'component-improver',
    category: 'Component Dev',
    description: 'Improve a React component directory with extended tests, Storybook stories, and variant coverage — rewrites the test and story files with comprehensive cases.',
    actions: ['improve'],
    serverPath: 'tools/component-improver',
    example: '{ "path": "packages/ui/components/Button" }',
  },

  {
    id: 'refactor-executor',
    name: 'refactor-executor',
    category: 'Modernization',
    description: 'Safely execute refactor plans on React/TS codebases — move/rename files, split modules, update all imports, create barrels, validate the build, and roll back on failure. 10 staged operations.',
    actions: ['validate-refactor-plan', 'move-files', 'update-imports', 'split-modules', 'apply-refactor', 'rollback-on-failure'],
    serverPath: 'tools/refactor-executor',
    example: '{ "path": "/path/to/app", "refactorPlan": { "moves": [], "renames": [], "splits": [] } }',
  },

  // ── Code Quality ──────────────────────────────────────────────────────────
  {
    id: 'quality-pipeline',
    name: 'quality-pipeline',
    category: 'Code Quality',
    description: 'Five-stage automated quality pipeline: runs tests, type-checks, performance analysis, accessibility audit, and design token enforcement. Returns an A–F grade.',
    actions: ['run_full_pipeline', 'run_partial_pipeline'],
    serverPath: 'tools/quality-pipeline',
    example: '{ "path": "packages/ui", "stages": ["tests","types","perf","a11y","tokens"] }',
  },
  {
    id: 'typescript-enforcer',
    name: 'typescript-enforcer',
    category: 'Code Quality',
    description: 'Scan a path for TypeScript violations — implicit any, unsafe casts, missing return types, non-null assertions. 7 rules scored 0–10 with fix suggestions.',
    actions: ['scan_file', 'scan_directory', 'check_project', 'generate_report'],
    serverPath: 'tools/typescript-enforcer',
    example: '{ "path": "src/" }',
  },
  {
    id: 'accessibility-checker',
    name: 'accessibility-checker',
    category: 'Code Quality',
    description: 'Static WCAG 2.1 compliance analysis — missing alt text, unlabelled inputs, ARIA role violations, keyboard navigation gaps. 9 rules with prioritised fixes.',
    actions: ['check_accessibility', 'check_file', 'generate_report'],
    serverPath: 'tools/accessibility-checker',
    example: '{ "path": "src/components/" }',
  },

  // ── Analysis ──────────────────────────────────────────────────────────────
  {
    id: 'dep-auditor',
    name: 'dep-auditor',
    category: 'Analysis',
    description: 'Deep dependency analysis for monorepos — finds unused packages, duplicate dependencies across workspaces, outdated versions, and bundle size impact.',
    actions: ['find_unused_deps', 'find_duplicate_deps', 'check_outdated', 'analyze_bundle_impact'],
    serverPath: 'tools/dep-auditor',
    example: '{ "root": "." }',
  },
  {
    id: 'monorepo-manager',
    name: 'monorepo-manager',
    category: 'Analysis',
    description: 'Workspace introspection and dependency graph visualisation — lists all packages, maps inter-package relationships, finds shared dep mismatches, and reports monorepo health.',
    actions: ['list_packages', 'analyze_dependencies', 'check_health', 'get_dependency_graph'],
    serverPath: 'tools/monorepo-manager',
    example: '{ "root": "." }',
  },
  {
    id: 'legacy-analyzer',
    name: 'legacy-analyzer',
    category: 'Analysis',
    description: '22-tool health audit for any React/Next.js/Remix app. Scores 0–100 across routing, state management, API layer, styling, and component architecture. Returns a prioritised migration roadmap.',
    actions: ['analyze-legacy-app', 'detect-project-tech', 'analyze-folder-structure', 'analyze-state-management', 'analyze-routing'],
    serverPath: 'tools/legacy-analyzer',
    example: '{ "path": "src/" }',
  },
  {
    id: 'render-analyzer',
    name: 'render-analyzer',
    category: 'Analysis',
    description: 'Identify React render performance bottlenecks — unnecessary re-renders, missing memo, unstable inline object and function references, and missing useCallback/useMemo.',
    actions: ['detect_rerenders', 'check_memo', 'analyze_props'],
    serverPath: 'tools/render-analyzer',
    example: '{ "path": "src/components/DataTable.tsx" }',
  },
  {
    id: 'performance-audit',
    name: 'performance-audit',
    category: 'Analysis',
    description: 'Runtime performance analysis — detects memory leaks, heavy imports, unoptimised images, excessive nesting, and console.log statements left in production code.',
    actions: ['audit_bundle', 'detect_heavy_imports', 'check_render_performance'],
    serverPath: 'tools/performance-audit',
    example: '{ "path": "src/" }',
  },
  {
    id: 'lighthouse-runner',
    name: 'lighthouse-runner',
    category: 'Analysis',
    description: 'Static HTML audit plus Lighthouse CLI integration — scores title, viewport, meta, OG/Twitter tags, canonical, JSON-LD, and Core Web Vitals. Supports diff between two runs.',
    actions: ['static_audit', 'run_lighthouse', 'collect_metrics', 'compare_audits'],
    serverPath: 'tools/lighthouse-runner',
    example: '{ "path": "public/index.html" }',
  },
  {
    id: 'test-gap-analyzer',
    name: 'test-gap-analyzer',
    category: 'Analysis',
    description: 'Find untested code paths — maps every exported function and component to its test coverage, identifies uncovered branches, and reports a coverage gap score.',
    actions: ['analyze_test_gaps', 'detect_missing_edge_cases', 'coverage_report'],
    serverPath: 'tools/test-gap-analyzer',
    example: '{ "path": "src/", "testDir": "__tests__" }',
  },

  // ── Testing ────────────────────────────────────────────────────────────────
  {
    id: 'generate-tests',
    name: 'generate-tests',
    category: 'Testing',
    description: 'Analyse a TypeScript/React source file and auto-generate a Vitest test suite covering happy paths, edge cases, and error states based on the function signatures.',
    actions: ['generate_tests', 'analyze_source'],
    serverPath: 'tools/generate-tests',
    example: '{ "path": "src/hooks/useDebounce.ts" }',
  },

  // ── Modernization ─────────────────────────────────────────────────────────
  {
    id: 'code-modernizer',
    name: 'code-modernizer',
    category: 'Modernization',
    description: 'AST-based JS/JSX → TypeScript conversion. Infers types from usage, generates interface definitions, converts PropTypes to TypeScript, and removes Flow annotations.',
    actions: ['convert_to_typescript'],
    serverPath: 'tools/code-modernizer',
    example: '{ "path": "src/components/LegacyTable.jsx" }',
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  {
    id: 'json-viewer',
    name: 'json-viewer',
    category: 'Utilities',
    description: 'Generate an interactive, collapsible, searchable HTML JSON viewer from any payload. Supports dark/light mode and is useful for inspecting MCP responses and API payloads.',
    actions: ['view_json', 'list_responses', 'view_response'],
    serverPath: 'tools/json-viewer',
    example: '{ "data": { "key": "value" }, "label": "API response" }',
  },

  // ── CRUD Factory ──────────────────────────────────────────────────────────
  {
    id: 'infer-fields',
    name: 'infer-fields',
    category: 'CRUD Factory',
    description: 'Infer a typed FieldSchema (fields, types, foreign-key relations, and table/form presentation defaults) from a JSON API sample or an OpenAPI schema. The data contract every CRUD/form/table generator consumes.',
    actions: ['infer_fields'],
    serverPath: 'tools/infer-fields',
    example: '{ "input": "{\\"id\\":1,\\"title\\":\\"Hi\\",\\"authorId\\":5}", "baseEndpoint": "/api/articles" }',
  },
  {
    id: 'zod-schema-generator',
    name: 'zod-schema-generator',
    category: 'CRUD Factory',
    description: 'Generate a Zod schema and its inferred TypeScript type from a FieldSchema — Zod at every boundary for forms and API clients.',
    actions: ['generate_zod_schema'],
    serverPath: 'tools/zod-schema-generator',
    example: '{ "schema": { "resource": "article", "baseEndpoint": "/api/articles", "idKey": "id", "fields": [] } }',
  },
  {
    id: 'api-client-generator',
    name: 'api-client-generator',
    category: 'CRUD Factory',
    description: 'Generate a typed CRUD data layer from a FieldSchema — an RTK Query api slice or TanStack Query hooks (list/get/create/update/delete) with cache invalidation.',
    actions: ['generate_api_client'],
    serverPath: 'tools/api-client-generator',
    example: '{ "schema": { "resource": "article", "baseEndpoint": "/api/articles" }, "dataLayer": "rtk" }',
  },
  {
    id: 'form-generator',
    name: 'form-generator',
    category: 'CRUD Factory',
    description: 'Generate a React Hook Form + Zod form component (create or edit) from a FieldSchema, wired to the generated rtk or tanstack mutation hooks.',
    actions: ['generate_form'],
    serverPath: 'tools/form-generator',
    example: '{ "schema": { "resource": "article" }, "mode": "create", "dataLayer": "rtk" }',
  },
  {
    id: 'table-generator',
    name: 'table-generator',
    category: 'CRUD Factory',
    description: 'Generate a TanStack Table data table (sortable headers, global filter, pagination) from a FieldSchema, wired to the generated list hook. Client or server pagination.',
    actions: ['generate_table'],
    serverPath: 'tools/table-generator',
    example: '{ "schema": { "resource": "article" }, "paginationMode": "client", "dataLayer": "rtk" }',
  },
  {
    id: 'detail-generator',
    name: 'detail-generator',
    category: 'CRUD Factory',
    description: 'Generate a typed detail/view component from a FieldSchema — every field as a definition row plus a delete action, wired to the generated get and delete hooks.',
    actions: ['generate_detail'],
    serverPath: 'tools/detail-generator',
    example: '{ "schema": { "resource": "article" }, "dataLayer": "rtk" }',
  },
  {
    id: 'crud-composer',
    name: 'crud-composer',
    category: 'CRUD Factory',
    description: 'Wire the generated table/detail/form components into routes — a React Router 7 route array with param wrappers, or Next App Router app/ segment page files.',
    actions: ['compose_crud'],
    serverPath: 'tools/crud-composer',
    example: '{ "schema": { "resource": "article", "baseEndpoint": "/api/articles" }, "router": "rr7" }',
  },
  {
    id: 'msw-mock-generator',
    name: 'msw-mock-generator',
    category: 'CRUD Factory',
    description: 'Generate MSW request handlers (list/get/create/update/delete) plus deterministic seed data from a FieldSchema, so the generated CRUD feature runs against a mock API in dev and tests.',
    actions: ['generate_mock'],
    serverPath: 'tools/msw-mock-generator',
    example: '{ "schema": { "resource": "article", "baseEndpoint": "/api/articles" }, "count": 5 }',
  },
  {
    id: 'workflow-runner',
    name: 'workflow-runner',
    category: 'CRUD Factory',
    description: 'Run the schema_to_feature routine end-to-end: infer-fields → zod → api-client → table/detail/form → crud-composer, gated by review-gate. Returns the full generated file set, a per-step journal, and an A–F grade.',
    actions: ['run_workflow'],
    serverPath: 'tools/workflow-runner',
    example: '{ "input": "{\\"id\\":1,\\"title\\":\\"Hi\\"}", "baseEndpoint": "/api/articles", "dataLayer": "rtk", "router": "rr7" }',
  },

  // ── Code Quality ──────────────────────────────────────────────────────────
  {
    id: 'review-gate',
    name: 'review-gate',
    category: 'Code Quality',
    description: 'Static A–F quality gate for generated or changed React/TS code: <img> missing alt and unfilled stubs (errors), any / console.log / hardcoded hex colors (warnings). Grades a file or directory.',
    actions: ['run_review'],
    serverPath: 'tools/review-gate',
    example: '{ "path": "src/features/article" }',
  },

  {
    id: 'enforce-design-tokens',
    name: 'enforce-design-tokens',
    category: 'Code Quality',
    description: 'Scan React/TS/CSS for hardcoded design values (colors, spacing, font sizes, radii, shadows, z-index), suggest design-token replacements, and grade a path A–F on token compliance.',
    actions: ['scan_tokens', 'suggest_tokens', 'enforce_tokens'],
    serverPath: 'tools/enforce-design-tokens',
    example: '{ "path": "src/components", "severity": "high" }',
  },

  {
    id: 'e2e-generator',
    name: 'e2e-generator',
    category: 'Testing',
    description: 'Generate a Playwright end-to-end CRUD flow spec (create -> list -> read -> edit -> delete + a11y) from a FieldSchema. Tests the feature the CRUD factory generates, closing the factory -> feature -> mock -> E2E loop.',
    actions: ['generate_e2e'],
    serverPath: 'tools/e2e-generator',
    example: '{ "schema": { "resource": "article", "baseEndpoint": "/api/articles" } }',
  },
  {
    id: 'playwright-scaffolder',
    name: 'playwright-scaffolder',
    category: 'Testing',
    description: 'Scaffold a Playwright test harness for a React/Vite app — config, POM fixture, base Page Object, and optional auth storage-state setup.',
    actions: ['generate_scaffold'],
    serverPath: 'tools/playwright-scaffolder',
    example: '{ "baseUrl": "http://localhost:5173", "includeAuth": true }',
  },
  {
    id: 'visual-regression-setup',
    name: 'visual-regression-setup',
    category: 'Testing',
    description: 'Generate Playwright visual-regression specs (toHaveScreenshot) for routes or Storybook stories, plus the config snippet — catches unintended CSS/layout drift.',
    actions: ['generate_visual_regression'],
    serverPath: 'tools/visual-regression-setup',
    example: '{ "routes": ["/", "/articles"] }',
  },
  {
    id: 'test-data-factory',
    name: 'test-data-factory',
    category: 'Testing',
    description: 'Generate a typed test-fixture factory (makeX/makeXs with overrides + seq reset) from a FieldSchema — deterministic mock data for unit tests, Storybook, and seeds.',
    actions: ['generate_factory'],
    serverPath: 'tools/test-data-factory',
    example: '{ "schema": { "resource": "article", "baseEndpoint": "/api/articles" } }',
  },
  {
    id: 'fix-failing-tests',
    name: 'fix-failing-tests',
    category: 'Testing',
    description: 'Run the suite (auto-detects Vitest/Jest), classify each failure by root cause (import, type, assertion, timeout, runtime), and generate targeted fix code.',
    actions: ['run_tests', 'analyze_failures', 'auto_fix'],
    serverPath: 'tools/fix-failing-tests',
    example: '{ "projectRoot": "/path/to/project" }',
  },

  // ── Boilerplate ───────────────────────────────────────────────────────────
  {
    id: 'barrel-generator',
    name: 'barrel-generator',
    category: 'Boilerplate',
    description: 'Generate an index.ts barrel that re-exports every module in a folder (skips index/test/stories/.d.ts/css) — kills hand-maintained export lists that drift.',
    actions: ['generate_barrel'],
    serverPath: 'tools/barrel-generator',
    example: '{ "path": "src/components", "named": true }',
  },

  // ── Meta ──────────────────────────────────────────────────────────────────
  {
    id: 'mcp-tool-factory',
    name: 'mcp-tool-factory',
    category: 'Meta',
    description: 'Scaffold, wire, and verify new MCP tools inside this package — the executable form of the mcp-server-builder skill. Writes the McpServerBase shell + core stub + tests, edits root workspaces/scripts/bin, then builds and smoke-tests.',
    actions: ['scaffold_tool', 'wire_tool', 'verify_tool'],
    serverPath: 'tools/mcp-tool-factory',
    example: '{ "spec": { "name": "my-tool", "description": "...", "actions": [{ "name": "do_thing", "description": "..." }] } }',
  },
  {
    id: 'mcp-tool-improviser',
    name: 'mcp-tool-improviser',
    category: 'Meta',
    description: 'Analyze and improve MCP tools across 7 dimensions (description quality, schema completeness, error handling, edge cases, response structure, code quality, contextual depth). Proposes diffs, applies them, and supports rollback.',
    actions: ['analyze_tool', 'batch_analyze', 'apply_improvements', 'rollback'],
    serverPath: 'tools/mcp-tool-improviser',
    example: '{ "path": "tools/component-factory/src/index.ts" }',
  },
  {
    id: 'docs-generator',
    name: 'docs-generator',
    category: 'Meta',
    description: 'Generate documentation from source — a README for an MCP tool (from its addTool registrations) or an API reference for a TS module (from its exported functions/types + JSDoc).',
    actions: ['generate_tool_docs', 'generate_api_reference'],
    serverPath: 'tools/docs-generator',
    example: '{ "path": "tools/infer-fields" }',
  },
]

export const categories: ToolCategory[] = [
  'Component Dev',
  'Code Quality',
  'Analysis',
  'Testing',
  'Modernization',
  'CRUD Factory',
  'Boilerplate',
  'Meta',
  'Utilities',
]

export const categoryColors: Record<ToolCategory, string> = {
  'Component Dev': '#46D88A',
  'Code Quality':  '#5B9DFF',
  'Analysis':      '#45C7D6',
  'Testing':       '#C792EA',
  'Modernization': '#F5B544',
  'Utilities':     '#9DA2A9',
}

export const categoryCount: Record<ToolCategory, number> = Object.fromEntries(
  categories.map(cat => [cat, tools.filter(t => t.category === cat).length])
) as Record<ToolCategory, number>
