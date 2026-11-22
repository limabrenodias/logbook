/* Keyboard shortcuts and the Ctrl/Cmd+K command box. */
"use strict";
const Keys=(()=>{
  const typing=el=>el&&(/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)||el.isContentEditable);
  const go=r=>{location.hash="#"+r};
  const LIST=[["N","Add a log"],["F","Focus"],["/","Search logs"],["1 – 7","Insights · Home · Focus · Friends · Stats · Logs · Setup"],
    ["Ctrl/⌘ K","Command box — type what you want to do"],["Ctrl/⌘ Z","Undo the last change"],["Space","Start / pause the Focus timer (on Focus)"],["Esc","Close"],["?","This list"]];
  function help(){
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:8px"><h2 style="font-size:19px">Keyboard shortcuts</h2><span class="spacer"></span><button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button></div>
      <div class="kb">${LIST.map(([k,d])=>`<div><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join("")}</div>`;
    $("#scrim").classList.add("open");
  }
  function commands(){
    const out=[];
    ROUTES.forEach(([k,l],i)=>out.push({t:"Go to "+l,k:String(i+1),run:()=>go(k)}));
    if(!readOnly()){
      out.push({t:"Add a log",k:"N",run:()=>openModal(null)});
      out.push({t:"Start a Focus session",run:()=>go("focus")});
      for(const q of Quick.list())out.push({t:`Quick log: ${q.a||q.t} · ${q.s} · ${q.m} min`,run:()=>Quick.log(q.id)});
      out.push({t:"New goal",run:()=>{go("home");setTimeout(()=>Goals.editor(null),60)}});
      out.push({t:"Manage quick logs",run:()=>Quick.sheet()});
      out.push({t:"Download a full backup",run:()=>Backup.run("all")});
      out.push({t:"Select logs to edit together",run:()=>{ui.sel=new Set();go("logs");render()}});
    }
    THEMES.forEach(([k,n])=>out.push({t:"Theme: "+n,run:()=>setTheme(k)}));
    out.push({t:"Keyboard shortcuts",k:"?",run:help});
    return out;
  }
  let sel=0,items=[];
  function palette(){
    $("#modal").innerHTML=`<input type="text" id="cmdQ" placeholder="Type a command or search your logs…" autocomplete="off" aria-label="Command">
      <div class="cmd" id="cmdList" role="listbox"></div><p class="muted" style="font-size:12px;margin:8px 0 0">↑ ↓ to move · Enter to run · Esc to close</p>`;
    $("#scrim").classList.add("open");const q=$("#cmdQ");q.focus();fill("");
    q.addEventListener("input",()=>fill(q.value));
    q.addEventListener("keydown",e=>{
      if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();sel=(sel+(e.key==="ArrowDown"?1:-1)+items.length)%Math.max(1,items.length);draw()}
      else if(e.key==="Enter"){e.preventDefault();exec(sel)}});
  }
  function fill(q){
    q=q.trim().toLowerCase();const words=q.split(/\s+/).filter(Boolean);
    items=commands().filter(c=>words.every(w=>c.t.toLowerCase().includes(w)));
    if(q)items.push({t:`Search logs for “${q}”`,run:()=>{ui.logQ=q;ui.logLimit=150;go("logs");render()}});
    sel=0;draw();
  }
  function draw(){
    const L=$("#cmdList");if(!L)return;
    L.innerHTML=items.slice(0,40).map((c,i)=>`<button class="${i===sel?"on":""}" role="option" aria-selected="${i===sel}" data-cmd="${i}"><span>${esc(c.t)}</span>${c.k?`<kbd>${esc(c.k)}</kbd>`:""}</button>`).join("")||'<p class="muted">Nothing matches.</p>';
    const on=L.querySelector(".on");if(on)on.scrollIntoView({block:"nearest"});
  }
  function exec(i){const c=items[i];if(!c)return;closeModal();c.run()}
  document.addEventListener("click",e=>{const b=e.target.closest("[data-cmd]");if(b)exec(+b.dataset.cmd)});
  document.addEventListener("keydown",e=>{
    if(phase!=="app")return;const mod=e.ctrlKey||e.metaKey;
    if(mod&&e.key.toLowerCase()==="k"){e.preventDefault();if($("#cmdQ"))closeModal();else palette();return}
    if(mod&&!e.shiftKey&&e.key.toLowerCase()==="z"&&!typing(e.target)){if(runUndo()){e.preventDefault();toast("Undone")}return}
    if(mod||e.altKey||typing(e.target)||$("#scrim").classList.contains("open"))return;
    const k=e.key;
    if(k==="n"||k==="N"){if(!readOnly()&&route()!=="focus"){e.preventDefault();openModal(null)}}
    else if(k==="f"||k==="F"){if(route()!=="focus"){e.preventDefault();go("focus")}}
    else if(k==="/"){e.preventDefault();go("logs");setTimeout(()=>{const i=$("#logQ");if(i)i.focus()},60)}
    else if(k==="?"){e.preventDefault();help()}
    else if(/^[1-7]$/.test(k)&&ROUTES[+k-1]){e.preventDefault();go(ROUTES[+k-1][0])}
  });
  return {help,palette};
})();
