export type ToolCategory =
  | 'Component Dev'
  | 'Code Quality'
  | 'Analysis'
  | 'Testing'
  | 'Modernization'
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
  {
    id: 'infer-fields',
    name: 'infer-fields',
    category: 'Utilities',
    description: 'Infer a typed FieldSchema (fields, types, foreign-key relations, and table/form presentation defaults) from a JSON API sample or an OpenAPI schema. The data contract every CRUD/form/table generator consumes.',
    actions: ['infer_fields'],
    serverPath: 'tools/infer-fields',
    example: '{ "input": "{\\"id\\":1,\\"title\\":\\"Hi\\",\\"authorId\\":5}", "baseEndpoint": "/api/articles" }',
  },
]

export const categories: ToolCategory[] = [
  'Component Dev',
  'Code Quality',
  'Analysis',
  'Testing',
  'Modernization',
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
