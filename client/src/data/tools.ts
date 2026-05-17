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
    description: 'Scaffold a new @repo/ui component from a description. Generates TSX, test file, Storybook story, and type definitions from 41 real shadcn/ui templates.',
    actions: ['generate_component', 'list_templates', 'review_component', 'fix_component', 'improve_component'],
    serverPath: 'tools/component-factory',
    example: '{ "name": "DataGrid", "description": "sortable data table with pagination" }',
  },
  {
    id: 'component-fixer',
    name: 'component-fixer',
    category: 'Component Dev',
    description: 'Auto-fix broken React components — resolves missing imports, incorrect dependency arrays, prop type mismatches, and common anti-patterns.',
    actions: ['fix'],
    serverPath: 'tools/component-fixer',
    example: '{ "path": "src/components/DataGrid.tsx" }',
  },
  {
    id: 'component-improver',
    name: 'component-improver',
    category: 'Component Dev',
    description: 'Enhance an existing component with additional variants, extended Storybook stories, and comprehensive test coverage including edge cases.',
    actions: ['improve'],
    serverPath: 'tools/component-improver',
    example: '{ "path": "src/components/Button.tsx" }',
  },
  {
    id: 'component-reviewer',
    name: 'component-reviewer',
    category: 'Component Dev',
    description: 'Comprehensive component audit — TypeScript errors, test coverage gaps, accessibility violations (WCAG 2.1), and performance anti-patterns.',
    actions: ['review'],
    serverPath: 'tools/component-reviewer',
    example: '{ "path": "src/components/DataGrid.tsx" }',
  },
  {
    id: 'storybook-generator',
    name: 'storybook-generator',
    category: 'Component Dev',
    description: 'Auto-generate Storybook story files for any existing component. Infers props from TypeScript types and creates stories for all variants.',
    actions: ['generate_stories'],
    serverPath: 'tools/storybook-generator',
    example: '{ "path": "src/components/Badge.tsx" }',
  },
  {
    id: 'utils-scaffolder',
    name: 'utils-scaffolder',
    category: 'Component Dev',
    description: 'Scaffold utility modules, custom hooks, and helper functions in @repo/utils with full TypeScript types, JSDoc, and test stubs.',
    actions: ['generate_module', 'generate_hook', 'generate_component', 'list_templates', 'validate_output'],
    serverPath: 'tools/utils-scaffolder',
    example: '{ "type": "hook", "name": "useDebounce" }',
  },
  {
    id: 'ixd-generator',
    name: 'ixd-generator',
    category: 'Component Dev',
    description: 'Generate interaction design specifications from design files. Produces component interaction maps, state diagrams, and handoff docs.',
    actions: ['read_design_file', 'generate_ixd', 'list_templates', 'validate_design'],
    serverPath: 'tools/ixd-generator',
    example: '{ "designFile": "designs/dashboard.fig" }',
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
    description: 'Scan a path for TypeScript violations — implicit any, missing return types, unchecked indexed access, unused locals. Returns violations with fix suggestions.',
    actions: ['scan_file', 'check_project'],
    serverPath: 'tools/typescript-enforcer',
    example: '{ "path": "src/" }',
  },
  {
    id: 'accessibility-checker',
    name: 'accessibility-checker',
    category: 'Code Quality',
    description: 'Static WCAG 2.1 compliance analysis — missing alt text, unlabelled buttons, insufficient color contrast, broken heading hierarchy, invalid ARIA roles.',
    actions: ['check_accessibility'],
    serverPath: 'tools/accessibility-checker',
    example: '{ "path": "src/components/" }',
  },
  {
    id: 'enforce-design-tokens',
    name: 'enforce-design-tokens',
    category: 'Code Quality',
    description: 'Detect and auto-replace hardcoded colour, spacing, and radius values with the correct design token references. Enforces a zero-arbitrary-values rule.',
    actions: ['scan', 'fix'],
    serverPath: 'tools/enforce-design-tokens',
    example: '{ "path": "src/", "fix": true }',
  },
  {
    id: 'analyze-ui-design',
    name: 'analyze-ui-design',
    category: 'Code Quality',
    description: 'Analyse UI/UX design patterns and visual hierarchy in rendered components — spacing consistency, colour usage, typography scale, and layout alignment.',
    actions: ['analyze'],
    serverPath: 'tools/analyze-ui-design',
    example: '{ "path": "src/pages/Dashboard.tsx" }',
  },

  // ── Analysis ──────────────────────────────────────────────────────────────
  {
    id: 'dep-auditor',
    name: 'dep-auditor',
    category: 'Analysis',
    description: 'Deep dependency analysis for monorepos — finds unused packages, duplicate dependencies across workspaces, outdated versions, and bundle size impact.',
    actions: ['find_unused_deps', 'find_duplicate_deps', 'check_outdated', 'analyze_bundle_impact'],
    serverPath: 'tools/dep-auditor',
    example: '{ "workspace": "packages/ui" }',
  },
  {
    id: 'monorepo-manager',
    name: 'monorepo-manager',
    category: 'Analysis',
    description: 'Workspace introspection and dependency graph visualisation — lists all packages, maps inter-package relationships, and reports overall monorepo health.',
    actions: ['list_packages', 'analyze_dependencies', 'check_health', 'get_dependency_graph'],
    serverPath: 'tools/monorepo-manager',
    example: '{ "root": "." }',
  },
  {
    id: 'legacy-analyzer',
    name: 'legacy-analyzer',
    category: 'Analysis',
    description: 'Analyse legacy React codebases across five dimensions: routing patterns, state management, API layer, styling approach, and component architecture. Returns a modernisation roadmap.',
    actions: ['analyze-refactoring', 'analyze-state-management', 'analyze-api-layer', 'analyze-routing', 'analyze-styling'],
    serverPath: 'tools/legacy-analyzer',
    example: '{ "path": "src/", "aspects": ["state","routing","api"] }',
  },
  {
    id: 'render-analyzer',
    name: 'render-analyzer',
    category: 'Analysis',
    description: 'Identify React render performance bottlenecks — unnecessary re-renders, missing memoisation, unstable object/array references, and expensive inline computations.',
    actions: ['analyze_renders'],
    serverPath: 'tools/render-analyzer',
    example: '{ "path": "src/components/DataTable.tsx" }',
  },
  {
    id: 'performance-audit',
    name: 'performance-audit',
    category: 'Analysis',
    description: 'Runtime performance analysis — detects slow imports, missing cleanup in effects, synchronous localStorage calls, and layout-triggering DOM reads.',
    actions: ['audit'],
    serverPath: 'tools/performance-audit',
    example: '{ "path": "src/" }',
  },
  {
    id: 'lighthouse-runner',
    name: 'lighthouse-runner',
    category: 'Analysis',
    description: 'Run Lighthouse audits programmatically — performance, accessibility, best-practices, and SEO scores with actionable recommendations.',
    actions: ['run_audit'],
    serverPath: 'tools/lighthouse-runner',
    example: '{ "url": "http://localhost:5173" }',
  },
  {
    id: 'test-gap-analyzer',
    name: 'test-gap-analyzer',
    category: 'Analysis',
    description: 'Find untested code paths — maps every exported function and component to its test coverage, identifies branches with no test, and reports a coverage gap score.',
    actions: ['analyze_gaps'],
    serverPath: 'tools/test-gap-analyzer',
    example: '{ "path": "src/", "testDir": "__tests__" }',
  },

  // ── Testing ────────────────────────────────────────────────────────────────
  {
    id: 'generate-tests',
    name: 'generate-tests',
    category: 'Testing',
    description: 'Auto-generate Vitest unit and integration tests from source code analysis. Covers happy paths, edge cases, and error states based on TypeScript types.',
    actions: ['generate'],
    serverPath: 'tools/generate-tests',
    example: '{ "path": "src/hooks/useDebounce.ts" }',
  },
  {
    id: 'fix-failing-tests',
    name: 'fix-failing-tests',
    category: 'Testing',
    description: 'Detect failing tests, analyse root causes (import errors, mock mismatches, async timing), and generate targeted fixes. Supports Vitest and Jest.',
    actions: ['fix_tests'],
    serverPath: 'tools/fix-failing-tests',
    example: '{ "path": "src/__tests__/" }',
  },

  // ── Modernization ─────────────────────────────────────────────────────────
  {
    id: 'code-modernizer',
    name: 'code-modernizer',
    category: 'Modernization',
    description: 'Convert JS/JSX files to TypeScript with AST-based type inference. Generates interface definitions, adds return types, converts PropTypes to TypeScript, and removes Flow annotations.',
    actions: ['convert-to-typescript'],
    serverPath: 'tools/code-modernizer',
    example: '{ "path": "src/components/LegacyTable.jsx" }',
  },
  {
    id: 'refactor-executor',
    name: 'refactor-executor',
    category: 'Modernization',
    description: 'Execute planned refactors safely across a codebase — rename exports, split large components, extract hooks, and update all import sites atomically.',
    actions: ['execute'],
    serverPath: 'tools/refactor-executor',
    example: '{ "plan": "extract usePagination from DataTable.tsx" }',
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  {
    id: 'json-viewer',
    name: 'json-viewer',
    category: 'Utilities',
    description: 'Save any JSON payload and generate an interactive, searchable HTML viewer. Useful for inspecting MCP tool responses, API payloads, and config files.',
    actions: ['view_json', 'list_responses', 'view_response'],
    serverPath: 'tools/json-viewer',
    example: '{ "data": { "key": "value" }, "label": "API response" }',
  },
  {
    id: 'config-manager',
    name: 'config-manager',
    category: 'Utilities',
    description: 'Validate and audit monorepo workspace configurations — checks package.json consistency, tsconfig inheritance chains, and ESLint config alignment across all packages.',
    actions: ['validate', 'audit'],
    serverPath: 'tools/config-manager',
    example: '{ "root": "." }',
  },
  {
    id: 'mcp-tool-improviser',
    name: 'mcp-tool-improviser',
    category: 'Utilities',
    description: 'Meta-tool: analyse and improve other MCP servers. Identifies missing input validation, non-standard tool names, missing error handling, and suggests improvements.',
    actions: ['analyze_tool', 'improve_tool', 'generate_test', 'validate_mcp'],
    serverPath: 'tools/mcp-tool-improviser',
    example: '{ "serverPath": "tools/component-factory" }',
  },
  {
    id: 'docs',
    name: 'docs',
    category: 'Utilities',
    description: 'Generate comprehensive documentation for any package or module — README, API reference, usage examples, and type signatures extracted from source.',
    actions: ['generate'],
    serverPath: 'tools/docs',
    example: '{ "path": "packages/dashcraft", "format": "markdown" }',
  },
  {
    id: 'cli-wrappers',
    name: 'cli-wrappers',
    category: 'Utilities',
    description: 'CLI wrappers that turn any MCP server into a general-purpose shell script. The same server that powers Cline also powers pnpm scripts and CI pipelines.',
    actions: ['scan-all', 'scan-ui', 'run-pipeline'],
    serverPath: 'tools/cli-wrappers',
    example: 'pnpm scan:ui  # → component-reviewer on all @repo/ui components',
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
  'Component Dev': '#6366f1',
  'Code Quality': '#10b981',
  'Analysis': '#f59e0b',
  'Testing': '#3b82f6',
  'Modernization': '#ec4899',
  'Utilities': '#a1a1aa',
}
