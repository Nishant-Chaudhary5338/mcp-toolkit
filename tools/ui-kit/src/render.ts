// ============================================================================
// renderReportHTML — assembles ONE self-contained HTML document from a
// HealthReport. Styles + runtime + data are all inlined (no external requests),
// so the result drops straight into a sandboxed MCP iframe or a browser tab.
// ============================================================================

import { STYLES } from "./theme.js";
import { RUNTIME } from "./runtime.js";
import { esc } from "./escape.js";
import {
  buildHeader,
  buildHero,
  buildFixFirst,
  buildCategories,
  buildTriageShell,
  buildChrome,
} from "./components.js";
import { HealthReport } from "./types.js";

/** Embed JSON safely inside a <script> tag (neutralise `</script>` break-out). */
function embedJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function renderReportHTML(report: HealthReport): string {
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
${buildHeader(report)}
${buildHero(report)}
${buildFixFirst(report)}
${buildCategories(report)}
${buildTriageShell(report)}
<div class="foot-note">${esc(report.meta.tool)} · generated ${esc(report.meta.generatedAt)} · mcp-react-toolkit</div>
</div>
${buildChrome()}
<script id="report-data" type="application/json">${embedJson(report)}</script>
<script>${RUNTIME}</script>
</body>
</html>`;
}
