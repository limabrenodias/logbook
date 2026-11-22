/* Focus points — rewards real focus time, finishing sessions, and coming back on time after breaks.
   Anti-cheat rules:
   • Only time with the focus timer RUNNING and the person PRESENT is credited (pausing earns nothing).
   • Present = they started the session themselves, or confirmed with a tap/key after an auto-start.
     An auto-started session nobody confirms earns 0 and breaks the chain.
   • The "on time" clock is fixed when the focus ends: return deadline = focus end + planned break.
     Pausing or starting the break late doesn't move it; sitting on the start screen doesn't help —
     the delay is measured to the moment you actually start (or confirm) the next focus.
   Stored on this device (localStorage) for now. */
"use strict";
const Points=(()=>{
  const KEY="lb-points",GRACE=5*60000;
  let L=load();
  function load(){try{const o=JSON.parse(localStorage.getItem(KEY)||"{}");return {total:o.total||0,hist:o.hist||[],chain:o.chain||{n:0,due:null}}}catch(_){return {total:0,hist:[],chain:{n:0,due:null}}}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(L))}catch(_){}}
  const day=t=>{const d=new Date(t);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};

  function chainFor(now){const c=L.chain;if(c.n>0&&c.due!=null){const delay=Math.max(0,now-c.due);if(delay<=GRACE)return {n:c.n+1,delay}}return {n:1,delay:null}}
  // a focus session starts for the first time
  function begin(st,manual){st.credit=0;st.lastTick=Date.now();st.presenceAt=null;st.chainN=1;st.delay=null;if(manual)confirm(st)}
  function confirm(st){if(st.presenceAt)return;const now=Date.now();st.presenceAt=now;st.lastTick=now;const c=chainFor(now);st.chainN=c.n;st.delay=c.delay}
  function tick(st){const now=Date.now();if(st.running&&st.phase==="focus"&&st.presenceAt&&st.lastTick){const to=Math.min(now,st.endAt);st.credit=(st.credit||0)+Math.max(0,to-st.lastTick)}st.lastTick=st.running?now:null}
  function pause(st){tick(st);st.lastTick=null}
  function resume(st){st.lastTick=Date.now()}
  function needsPresence(st){return st.phase==="focus"&&st.running&&st.startedAt&&!st.presenceAt}

  function score(min,focusMin,n,delay,full){
    const lenM=1+Math.min(.4,Math.max(0,(focusMin-25)/100));        // longer sessions: up to ×1.4
    const chM=1+.1*Math.min(Math.max(n-1,0),5);                        // sessions in a row: up to ×1.5
    const base=Math.round(min*lenM*chM);
    const comp=full?Math.round(min*.2):0;                              // finishing bonus +20%
    const onT=full&&n>1&&delay!=null?(delay<=60000?5:delay<=180000?3:1):0; // back on time
    return {base,comp,onT,lenM,chM,total:base+comp+onT};
  }
  // focus session ends (full = timer reached zero). breakMin = planned break after it.
  function finish(st,full,focusMin,breakMin){
    tick(st);const min=Math.round((st.credit||0)/60000);
    if(!st.presenceAt||min<1){L.chain={n:0,due:null};save();return null}
    const n=full?st.chainN||1:1;const s=score(min,focusMin,n,st.delay,full);
    L.total+=s.total;L.hist.unshift({t:Date.now(),d:day(Date.now()),min,n,...s});L.hist=L.hist.slice(0,5000);
    L.chain=full?{n,due:Date.now()+breakMin*60000}:{n:0,due:null};save();return {...s,min,n};
  }
  function skipBreak(){if(L.chain.n>0){L.chain.due=Math.min(L.chain.due??Date.now(),Date.now());save()}}
  function abandon(){L.chain={n:0,due:null};save()}
  function summary(){const today=day(Date.now());const wk=Date.now()-6*864e5;let t=0,w=0;for(const h of L.hist){if(h.d===today)t+=h.total;if(h.t>=wk)w+=h.total}
    const c=L.chain;const live=c.n>0&&(c.due==null||Date.now()-c.due<=GRACE);
    return {total:L.total,today:t,week:w,chain:live?c.n:0,due:live?c.due:null,recent:L.hist.slice(0,8),graceMin:GRACE/60000}}
  // across devices: every award ever made is kept in your account; merge them in and recount
  function awards(){return L.hist.slice()}
  function merge(list){
    const seen=new Set(L.hist.map(h=>+h.t));let added=0;
    for(const h of list||[])if(h&&h.t!=null&&!seen.has(+h.t)){L.hist.push(h);seen.add(+h.t);added++}
    L.hist.sort((a,b)=>b.t-a.t);L.hist=L.hist.slice(0,5000);
    const sum=L.hist.reduce((a,h)=>a+(h.total||0),0);const before=L.total;L.total=Math.max(L.total,sum);
    if(added||L.total!==before)save();return added;
  }
  return {begin,confirm,tick,pause,resume,needsPresence,finish,skipBreak,abandon,summary,score,awards,merge};
})();
