/* Resources (books, podcasts, series, courses…) and exam / practice scores.
   Stored in the resources and scores tables (database update 4); changes go through the
   offline outbox like logs, and a copy is kept on the device. */
"use strict";
const Lib=(()=>{
  let res=[],scores=[],ok=null;
  const KINDS={book:["📖","Book"],podcast:["🎧","Podcast"],series:["📺","Series"],course:["🎓","Course"],video:["▶️","YouTube / videos"],app:["📱","App"],other:["✳️","Other"]};
  const UNITS=["pages","chapters","episodes","lessons","videos","units","minutes","%"];
  const missing=e=>e&&(e.code==="42P01"||e.code==="PGRST205"||/does not exist|schema cache/i.test(e.message||""));
  async function load(uid,cached){
    if(cached){res=Net.applyRaw((cached.res||[]).map(x=>({...x})),"resources");scores=Net.applyRaw((cached.scores||[]).map(x=>({...x})),"scores")}
    if(!sb||Net.bootOffline)return;
    const [a,b]=await Promise.all([sb.from("resources").select("*").eq("user_id",uid).order("updated_at",{ascending:false}),
      sb.from("scores").select("*").eq("user_id",uid).order("d",{ascending:false})]);
    if(a.error||b.error){if(missing(a.error||b.error))ok=false;return}
    ok=true;if(uid!==viewing)return;
    res=uid===me?Net.applyRaw(a.data,"resources"):a.data;scores=uid===me?Net.applyRaw(b.data,"scores"):b.data;
    if(uid===me)Cache.save();
  }
  function write(t,op){Net.write({...op,t})}
  /* ---------- resources ---------- */
  const minutesOn=id=>all().logs.reduce((a,l)=>a+(l.r===id?l.m:0),0);
  const lastOn=id=>{const l=all().logs.find(x=>x.r===id);return l?l.d:null};
  function pct(r){return r.total?Math.min(100,r.progress/r.total*100):null}
  function etaText(r){
    const m=minutesOn(r.id);if(!r.total||r.status==="done"||!r.progress||m<30)return "";
    const left=Math.max(0,r.total-r.progress);if(!left)return "";const perH=r.progress/(m/60);
    return perH>0?`≈ ${(left/perH).toFixed(left/perH<10?1:0)} h to finish at your pace`:"";
  }
  function resCard(r){
    const p=pct(r);const m=minutesOn(r.id);const k=KINDS[r.kind]||KINDS.other;const ro=readOnly();const last=lastOn(r.id);
    return `<div class="res st-${r.status}"><div class="res-h"><span class="res-k" aria-hidden="true">${k[0]}</span><div class="res-t"><b>${esc(r.title)}</b><div class="meta">${esc(k[1])}${r.subject?" · "+esc(r.subject):""}${r.status!=="active"?` · <span class="pill pill-${r.status==="done"?"done":"future"}">${r.status==="done"?"Finished":r.status==="paused"?"Paused":"Dropped"}</span>`:""}</div></div>
       ${ro?"":`<button class="ib" data-resedit="${esc(r.id)}" title="Edit">${ICONS.edit}</button>`}</div>
      ${r.total?`<div class="g-bar"><div class="fill" style="width:${p}%"></div></div><div class="res-n"><span class="num"><b>${r.progress}</b> / ${r.total} ${esc(r.unit)}</span><span class="muted">${Math.round(p)}%</span></div>`:`<div class="res-n"><span class="num"><b>${r.progress}</b> ${esc(r.unit)}</span></div>`}
      <div class="res-f"><span class="num">${H(m)} h</span><span class="muted">${last?"last "+esc(relDay(last)):"no time logged yet"}</span>${etaText(r)?`<span class="muted">${etaText(r)}</span>`:""}</div>
      ${ro||r.status==="done"?"":`<div class="res-a"><button class="btn sm" data-reslog="${esc(r.id)}">Log time</button><button class="btn sec sm" data-resplus="${esc(r.id)}" title="Add progress">+ ${r.unit==="%"?"5 %":"1 "+esc(r.unit.replace(/s$/,""))}</button>${r.total&&r.progress<r.total?"":`<button class="btn sec sm" data-resdone="${esc(r.id)}">Finished</button>`}</div>`}
    </div>`;
  }
  function viewRes(){
    if(ok===false)return setupNote();
    const f=ui.resF||"active";const ro=readOnly();
    const L=res.filter(r=>f==="all"||(f==="active"?r.status==="active"||r.status==="paused":r.status===f));
    const done=res.filter(r=>r.status==="done").length;
    return `<div class="row" style="margin-bottom:14px"><div class="seg sm">${[["active","In progress"],["done",`Finished (${done})`],["all","All"]].map(([k,l])=>`<button class="${k===f?"on":""}" data-resf="${k}">${l}</button>`).join("")}</div><span class="spacer"></span>${ro?"":`<button class="btn" data-resnew>+ Resource</button>`}</div>
      ${L.length?`<div class="res-grid">${L.map(resCard).join("")}</div>`:`<div class="card empty-state">${f==="done"?"Nothing finished yet.":`Add the books, podcasts, series and courses you're working through. When you log time, pick the resource and where you're at — progress and hours add up here.`}</div>`}`;
  }
  function resEditor(id,preset){
    const r=res.find(x=>x.id===id)||{title:"",kind:"book",subject:focus(),unit:"pages",total:"",progress:0,status:"active",url:"",notes:"",...(preset||{})};
    const subs=subjects();const list=[...subs,...LANGS.filter(x=>!subs.includes(x))];
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">${id?"Edit resource":"New resource"}</h2><span class="spacer"></span><button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button></div>
     <div class="field"><label for="rT">Title</label><input type="text" id="rT" maxlength="120" value="${esc(r.title)}" placeholder="e.g. L'Étranger, InnerFrench, Lupin"></div>
     <div class="two"><div class="field"><label for="rK">Kind</label><select id="rK">${Object.entries(KINDS).map(([k,[e,l]])=>`<option value="${k}" ${k===r.kind?"selected":""}>${e} ${l}</option>`).join("")}</select></div>
      <div class="field"><label for="rS">Subject</label><select id="rS">${list.map(x=>`<option ${x===r.subject?"selected":""}>${esc(x)}</option>`).join("")}</select></div></div>
     <div class="two"><div class="field"><label for="rP">Where you are</label><input type="number" id="rP" min="0" max="100000" value="${r.progress}" inputmode="numeric"></div>
      <div class="field"><label for="rN">Out of <span class="muted" style="font-weight:400">— optional</span></label><div class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" id="rN" min="1" max="100000" value="${r.total??""}" inputmode="numeric" style="min-width:0;flex:1"><select id="rU" aria-label="Unit">${UNITS.map(u=>`<option ${u===r.unit?"selected":""}>${u}</option>`).join("")}</select></div></div></div>
     <div class="two"><div class="field"><label for="rSt">Status</label><select id="rSt">${[["active","In progress"],["paused","Paused"],["done","Finished"],["dropped","Dropped"]].map(([k,l])=>`<option value="${k}" ${k===r.status?"selected":""}>${l}</option>`).join("")}</select></div>
      <div class="field"><label for="rL">Link <span class="muted" style="font-weight:400">— optional</span></label><input type="text" id="rL" maxlength="500" value="${esc(r.url||"")}" placeholder="https://…"></div></div>
     <div class="field"><label for="rNo">Notes <span class="muted" style="font-weight:400">— optional</span></label><input type="text" id="rNo" maxlength="1000" value="${esc(r.notes||"")}"></div>
     <div class="row" style="justify-content:flex-end;margin-top:8px">${id?`<button class="btn danger" data-resdel="${esc(id)}" style="margin-right:auto">Delete</button>`:""}<button class="btn sec" data-act="close">Cancel</button><button class="btn" data-ressave="${esc(id||"")}">Save</button></div>`;
    $("#scrim").classList.add("open");setTimeout(()=>{const t=$("#rT");if(t&&!id)t.focus()},50);
  }
  function resSave(id){
    const title=$("#rT").value.trim();if(!title)return toast("Give it a title");
    const total=parseInt($("#rN").value,10)||null,progress=Math.max(0,parseInt($("#rP").value,10)||0),status=$("#rSt").value;
    const row={title:title.slice(0,120),kind:$("#rK").value,subject:$("#rS").value,unit:$("#rU").value,total,progress:total?Math.min(progress,total):progress,status,
      url:$("#rL").value.trim().slice(0,500)||null,notes:$("#rNo").value.trim().slice(0,1000)||null,updated_at:new Date().toISOString(),finished_at:status==="done"?today():null};
    closeModal();
    if(id){const r=res.find(x=>x.id===id);const prev={...r};Object.assign(r,row);write("resources",{op:"update",ids:[id],patch:row});render();
      actionToast("Resource updated","Undo",()=>{const x=res.find(y=>y.id===id);const p={...prev};delete p.id;delete p.user_id;delete p.created_at;Object.assign(x,prev);write("resources",{op:"update",ids:[id],patch:p});render()})}
    else{const r={id:newId(),...row,created_at:new Date().toISOString()};res.unshift(r);write("resources",{op:"insert",rows:[r]});render();toast("Added "+title)}
    return true;
  }
  function resPatch(id,patch,msg){
    const r=res.find(x=>x.id===id);if(!r)return;const prev={};for(const k in patch)prev[k]=r[k];
    patch={...patch,updated_at:new Date().toISOString()};Object.assign(r,patch);write("resources",{op:"update",ids:[id],patch});render();
    if(msg)actionToast(msg,"Undo",()=>{Object.assign(r,prev);write("resources",{op:"update",ids:[id],patch:prev});render()});
  }
  function resDelete(id){
    const r=res.find(x=>x.id===id);if(!r)return;closeModal();res=res.filter(x=>x!==r);
    const linked=logsArr.filter(l=>l.r===id);linked.forEach(l=>l.r=null);invalidate();
    write("resources",{op:"delete",ids:[id]});render();   // the database unlinks its logs by itself (on delete set null)
    actionToast(`Deleted “${r.title}”`,"Undo",()=>{res.unshift(r);write("resources",{op:"insert",rows:[r]});linked.forEach(l=>l.r=id);invalidate();
      if(linked.length)Net.write({op:"update",ids:linked.map(l=>l.i),patch:{resource_id:id}});render()},8000);
  }
  // the log form: pick a resource and say where you are now
  function formField(subject,cur){
    if(ok!==true)return "";
    const L=res.filter(r=>r.status==="active"||r.status==="paused"||r.id===cur);if(!L.length)return `<p class="muted" style="font-size:12.5px;margin:0 0 10px">Tip: add the books and podcasts you're working through under <b>Logs → Resources</b> to track progress.</p>`;
    const mine=L.filter(r=>r.subject===subject),other=L.filter(r=>r.subject!==subject);
    const r=res.find(x=>x.id===cur);
    return `<div class="two"><div class="field"><label for="fR">Resource <span class="muted" style="font-weight:400">— optional</span></label><select id="fR"><option value="">None</option>${mine.map(x=>`<option value="${esc(x.id)}" ${x.id===cur?"selected":""}>${esc(x.title)}</option>`).join("")}${other.length?`<option disabled>──────────</option>${other.map(x=>`<option value="${esc(x.id)}" ${x.id===cur?"selected":""}>${esc(x.title)} · ${esc(x.subject||"")}</option>`).join("")}`:""}</select></div>
      <div class="field" id="fRPw" style="${r?"":"visibility:hidden"}"><label for="fRP">Now at <span id="fRU" class="muted" style="font-weight:400">${r?esc(r.unit)+(r.total?" / "+r.total:""):""}</span></label><input type="number" id="fRP" min="0" inputmode="numeric" value="${r?r.progress:""}"></div></div>`;
  }
  function formRead(){const s=$("#fR");if(!s||!s.value)return {r:null};const p=$("#fRP")&&$("#fRP").value!==""?parseInt($("#fRP").value,10):null;return {r:s.value,progress:p}}
  function afterLog(f){
    if(!f||!f.r)return;const r=res.find(x=>x.id===f.r);if(!r)return;
    const patch={updated_at:new Date().toISOString()};
    if(f.progress!=null&&!isNaN(f.progress)&&f.progress!==r.progress){patch.progress=r.total?Math.min(f.progress,r.total):f.progress;if(r.total&&patch.progress>=r.total){patch.status="done";patch.finished_at=today()}}
    Object.assign(r,patch);write("resources",{op:"update",ids:[r.id],patch});
    if(patch.status==="done")setTimeout(()=>toast(`🎉 Finished “${r.title}”`,4000),1200);
  }
  /* ---------- scores ---------- */
  function setupNote(){return `<div class="card"><h2>One more step in Supabase</h2><p class="sub">Resources and scores need database update 4: open Supabase → SQL Editor → New query, paste <b>supabase-update-4.sql</b> from the repo and press Run.</p></div>`}
  const pctOf=s=>s.max_total?s.total/s.max_total*100:null;
  function lineChart(el,pts){
    // one series, % of max over time; recessive grid, 2px line, 8px markers, hover titles
    const W=el.clientWidth||600,Hh=200,pl=34,pr=12,pt=10,pb=26;const iw=W-pl-pr,ih=Hh-pt-pb;
    if(!pts.length){el.innerHTML="";return}
    const t0=parseD(pts[0].d).getTime(),t1=parseD(pts[pts.length-1].d).getTime();const sp=Math.max(1,t1-t0);
    const X=d=>pl+(pts.length===1?iw/2:(parseD(d).getTime()-t0)/sp*iw),Y=v=>pt+ih-(v/100)*ih;
    let g="";for(const v of [0,25,50,75,100])g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--border)" stroke-width="1"/><text x="${pl-6}" y="${Y(v)+4}" text-anchor="end" font-size="10.5" fill="var(--text-muted)">${v}%</text>`;
    const path=pts.map((p,i)=>(i?"L":"M")+X(p.d).toFixed(1)+","+Y(p.v).toFixed(1)).join("");
    const dots=pts.map(p=>`<circle cx="${X(p.d)}" cy="${Y(p.v)}" r="5" fill="var(--series-1,var(--accent))" stroke="var(--surface-1)" stroke-width="2"><title>${esc(fmtDate(p.d))} · ${Math.round(p.v)}%${p.label?" · "+esc(p.label):""}</title></circle>`).join("");
    const lab=[pts[0],pts[pts.length-1]].filter((p,i,a)=>i===0||p!==a[0]).map((p,i)=>`<text x="${X(p.d)}" y="${Hh-6}" text-anchor="${pts.length===1?"middle":i?"end":"start"}" font-size="10.5" fill="var(--text-muted)">${esc(shortDate(p.d))}</text>`).join("");
    el.innerHTML=`<svg width="${W}" height="${Hh}" role="img" aria-label="Score over time">${g}<path d="${path}" fill="none" stroke="var(--series-1,var(--accent))" stroke-width="2" stroke-linejoin="round"/>${dots}${lab}</svg>`;
  }
  function viewScores(){
    if(ok===false)return setupNote();
    const ro=readOnly();const exams=[...new Set(scores.map(s=>s.exam))];
    if(!scores.length)return `<div class="row" style="margin-bottom:14px"><span class="spacer"></span>${ro?"":`<button class="btn" data-scnew>+ Score</button>`}</div><div class="card empty-state">Record practice exams and tests — total and each section — to see your progress, your weakest part, and how much you studied between tests.</div>`;
    const ex=ui.scEx&&exams.includes(ui.scEx)?ui.scEx:exams[0];const L=scores.filter(s=>s.exam===ex).sort((a,b)=>a.d<b.d?-1:1);
    const last=L[L.length-1],prev=L[L.length-2];
    const parts=(last.parts||[]).map(p=>{const pp=prev&&(prev.parts||[]).find(x=>x.name===p.name);return {...p,pct:p.max?p.score/p.max*100:null,delta:pp?(p.max&&pp.max&&p.max!==pp.max?(p.score/p.max-pp.score/pp.max)*p.max:p.score-pp.score):null}});
    const weakest=parts.filter(p=>p.pct!=null).sort((a,b)=>a.pct-b.pct)[0];
    let between="";if(prev&&last.subject){const mins=all().logs.reduce((a,l)=>a+(l.s===last.subject&&l.d>prev.d&&l.d<=last.d?l.m:0),0);const dv=pctOf(last)!=null&&pctOf(prev)!=null?pctOf(last)-pctOf(prev):null;
      between=`<p class="ins-say">Between your last two ${esc(ex)} results you studied <b>${H(mins)} h</b> of ${esc(last.subject)}${dv!=null?` and moved <b class="${dv>=0?"delta-up":"delta-down"}">${dv>=0?"+":""}${dv.toFixed(1)} points</b>`:""}.</p>`}
    ui._scorePts=L.filter(s=>pctOf(s)!=null).map(s=>({d:s.d,v:pctOf(s),label:`${s.total}/${s.max_total}`}));
    return `<div class="row" style="margin-bottom:14px;flex-wrap:wrap"><div class="chips">${exams.map(x=>`<button class="qchip tpl ${x===ex?"on":""}" data-scex="${esc(x)}">${esc(x)}</button>`).join("")}</div><span class="spacer"></span>${ro?"":`<button class="btn" data-scnew>+ Score</button>`}</div>
     <div class="grid g2"><div class="card"><h2>${esc(ex)}</h2><p class="sub">${L.length} result${L.length>1?"s":""} · latest ${esc(fmtDate(last.d))}: <b class="num">${last.total??"—"}${last.max_total?" / "+last.max_total:""}</b>${pctOf(last)!=null?` (${Math.round(pctOf(last))}%)`:""}</p><div class="chart" id="scChart"></div>${between}</div>
      <div class="card"><h2>Sections</h2><p class="sub">Latest result${prev?", change since the one before":""}.</p>
       ${parts.map(p=>`<div class="cmp"><span>${esc(p.name)}</span><div class="g-bar"><div class="fill" style="width:${p.pct??0}%;${weakest&&p===weakest?"background:var(--danger)":""}"></div></div><span class="num">${p.score}/${p.max}${p.delta!=null&&Math.abs(p.delta)>=.25?` <span class="${p.delta>=0?"delta-up":"delta-down"}" title="Change since the result before">${p.delta>=0?"▲":"▼"}${+Math.abs(p.delta).toFixed(1)}</span>`:""}</span></div>`).join("")||'<div class="muted">No sections recorded.</div>'}
       ${weakest&&parts.length>1?`<p class="ins-say">Weakest right now: <b>${esc(weakest.name)}</b> (${Math.round(weakest.pct)}%).</p>`:""}</div></div>
     <div class="card"><h2>All results</h2>${[...L].reverse().map(s=>`<div class="log"><div class="main"><div class="act">${esc(fmtDate(s.d))}</div><div class="meta">${(s.parts||[]).map(p=>esc(p.name)+" "+p.score+"/"+p.max).join(" · ")}${s.notes?" · "+esc(s.notes):""}</div></div><div class="min num">${s.total??"—"}${s.max_total?" / "+s.max_total:""}</div>${ro?"":`<button class="ib" data-scedit="${esc(s.id)}" title="Edit">${ICONS.edit}</button>`}</div>`).join("")}</div>`;
  }
  function scEditor(id){
    const s0=scores.find(x=>x.id===id);const exams=[...new Set(scores.map(s=>s.exam))];
    const base=s0||(()=>{const p=scores.find(s=>s.exam===ui.scEx)||scores[0];return {d:today(),exam:p?p.exam:"",subject:p?p.subject:focus(),parts:p?(p.parts||[]).map(x=>({name:x.name,score:"",max:x.max})):[{name:"",score:"",max:""}],notes:""}})();
    const subs=subjects();
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">${id?"Edit score":"New score"}</h2><span class="spacer"></span><button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button></div>
     <div class="two"><div class="field"><label for="scE">Exam or test</label><input type="text" id="scE" list="scEl" maxlength="60" value="${esc(base.exam)}" placeholder="e.g. Practice exam 1"><datalist id="scEl">${exams.map(x=>`<option value="${esc(x)}">`).join("")}</datalist></div>
      <div class="field"><label for="scD">Date</label><input type="date" id="scD" value="${base.d}" max="${today()}"></div></div>
     <div class="field"><label for="scS">Subject</label><select id="scS">${[...subs,...LANGS.filter(x=>!subs.includes(x))].map(x=>`<option ${x===base.subject?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
     <div class="field"><label>Sections <span class="muted" style="font-weight:400">— name, score, out of</span></label><div id="scParts">${(base.parts.length?base.parts:[{name:"",score:"",max:""}]).map(partRow).join("")}</div>
      <button class="linkb" data-scadd>+ Add a section</button></div>
     <div class="two"><div class="field"><label for="scT">Total</label><input type="number" id="scT" step="0.5" value="${s0&&s0.total!=null?s0.total:""}" placeholder="adds up the sections"></div><div class="field"><label for="scM">Out of</label><input type="number" id="scM" step="0.5" value="${s0&&s0.max_total!=null?s0.max_total:""}" placeholder="adds up the sections"></div></div>
     <div class="field"><label for="scN">Notes <span class="muted" style="font-weight:400">— optional</span></label><input type="text" id="scN" maxlength="1000" value="${esc(base.notes||"")}"></div>
     <div class="row" style="justify-content:flex-end">${id?`<button class="btn danger" data-scdel="${esc(id)}" style="margin-right:auto">Delete</button>`:""}<button class="btn sec" data-act="close">Cancel</button><button class="btn" data-scsave="${esc(id||"")}">Save</button></div>`;
    $("#scrim").classList.add("open");
  }
  function partRow(p){return `<div class="sc-part"><input type="text" class="spn" maxlength="40" value="${esc(p.name||"")}" placeholder="Section" aria-label="Section name"><input type="number" class="sps" step="0.5" value="${p.score??""}" placeholder="Score" aria-label="Score"><input type="number" class="spm" step="0.5" value="${p.max??""}" placeholder="Out of" aria-label="Out of"></div>`}
  function scSave(id){
    const exam=$("#scE").value.trim();if(!exam)return toast("Name the exam or test");const d=$("#scD").value;if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return toast("Pick a date");
    const parts=[...document.querySelectorAll(".sc-part")].map(r=>({name:r.querySelector(".spn").value.trim().slice(0,40),score:parseFloat(r.querySelector(".sps").value),max:parseFloat(r.querySelector(".spm").value)})).filter(p=>p.name&&!isNaN(p.score)).map(p=>({...p,max:isNaN(p.max)?null:p.max}));
    let total=parseFloat($("#scT").value),max=parseFloat($("#scM").value);
    if(isNaN(total))total=parts.length?parts.reduce((a,p)=>a+p.score,0):null;if(isNaN(max))max=parts.length&&parts.every(p=>p.max)?parts.reduce((a,p)=>a+p.max,0):null;
    if(total==null)return toast("Add a total or at least one section");
    const row={d,exam:exam.slice(0,60),subject:$("#scS").value,parts,total,max_total:max,notes:$("#scN").value.trim().slice(0,1000)||null};
    closeModal();ui.scEx=row.exam;
    if(id){const s=scores.find(x=>x.id===id);const prev={...s};Object.assign(s,row);write("scores",{op:"update",ids:[id],patch:row});render();
      actionToast("Score updated","Undo",()=>{const p={d:prev.d,exam:prev.exam,subject:prev.subject,parts:prev.parts,total:prev.total,max_total:prev.max_total,notes:prev.notes};Object.assign(s,p);write("scores",{op:"update",ids:[id],patch:p});render()})}
    else{const s={id:newId(),...row,created_at:new Date().toISOString()};scores.unshift(s);write("scores",{op:"insert",rows:[s]});render();toast("Score saved")}
  }
  function scDelete(id){const s=scores.find(x=>x.id===id);if(!s)return;closeModal();scores=scores.filter(x=>x!==s);write("scores",{op:"delete",ids:[id]});render();
    actionToast("Score deleted","Undo",()=>{scores.unshift(s);write("scores",{op:"insert",rows:[s]});render()},8000)}
  function after(){const el=$("#scChart");if(el&&ui._scorePts)lineChart(el,ui._scorePts)}
  /* ---------- events ---------- */
  document.addEventListener("click",e=>{
    const t=e.target.closest("[data-resf],[data-resnew],[data-resedit],[data-ressave],[data-resdel],[data-reslog],[data-resplus],[data-resdone],[data-scnew],[data-scedit],[data-scsave],[data-scdel],[data-scex],[data-scadd],[data-logtab]");if(!t)return;const d=t.dataset;
    if(d.logtab!=null){ui.logTab=d.logtab;render()}
    else if(d.resf){ui.resF=d.resf;render()}
    else if(d.resnew!=null)resEditor(null);
    else if(d.resedit)resEditor(d.resedit);
    else if(d.ressave!=null)resSave(d.ressave||null);
    else if(d.resdel){if(!t.classList.contains("confirm")){t.classList.add("confirm");t.textContent="Delete?";return}resDelete(d.resdel)}
    else if(d.reslog){const r=res.find(x=>x.id===d.reslog);if(r)openModal(null,{r:r.id,s:r.subject,a:r.title})}
    else if(d.resplus){const r=res.find(x=>x.id===d.resplus);if(!r)return;const step=r.unit==="%"?5:1;const v=r.total?Math.min(r.total,r.progress+step):r.progress+step;resPatch(r.id,{progress:v,...(r.total&&v>=r.total?{status:"done",finished_at:today()}:{})},`${r.title}: ${v} ${r.unit}`)}
    else if(d.resdone)resPatch(d.resdone,{status:"done",finished_at:today()},"Marked as finished 🎉");
    else if(d.scnew!=null)scEditor(null);
    else if(d.scedit)scEditor(d.scedit);
    else if(d.scsave!=null)scSave(d.scsave||null);
    else if(d.scdel){if(!t.classList.contains("confirm")){t.classList.add("confirm");t.textContent="Delete?";return}scDelete(d.scdel)}
    else if(d.scex){ui.scEx=d.scex;render()}
    else if(d.scadd!=null){$("#scParts").insertAdjacentHTML("beforeend",partRow({}))}
  });
  document.addEventListener("change",e=>{
    if(e.target.id==="fR"){const r=res.find(x=>x.id===e.target.value);const w=$("#fRPw");if(w)w.style.visibility=r?"visible":"hidden";
      if(r){$("#fRP").value=r.progress;$("#fRU").textContent=r.unit+(r.total?" / "+r.total:"");const a=$("#fA");if(a&&!a.value)a.value=r.title}}
  });
  return {load,viewRes,viewScores,after,formField,formRead,afterLog,resEditor,get res(){return res},get scores(){return scores},get ok(){return ok},
    titleOf(id){const r=res.find(x=>x.id===id);return r?r.title:""},reset(){res=[];scores=[];ok=null}};
})();
