import { describe, it, expect } from "vitest";
import { renderReportHTML, SAMPLE_REPORT, scoreToGrade, scoreToBand } from "./index.js";
import { esc } from "./escape.js";
import type { HealthReport } from "./index.js";

describe("scoreToGrade", () => {
  it("maps score ranges to grades", () => {
    expect(scoreToGrade(100)).toBe("A+");
    expect(scoreToGrade(88)).toBe("A");
    expect(scoreToGrade(72)).toBe("B");
    expect(scoreToGrade(60)).toBe("C");
    expect(scoreToGrade(42)).toBe("D");
    expect(scoreToGrade(20)).toBe("F");
  });
});

describe("scoreToBand", () => {
  it("buckets scores into accent bands", () => {
    expect(scoreToBand(80)).toBe("good");
    expect(scoreToBand(50)).toBe("warn");
    expect(scoreToBand(30)).toBe("bad");
  });
});

describe("esc", () => {
  it("escapes HTML-significant characters", () => {
    expect(esc(`<img src=x onerror="a">`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;");
    expect(esc("a & b")).toBe("a &amp; b");
    expect(esc(null)).toBe("");
  });
});

describe("renderReportHTML", () => {
  const html = renderReportHTML(SAMPLE_REPORT);

  it("produces a complete self-contained document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).toContain("data-theme=\"light\"");
    // no external resource requests
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  it("renders the headline score and grade", () => {
    expect(html).toContain('data-count="62"');
    expect(html).toContain("Grade C");
  });

  it("renders every category and embeds the report data", () => {
    for (const c of SAMPLE_REPORT.categories) expect(html).toContain(esc(c.name));
    expect(html).toContain('id="report-data"');
    const json = html.split('id="report-data" type="application/json">')[1].split("</script>")[0];
    const parsed = JSON.parse(json.replace(/\\u003c/g, "<")) as HealthReport;
    expect(parsed.issues).toHaveLength(SAMPLE_REPORT.issues.length);
  });

  it("ships the theme toggle and agentic action hooks", () => {
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('data-action="fix-god"');
  });

  it("escapes a malicious title so it cannot break out of the document", () => {
    const evil: HealthReport = {
      ...SAMPLE_REPORT,
      meta: { ...SAMPLE_REPORT.meta, title: `</script><img src=x onerror=alert(1)>` },
    };
    const out = renderReportHTML(evil);
    expect(out).not.toContain("<img src=x onerror=alert(1)>");
    expect(out).not.toContain("</script><img");
  });
});
