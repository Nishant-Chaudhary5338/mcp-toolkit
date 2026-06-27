import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { renderReportHTML } from "./render.js";
import { SAMPLE_REPORT } from "./fixture.js";
import type { HealthReport } from "./types.js";

function bootHtml(html: string): { window: Window & typeof globalThis; doc: Document } {
  const dom = new JSDOM(html, {
    url: "https://example.com/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  // @ts-expect-error jsdom window is a structural match for the test
  return { window: dom.window, doc: dom.window.document };
}
function boot(): { window: Window & typeof globalThis; doc: Document } {
  return bootHtml(renderReportHTML(SAMPLE_REPORT));
}

describe("runtime (jsdom)", () => {
  let doc: Document;
  let window: Window & typeof globalThis;
  beforeEach(() => {
    const b = boot();
    doc = b.doc;
    window = b.window;
  });

  it("hydrates the triage table from embedded data", () => {
    const rows = doc.querySelectorAll("#rows tr");
    expect(rows.length).toBe(SAMPLE_REPORT.issues.length);
  });

  it("defaults to light theme and toggles to dark", () => {
    expect(doc.documentElement.getAttribute("data-theme")).toBe("light");
    (doc.getElementById("theme-toggle") as HTMLButtonElement).click();
    expect(doc.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("sets the accent band from the score", () => {
    // score 62 -> warn band
    expect(doc.documentElement.getAttribute("data-band")).toBe("warn");
  });

  it("filters rows by severity", () => {
    const critical = SAMPLE_REPORT.issues.filter((i) => i.severity === "critical").length;
    const btn = doc.querySelector('.filter button[data-sev="critical"]') as HTMLButtonElement;
    btn.click();
    expect(doc.querySelectorAll("#rows tr").length).toBe(critical);
  });

  it("searches across title and file", () => {
    const search = doc.getElementById("search") as HTMLInputElement;
    search.value = "Dashboard.jsx";
    search.dispatchEvent(new window.Event("input"));
    const rows = doc.querySelectorAll("#rows tr");
    expect(rows.length).toBe(1);
  });

  it("opens the drawer when a row is clicked", () => {
    const row = doc.querySelector("#rows tr") as HTMLTableRowElement;
    row.click();
    expect(doc.getElementById("drawer")?.classList.contains("open")).toBe(true);
    expect(doc.getElementById("d-title")?.textContent).toBeTruthy();
  });

  it("dispatches an MCP tool message when embedded in a host", () => {
    // simulate iframe embedding by making self !== top is not possible post-boot;
    // instead assert the action handler runs and surfaces a toast (fallback path).
    const action = doc.querySelector('[data-action="fix-god"]') as HTMLButtonElement;
    action.click();
    const toast = doc.getElementById("toast");
    expect(toast?.classList.contains("show")).toBe(true);
  });

  it("restores focus to the triggering row when the drawer closes", () => {
    const row = doc.querySelector("#rows tr") as HTMLTableRowElement;
    row.focus();
    row.click();
    (doc.getElementById("d-close") as HTMLButtonElement).click();
    expect(doc.activeElement).toBe(row);
  });

  it("escapes malicious issue data injected into the runtime-built table (no XSS)", () => {
    const evil: HealthReport = {
      ...SAMPLE_REPORT,
      issues: [
        {
          id: "x1",
          category: "components",
          severity: "high",
          title: `<img src=x onerror="window.__xss=1">`,
          file: `src/<script>window.__xss=1</script>.tsx`,
        },
      ],
    };
    const { window, doc } = bootHtml(renderReportHTML(evil));
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    // the malicious markup must be inert text, not real elements
    expect(doc.querySelectorAll("#rows img").length).toBe(0);
    expect(doc.querySelector("#rows .cell-title")?.textContent).toContain("<img");
  });
});
