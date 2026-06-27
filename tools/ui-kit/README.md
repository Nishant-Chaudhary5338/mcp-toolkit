# @mcp-showcase/ui-kit

Reusable **single-file HTML report UI** for MCP tools — dependency-free, dual-theme (light/dark), and agentic. Any tool that maps its output to the `HealthReport` schema gets a premium interactive dashboard that renders inside an MCP host (MCP Apps / `ui://`) **and** opens standalone in a browser.

Flagship producer: `legacy-analyzer` → **Codebase Health Studio**.

## Exports

```ts
import { renderReportHTML, SAMPLE_REPORT, type HealthReport } from "@mcp-showcase/ui-kit";

const html = renderReportHTML(myReport); // one self-contained <!doctype html> string
```

- `renderReportHTML(report: HealthReport): string` — styles, runtime and data all inlined (no external requests, safe for a sandboxed iframe).
- `HealthReport` / `ReportIssue` / `ReportCategory` / `ReportAction` — the tool-agnostic contract.
- `SAMPLE_REPORT` — fixture used by the standalone demo (`npm run build` → `demo/index.html`).

## Surfaces (DataAdapter)

The runtime detects where it is running:

- **Embedded in an MCP host** → action buttons `postMessage` MCP-UI intents (`tool` / `prompt`) to the parent so the agent runs the fix.
- **Standalone browser tab** → graceful fallback: copies a ready-to-paste prompt to the clipboard.

Data is read from `window.__REPORT__`, then an inline `#report-data` script, then a `?data=` base64 URL param.

## Why no framework

The artifact must be a tiny, robust, self-contained file for a sandboxed iframe. Plain CSS + browser JS keeps the bundle ~38 KB with zero supply chain. The React/Vite path is a documented future swap if richer interactivity is needed.
