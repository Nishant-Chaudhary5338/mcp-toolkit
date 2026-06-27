// ============================================================================
// CLIENT RUNTIME — plain browser JS emitted as a string into the single-file
// HTML. No build step, no framework. Handles: theme, gauge/counter animation,
// triage table (sort/filter/search), drawer, agentic actions and export.
//
// DataAdapter: detects surface at runtime.
//   • Embedded in an iframe (MCP host)  -> postMessage MCP-UI actions to parent.
//   • Standalone browser tab            -> graceful fallback (copy prompt).
// ============================================================================

export const RUNTIME = String.raw`(function(){
  "use strict";
  function readEmbedded(){
    var el=document.getElementById('report-data');
    if(!el) return null; try{ return JSON.parse(el.textContent||'null'); }catch(e){ return null; }
  }
  function readUrl(){
    try{ var p=new URLSearchParams(location.search).get('data'); if(!p) return null;
      var bytes=Uint8Array.from(atob(p), function(c){ return c.charCodeAt(0); });
      return JSON.parse(new TextDecoder().decode(bytes)); }catch(e){ return null; }
  }
  var DATA = window.__REPORT__ || readEmbedded() || readUrl();
  if(!DATA){ return; }
  var EMBEDDED = false; try{ EMBEDDED = window.self !== window.top; }catch(e){ EMBEDDED = true; }
  var HOST_ORIGIN = window.__MCP_HOST_ORIGIN__ || '*'; // host may inject its origin to harden postMessage
  var lastFocus = null;
  var root = document.documentElement;
  var SEV_RANK = { critical:4, high:3, medium:2, low:1 };

  function E(s){ return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function $(id){ return document.getElementById(id); }

  // ---------- theme ----------
  function store(k,v){ try{ if(v==null) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
  function applyTheme(t){
    root.setAttribute('data-theme', t);
    var sun=document.querySelector('.theme-sun'), moon=document.querySelector('.theme-moon');
    if(sun&&moon){ sun.hidden = t!=='dark'; moon.hidden = t==='dark'; }
  }
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(store('mcp-ui-theme') || (prefersDark?'dark':'light'));
  var tt=$('theme-toggle');
  if(tt) tt.addEventListener('click', function(){
    var next = root.getAttribute('data-theme')==='dark'?'light':'dark';
    applyTheme(next); store('mcp-ui-theme', next);
  });

  // ---------- band + intro animation ----------
  root.setAttribute('data-band', DATA.score>=70?'good':(DATA.score>=45?'warn':'bad'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(function(){
    var arc=document.querySelector('.gauge .arc');
    if(arc) arc.style.strokeDashoffset = arc.getAttribute('data-target');
    Array.prototype.forEach.call(document.querySelectorAll('.bar > i'), function(i){ i.style.width=i.getAttribute('data-w')+'%'; });
    var el=document.querySelector('.score'); if(!el) return;
    var target=parseInt(el.getAttribute('data-count'),10)||0;
    if(reduce){ el.textContent=target; return; }
    var start=null;
    requestAnimationFrame(function step(ts){ if(!start)start=ts; var p=Math.min(1,(ts-start)/1000);
      el.textContent=Math.round((1-Math.pow(1-p,3))*target); if(p<1) requestAnimationFrame(step); });
  });

  // ---------- actions (DataAdapter) ----------
  var actionsById={};
  (DATA.topActions||[]).forEach(function(a){ actionsById[a.id]=a; });
  (DATA.issues||[]).forEach(function(it){ (it.actions||[]).forEach(function(a){ actionsById[a.id]=a; }); });
  function copy(text){
    try{ if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(text); }catch(e){}
    try{ var t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select();
      document.execCommand('copy'); document.body.removeChild(t); }catch(e){}
  }
  var toastTimer;
  function toast(msg){
    var el=$('toast'); if(!el) return; el.textContent=msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(function(){ el.classList.remove('show'); }, 2600);
  }
  function runAction(id){
    var a=actionsById[id]; if(!a) return;
    if(a.kind==='link'){
      if(!/^https?:\/\//i.test(a.href||'')){ toast('Unsafe link blocked'); return; }
      window.open(a.href,'_blank','noopener'); return;
    }
    if(EMBEDDED){
      var msg = a.kind==='tool'
        ? { type:'tool', messageId:'mcp-ui-'+Date.now(), payload:{ toolName:a.tool, params:a.params||{} } }
        : { type:'prompt', messageId:'mcp-ui-'+Date.now(), payload:{ prompt:a.prompt } };
      try{ window.parent.postMessage(msg,HOST_ORIGIN); toast(a.kind==='tool'?('Running '+a.tool+' …'):'Sent to agent ✓'); return; }catch(e){}
    }
    var text = a.kind==='tool' ? (a.fallback||('Run '+a.tool)) : (a.prompt||a.fallback||a.label);
    copy(text); toast('Copied — paste into your agent');
  }
  document.addEventListener('click', function(e){
    var el=e.target.closest && e.target.closest('[data-action]');
    if(el){ e.preventDefault(); runAction(el.getAttribute('data-action')); }
  });
  document.addEventListener('keydown', function(e){
    if((e.key==='Enter'||e.key===' ')){ var el=e.target.closest && e.target.closest('.qitem[data-action]');
      if(el){ e.preventDefault(); runAction(el.getAttribute('data-action')); } }
  });

  // ---------- triage table ----------
  var state={ sev:'all', q:'', cat:null, key:'severity', dir:'desc' };
  var rowsEl=$('rows'), emptyEl=$('empty'), countEl=$('issue-count');
  function passes(it){
    if(state.sev!=='all' && it.severity!==state.sev) return false;
    if(state.cat && it.category!==state.cat) return false;
    if(state.q){ var q=state.q.toLowerCase();
      var hay=(it.title+' '+(it.file||'')+' '+(it.category||'')+' '+(it.description||'')).toLowerCase();
      if(hay.indexOf(q)<0) return false; }
    return true;
  }
  function cmp(a,b){
    var k=state.key, av, bv;
    if(k==='severity'){ av=SEV_RANK[a.severity]||0; bv=SEV_RANK[b.severity]||0; }
    else { av=(a[k]||'').toString().toLowerCase(); bv=(b[k]||'').toString().toLowerCase(); }
    if(av<bv) return state.dir==='asc'?-1:1;
    if(av>bv) return state.dir==='asc'?1:-1;
    return 0;
  }
  function catName(id){ var c=(DATA.categories||[]).filter(function(x){return x.id===id;})[0]; return c?c.name:id; }
  function render(){
    var list=(DATA.issues||[]).filter(passes).slice().sort(cmp);
    rowsEl.innerHTML = list.map(function(it){
      return '<tr data-id="'+E(it.id)+'" tabindex="0" role="button" aria-label="Open issue: '+E(it.title)+'">'+
        '<td><span class="sev '+E(it.severity)+'"><span class="pip"></span>'+E(it.severity)+'</span></td>'+
        '<td class="cell-title">'+E(it.title)+'</td>'+
        '<td><span class="tag">'+E(catName(it.category))+'</span></td>'+
        '<td class="cell-file">'+E(it.file||'—')+'</td></tr>';
    }).join('');
    emptyEl.hidden = list.length>0;
    if(countEl) countEl.textContent = list.length+(state.cat?(' in '+catName(state.cat)):(' of '+(DATA.issues||[]).length));
  }
  if(rowsEl){
    rowsEl.addEventListener('click', function(e){
      var tr=e.target.closest('tr[data-id]'); if(tr) openDrawer(tr.getAttribute('data-id'));
    });
    rowsEl.addEventListener('keydown', function(e){
      if(e.key==='Enter'||e.key===' '){ var tr=e.target.closest('tr[data-id]');
        if(tr){ e.preventDefault(); openDrawer(tr.getAttribute('data-id')); } }
    });
    Array.prototype.forEach.call(document.querySelectorAll('.filter button'), function(b){
      b.addEventListener('click', function(){
        state.sev=b.getAttribute('data-sev');
        Array.prototype.forEach.call(document.querySelectorAll('.filter button'), function(x){
          x.setAttribute('aria-pressed', x===b?'true':'false'); });
        render();
      });
    });
    var search=$('search');
    if(search) search.addEventListener('input', function(){ state.q=search.value; render(); });
    Array.prototype.forEach.call(document.querySelectorAll('thead th[data-sort]'), function(th){
      th.addEventListener('click', function(){
        var k=th.getAttribute('data-sort');
        if(state.key===k){ state.dir=state.dir==='asc'?'desc':'asc'; } else { state.key=k; state.dir=k==='severity'?'desc':'asc'; }
        Array.prototype.forEach.call(document.querySelectorAll('thead th[data-sort]'), function(x){ x.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', state.dir==='asc'?'ascending':'descending');
        render();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.card[data-category]'), function(card){
      function trigger(){
        var id=card.getAttribute('data-category');
        state.cat = state.cat===id ? null : id;
        Array.prototype.forEach.call(document.querySelectorAll('.card[data-category]'), function(c){
          c.style.borderColor = (c===card && state.cat) ? 'var(--accent)' : ''; });
        render();
        var sec=document.querySelector('.table-card'); if(sec&&state.cat) sec.scrollIntoView({behavior:reduce?'auto':'smooth', block:'start'});
      }
      card.addEventListener('click', trigger);
      card.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); trigger(); } });
    });
    render();
  }

  // ---------- drawer ----------
  var drawer=$('drawer'), scrim=$('scrim');
  function field(k,v,mono){ return '<div class="field"><div class="k">'+E(k)+'</div><div class="v'+(mono?' mono':'')+'">'+E(v)+'</div></div>'; }
  function openDrawer(id){
    var it=(DATA.issues||[]).filter(function(x){return x.id===id;})[0]; if(!it) return;
    lastFocus=document.activeElement;
    $('d-title').textContent=it.title;
    var body='';
    body+='<div class="kv" style="margin-bottom:16px">'+
      '<span class="pair"><b style="color:var(--sev-'+E(it.severity)+')">'+E(it.severity)+'</b></span>'+
      '<span class="pair">'+E(catName(it.category))+'</span></div>';
    if(it.description) body+=field('What it means', it.description);
    if(it.file) body+=field('File', it.file, true);
    (it.meta||[]).forEach(function(m){ body+=field(m.label, m.value); });
    $('d-body').innerHTML=body;
    $('d-acts').innerHTML=(it.actions||[]).map(function(a,i){
      return '<button class="btn'+(i===0?' primary':'')+'" type="button" data-action="'+E(a.id)+'">'+E(a.label)+'</button>';
    }).join('') || '<span style="color:var(--faint);font-size:12px">No automated fix available</span>';
    drawer.classList.add('open'); scrim.classList.add('open');
    var dcEl=$('d-close'); if(dcEl) dcEl.focus();
  }
  function closeDrawer(){
    drawer.classList.remove('open'); scrim.classList.remove('open');
    if(lastFocus&&lastFocus.focus){ lastFocus.focus(); lastFocus=null; }
  }
  if(scrim) scrim.addEventListener('click', closeDrawer);
  var dc=$('d-close'); if(dc) dc.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeDrawer(); });

  // ---------- export ----------
  var ex=$('export-btn');
  function md(s){ return String(s==null?'':s).replace(/[\r\n]+/g,' '); }
  if(ex) ex.addEventListener('click', function(){
    var L=[]; L.push('# '+md(DATA.meta.title)); L.push('');
    L.push('**Target:** '+md(DATA.meta.target)+'  ');
    L.push('**Health score:** '+DATA.score+'/100  ');
    L.push('**Issues:** '+DATA.totalIssues); L.push('');
    L.push('## Areas');
    (DATA.categories||[]).forEach(function(c){ L.push('- **'+md(c.name)+'** ('+c.status+(typeof c.score==='number'?', '+c.score:'')+') — '+md(c.summary)); });
    L.push(''); L.push('## Issues');
    (DATA.issues||[]).slice().sort(function(a,b){return (SEV_RANK[b.severity]||0)-(SEV_RANK[a.severity]||0);}).forEach(function(it){
      L.push('- ['+it.severity.toUpperCase()+'] '+md(it.title)+(it.file?(' — '+md(it.file)):'')); });
    copy(L.join('\n')); toast('Report copied as Markdown ✓');
  });
})();`;
