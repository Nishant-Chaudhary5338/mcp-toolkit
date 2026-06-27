// Build step: emit a standalone browser demo (fixture baked in) so the report
// UI can be opened directly in a browser — the public showcase artifact.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderReportHTML } from "./render.js";
import { renderResultHTML } from "./result-render.js";
import { SAMPLE_REPORT } from "./fixture.js";
import { SAMPLE_RESULT } from "./result-fixture.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "demo");
mkdirSync(outDir, { recursive: true });

const html = renderReportHTML(SAMPLE_REPORT);
writeFileSync(resolve(outDir, "index.html"), html, "utf8");
console.error(`[ui-kit] wrote demo/index.html (${(html.length / 1024).toFixed(1)} KB)`);

const resultHtml = renderResultHTML(SAMPLE_RESULT);
writeFileSync(resolve(outDir, "result.html"), resultHtml, "utf8");
console.error(`[ui-kit] wrote demo/result.html (${(resultHtml.length / 1024).toFixed(1)} KB)`);
