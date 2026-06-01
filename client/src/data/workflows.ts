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
    id: 'render-performance',
    title: 'Render Performance Audit',
    tagline: 'Find every unnecessary re-render, memory leak, and heavy import before they hit production.',
    useCase: '"Our dashboard is sluggish. Identify re-render hotspots, detect memory leaks, find test gaps, and give us an overall grade."',
    endpoint: '/api/workflow/render-performance',
    steps: [
      {
        tool: 'render-analyzer',
        category: 'Analysis',
        action: 'detect_rerenders',
        description: 'Scan for unnecessary re-renders, missing memo, and unstable references',
        outputSummary: '5 unstable object refs, 3 missing useCallback calls identified',
      },
      {
        tool: 'performance-audit',
        category: 'Analysis',
        action: 'audit_bundle',
        description: 'Detect memory leaks, heavy imports, and layout-triggering DOM reads',
        outputSummary: '2 memory leaks in useEffect, moment.js flagged as 67kb import',
      },
      {
        tool: 'test-gap-analyzer',
        category: 'Analysis',
        action: 'analyze_test_gaps',
        description: 'Map every export to its test coverage and find uncovered branches',
        outputSummary: '18% of exported functions have no test — 4 critical paths uncovered',
      },
      {
        tool: 'quality-pipeline',
        category: 'Code Quality',
        action: 'run_full_pipeline',
        description: 'Full pipeline: tests + types + perf + a11y + tokens → overall grade',
        outputSummary: 'Grade: C+ (68/100) — performance and test gaps are the blockers',
      },
    ],
  },
]
