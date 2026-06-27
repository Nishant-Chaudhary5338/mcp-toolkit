// ============================================================================
// THEME — dual light (default) + dark, toggled at runtime via [data-theme].
// Grade accent is driven by [data-band="good|warn|bad"] on the root so a
// failing repo still *feels* urgent in either mode.
// Dependency-free: plain CSS custom properties, no Tailwind at runtime.
// ============================================================================

export const STYLES = /* css */ `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0}

:root{
  --font:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;

  /* light (default) */
  --bg:#f7f7f6;
  --surface:#ffffff;
  --surface-2:#fbfbfa;
  --text:#16161a;
  --muted:#6b7280;
  --faint:#9aa0aa;
  --border:#ebe9e4;
  --border-strong:#dedcd5;
  --shadow:0 1px 2px rgba(16,16,20,.04),0 8px 24px -12px rgba(16,16,20,.10);
  --ring:rgba(99,102,241,.45);

  --good:#059669; --good-soft:#ecfdf5;
  --warn:#d97706; --warn-soft:#fffbeb;
  --bad:#e11d48;  --bad-soft:#fff1f2;

  --sev-critical:#e11d48; --sev-high:#ea580c; --sev-medium:#d97706; --sev-low:#64748b;
  --sev-critical-soft:#fff1f2; --sev-high-soft:#fff7ed; --sev-medium-soft:#fffbeb; --sev-low-soft:#f1f5f9;

  --accent:var(--good);
  --accent-soft:var(--good-soft);
  --radius:14px;
  --radius-sm:10px;
}

[data-theme="dark"]{
  --bg:#0a0b0d;
  --surface:#141519;
  --surface-2:#0f1013;
  --text:#f3f4f6;
  --muted:#9aa1ad;
  --faint:#6b7280;
  --border:rgba(255,255,255,.07);
  --border-strong:rgba(255,255,255,.12);
  --shadow:0 1px 2px rgba(0,0,0,.4),0 16px 40px -20px rgba(0,0,0,.7);
  --ring:rgba(129,140,248,.55);

  --good:#34d399; --good-soft:rgba(52,211,153,.12);
  --warn:#fbbf24; --warn-soft:rgba(251,191,36,.12);
  --bad:#fb7185;  --bad-soft:rgba(251,113,133,.12);

  --sev-critical:#fb7185; --sev-high:#fb923c; --sev-medium:#fbbf24; --sev-low:#94a3b8;
  --sev-critical-soft:rgba(251,113,133,.12); --sev-high-soft:rgba(251,146,60,.12);
  --sev-medium-soft:rgba(251,191,36,.12); --sev-low-soft:rgba(148,163,184,.12);
}

[data-band="good"]{--accent:var(--good);--accent-soft:var(--good-soft)}
[data-band="warn"]{--accent:var(--warn);--accent-soft:var(--warn-soft)}
[data-band="bad"]{--accent:var(--bad);--accent-soft:var(--bad-soft)}

body{
  font-family:var(--font);
  background:var(--bg);
  color:var(--text);
  font-size:14px;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
  font-variant-numeric:tabular-nums;
}
.num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}

.wrap{max-width:1040px;margin:0 auto;padding:28px 24px 64px}

/* header */
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}
.brand{display:flex;align-items:center;gap:11px;min-width:0}
.brand .dot{width:30px;height:30px;border-radius:9px;background:var(--accent-soft);color:var(--accent);
  display:grid;place-items:center;flex:none;border:1px solid var(--border)}
.brand h1{font-size:15px;font-weight:650;margin:0;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand .sub{font-size:12px;color:var(--muted);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hdr-actions{display:flex;align-items:center;gap:8px;flex:none}

.btn{appearance:none;font-family:inherit;font-size:12.5px;font-weight:550;color:var(--text);
  background:var(--surface);border:1px solid var(--border-strong);border-radius:9px;padding:7px 11px;
  cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:.16s ease;line-height:1}
.btn:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-1px)}
.btn:active{transform:translateY(0)}
.btn:focus-visible{outline:none;box-shadow:0 0 0 3px var(--ring)}
.btn.icon{padding:7px;width:32px;height:32px;justify-content:center}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
[data-theme="dark"] .btn.primary{color:#0a0b0d}
.btn.primary:hover{filter:brightness(1.05);color:#fff}
[data-theme="dark"] .btn.primary:hover{color:#0a0b0d}

/* hero */
.hero{display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:26px 28px;box-shadow:var(--shadow);margin-bottom:18px}
.gauge{position:relative;width:148px;height:148px;flex:none}
.gauge svg{transform:rotate(-90deg)}
.gauge .track{stroke:var(--border-strong);fill:none}
.gauge .arc{stroke:var(--accent);fill:none;stroke-linecap:round;transition:stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)}
.gauge .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1}
.gauge .score{font-size:42px;font-weight:680;letter-spacing:-.03em;line-height:1}
.gauge .of{font-size:11px;color:var(--faint);margin-top:3px}
.hero-meta{min-width:0}
.grade-row{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}
.grade{font-size:13px;font-weight:650;color:var(--accent);background:var(--accent-soft);
  border:1px solid var(--border);border-radius:7px;padding:3px 9px}
.verdict{font-size:18px;font-weight:620;letter-spacing:-.01em}
.hero p{color:var(--muted);margin:2px 0 14px;font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:7px}
.chip{font-size:12px;color:var(--muted);background:var(--surface-2);border:1px solid var(--border);
  border-radius:999px;padding:4px 10px;display:inline-flex;gap:5px}
.chip b{color:var(--text);font-weight:600}

/* section heading */
.sec{margin:26px 0 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.sec h2{font-size:13px;font-weight:620;letter-spacing:.02em;text-transform:uppercase;color:var(--muted);margin:0}
.sec .count{font-size:12px;color:var(--faint)}

/* category cards */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:15px 16px;
  box-shadow:var(--shadow);transition:.16s ease;display:flex;flex-direction:column}
.card:hover{border-color:var(--border-strong);transform:translateY(-2px)}
.card .top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
.card .name{font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card .badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;flex:none}
.badge.good{color:var(--good);background:var(--good-soft)}
.badge.warn{color:var(--warn);background:var(--warn-soft)}
.badge.bad{color:var(--bad);background:var(--bad-soft)}
.card .sum{color:var(--muted);font-size:12.5px;line-height:1.45;min-height:3.9em;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.bar{height:5px;border-radius:999px;background:var(--border-strong);overflow:hidden;margin-top:11px}
.bar > i{display:block;height:100%;border-radius:999px;transition:width 1s cubic-bezier(.22,1,.36,1)}
.bar > i.good{background:var(--good)} .bar > i.warn{background:var(--warn)} .bar > i.bad{background:var(--bad)}
.card .foot{display:flex;justify-content:space-between;align-items:center;margin-top:9px;font-size:11.5px;color:var(--faint)}

/* toolbar */
.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.search{flex:1;min-width:180px;position:relative}
.search input{width:100%;font-family:inherit;font-size:13px;color:var(--text);background:var(--surface);
  border:1px solid var(--border-strong);border-radius:9px;padding:8px 11px 8px 32px}
.search input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--ring)}
.search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--faint)}
.filter{display:flex;gap:4px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:3px}
.filter button{appearance:none;font-family:inherit;font-size:12px;font-weight:550;color:var(--muted);
  background:transparent;border:0;border-radius:6px;padding:5px 10px;cursor:pointer;transition:.14s}
.filter button[aria-pressed="true"]{background:var(--surface);color:var(--text);box-shadow:var(--shadow)}
.filter button:hover{color:var(--text)}

/* table */
.table-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  box-shadow:var(--shadow);overflow:hidden}
table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
thead th:nth-child(1),tbody td:nth-child(1){width:96px}
thead th:nth-child(3),tbody td:nth-child(3){width:120px}
thead th:nth-child(4),tbody td:nth-child(4){width:160px}
thead th{text-align:left;font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;
  color:var(--faint);padding:11px 16px;border-bottom:1px solid var(--border);cursor:pointer;user-select:none;white-space:nowrap}
thead th .arr{opacity:.4;font-size:9px;margin-left:3px}
thead th[aria-sort] .arr{opacity:1;color:var(--accent)}
tbody tr{border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s}
tbody tr:last-child{border-bottom:0}
tbody tr:hover{background:var(--surface-2)}
tbody td{padding:11px 16px;vertical-align:top}
.sev{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:12px;white-space:nowrap}
.sev .pip{width:7px;height:7px;border-radius:999px;flex:none}
.sev.critical{color:var(--sev-critical)} .sev.critical .pip{background:var(--sev-critical)}
.sev.high{color:var(--sev-high)} .sev.high .pip{background:var(--sev-high)}
.sev.medium{color:var(--sev-medium)} .sev.medium .pip{background:var(--sev-medium)}
.sev.low{color:var(--sev-low)} .sev.low .pip{background:var(--sev-low)}
.cell-title{font-weight:550;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.cell-file{font-family:var(--mono);font-size:11.5px;color:var(--muted);overflow-wrap:anywhere;word-break:normal;max-width:200px}
.tag{font-size:11px;color:var(--muted);background:var(--surface-2);border:1px solid var(--border);
  border-radius:6px;padding:2px 7px;white-space:nowrap}
.empty{padding:40px 16px;text-align:center;color:var(--muted)}
.empty .big{font-size:15px;color:var(--text);font-weight:600;margin-bottom:4px}

/* drawer */
.scrim{position:fixed;inset:0;background:rgba(10,11,13,.42);opacity:0;pointer-events:none;transition:.2s;z-index:40}
.scrim.open{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;height:100%;width:min(440px,92vw);background:var(--surface);
  border-left:1px solid var(--border);box-shadow:-24px 0 60px -30px rgba(0,0,0,.5);
  transform:translateX(100%);transition:transform .26s cubic-bezier(.22,1,.36,1);z-index:50;
  display:flex;flex-direction:column}
.drawer.open{transform:translateX(0)}
.drawer header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
  padding:20px 22px 16px;border-bottom:1px solid var(--border)}
.drawer header h3{margin:0;font-size:16px;font-weight:640;letter-spacing:-.01em;line-height:1.35}
.drawer .body{padding:18px 22px;overflow-y:auto;flex:1}
.drawer .field{margin-bottom:16px}
.drawer .field .k{font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--faint);margin-bottom:5px}
.drawer .field .v{font-size:13.5px;color:var(--text)}
.drawer .field .v.mono{font-family:var(--mono);font-size:12px;color:var(--muted);word-break:break-all}
.drawer .acts{padding:16px 22px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px}
.kv{display:flex;gap:8px;flex-wrap:wrap}
.kv .pair{font-size:12px;color:var(--muted);background:var(--surface-2);border:1px solid var(--border);border-radius:7px;padding:4px 9px}
.kv .pair b{color:var(--text);font-weight:600}

/* fix-first */
.queue{display:flex;flex-direction:column;gap:8px}
.qitem{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:11px 14px;box-shadow:var(--shadow);cursor:pointer;transition:.14s}
.qitem:hover{border-color:var(--accent);transform:translateX(2px)}
.qitem .rank{width:22px;height:22px;border-radius:7px;background:var(--accent-soft);color:var(--accent);
  font-size:12px;font-weight:680;display:grid;place-items:center;flex:none}
.qitem .qt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.qitem .qt .t{display:block;font-weight:550;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qitem .qt .s{display:block;font-size:11.5px;color:var(--faint)}

/* toast */
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(20px);opacity:0;
  background:var(--text);color:var(--bg);font-size:13px;font-weight:550;padding:10px 16px;border-radius:10px;
  box-shadow:var(--shadow);transition:.22s;z-index:60;pointer-events:none;max-width:90vw}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

.foot-note{margin-top:34px;text-align:center;font-size:11.5px;color:var(--faint)}
.foot-note a{color:var(--muted)}

@media (max-width:560px){
  .hero{grid-template-columns:1fr;justify-items:center;text-align:center}
  .hero-meta{text-align:center}.chips{justify-content:center}.grade-row{justify-content:center}
}
/* result view */
.result-hero{display:flex;align-items:center;gap:18px;flex-wrap:wrap;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:22px 26px;box-shadow:var(--shadow);margin-bottom:18px}
.result-hero .glyph{width:52px;height:52px;border-radius:14px;background:var(--accent-soft);color:var(--accent);
  display:grid;place-items:center;flex:none;border:1px solid var(--border)}
.result-hero .rh-main{min-width:0;flex:1}
.result-hero .rh-title{font-size:20px;font-weight:660;letter-spacing:-.02em;line-height:1.2}
.result-hero .rh-sub{color:var(--muted);font-size:13px;margin-top:3px}
.status-pill{font-size:12px;font-weight:650;padding:4px 10px;border-radius:999px;white-space:nowrap}
.status-pill.good{color:var(--good);background:var(--good-soft)}
.status-pill.warn{color:var(--warn);background:var(--warn-soft)}
.status-pill.bad{color:var(--bad);background:var(--bad-soft)}
.result-hero .chips{margin-top:0}

.changes{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
.change-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);transition:background .12s}
.change-row:last-child{border-bottom:0}
.change-row.clickable{cursor:pointer}
.change-row.clickable:hover{background:var(--surface-2)}
.kind{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:6px;flex:none;width:74px;text-align:center}
.kind.created{color:var(--good);background:var(--good-soft)}
.kind.modified{color:var(--warn);background:var(--warn-soft)}
.kind.deleted{color:var(--bad);background:var(--bad-soft)}
.kind.renamed{color:var(--sev-low);background:var(--sev-low-soft)}
.change-main{flex:1;min-width:0}
.change-path{font-family:var(--mono);font-size:12.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.change-sum{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.change-delta{font-family:var(--mono);font-size:11.5px;flex:none;white-space:nowrap}
.change-delta .add{color:var(--good)} .change-delta .del{color:var(--bad)}

.section{margin-top:10px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
.section-item{display:flex;align-items:flex-start;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)}
.section-item:last-child{border-bottom:0}
.section-item .ip{width:7px;height:7px;border-radius:999px;margin-top:6px;flex:none;background:var(--faint)}
.section-item .ip.ok{background:var(--good)} .section-item .ip.warn{background:var(--warn)} .section-item .ip.error{background:var(--bad)}
.section-item .it{font-size:13px;font-weight:550}
.section-item .id{font-size:12px;color:var(--muted)}
.next-steps{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.diff{font-family:var(--mono);font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word;
  background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px}
.diff .dl-add{color:var(--good)} .diff .dl-del{color:var(--bad)} .diff .dl-ctx{color:var(--muted)}

@media (prefers-reduced-motion:reduce){
  *{transition:none!important;animation:none!important}
}
`;
