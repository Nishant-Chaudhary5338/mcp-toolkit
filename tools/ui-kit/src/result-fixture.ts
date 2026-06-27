import { ResultReport } from "./types.js";

/** Sample action report — drives the result-view demo and tests. */
export const SAMPLE_RESULT: ResultReport = {
  meta: {
    title: "Component Factory",
    subtitle: "shadcn/ui · Button",
    target: "@repo/ui",
    generatedAt: "2026-06-27",
    tool: "component-factory",
  },
  headline: "Created 3 files for Button",
  status: "success",
  stats: [
    { label: "Created", value: "3" },
    { label: "Template", value: "shadcn/ui" },
    { label: "Variants", value: "6" },
  ],
  changes: [
    { path: "src/components/Button/Button.tsx", kind: "created", summary: "Component with 6 variants + 4 sizes", additions: 84, language: "tsx", diff: "+ import { cva } from 'class-variance-authority';\n+ export const Button = ({ variant, size, ...props }) => {\n+   return <button className={cn(buttonVariants({ variant, size }))} {...props} />;\n+ };" },
    { path: "src/components/Button/Button.test.tsx", kind: "created", summary: "Vitest + RTL suite, 8 cases", additions: 52, language: "tsx" },
    { path: "src/components/Button/Button.stories.tsx", kind: "created", summary: "Storybook stories: Default, variants, sizes", additions: 39, language: "tsx" },
  ],
  sections: [
    {
      title: "Steps",
      items: [
        { title: "Resolved shadcn/ui Button template", status: "ok" },
        { title: "Generated variants with CVA", status: "ok" },
        { title: "Wrote tests + stories", status: "ok" },
        { title: "Skipped: index barrel not updated", detail: "Add `export * from './Button'` to src/components/index.ts", status: "warn" },
      ],
    },
  ],
  nextActions: [
    { id: "review", label: "Review the component", kind: "tool", tool: "component-reviewer", params: { path: "src/components/Button/Button.tsx" }, fallback: "Review src/components/Button/Button.tsx." },
    { id: "story", label: "Generate more stories", kind: "tool", tool: "storybook-generator", params: { path: "src/components/Button/Button.tsx" }, fallback: "Generate Storybook stories for Button." },
    { id: "barrel", label: "Update barrel export", kind: "prompt", prompt: "Add `export * from './Button'` to src/components/index.ts" },
  ],
};
