# lighthouse-runner

MCP server for web performance and SEO auditing — static HTML analysis plus Lighthouse CLI integration.

## Tools

| Tool | What it does |
|---|---|
| `static_audit` | Score an HTML file: title, viewport, meta description, OG tags, canonical, JSON-LD, a11y landmarks |
| `run_lighthouse` | Run Lighthouse CLI against a live URL (requires Lighthouse installed globally) |
| `collect_metrics` | Extract Core Web Vitals from a Lighthouse JSON report |
| `compare_audits` | Diff two Lighthouse runs to track score changes |

## Static audit checks

| Check | Deduction |
|---|---|
| Missing `<title>` | -10 |
| Missing `name="viewport"` | -10 |
| Missing `name="description"` | -5 |
| Missing `lang` attribute | -5 |
| Images without `alt` | -5 each |
| Render-blocking `<script>` (no defer/async) | -10 |
| Missing canonical URL | -3 |
| Missing Open Graph tags | -3 |
| Missing Twitter Card tags | -2 |
| Missing charset | -3 |
| No semantic landmarks | -5 |
| No JSON-LD structured data | -2 |
| Missing `theme-color` | -1 |

## Usage

```sh
# Audit a local HTML file
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"static_audit","arguments":{"path":"/path/to/index.html"}}}' \
  | node build/index.js
```

## Build & test

```sh
npm run build
npm test
```
