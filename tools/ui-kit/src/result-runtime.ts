// ============================================================================
// CLIENT RUNTIME for the RESULT view. Dependency-free browser JS.
// Theme toggle, change-diff drawer, next-step actions (host postMessage /
// browser clipboard fallback), markdown export. Mirrors the health runtime's
// DataAdapter behaviour.
// ============================================================================

export const RESULT_RUNTIME = String.raw`(function(){
  "use strict";
  function readEmbedded(){ var el=document.getElementById('report-data'); if(!el) return null;
    try{ return JSON.parse(el.textContent||'null'); }catch(e){ return null; } }
  function readUrl(){ try{ var p=new URLSearchParams(location.search).get('data'); if(!p) return null;
    var bytes=Uint8Array.from(atob(p), function(c){ return c.charCodeAt(0); });
    return JSON.parse(new TextDecoder().decode(bytes)); }catch(e){ return null; } }
  var DATA = window.__REPORT__ || readEmbedded() || readUrl();
  if(!DATA){ return; }
  var EMBEDDED=false; try{ EMBEDDED = window.self !== window.top; }catch(e){ EMBEDDED=true; }
  var HOST_ORIGIN = window.__MCP_HOST_ORIGIN__ || '*';
  var root=document.documentElement, lastFocus=null;
  function E(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function $(id){ return document.getElementById(id); }

  // theme
  function store(k,v){ try{ if(v==null) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
  function applyTheme(t){ root.setAttribute('data-theme',t);
    var sun=document.querySelector('.theme-sun'), moon=document.querySelector('.theme-moon');
    if(sun&&moon){ sun.hidden=t!=='dark'; moon.hidden=t==='dark'; } }
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(store('mcp-ui-theme') || (prefersDark?'dark':'light'));
  var tt=$('theme-toggle'); if(tt) tt.addEventListener('click', function(){
    var n=root.getAttribute('data-theme')==='dark'?'light':'dark'; applyTheme(n); store('mcp-ui-theme',n); });

  root.setAttribute('data-band', DATA.status==='partial'?'warn':'good');

  // actions
  var actionsById={}; (DATA.nextActions||[]).forEach(function(a){ actionsById[a.id]=a; });
  function copy(text){ try{ if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(text); }catch(e){}
    try{ var t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }catch(e){} }
  var toastTimer; function toast(msg){ var el=$('toast'); if(!el) return; el.textContent=msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(function(){ el.classList.remove('show'); },2600); }
  function runAction(id){ var a=actionsById[id]; if(!a) return;
    if(a.kind==='link'){ if(!/^https?:\/\//i.test(a.href||'')){ toast('Unsafe link blocked'); return; } window.open(a.href,'_blank','noopener'); return; }
    if(EMBEDDED){ var msg = a.kind==='tool' ? { type:'tool', messageId:'mcp-ui-'+Date.now(), payload:{ toolName:a.tool, params:a.params||{} } } : { type:'prompt', messageId:'mcp-ui-'+Date.now(), payload:{ prompt:a.prompt } };
      try{ window.parent.postMessage(msg,HOST_ORIGIN); toast(a.kind==='tool'?('Running '+a.tool+' …'):'Sent to agent ✓'); return; }catch(e){} }
    var text = a.kind==='tool' ? (a.fallback||('Run '+a.tool)) : (a.prompt||a.fallback||a.label); copy(text); toast('Copied — paste into your agent'); }
  document.addEventListener('click', function(e){ var el=e.target.closest && e.target.closest('[data-action]');
    if(el){ e.preventDefault(); runAction(el.getAttribute('data-action')); } });

  // change diff drawer
  var drawer=$('drawer'), scrim=$('scrim');
  function renderDiff(diff){ return diff.split('\n').map(function(l){
    var c = l.charAt(0)==='+' ? 'dl-add' : l.charAt(0)==='-' ? 'dl-del' : 'dl-ctx'; return '<span class="'+c+'">'+E(l)+'</span>'; }).join('\n'); }
  function openChange(i){ var c=(DATA.changes||[])[i]; if(!c||!c.diff) return; lastFocus=document.activeElement;
    $('d-title').textContent=c.path;
    $('d-body').innerHTML='<div class="kv" style="margin-bottom:14px"><span class="pair"><b>'+E(c.kind)+'</b></span>'+(c.language?'<span class="pair">'+E(c.language)+'</span>':'')+'</div><div class="diff">'+renderDiff(c.diff)+'</div>';
    $('d-acts').innerHTML='';
    drawer.classList.add('open'); scrim.classList.add('open'); var dc=$('d-close'); if(dc) dc.focus(); }
  function closeDrawer(){ drawer.classList.remove('open'); scrim.classList.remove('open'); if(lastFocus&&lastFocus.focus){ lastFocus.focus(); lastFocus=null; } }
  document.addEventListener('click', function(e){ var r=e.target.closest && e.target.closest('.change-row[data-change]'); if(r) openChange(parseInt(r.getAttribute('data-change'),10)); });
  document.addEventListener('keydown', function(e){ if((e.key==='Enter'||e.key===' ')){ var r=e.target.closest && e.target.closest('.change-row[data-change]'); if(r){ e.preventDefault(); openChange(parseInt(r.getAttribute('data-change'),10)); } } });
  if(scrim) scrim.addEventListener('click', closeDrawer);
  var dcl=$('d-close'); if(dcl) dcl.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeDrawer(); });

  // export
  var ex=$('export-btn'); function md(s){ return String(s==null?'':s).replace(/[\r\n]+/g,' '); }
  if(ex) ex.addEventListener('click', function(){ var L=[]; L.push('# '+md(DATA.meta.title)); L.push('');
    L.push('**'+md(DATA.headline)+'** ('+DATA.status+')  '); L.push('**Target:** '+md(DATA.meta.target)); L.push('');
    if((DATA.changes||[]).length){ L.push('## Changes'); (DATA.changes||[]).forEach(function(c){ L.push('- ['+c.kind.toUpperCase()+'] '+md(c.path)+(c.summary?(' — '+md(c.summary)):'')); }); L.push(''); }
    (DATA.sections||[]).forEach(function(s){ L.push('## '+md(s.title)); s.items.forEach(function(it){ L.push('- '+md(it.title)+(it.detail?(' — '+md(it.detail)):'')); }); L.push(''); });
    copy(L.join('\n')); toast('Summary copied as Markdown ✓'); });
})();`;
