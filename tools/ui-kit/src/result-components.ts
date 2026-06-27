// ============================================================================
// SERVER-SIDE BUILDERS for the RESULT view (generative/action tools).
// Reuses the shared chrome (header, drawer, toast) and CSS classes.
// ============================================================================

import { esc } from "./escape.js";
import { buildChrome } from "./components.js";
import { ResultReport, FileChange, ResultSection, statusToBand } from "./types.js";

const SUN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const MOON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const STATUS_LABEL: Record<string, string> = { success: "Success", partial: "Partial", noop: "No changes" };

export function buildResultHeader(report: ResultReport): string {
  return /* html */ `
  <header class="hdr">
    <div class="brand">
      <span class="dot" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </span>
      <div style="min-width:0">
        <h1>${esc(report.meta.title)}</h1>
        <p class="sub">${esc(report.meta.target)}</p>
      </div>
    </div>
    <div class="hdr-actions">
      <button class="btn icon" id="theme-toggle" type="button" aria-label="Toggle colour theme" title="Toggle theme">
        <span class="theme-sun" hidden>${SUN}</span><span class="theme-moon">${MOON}</span>
      </button>
      <button class="btn" id="export-btn" type="button" title="Copy summary as Markdown">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
        Export
      </button>
    </div>
  </header>`;
}

export function buildResultHero(report: ResultReport): string {
  const band = statusToBand(report.status);
  const chips = (report.stats ?? [])
    .map((s) => `<span class="chip"><span>${esc(s.label)}</span><b>${esc(s.value)}</b></span>`)
    .join("");
  return /* html */ `
  <section class="result-hero" data-band="${band}">
    <span class="glyph" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    </span>
    <div class="rh-main">
      <div class="rh-title">${esc(report.headline)}</div>
      ${report.meta.subtitle ? `<div class="rh-sub">${esc(report.meta.subtitle)}</div>` : ""}
      ${chips ? `<div class="chips" style="margin-top:10px">${chips}</div>` : ""}
    </div>
    <span class="status-pill ${band}">${esc(STATUS_LABEL[report.status] ?? report.status)}</span>
  </section>`;
}

export function buildChanges(report: ResultReport): string {
  const changes = report.changes ?? [];
  if (!changes.length) return "";
  const row = (c: FileChange, i: number): string => {
    const delta =
      c.additions != null || c.deletions != null
        ? `<span class="change-delta">${c.additions != null ? `<span class="add">+${esc(c.additions)}</span> ` : ""}${c.deletions != null ? `<span class="del">-${esc(c.deletions)}</span>` : ""}</span>`
        : "";
    const clickable = c.diff ? "clickable" : "";
    return /* html */ `
    <div class="change-row ${clickable}" ${c.diff ? `data-change="${i}" role="button" tabindex="0"` : ""}>
      <span class="kind ${esc(c.kind)}">${esc(c.kind)}</span>
      <span class="change-main">
        <span class="change-path">${esc(c.path)}</span>
        ${c.summary ? `<span class="change-sum">${esc(c.summary)}</span>` : ""}
      </span>
      ${delta}
    </div>`;
  };
  return /* html */ `
  <div class="sec"><h2>Changes</h2><span class="count">${changes.length} file${changes.length === 1 ? "" : "s"}</span></div>
  <div class="changes">${changes.map(row).join("")}</div>`;
}

export function buildSections(report: ResultReport): string {
  const sections = report.sections ?? [];
  if (!sections.length) return "";
  const section = (s: ResultSection): string => {
    const items = s.items
      .map(
        (it) => `
      <div class="section-item">
        <span class="ip ${it.status ? esc(it.status) : ""}"></span>
        <div style="min-width:0"><div class="it">${esc(it.title)}</div>${it.detail ? `<div class="id">${esc(it.detail)}</div>` : ""}</div>
      </div>`
      )
      .join("");
    return /* html */ `
    <div class="sec"><h2>${esc(s.title)}</h2><span class="count">${s.items.length}</span></div>
    <div class="section">${items}</div>`;
  };
  return sections.map(section).join("");
}

export function buildNextSteps(report: ResultReport): string {
  const actions = report.nextActions ?? [];
  if (!actions.length) return "";
  const btns = actions
    .map((a, i) => `<button class="btn${i === 0 ? " primary" : ""}" type="button" data-action="${esc(a.id)}">${esc(a.label)}</button>`)
    .join("");
  return /* html */ `
  <div class="sec"><h2>Next steps</h2></div>
  <div class="next-steps">${btns}</div>`;
}

export { buildChrome };
