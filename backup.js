/* Export & backup: CSV files for logs, Focus sessions and focus points, plus one JSON file
   with everything (restorable). Uses globals from index.html. */
"use strict";
const Backup=(()=>{
  const LK="lb-lastbackup";
  const sep=()=>ui.csvSemi?";":",";
  const q=v=>{v=v==null?"":String(v);return new RegExp(`["\\n\\r${sep()}]`).test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const rowsToCSV=(head,rows)=>"﻿"+[head,...rows].map(r=>r.map(q).join(sep())).join("\r\n");   // BOM so Excel shows é, ł, ã correctly
  const p2=n=>String(n).padStart(2,"0");
  const hm=t=>{const d=new Date(t);return p2(d.getHours())+":"+p2(d.getMinutes())};
  const ymdT=t=>ymd(new Date(t));
  const ls=(k,def)=>{try{return JSON.parse(localStorage.getItem(k)||"null")??def}catch(_){return def}};
  const who=()=>(myProfile&&myProfile.username)||"me";

  function logsCSV(){
    return rowsToCSV(["Activity","Language","Activity Type","Time (minutes)","Date","Source","Logged at","ID"],
      all().logs.map(l=>[l.a||"",l.s,l.t,l.m,l.d,l.src||"manual",l.c||"",l.i]));
  }
  function focusCSV(){
    const tl=ls("lb-timeline",[]).slice().sort((a,b)=>(a.segs[0]||[0])[0]-(b.segs[0]||[0])[0]);
    return rowsToCSV(["Date","Start","End","Focus minutes","Subject","Type","Activity","Finished","Pauses","Points","Start (ISO)","End (ISO)"],
      tl.filter(x=>x.segs&&x.segs.length).map(x=>{const a=x.segs[0][0],b=x.segs[x.segs.length-1][1];
        return [x.day||ymdT(a),hm(a),hm(b),x.min,x.s,x.t,x.a||"",x.full?"yes":"stopped early",x.segs.length-1,x.pts||0,new Date(a).toISOString(),new Date(b).toISOString()]}));
  }
  function pointsCSV(){
    const P=ls("lb-points",{hist:[]});
    return rowsToCSV(["Date","Time","Credited minutes","Sessions in a row","Base","Finish bonus","On-time bonus","Total"],
      (P.hist||[]).slice().reverse().map(h=>[h.d,hm(h.t),h.min,h.n,h.base,h.comp,h.onT,h.total]));
  }
  function backupJSON(){
    const P=myProfile||{};
    return JSON.stringify({app:"logbook",version:1,exported_at:new Date().toISOString(),username:P.username,
      profile:{focus:P.focus||null,subjects:P.subjects||[],types:P.types||[],prefs:Prefs.mine()},
      logs:all().logs.map(l=>({date:l.d,subject:l.s,type:l.t,minutes:l.m,activity:l.a||"",src:l.src||"manual",created_at:l.c||null,id:l.i})),
      device:{timeline:ls("lb-timeline",[]),points:ls("lb-points",null),focus:ls("lb-focus",null),theme:(()=>{try{return localStorage.getItem("lb-theme")}catch(_){return null}})()}},null,1);
  }
  function download(name,text,type){
    const blob=new Blob([text],{type});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);
  }
  function mark(){try{localStorage.setItem(LK,String(Date.now()))}catch(_){}}
  function run(kind){
    const d=today(),u=who();
    if(kind==="logs"){download(`logbook-${u}-logs-${d}.csv`,logsCSV(),"text/csv;charset=utf-8");toast(`Exported ${all().logs.length} logs`)}
    else if(kind==="focus"){const n=ls("lb-timeline",[]).length;if(!n)return toast("No Focus sessions on this device yet");download(`logbook-${u}-focus-sessions-${d}.csv`,focusCSV(),"text/csv;charset=utf-8");toast(`Exported ${n} Focus sessions`)}
    else if(kind==="points"){download(`logbook-${u}-focus-points-${d}.csv`,pointsCSV(),"text/csv;charset=utf-8")}
    else if(kind==="json"){download(`logbook-${u}-backup-${d}.json`,backupJSON(),"application/json");mark();toast("Full backup downloaded");render()}
    else if(kind==="all"){download(`logbook-${u}-logs-${d}.csv`,logsCSV(),"text/csv;charset=utf-8");
      setTimeout(()=>{if(ls("lb-timeline",[]).length)download(`logbook-${u}-focus-sessions-${d}.csv`,focusCSV(),"text/csv;charset=utf-8")},400);
      setTimeout(()=>{download(`logbook-${u}-backup-${d}.json`,backupJSON(),"application/json");mark();render()},800);toast("Downloading your files…")}
  }
  function card(){
    const last=+(localStorage.getItem(LK)||0);const days=last?Math.floor((Date.now()-last)/864e5):null;
    const nTl=ls("lb-timeline",[]).length,nPts=(ls("lb-points",{hist:[]}).hist||[]).length;
    return `<div class="card" id="backupCard"><h2>Export & backup</h2>
     <p class="sub">Your data as files you keep — open them in Excel or Google Sheets, or restore them here if anything goes wrong. ${last?`Last full backup on this device: <b>${days===0?"today":days===1?"yesterday":days+" days ago"}</b>.`:"<b>No full backup yet.</b>"}${days!=null&&days>30?` <span style="color:var(--danger)">Time for a new one.</span>`:""}</p>
     <button class="btn" data-bk="all">Download everything</button>
     <div class="bk-list">
      <div class="bk"><div><b>All logs</b> · CSV<div class="muted">${all().logs.length} logs — every subject, type, minutes, date, source and description. Same columns as Polylogger, plus extras.</div></div><button class="btn sec sm" data-bk="logs">Download</button></div>
      <div class="bk"><div><b>Focus sessions</b> · CSV<div class="muted">${nTl} sessions on this device — date, start and end time, minutes, subject, finished or stopped early, pauses, points.</div></div><button class="btn sec sm" data-bk="focus" ${nTl?"":"disabled"}>Download</button></div>
      <div class="bk"><div><b>Focus points</b> · CSV<div class="muted">${nPts} awards on this device.</div></div><button class="btn sec sm" data-bk="points" ${nPts?"":"disabled"}>Download</button></div>
      <div class="bk"><div><b>Full backup</b> · JSON<div class="muted">Everything in one file: logs, goals, quick logs, consistency settings, subjects, Focus sessions, points and Focus settings. Restorable below.</div></div><button class="btn sec sm" data-bk="json">Download</button></div>
     </div>
     <label class="gchk"><input type="checkbox" id="csvSemi" ${ui.csvSemi?"checked":""}> Use semicolons (;) — pick this if Excel puts everything in one column (common with Polish or Portuguese settings)</label>
     <p class="muted" style="font-size:12.5px;margin:6px 0 0">Focus sessions and points are kept on each device separately — export from every device you use Focus on.</p>
     <h3 style="font-size:14px;margin:18px 0 4px">Restore</h3><p class="sub" style="margin-bottom:8px">Pick a full backup (.json) or a logs CSV from here or Polylogger. Logs you already have are skipped, so restoring twice is safe.</p>
     <input type="file" id="restoreFile" accept=".json,.csv,application/json,text/csv"><div id="restoreBox"></div></div>`;
  }
  async function restore(file){
    if(/\.csv$/i.test(file.name)||file.type==="text/csv"){handleCSV(file,"#restoreBox");return}
    let B;try{B=JSON.parse(await file.text())}catch(_){return toast("That file isn't a valid backup")}
    if(!B||B.app!=="logbook"||!Array.isArray(B.logs))return toast("That doesn't look like a Logbook backup");
    const box=$("#restoreBox");
    // device data: merge without losing anything already here
    const tl=ls("lb-timeline",[]);const ids=new Set(tl.map(x=>x.id));let addTl=0;
    for(const x of (B.device&&B.device.timeline)||[])if(x&&x.id&&!ids.has(x.id)){tl.push(x);ids.add(x.id);addTl++}
    tl.sort((a,b)=>(a.segs[0]||[0])[0]-(b.segs[0]||[0])[0]);try{localStorage.setItem("lb-timeline",JSON.stringify(tl.slice(-2000)))}catch(_){}
    const bp=B.device&&B.device.points;if(bp&&bp.hist){const cur=ls("lb-points",{total:0,hist:[],chain:{n:0,due:null}});const seen=new Set((cur.hist||[]).map(h=>h.t));let add=0;
      for(const h of bp.hist)if(!seen.has(h.t)){cur.hist.push(h);add++}cur.hist.sort((a,b)=>b.t-a.t);cur.hist=cur.hist.slice(0,400);cur.total=Math.max(cur.total||0,bp.total||0);
      if(add)try{localStorage.setItem("lb-points",JSON.stringify(cur))}catch(_){}}
    if(B.device&&B.device.focus&&!localStorage.getItem("lb-focus"))try{const f={...B.device.focus};delete f._st;localStorage.setItem("lb-focus",JSON.stringify(f))}catch(_){}
    // settings: fill in what's missing, never overwrite what you have
    const P=B.profile||{};const mine=Prefs.mine();const patch={};
    for(const k of Object.keys(P.prefs||{}))if(mine[k]===undefined||(Array.isArray(mine[k])&&!mine[k].length))patch[k]=P.prefs[k];
    if(Object.keys(patch).length)await Prefs.set(patch,true);
    const sp={};if(P.subjects&&P.subjects.length)sp.subjects=[...new Set([...(myProfile.subjects||[]),...P.subjects])];if(P.types&&P.types.length)sp.types=[...new Set([...(myProfile.types||[]),...P.types])];
    if(Object.keys(sp).length)await saveSettings(sp);
    // logs: same review + de-duplication as a CSV import
    const rows=B.logs.filter(l=>/^\d{4}-\d{2}-\d{2}$/.test(l.date)&&l.minutes>0).map(l=>({a:l.activity||"",L:l.subject,t:l.type||"Mixed",m:Math.min(l.minutes,1440),d:l.date,src:l.src||"manual"}));
    const lang={};rows.forEach(r=>{const e=lang[r.L]||(lang[r.L]={name:r.L,n:0,m:0,to:r.L});e.n++;e.m+=r.m});
    importState={rows,langs:Object.values(lang).sort((a,b)=>b.m-a.m),box:"#restoreBox",note:`Backup from ${B.exported_at?new Date(B.exported_at).toLocaleString():"?"}${B.username?" (@"+esc(B.username)+")":""}. Restored ${addTl} Focus sessions${Object.keys(patch).length?" and your missing settings":""} on this device.`};
    renderImportBox();if(box)box.scrollIntoView({block:"nearest"});
  }
  document.addEventListener("click",e=>{const b=e.target.closest("[data-bk]");if(b)run(b.dataset.bk)});
  document.addEventListener("change",e=>{
    if(e.target.id==="csvSemi")ui.csvSemi=e.target.checked;
    if(e.target.id==="restoreFile"&&e.target.files[0]){const f=e.target.files[0];e.target.value="";restore(f)}
  });
  return {card,run,logsCSV,focusCSV,pointsCSV,backupJSON};
})();
