// ============================================================================
// renderResultHTML — one self-contained HTML document for an action/result
// report (scaffold, fix, convert, generate). Shares styles + chrome with the
// health report; uses the result-specific runtime.
// ============================================================================

import { STYLES } from "./theme.js";
import { RESULT_RUNTIME } from "./result-runtime.js";
import { esc } from "./escape.js";
import {
  buildResultHeader,
  buildResultHero,
  buildChanges,
  buildSections,
  buildNextSteps,
  buildChrome,
} from "./result-components.js";
import { ResultReport } from "./types.js";

function embedJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function renderResultHTML(report: ResultReport): string {
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(report.meta.title)} — ${esc(report.meta.target)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
${buildResultHeader(report)}
${buildResultHero(report)}
${buildNextSteps(report)}
${buildChanges(report)}
${buildSections(report)}
<div class="foot-note">${esc(report.meta.tool)} · generated ${esc(report.meta.generatedAt)} · mcp-react-toolkit</div>
</div>
${buildChrome()}
<script id="report-data" type="application/json">${embedJson(report)}</script>
<script>${RESULT_RUNTIME}</script>
</body>
</html>`;
}
