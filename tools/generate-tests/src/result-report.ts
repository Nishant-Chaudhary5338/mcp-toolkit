import type { ResultReport, FileChange, ResultSection, ReportAction } from "@mcp-showcase/ui-kit";

// ---------------------------------------------------------------------------
// Local input shape — mirrors what generate_tests returns on success
// ---------------------------------------------------------------------------

export interface GenerateTestsResult {
  message: string;
  dest?: string;
  testContent?: string;
  analysis?: {
    components: string[];
    hooks: string[];
    functions: string[];
    classes: string[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countCases(analysis: GenerateTestsResult["analysis"]): number {
  if (!analysis) return 0;
  return (
    analysis.components.length +
    analysis.hooks.length +
    analysis.functions.length +
    analysis.classes.length
  );
}

function resolveStatus(result: GenerateTestsResult): ResultReport["status"] {
  if (!result.dest) return "noop";
  if (result.message.toLowerCase().includes("already exists")) return "noop";
  return "success";
}

function buildChanges(result: GenerateTestsResult): FileChange[] {
  if (!result.dest) return [];

  const cases = countCases(result.analysis);
  const summaryParts: string[] = [];
  const a = result.analysis;
  if (a) {
    if (a.components.length) summaryParts.push(`${a.components.length} component(s)`);
    if (a.hooks.length) summaryParts.push(`${a.hooks.length} hook(s)`);
    if (a.functions.length) summaryParts.push(`${a.functions.length} function(s)`);
    if (a.classes.length) summaryParts.push(`${a.classes.length} class(es)`);
  }

  const change: FileChange = {
    path: result.dest,
    kind: "created",
    summary: cases > 0 ? `${cases} suite(s): ${summaryParts.join(", ")}` : result.message,
    language: result.dest.endsWith(".tsx") ? "tsx" : "ts",
    ...(result.testContent
      ? { diff: result.testContent.split("\n").slice(0, 20).join("\n") }
      : {}),
  };

  return [change];
}

function buildSections(result: GenerateTestsResult): ResultSection[] {
  const a = result.analysis;
  if (!a) return [];

  const items: ResultSection["items"] = [];
  for (const name of a.components) items.push({ title: name, detail: "React component suite", status: "ok" });
  for (const name of a.hooks) items.push({ title: name, detail: "Custom hook suite", status: "ok" });
  for (const name of a.functions) items.push({ title: name, detail: "Function suite", status: "ok" });
  for (const name of a.classes) items.push({ title: name, detail: "Class suite", status: "ok" });

  if (items.length === 0) return [];
  return [{ title: "Generated suites", items }];
}

function buildNextActions(result: GenerateTestsResult): ReportAction[] {
  const actions: ReportAction[] = [];

  if (result.dest) {
    actions.push({
      id: "fix-failing",
      label: "Fix failing tests",
      kind: "tool",
      tool: "fix-failing-tests",
      params: { path: result.dest },
      fallback: `Run: npx vitest run ${result.dest}`,
    });

    actions.push({
      id: "gap-analysis",
      label: "Analyze test gaps",
      kind: "tool",
      tool: "test-gap-analyzer",
      params: { path: result.dest },
      fallback: `Inspect ${result.dest} for missing coverage paths.`,
    });
  }

  actions.push({
    id: "run-suite",
    label: "Run the test suite",
    kind: "prompt",
    prompt: result.dest
      ? `Run: npx vitest run ${result.dest}`
      : "Run: npx vitest run",
  });

  return actions;
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

export function toResultReport(
  result: GenerateTestsResult,
  generatedAt: string
): ResultReport {
  const cases = countCases(result.analysis);
  const filesCount = result.dest ? 1 : 0;
  const status = resolveStatus(result);

  const headline =
    status === "noop"
      ? result.message
      : `Generated ${filesCount} test file${filesCount !== 1 ? "s" : ""} (${cases} suite${cases !== 1 ? "s" : ""})`;

  const target = result.dest ?? "unknown";

  return {
    meta: {
      title: "Test Generator",
      subtitle: result.dest ? `→ ${result.dest.split("/").pop() ?? result.dest}` : undefined,
      target,
      generatedAt,
      tool: "generate-tests",
    },
    headline,
    status,
    stats: [
      { label: "Files", value: String(filesCount) },
      { label: "Suites", value: String(cases) },
      { label: "Coverage target", value: "Vitest + RTL" },
    ],
    changes: buildChanges(result),
    sections: buildSections(result),
    nextActions: buildNextActions(result),
  };
}
