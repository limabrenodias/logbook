/* Offline-first saving, a local copy of your logbook, and Focus sync across devices.
   • Every change is applied on screen at once and put in an outbox kept on this device.
     The outbox is sent in order whenever there's a connection; nothing is lost when offline.
   • New logs get their id on this device, so a log made offline can be edited or deleted
     offline too, and re-sending after a dropped connection can never create a duplicate.
   • Your logbook is also cached on the device, so the app opens instantly, even with no signal.
   • Focus sessions and points are merged between your devices through your account. */
"use strict";
const Net=(()=>{
  let queue=[],busy=false,offline=!navigator.onLine,bootOffline=false;
  const K=()=>"lb-outbox-"+me;
  function init(){try{queue=JSON.parse(localStorage.getItem(K())||"[]")||[]}catch(_){queue=[]}paint()}
  function persist(){try{localStorage.setItem(K(),JSON.stringify(queue))}catch(_){}}
  const retryable=e=>!e||!e.code&&/fetch|network|load failed|timed? ?out|abort/i.test((e.message||"")+" "+(e.details||""))||e.code==="PGRST301"||/jwt expired/i.test(e.message||"");
  async function run(op){
    const T=sb.from("logs");
    if(op.op==="insert"){
      const r=await sb.from("logs").insert(op.rows);if(!r.error||r.error.code!=="23505")return r.error;
      // some of these already reached the server before the connection dropped: add the rest one by one
      for(const row of op.rows){const x=await sb.from("logs").insert(row);if(x.error&&x.error.code!=="23505")return x.error}return null;
    }
    for(let i=0;i<op.ids.length;i+=200){const ids=op.ids.slice(i,i+200);
      const r=op.op==="update"?await sb.from("logs").update(op.patch).in("id",ids):await sb.from("logs").delete().in("id",ids);if(r.error)return r.error}
    return null;
  }
  async function flush(){
    if(busy||!queue.length||!sb||!me||bootOffline)return;busy=true;paint();
    try{
      while(queue.length){const err=await run(queue[0]);
        if(err){if(retryable(err)){offline=true;if(/jwt/i.test(err.message||""))try{await sb.auth.refreshSession()}catch(_){}break}
          queue.shift();persist();fail(err,"A change couldn't be saved, so it was undone");await refresh();continue}
        queue.shift();persist();offline=false}
      if(!queue.length)Cache.save();
    }finally{busy=false;paint()}
  }
  function write(op){queue.push(op);persist();Cache.save();paint();flush()}
  // put changes that haven't reached the server yet back on top of freshly loaded data
  function apply(arr){
    for(const op of queue){
      if(op.op==="insert"){for(const r of op.rows)if(!arr.some(x=>x.i===r.id))arr.push(fromRow(r))}
      else{const s=new Set(op.ids);
        if(op.op==="delete"){for(let i=arr.length-1;i>=0;i--)if(s.has(arr[i].i))arr.splice(i,1)}
        else for(const l of arr)if(s.has(l.i))patchLocal(l,op.patch)}
    }
    return arr;
  }
  function paint(){
    let p=document.getElementById("netPill");
    const n=queue.length;const show=phase==="app"&&(n||offline||bootOffline);
    if(!show){if(p)p.remove();return}
    if(!p){p=document.createElement("button");p.id="netPill";p.setAttribute("aria-live","polite");p.onclick=()=>{offline=false;flush()};document.body.appendChild(p)}
    p.className=offline||bootOffline?"off":"busy";
    p.innerHTML=`<span class="dot ${offline||bootOffline?"":"g"}"></span>${offline||bootOffline?"Offline":"Saving"}${n?` · ${n} change${n>1?"s":""} waiting`:" · your changes are kept"}`;
  }
  addEventListener("online",()=>{offline=false;paint();if(bootOffline)resumeOnline();else flush()});
  addEventListener("offline",()=>{offline=true;paint()});
  setInterval(()=>{if(queue.length&&!document.hidden)flush()},20000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&queue.length)flush()});
  async function resumeOnline(){
    try{const {data:{session}}=await sb.auth.getSession();if(!session)return;bootOffline=false;me=session.user.id;await startApp()}catch(_){}
  }
  return {init,write,flush,apply,paint,get pending(){return queue.length},markOffline(){offline=true;paint()},
    setBootOffline(v){bootOffline=v;paint()},get bootOffline(){return bootOffline}};
})();

const COLS={d:"d",subject:"s",type:"t",minutes:"m",activity:"a",src:"src"};
function patchLocal(l,patch){for(const k in patch)if(COLS[k])l[COLS[k]]=patch[k];return l}
function newId(){if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;
  const h=[...b].map(x=>x.toString(16).padStart(2,"0")).join("");return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
const toRow=l=>({id:l.i,d:l.d,subject:l.s,type:l.t,minutes:l.m,activity:l.a||"",src:l.src||"manual",created_at:l.c||new Date().toISOString(),ext_id:l.x||null});

const Cache={
  save(){if(!me||viewing!==me||!myProfile)return;clearTimeout(this._t);this._t=setTimeout(()=>{
    try{localStorage.setItem("lb-cache-"+me,JSON.stringify({at:Date.now(),profile:myProfile,logs:logsArr.map(l=>[l.i,l.d,l.s,l.t,l.m,l.a,l.src,l.c,l.x||null])}))}catch(e){console.warn("cache",e)}},400)},
  load(uid){try{const o=JSON.parse(localStorage.getItem("lb-cache-"+uid)||"null");if(!o)return null;
    return {at:o.at,profile:o.profile,logs:o.logs.map(([i,d,s,t,m,a,src,c,x])=>({i,d,s,t,m,a,src,c,x}))}}catch(_){return null}},
  clear(uid){try{localStorage.removeItem("lb-cache-"+uid);localStorage.removeItem("lb-outbox-"+uid)}catch(_){}}
};
// The signed-in user id saved by Supabase on this device — lets the app open offline.
function storedUserId(){try{const k=Object.keys(localStorage).find(k=>/^sb-.*-auth-token$/.test(k));const o=k&&JSON.parse(localStorage.getItem(k));return o&&(o.user&&o.user.id||(o.currentSession&&o.currentSession.user.id))||null}catch(_){return null}}

/* ---------- Focus sessions, points and Focus settings across devices ---------- */
const FocusSync=(()=>{
  let ok=true,busy=false,lastSig="",cfgT=null;
  const tl=()=>{try{return JSON.parse(localStorage.getItem("lb-timeline")||"[]")}catch(_){return []}};
  const missing=e=>e&&(e.code==="42P01"||e.code==="PGRST205"||/does not exist|schema cache/i.test(e.message||""));
  async function insertAll(table,rows){
    for(let i=0;i<rows.length;i+=200){const part=rows.slice(i,i+200);const r=await sb.from(table).insert(part);
      if(r.error&&r.error.code==="23505"){for(const x of part){const y=await sb.from(table).insert(x);if(y.error&&y.error.code!=="23505")return y.error}}
      else if(r.error)return r.error}
    return null;
  }
  async function run(){
    if(!ok||busy||!sb||!me||Net.bootOffline||!navigator.onLine)return;busy=true;
    try{
      // sessions
      const r=await sb.from("focus_sessions").select("id,data").eq("user_id",me).order("day",{ascending:false}).limit(5000);
      if(r.error){if(missing(r.error))ok=false;return}
      const local=tl();const have=new Set(local.map(x=>x.id));const remote=new Set(r.data.map(x=>x.id));let added=0;
      for(const x of r.data)if(!have.has(x.id)&&x.data&&x.data.segs){local.push(x.data);added++}
      const up=local.filter(x=>x&&x.id&&!remote.has(x.id)&&x.segs&&x.segs.length).map(x=>({id:String(x.id).slice(0,40),day:x.day,data:x}));
      if(up.length){const e=await insertAll("focus_sessions",up);if(e)console.warn(e)}
      if(added){local.sort((a,b)=>(a.segs[0]||[0])[0]-(b.segs[0]||[0])[0]);try{localStorage.setItem("lb-timeline",JSON.stringify(local.slice(-3000)))}catch(_){}}
      // points
      const a=await sb.from("focus_awards").select("t,data").eq("user_id",me).limit(20000);
      if(!a.error){const mine=Points.awards();const rt=new Set(a.data.map(x=>+x.t));
        const upA=mine.filter(h=>!rt.has(+h.t)).map(h=>({t:h.t,data:h}));if(upA.length){const e=await insertAll("focus_awards",upA);if(e)console.warn(e)}
        Points.merge(a.data.map(x=>x.data))}
      lastSig=sig();
      if(added&&phase==="app"&&(route()==="focus"||route()==="insights"))render();
    }catch(e){console.warn("focus sync",e)}finally{busy=false}
  }
  const sig=()=>{const t=tl();return t.length+"|"+(t.length?t[t.length-1].id:"")+"|"+Points.awards().length};
  // Focus settings (scene, timers, presets, sounds…) — newest change wins
  function cfgNow(){try{const o=JSON.parse(localStorage.getItem("lb-focus")||"{}");delete o._st;return o}catch(_){return {}}}
  function cfgCheck(){
    const cur=JSON.stringify(cfgNow());const last=localStorage.getItem("lb-focus-synced");
    if(cur===last||cur==="{}")return;try{localStorage.setItem("lb-focus-at",String(Date.now()))}catch(_){}
    clearTimeout(cfgT);cfgT=setTimeout(()=>{if(!me||!myProfile)return;const v=cfgNow();Prefs.set({focusCfg:v,focusCfgAt:Date.now()},true);try{localStorage.setItem("lb-focus-synced",JSON.stringify(v))}catch(_){}},4000);
  }
  function cfgPull(){
    const p=Prefs.mine();if(!p.focusCfg)return cfgCheck();
    const localAt=+(localStorage.getItem("lb-focus-at")||0);
    if((p.focusCfgAt||0)>localAt&&JSON.stringify(p.focusCfg)!==JSON.stringify(cfgNow())){
      try{const o=JSON.parse(localStorage.getItem("lb-focus")||"{}");localStorage.setItem("lb-focus",JSON.stringify({...p.focusCfg,_st:o._st}));
        localStorage.setItem("lb-focus-synced",JSON.stringify(p.focusCfg));localStorage.setItem("lb-focus-at",String(p.focusCfgAt))}catch(_){}
      if(typeof Focus!=="undefined"&&Focus.reloadCfg)Focus.reloadCfg();
    }else cfgCheck();
  }
  let sT=null;
  document.addEventListener("focus-state",()=>{cfgCheck();if(sig()!==lastSig){clearTimeout(sT);sT=setTimeout(run,3000)}});
  setInterval(()=>{if(phase==="app"&&!document.hidden)run()},5*60000);
  addEventListener("online",()=>setTimeout(run,2000));
  return {start(){cfgPull();run()},run,get ok(){return ok}};
})();

/* ---------- install / launch shortcuts ---------- */
if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(e=>console.warn("sw",e)));
function launchAction(){
  const p=new URLSearchParams(location.search);const a=p.get("action");if(!a)return;
  p.delete("action");history.replaceState(null,"",location.pathname+(p.toString()?"?"+p:"")+location.hash);
  if(a==="new")setTimeout(()=>openModal(null),150);else if(a==="focus")location.hash="#focus";else if(a==="insights")location.hash="#insights";
}
