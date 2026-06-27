import { HealthReport } from "./types.js";

/** Representative sample report — drives the standalone browser demo and tests. */
export const SAMPLE_REPORT: HealthReport = {
  meta: {
    title: "Codebase Health Studio",
    subtitle: "React 18 · CRA",
    target: "acme-dashboard",
    generatedAt: "2026-06-27",
    tool: "legacy-analyzer",
  },
  score: 62,
  totalIssues: 18,
  chips: [
    { label: "Framework", value: "Create React App" },
    { label: "React", value: "18.2.0" },
    { label: "Language", value: "JavaScript" },
    { label: "Components", value: "94" },
  ],
  topActions: [
    { id: "fix-god", label: "Split the 3 god components", kind: "tool", tool: "component-fixer", params: { target: "components" }, fallback: "Refactor Dashboard.jsx, Settings.jsx and Reports.jsx into smaller components." },
    { id: "plan", label: "Generate full refactor plan", kind: "tool", tool: "generate-refactor-plan", params: { path: "." }, fallback: "Generate a refactor plan for acme-dashboard." },
    { id: "migrate-ts", label: "Migrate the API layer to TypeScript", kind: "prompt", prompt: "Convert src/api/*.js to TypeScript with typed responses and a centralised client." },
  ],
  categories: [
    { id: "components", name: "Components", score: 48, status: "warn", summary: "3 god components over 300 lines; 11 with mixed responsibilities.", issueCount: 6, details: [{ label: "Total", value: "94" }, { label: "Large", value: "3" }] },
    { id: "state", name: "State", score: 55, status: "warn", summary: "Redux without normalisation; derived state stored in the store.", issueCount: 3 },
    { id: "api", name: "API layer", score: 40, status: "bad", summary: "Scattered axios calls, 4 duplicated endpoints, no central client.", issueCount: 4 },
    { id: "routing", name: "Routing", score: 78, status: "good", summary: "react-router v6, nested routes, but no lazy loading.", issueCount: 1 },
    { id: "styling", name: "Styling", score: 60, status: "warn", summary: "Mixed CSS + styled-components; 23 hardcoded colours.", issueCount: 2 },
    { id: "deps", name: "Dependencies", score: 84, status: "good", summary: "2 unused deps; moment.js inflating the bundle.", issueCount: 2 },
  ],
  issues: [
    { id: "i1", category: "components", severity: "critical", title: "God component: Dashboard.jsx (612 lines)", description: "Dashboard.jsx mixes data fetching, layout, and 4 unrelated widgets. It is the single largest re-render hotspot.", file: "src/pages/Dashboard.jsx", meta: [{ label: "Lines", value: "612" }, { label: "Responsibilities", value: "5" }], actions: [{ id: "fix-i1", label: "Split with component-fixer", kind: "tool", tool: "component-fixer", params: { file: "src/pages/Dashboard.jsx" }, fallback: "Split src/pages/Dashboard.jsx into smaller components." }, { id: "explain-i1", label: "Explain the risk", kind: "prompt", prompt: "Explain why a 612-line god component hurts maintainability and performance in React." }] },
    { id: "i2", category: "api", severity: "critical", title: "Duplicated endpoint: GET /users called 4 ways", description: "Four components call GET /users with slightly different axios config — no shared client or cache.", file: "src/api/", meta: [{ label: "Call sites", value: "4" }], actions: [{ id: "fix-i2", label: "Centralise the API client", kind: "prompt", prompt: "Create a centralised typed axios client and replace the 4 duplicate GET /users call sites." }] },
    { id: "i3", category: "components", severity: "high", title: "God component: Settings.jsx (438 lines)", file: "src/pages/Settings.jsx", meta: [{ label: "Lines", value: "438" }], actions: [{ id: "fix-i3", label: "Split with component-fixer", kind: "tool", tool: "component-fixer", params: { file: "src/pages/Settings.jsx" }, fallback: "Split src/pages/Settings.jsx." }] },
    { id: "i4", category: "api", severity: "high", title: "No central HTTP client — axios imported in 19 files", file: "src/", actions: [] },
    { id: "i5", category: "state", severity: "high", title: "Derived state stored in Redux (totals recomputed on every action)", file: "src/store/cartSlice.js", actions: [{ id: "explain-i5", label: "How to fix", kind: "prompt", prompt: "Show how to replace derived state in Redux with reselect selectors." }] },
    { id: "i6", category: "deps", severity: "high", title: "moment.js adds ~230KB — replace with date-fns or Temporal", file: "package.json", meta: [{ label: "Bundle impact", value: "~230KB" }], actions: [] },
    { id: "i7", category: "components", severity: "medium", title: "Prop drilling 4 levels deep for `user`", file: "src/pages/Reports.jsx", actions: [] },
    { id: "i8", category: "styling", severity: "medium", title: "23 hardcoded hex colours outside the token system", file: "src/styles/", actions: [] },
    { id: "i9", category: "state", severity: "medium", title: "No memoised selectors — components re-render on unrelated store changes", file: "src/store/", actions: [] },
    { id: "i10", category: "api", severity: "medium", title: "Errors swallowed — 11 axios calls have no .catch", file: "src/api/", actions: [] },
    { id: "i11", category: "components", severity: "medium", title: "List rendered with array index as key", file: "src/components/Table.jsx", actions: [] },
    { id: "i12", category: "routing", severity: "medium", title: "No route-level code splitting (React.lazy)", file: "src/App.jsx", actions: [] },
    { id: "i13", category: "deps", severity: "low", title: "2 unused dependencies in package.json", file: "package.json", actions: [] },
    { id: "i14", category: "styling", severity: "low", title: "Duplicate utility classes across 6 CSS files", file: "src/styles/", actions: [] },
    { id: "i15", category: "components", severity: "low", title: "12 components missing displayName", file: "src/components/", actions: [] },
    { id: "i16", category: "api", severity: "low", title: "Base URL hardcoded instead of env var", file: "src/api/config.js", actions: [] },
    { id: "i17", category: "components", severity: "low", title: "Inline arrow functions in 31 render paths", file: "src/", actions: [] },
    { id: "i18", category: "state", severity: "low", title: "Local component state duplicates Redux store data", file: "src/pages/Profile.jsx", actions: [] },
  ],
};
