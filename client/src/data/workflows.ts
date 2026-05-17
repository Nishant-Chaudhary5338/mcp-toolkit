import { type ToolCategory } from './tools'

export interface WorkflowStep {
  tool: string
  category: ToolCategory
  action: string
  description: string
  outputSummary: string
}

export interface Workflow {
  id: string
  title: string
  tagline: string
  useCase: string
  steps: WorkflowStep[]
  endpoint: string
}

export const workflows: Workflow[] = [
  {
    id: 'component-pipeline',
    title: 'Component Pipeline',
    tagline: 'From description to production-ready component in one run.',
    useCase: '"I need a new DataTable with variants, full tests, and Storybook stories — built to our team conventions."',
    endpoint: '/api/workflow/component-pipeline',
    steps: [
      {
        tool: 'component-factory',
        category: 'Component Dev',
        action: 'generate_component',
        description: 'Scaffold component from description using team templates',
        outputSummary: 'DataTable.tsx + DataTable.types.ts + DataTable.test.tsx created',
      },
      {
        tool: 'component-reviewer',
        category: 'Component Dev',
        action: 'review',
        description: 'Audit TypeScript, accessibility, and test coverage',
        outputSummary: '3 type issues, 1 a11y warning, 78% coverage',
      },
      {
        tool: 'component-fixer',
        category: 'Component Dev',
        action: 'fix',
        description: 'Auto-fix all issues found in review',
        outputSummary: 'All 4 issues resolved, imports corrected',
      },
      {
        tool: 'component-improver',
        category: 'Component Dev',
        action: 'improve',
        description: 'Add size variants, loading state, empty state',
        outputSummary: '3 new variants added, 8 new test cases',
      },
      {
        tool: 'storybook-generator',
        category: 'Component Dev',
        action: 'generate_stories',
        description: 'Generate Storybook stories for all variants',
        outputSummary: 'DataTable.stories.tsx with 7 stories generated',
      },
    ],
  },
  {
    id: 'modernization',
    title: 'Code Modernization',
    tagline: 'Migrate a legacy JS codebase to strict TypeScript with tests.',
    useCase: '"This codebase was written in 2019 in plain JavaScript. Migrate it to TypeScript and generate tests for all exports."',
    endpoint: '/api/workflow/modernization',
    steps: [
      {
        tool: 'legacy-analyzer',
        category: 'Analysis',
        action: 'analyze-refactoring',
        description: 'Analyse the codebase — routing, state, API patterns, tech debt',
        outputSummary: 'Found 47 JS files, class components, PropTypes, no types',
      },
      {
        tool: 'code-modernizer',
        category: 'Modernization',
        action: 'convert-to-typescript',
        description: 'AST-based JS → TS conversion with inferred types',
        outputSummary: '47 files converted, 312 types inferred, 0 any used',
      },
      {
        tool: 'typescript-enforcer',
        category: 'Code Quality',
        action: 'check_project',
        description: 'Scan for remaining violations — implicit any, missing returns',
        outputSummary: '8 violations found across 3 files',
      },
      {
        tool: 'generate-tests',
        category: 'Testing',
        action: 'generate',
        description: 'Auto-generate Vitest tests for all exported functions',
        outputSummary: '94 test cases generated across 47 files',
      },
    ],
  },
  {
    id: 'quality-audit',
    title: 'Quality Audit',
    tagline: 'Full production readiness check before a release.',
    useCase: '"We\'re cutting a release branch tomorrow. Run a full quality audit — performance, accessibility, render efficiency, and overall grade."',
    endpoint: '/api/workflow/quality-audit',
    steps: [
      {
        tool: 'lighthouse-runner',
        category: 'Analysis',
        action: 'run_audit',
        description: 'Lighthouse audit — performance, a11y, best-practices, SEO',
        outputSummary: 'Performance 91 · A11y 84 · Best Practices 100 · SEO 96',
      },
      {
        tool: 'accessibility-checker',
        category: 'Code Quality',
        action: 'check_accessibility',
        description: 'Static WCAG 2.1 analysis across all components',
        outputSummary: '2 missing alt texts, 1 heading order violation',
      },
      {
        tool: 'render-analyzer',
        category: 'Analysis',
        action: 'analyze_renders',
        description: 'Detect unnecessary re-renders and memo opportunities',
        outputSummary: '3 unstable references, 2 missing memo calls identified',
      },
      {
        tool: 'quality-pipeline',
        category: 'Code Quality',
        action: 'run_full_pipeline',
        description: 'Full pipeline: tests + types + perf + a11y + tokens → grade',
        outputSummary: 'Grade: B+ (87/100) — 2 minor issues to fix before release',
      },
    ],
  },
  {
    id: 'dep-health',
    title: 'Dependency Health',
    tagline: 'Audit and clean up a monorepo\'s dependency graph.',
    useCase: '"Our node_modules is 2GB. Find unused packages, duplicates across workspaces, and the heaviest bundle contributors."',
    endpoint: '/api/workflow/dep-health',
    steps: [
      {
        tool: 'dep-auditor',
        category: 'Analysis',
        action: 'find_unused_deps',
        description: 'Identify packages declared but never imported',
        outputSummary: '8 unused packages found — safe to remove',
      },
      {
        tool: 'dep-auditor',
        category: 'Analysis',
        action: 'find_duplicate_deps',
        description: 'Find the same package installed multiple times across workspaces',
        outputSummary: '3 duplicates: lodash (v4+v5), date-fns (v2+v3), react-icons',
      },
      {
        tool: 'dep-auditor',
        category: 'Analysis',
        action: 'analyze_bundle_impact',
        description: 'Measure each dependency\'s bundle size contribution',
        outputSummary: 'Top 5 heaviest: moment (67kb), lodash (72kb), recharts (98kb)',
      },
      {
        tool: 'monorepo-manager',
        category: 'Analysis',
        action: 'check_health',
        description: 'Overall workspace health check — circular deps, version mismatches',
        outputSummary: 'Health score: 74/100 — 1 circular dep, 5 version mismatches',
      },
    ],
  },
  {
    id: 'new-feature',
    title: 'New Feature Scaffold',
    tagline: 'Bootstrap a new utility with tests, docs, and a quality grade.',
    useCase: '"I need a new useInfiniteScroll hook in @repo/utils — with tests, Storybook demo, and a quality check before merging."',
    endpoint: '/api/workflow/new-feature',
    steps: [
      {
        tool: 'utils-scaffolder',
        category: 'Component Dev',
        action: 'generate_hook',
        description: 'Scaffold useInfiniteScroll hook with full TypeScript types',
        outputSummary: 'useInfiniteScroll.ts + types.ts created with JSDoc',
      },
      {
        tool: 'generate-tests',
        category: 'Testing',
        action: 'generate',
        description: 'Generate Vitest tests covering happy path and edge cases',
        outputSummary: '12 test cases generated including scroll boundary and reset',
      },
      {
        tool: 'storybook-generator',
        category: 'Component Dev',
        action: 'generate_stories',
        description: 'Create an interactive Storybook demo for the hook',
        outputSummary: 'useInfiniteScroll.stories.tsx with 3 demo variants',
      },
      {
        tool: 'quality-pipeline',
        category: 'Code Quality',
        action: 'run_full_pipeline',
        description: 'Run full quality pipeline — types, tests, a11y, tokens',
        outputSummary: 'Grade: A (96/100) — ready to merge',
      },
    ],
  },
]
