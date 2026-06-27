import { describe, it, expect } from "vitest";
import { renderResultHTML, SAMPLE_RESULT, statusToBand } from "./index.js";
import { esc } from "./escape.js";
import type { ResultReport } from "./index.js";

describe("statusToBand", () => {
  it("maps status to accent band", () => {
    expect(statusToBand("success")).toBe("good");
    expect(statusToBand("partial")).toBe("warn");
    expect(statusToBand("noop")).toBe("good");
  });
});

describe("renderResultHTML", () => {
  const html = renderResultHTML(SAMPLE_RESULT);

  it("produces a complete self-contained document with no external requests", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  it("renders the headline, status and every change path", () => {
    expect(html).toContain("Created 3 files for Button");
    expect(html).toContain("Success");
    for (const c of SAMPLE_RESULT.changes ?? []) expect(html).toContain(esc(c.path));
  });

  it("ships the theme toggle, next-step actions and embedded data", () => {
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('data-action="review"');
    expect(html).toContain('id="report-data"');
    const json = html.split('id="report-data" type="application/json">')[1].split("</script>")[0];
    const parsed = JSON.parse(json.replace(/\\u003c/g, "<")) as ResultReport;
    expect(parsed.changes).toHaveLength(3);
  });

  it("escapes a malicious file path so it cannot break out", () => {
    const evil: ResultReport = {
      ...SAMPLE_RESULT,
      changes: [{ path: `</script><img src=x onerror=alert(1)>`, kind: "created" }],
    };
    const out = renderResultHTML(evil);
    expect(out).not.toContain("<img src=x onerror=alert(1)>");
    expect(out).not.toContain("</script><img");
  });
});
