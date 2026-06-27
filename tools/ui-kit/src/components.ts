// ============================================================================
// SERVER-SIDE COMPONENT BUILDERS — pure string -> HTML. No framework.
// The hero, category cards and fix-first queue are rendered statically for an
// instant premium paint; the interactive triage table + drawer are hydrated
// client-side by runtime.ts from the injected report data.
// ============================================================================

import { esc } from "./escape.js";
import {
  HealthReport,
  ReportCategory,
  ReportAction,
  scoreToBand,
  scoreToGrade,
} from "./types.js";

const SUN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const MOON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const SEARCH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;

function verdict(score: number): string {
  if (score >= 85) return "Healthy & well-structured";
  if (score >= 70) return "Solid, with a few rough edges";
  if (score >= 55) return "Workable, but carrying debt";
  if (score >= 40) return "Significant tech debt";
  return "High-risk — needs intervention";
}

export function buildHeader(report: HealthReport): string {
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
      <button class="btn" id="export-btn" type="button" title="Copy report as Markdown">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
        Export
      </button>
    </div>
  </header>`;
}

function gauge(score: number): string {
  const r = 64;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = circ * (1 - pct);
  return /* html */ `
  <div class="gauge" role="img" aria-label="Health score ${esc(score)} out of 100">
    <svg width="148" height="148" viewBox="0 0 148 148">
      <circle class="track" cx="74" cy="74" r="${r}" stroke-width="11"/>
      <circle class="arc" cx="74" cy="74" r="${r}" stroke-width="11"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${circ.toFixed(1)}"
        data-target="${offset.toFixed(1)}"/>
    </svg>
    <div class="center">
      <div class="score num" data-count="${esc(score)}">0</div>
      <div class="of">/ 100</div>
    </div>
  </div>`;
}

export function buildHero(report: HealthReport): string {
  const band = scoreToBand(report.score);
  const grade = scoreToGrade(report.score);
  const chips = (report.chips ?? [])
    .map((c) => `<span class="chip"><span>${esc(c.label)}</span><b>${esc(c.value)}</b></span>`)
    .join("");
  return /* html */ `
  <section class="hero" data-band="${band}">
    ${gauge(report.score)}
    <div class="hero-meta">
      <div class="grade-row">
        <span class="grade">Grade ${esc(grade)}</span>
        <span class="verdict">${esc(verdict(report.score))}</span>
      </div>
      <p>${esc(report.totalIssues)} issue${report.totalIssues === 1 ? "" : "s"} found across ${esc(report.categories.length)} areas${report.meta.subtitle ? " · " + esc(report.meta.subtitle) : ""}.</p>
      <div class="chips">${chips}</div>
    </div>
  </section>`;
}

function actionButtons(actions: ReportAction[] | undefined, primaryFirst = false): string {
  if (!actions || !actions.length) return "";
  return actions
    .map((a, i) => {
      const cls = primaryFirst && i === 0 ? "btn primary" : "btn";
      return `<button class="${cls}" type="button" data-action="${esc(a.id)}">${esc(a.label)}</button>`;
    })
    .join("");
}

export function buildFixFirst(report: HealthReport): string {
  const actions = report.topActions ?? [];
  if (!actions.length) return "";
  const items = actions
    .map((a, i) => {
      const sub = a.kind === "tool" ? `Runs ${esc(a.tool)}` : a.kind === "prompt" ? "Asks the agent" : "Opens link";
      return /* html */ `
      <div class="qitem" data-action="${esc(a.id)}" role="button" tabindex="0">
        <span class="rank num">${i + 1}</span>
        <span class="qt"><span class="t">${esc(a.label)}</span><span class="s">${sub}</span></span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--faint)"><path d="m9 18 6-6-6-6"/></svg>
      </div>`;
    })
    .join("");
  return /* html */ `
  <div class="sec"><h2>Fix-first queue</h2><span class="count">${actions.length} prioritised</span></div>
  <div class="queue">${items}</div>`;
}

export function buildCategories(report: HealthReport): string {
  const card = (c: ReportCategory): string => {
    const hasScore = typeof c.score === "number";
    const pct = hasScore ? Math.max(0, Math.min(100, c.score as number)) : 0;
    return /* html */ `
    <div class="card" data-category="${esc(c.id)}" role="button" tabindex="0" aria-label="Filter issues by ${esc(c.name)}">
      <div class="top">
        <span class="name">${esc(c.name)}</span>
        <span class="badge ${esc(c.status)}">${hasScore ? esc(pct) : esc(c.status)}</span>
      </div>
      <div class="sum">${esc(c.summary)}</div>
      ${hasScore ? `<div class="bar"><i class="${esc(c.status)}" data-w="${pct}" style="width:0"></i></div>` : ""}
      <div class="foot"><span>${esc(c.issueCount)} issue${c.issueCount === 1 ? "" : "s"}</span><span>View →</span></div>
    </div>`;
  };
  return /* html */ `
  <div class="sec"><h2>Areas</h2><span class="count">${report.categories.length} analysed</span></div>
  <div class="cards">${report.categories.map(card).join("")}</div>`;
}

export function buildTriageShell(report: HealthReport): string {
  const sevFilters = ["all", "critical", "high", "medium", "low"]
    .map(
      (s, i) =>
        `<button type="button" data-sev="${s}" aria-pressed="${i === 0 ? "true" : "false"}">${s[0].toUpperCase() + s.slice(1)}</button>`
    )
    .join("");
  return /* html */ `
  <div class="sec"><h2>Issues</h2><span class="count" id="issue-count">${report.issues.length} total</span></div>
  <div class="toolbar">
    <label class="search">
      ${SEARCH}
      <input id="search" type="search" placeholder="Search issues, files, categories…" aria-label="Search issues"/>
    </label>
    <div class="filter" role="group" aria-label="Filter by severity">${sevFilters}</div>
  </div>
  <div class="table-card">
    <table>
      <thead><tr>
        <th data-sort="severity" aria-sort="descending">Severity<span class="arr">▼</span></th>
        <th data-sort="title">Issue<span class="arr">▼</span></th>
        <th data-sort="category">Area<span class="arr">▼</span></th>
        <th data-sort="file">File<span class="arr">▼</span></th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <div class="empty" id="empty" hidden>
      <div class="big">Nothing matches</div>
      <div>Try clearing the search or severity filter.</div>
    </div>
  </div>`;
}

export function buildChrome(): string {
  return /* html */ `
  <div class="scrim" id="scrim"></div>
  <aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="d-title">
    <header>
      <h3 id="d-title"></h3>
      <button class="btn icon" id="d-close" type="button" aria-label="Close detail">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </header>
    <div class="body" id="d-body"></div>
    <div class="acts" id="d-acts"></div>
  </aside>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
}

export { actionButtons };
