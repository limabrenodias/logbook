/* Goals, consistency (daily & weekly targets, streak freezes, rest days) and quick logs.
   Uses globals from index.html (all, byDate, saveLog, esc, …). Settings are stored in
   profiles.prefs so they follow you across devices, with a copy on this device. */
"use strict";
const Prefs=(()=>{
  const LK="lb-prefs";let warned=false;
  function local(){try{return JSON.parse(localStorage.getItem(LK)||"{}")||{}}catch(_){return {}}}
  function mine(){const p=myProfile&&myProfile.prefs;return p&&Object.keys(p).length?p:local()}
  function get(){if(viewing&&viewing!==me)return (viewProfile&&viewProfile.prefs)||{};return mine()}
  async function set(patch,quiet){
    const next={...mine(),...patch};try{localStorage.setItem(LK,JSON.stringify(next))}catch(_){}
    myProfile={...myProfile,prefs:next};if(viewing===me)viewProfile=myProfile;if(!quiet)render();
    const {error}=await sb.from("profiles").update({prefs:next}).eq("id",me);
    if(error){console.warn(error);if(!warned){warned=true;toast("Saved on this device. Run supabase-social.sql in Supabase to sync it to your account.",6000)}}
  }
  return {get,set,mine};
})();

/* ---------- small helpers ---------- */
const G_ICON={
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 3L5 13h6l-1 8 8-10h-6z"/></svg>'};
function fmtMin(v){v=Math.max(0,v);return v<60?Math.ceil(v)+" min":(v/60).toFixed(v<600?1:0)+" h"}
function shortDate(s){return parseD(s).toLocaleDateString(undefined,{day:"numeric",month:"short",year:parseD(s).getFullYear()!==new Date().getFullYear()?"numeric":undefined})}
function cons(){const p=Prefs.get();return {daily:p.daily===undefined?30:+p.daily||0,weekly:+p.weekly||0,rest:Array.isArray(p.rest)?p.rest:[],freezes:p.freezes!==false}}
function actionToast(msg,label,fn,ms=6000){
  let t=document.getElementById("toastA");if(!t){t=document.createElement("div");t.id="toastA";document.body.appendChild(t)}
  t.innerHTML=`<span>${esc(msg)}</span>${label?`<button>${esc(label)}</button>`:""}`;t.style.display="flex";
  const b=t.querySelector("button");if(b)b.onclick=()=>{t.style.display="none";fn()};
  clearTimeout(actionToast._t);actionToast._t=setTimeout(()=>t.style.display="none",ms);
}

/* ---------- streak with freezes and rest days ----------
   A freeze is earned for every 7 logged days in a row (you can hold 2). A missed day
   uses one automatically. Rest days you choose never break the streak. Worked out
   from your logs, so every device shows the same number. */
function streakInfo(){
  const map=byDate();const keys=Object.keys(map).sort();const c=cons();const t=today();const gs=Goals.skipAll();
  const out={cur:0,best:0,freezes:0,frozen:new Set(),rest:new Set(),todayDone:!!map[t],usedRecently:0};
  if(!keys.length)return out;
  let d=parseD(keys[0]);const end=parseD(t);let cur=0,best=0,fz=0,run=0;const recentCut=ymd(addDays(new Date(),-13));
  while(d<=end){const k=ymd(d);
    if(map[k]){cur++;run++;if(c.freezes&&run%7===0&&fz<2)fz++;if(cur>best)best=cur}
    else if(k!==t){
      if(c.rest.includes(d.getDay())||gs.has(k))out.rest.add(k);
      else if(c.freezes&&fz>0&&cur>0){fz--;out.frozen.add(k);if(k>=recentCut)out.usedRecently++}
      else{cur=0;run=0}}
    d=addDays(d,1)}
  return Object.assign(out,{cur,best,freezes:fz});
}

/* ---------- Today card: daily goal ring, this week's strip, weekly target ---------- */
function ring(p,size=84){const r=size/2-7,C=2*Math.PI*r;p=Math.max(0,Math.min(1,p));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="7"/>
  <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${p>=1?"var(--good)":"var(--accent)"}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-p)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`}
function todayCard(){
  const map=byDate();const t=today();const tm=map[t]?map[t].m:0;const c=cons();const si=streakInfo();
  const ws=weekStart(new Date());let wk=0;const days=[];const gsk=Goals.skipAll();
  for(let i=0;i<7;i++){const d=addDays(ws,i),k=ymd(d),m=map[k]?map[k].m:0;wk+=m;
    const st=gsk.has(k)&&!m?"break":k>t?"future":si.frozen.has(k)?"frozen":m>0&&(!c.daily||m>=c.daily)?"met":m>0?"part":si.rest.has(k)||(k<=t&&(c.rest.includes(d.getDay())||Goals.skipAll().has(k))&&!m)?"rest":k===t?"today":"missed";
    days.push(`<div class="wd wd-${st}${k===t?" is-today":""}" title="${esc(fmtDate(k))}${m?" · "+dur(m):""}"><span>${d.toLocaleDateString(undefined,{weekday:"narrow"})}</span><i>${st==="frozen"?"❄":st==="rest"?"–":st==="break"?"~":st==="met"?"✓":""}</i></div>`)}
  const p=c.daily?tm/c.daily:0;const left=Math.max(0,c.daily-tm);const brk=readOnly()?null:Goals.breakToday();
  return `<div class="card today-card"><div class="head"><div><h2>Today</h2><p class="sub">${c.daily?`Daily goal: ${dur(c.daily)}`:"No daily goal set"} · <a href="#manage" data-g="toCons">change</a></p></div></div>
   <div class="tc-main">${c.daily?`<div class="tc-ring">${ring(p)}<div class="tc-ring-t"><b class="num">${tm}</b><small>/ ${c.daily} min</small></div></div>`:""}
    <div class="tc-side"><div class="tc-msg">${brk&&!tm?`🌿 On a break${brk.reason?` (${esc(brk.reason)})`:""} — back ${daysBetween(today(),brk.back)===1?"tomorrow":"on "+shortDate(brk.back)}. Your streak is safe.`:c.daily?(tm>=c.daily?"Daily goal reached 🎉":tm?`${dur(left)} to go — you're on your way.`:readOnly()?"Nothing yet today.":`Even ${Math.min(10,c.daily)} minutes keeps the habit alive.`):tm?`${dur(tm)} today.`:"Nothing logged yet today."}</div>
     <div class="tc-streak"><b class="num">${si.cur}</b> day streak${si.freezes?` · <span title="Earned for every 7 days in a row; a missed day uses one automatically">❄ ${si.freezes} freeze${si.freezes>1?"s":""}</span>`:""}${si.usedRecently?` · <span class="muted">${si.usedRecently} used recently</span>`:""}</div>
     <div class="wstrip">${days.join("")}</div></div></div>
   ${c.weekly?`<div class="tc-week"><div class="row" style="justify-content:space-between;font-size:13px"><span>This week</span><span class="num">${H(wk)} / ${c.weekly} h</span></div><div class="track"><div class="fill" style="width:${Math.min(100,wk/60/c.weekly*100)}%;${wk/60>=c.weekly?"background:var(--good)":""}"></div></div></div>`:""}
  </div>`;
}

/* ---------- Quick logs (you create them; nothing is added automatically) ---------- */
const Quick={
  list(){return Prefs.get().quick||[]},
  label(q){return `${q.a||q.t} · ${q.m} min`},
  card(){
    const L=this.list();const ro=readOnly();
    return `<div class="card quick-card"><div class="head"><div><h2>Quick log</h2><p class="sub">${ro?"Their one-tap logs.":"One tap logs it for today."}</p></div>${ro?"":`<button class="btn sec sm" data-g="quick">${L.length?"Edit":"Create"}</button>`}</div>
    ${L.length?`<div class="qchips">${L.map(q=>`<button class="qchip" data-qlog="${esc(q.id)}" ${ro?"disabled":""}><span class="qc-a">${esc(q.a||q.t)}</span><span class="qc-m">${esc(q.s)} · ${esc(q.t)} · <b class="num">${q.m}m</b></span></button>`).join("")}</div>`
      :`<div class="muted" style="font-size:13.5px">${ro?"None yet.":"Make buttons for things you do often — like “Anki · 20 min” or “Podcast · 30 min”. Your recent activities are suggested when you create one."}</div>`}</div>`;
  },
  suggestions(){
    const have=new Set(this.list().map(q=>[q.s,q.t,(q.a||"").toLowerCase()].join("|")));
    const seen=new Map();
    for(const l of all().logs){const k=[l.s,l.t,(l.a||"").toLowerCase()].join("|");if(have.has(k))continue;
      const e=seen.get(k);if(e){e.n++;continue}seen.set(k,{a:l.a||"",s:l.s,t:l.t,m:l.m,d:l.d,n:1});if(seen.size>=40)break}
    return [...seen.values()];   // logs are newest first, so this is most recent → least recent
  },
  sheet(fill){
    const L=this.list();const sug=this.suggestions();const subs=subjects();const f=fill||{a:"",s:focus(),t:"Listening",m:20};
    const list=[...subs,...LANGS.filter(x=>!subs.includes(x))];
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">Quick logs</h2><span class="spacer"></span><button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button></div>
    <p class="sub">Buttons on Home that log a session for today in one tap.</p>
    ${L.length?`<div class="qlist">${L.map((q,i)=>`<div class="log"><div class="main"><div class="act">${esc(q.a||q.t)}</div><div class="meta">${esc(q.s)} · ${esc(q.t)} · ${q.m} min</div></div>
      <button class="ib" data-qup="${i}" title="Move up" ${i?"":"disabled"}>↑</button><button class="ib" data-qdel="${i}" title="Remove">${ICONS.del}</button></div>`).join("")}</div>`:""}
    <div class="qform"><h3>New quick log</h3>
     <div class="field"><label>Description</label><input type="text" id="qA" maxlength="300" placeholder="e.g. Anki" value="${esc(f.a)}"></div>
     <div class="two"><div class="field"><label>Subject</label><select id="qS">${list.map(s=>`<option ${s===f.s?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Type</label><select id="qT">${types().map(x=>`<option ${x===f.t?"selected":""}>${esc(x)}</option>`).join("")}</select></div></div>
     <div class="row"><div class="field" style="margin:0;width:120px"><label>Minutes</label><input type="number" id="qM" min="1" max="1440" value="${f.m}" inputmode="numeric"></div><span class="spacer"></span><button class="btn" data-g="qadd" style="align-self:flex-end">Add quick log</button></div></div>
    <h3 class="qs-h">Recent activity <span class="muted">— tap one to fill the form</span></h3>
    <div class="qsug">${sug.length?sug.map((x,i)=>`<button class="qs" data-qsug="${i}"><span class="qs-a">${esc(x.a||"No description")}</span><span class="qs-m">${esc(x.s)} · ${esc(x.t)} · ${x.m} min</span><span class="qs-d">${esc(relDay(x.d))}${x.n>1?` · ${x.n}×`:""}</span></button>`).join(""):'<div class="muted">Nothing logged yet.</div>'}</div>`;
    this._sug=sug;$("#scrim").classList.add("open");
  },
  async log(id){
    const q=this.list().find(x=>x.id===id);if(!q||readOnly())return;
    const p=saveLog({a:q.a,s:q.s,t:q.t,m:q.m,d:today(),src:"manual"});
    actionToast(`Logged ${q.m} min of ${q.s}`,"Undo",async()=>{const l=await p;if(l)deleteLog(l)});
  }
};
function relDay(d){const n=daysBetween(d,today());return n===0?"today":n===1?"yesterday":n<7?n+" days ago":shortDate(d)}

/* ---------- Goals ---------- */
const G_UNIT={day:["day",1],week:["week",7],month:["month",30.44]};
const ST_TXT={break:"On a break",done:"Done",on:"On track",close:"Almost on track",behind:"Behind",missed:"Deadline passed",future:"Not started",nodays:"No study days left"};
const Goals={
  list(){return (Prefs.get().goals||[]).filter(g=>g&&g.rows&&g.rows.length)},
  unit(){return ui.gUnit||"week"},
  /* Skipped days are taken out of the plan as if they didn't exist: they don't count as
     study days left (so the daily need is spread over the days you can actually study),
     they don't drag down your average, and the "steady pace" marker ignores them.
     If you log time for the goal on a skipped day anyway, that day counts as normal. */
  skipSet(g){const s=new Set();for(const r of g.skips||[]){let d=parseD(r.from);const e=parseD(r.to||r.from);let n=0;while(d<=e&&n<400){s.add(ymd(d));d=addDays(d,1);n++}}return s},
  // the planned break (consecutive skipped days) that contains day k, if any
  breakAt(g,k,sk){sk=sk||this.skipSet(g);if(!sk.has(k)||k<g.start||k>g.deadline)return null;
    let a=parseD(k),b=parseD(k);while(sk.has(ymd(addDays(a,-1))))a=addDays(a,-1);while(sk.has(ymd(addDays(b,1))))b=addDays(b,1);
    const from=ymd(a),to=ymd(b);const e=(g.skips||[]).find(r=>r.from<=k&&(r.to||r.from)>=k);
    return {from,to,back:ymd(addDays(b,1)),reason:e&&e.reason||"",days:daysBetween(from,to)+1,dayNo:daysBetween(from,k)+1}},
  breakToday(){const t=today();for(const g of this.list())if(!g.archived){const b=this.breakAt(g,t);if(b)return {...b,goal:g}}return null},
  skipAll(){const s=new Set();for(const g of this.list())if(!g.archived)for(const d of this.skipSet(g))s.add(d);return s},
  stats(g){
    const t=today();const logs=all().logs.filter(l=>l.s===g.subject);const sk=this.skipSet(g);
    const logged=new Set();for(const l of logs)if(l.d>=g.start&&l.d<=t&&g.rows.some(r=>r.type==="*"||r.type===l.t))logged.add(l.d);
    const off=k=>sk.has(k)&&!logged.has(k);
    const avail=(a,b)=>{if(a>b)return 0;let n=0,d=parseD(a);const e=parseD(b);while(d<=e){if(!off(ymd(d)))n++;d=addDays(d,1)}return n};
    const from=t>g.start?t:g.start;
    const daysLeft=t>g.deadline?0:avail(from,g.deadline);          // study days left, today included
    const calLeft=t>g.deadline?0:daysBetween(from,g.deadline)+1;
    const totalDays=Math.max(1,avail(g.start,g.deadline));
    const elapsedDays=t<g.start?0:Math.min(totalDays,avail(g.start,t<g.deadline?t:g.deadline));
    const calElapsed=Math.max(0,daysBetween(g.start,t)+1);
    const win=g.count==="all"?28:Math.min(28,Math.max(7,calElapsed));const winCut=ymd(addDays(new Date(),-(win-1)));
    const winDays=Math.max(1,avail(winCut,t));
    const todaySkipped=off(t);const brk=this.breakAt(g,t,sk);
    const skippedLeft=[...sk].filter(k=>k>=from&&k<=g.deadline&&off(k)).length;
    const etaFrom=n=>{let d=new Date(),c=0,guard=0;while(c<n&&guard<4000){d=addDays(d,1);if(!sk.has(ymd(d)))c++;guard++}return ymd(d)};
    const asc=[...logs].reverse();
    const calc=r=>{
      const tgt=Math.round(r.h*60);let done=0,before=0,recent=0,todayM=0,reached=null;
      for(const l of asc){if(r.type!=="*"&&l.t!==r.type)continue;if(l.d<g.start){if(g.count!=="all")continue;before+=l.m}
        if(l.d>t)continue;done+=l.m;if(!reached&&done>=tgt)reached=l.d;if(l.d>=winCut)recent+=l.m;if(l.d===t)todayM+=l.m}
      const rem=Math.max(0,tgt-done);const pace=recent/winDays;   // average per study day
      const needDay=daysLeft?(rem+(rem&&!todaySkipped?todayM:0))/daysLeft:Infinity;
      const expected=elapsedDays?before+(tgt-before)*(elapsedDays/totalDays):before;
      const status=rem===0?"done":t<g.start?"future":t>g.deadline?"missed":!daysLeft?"nodays":pace>=needDay?"on":pace>=needDay*.8?"close":"behind";
      const eta=rem===0?reached:pace>0?etaFrom(Math.ceil(rem/pace)):null;
      const todayLeft=rem&&!todaySkipped&&t>=g.start?Math.max(0,needDay-todayM):0;
      return {...r,tgt,done,rem,pace,needDay,expected,status,eta,todayM,todayLeft,reached};
    };
    const rows=g.rows.map(calc);
    const totalRow=rows.find(r=>r.type==="*");const typeRows=rows.filter(r=>r.type!=="*");
    let all_;if(totalRow)all_=totalRow;else{const s=k=>typeRows.reduce((a,r)=>a+r[k],0);
      const rem=s("rem");const reachedAll=rem===0?typeRows.map(r=>r.reached).sort().pop():null;
      all_={tgt:s("tgt"),done:typeRows.reduce((a,r)=>a+Math.min(r.done,r.tgt),0),rem,expected:s("expected"),pace:s("pace"),needDay:daysLeft?s("needDay"):Infinity,todayM:s("todayM"),reached:reachedAll}}
    const order=["missed","nodays","behind","close","on","future","done"];
    const status=rows.every(r=>r.status==="done")?"done":brk&&t>=g.start?"break":rows.map(r=>r.status).filter(s=>s!=="done").sort((a,b)=>order.indexOf(a)-order.indexOf(b))[0];
    const eta=status==="done"?all_.reached:rows.some(r=>r.rem&&!r.eta)?null:rows.map(r=>r.eta).filter(Boolean).sort().pop();
    return {rows,all:all_,daysLeft,calLeft,totalDays,elapsedDays,status,eta,win,todaySkipped,skippedLeft,sk,brk};
  },
  need(minPerDay){const [n,mult]=G_UNIT[this.unit()];return minPerDay===Infinity?"—":`<b class="num">${fmtMin(minPerDay*mult)}</b><span>/${n}</span>`},
  balance(g){ // compare where your recent time went with the goal's split
    const rows=g.rows.filter(r=>r.type!=="*"&&r.h>0);if(rows.length<2)return [];
    const cut=ymd(addDays(new Date(),-29));const m={};let tot=0;
    for(const l of all().logs){if(l.d<cut)break;if(l.s!==g.subject)continue;if(rows.some(r=>r.type===l.t)){m[l.t]=(m[l.t]||0)+l.m;tot+=l.m}}
    if(tot<120)return [];const H_=rows.reduce((a,r)=>a+r.h,0);const out=[];
    for(const r of rows){const want=r.h/H_,got=(m[r.type]||0)/tot;if(got<want*.5)out.push(`${r.type} is ${Math.round(got*100)}% of your recent ${g.subject} goal time, but ${Math.round(want*100)}% of the goal.`)}
    return out;
  },
  cardOne(g){
    const S=this.stats(g);const a=S.all;const pct=a.tgt?Math.min(100,a.done/a.tgt*100):0;const ex=a.tgt?Math.min(100,a.expected/a.tgt*100):0;
    const ro=readOnly();const done=S.status==="done";
    const etaTxt=done?`Completed on ${fmtDate(S.all.reached||today())} 🎉`
      :S.status==="future"?`Starts ${fmtDate(g.start)} — ${daysBetween(today(),g.start)===1?"tomorrow":`in ${daysBetween(today(),g.start)} days`}. From then you'll need the amounts above.`
      :S.status==="break"?`🌿 ${S.brk.days>1?`Day ${S.brk.dayNo} of ${S.brk.days} of your break`:"Break day"}${S.brk.reason?` (${esc(S.brk.reason)})`:""} — back ${daysBetween(today(),S.brk.back)===1?"tomorrow":"on "+shortDate(S.brk.back)}. Nothing is expected until then; the amounts above are what you'll need once you're back.${S.todaySkipped?"":" You logged time today, so today counts as a normal study day."}`
      :S.status==="nodays"?`Every day left before the deadline is skipped. Remove a skipped day or move the deadline.`
      :S.status==="missed"?`The deadline was ${fmtDate(g.deadline)}. ${fmtMin(a.rem)} still to go — move the date or keep going.`
      :S.eta?`At your current pace (last ${S.win} days) you'd finish on <b>${shortDate(S.eta)}</b> — ${S.eta<=g.deadline?`${daysBetween(S.eta,g.deadline)} days before`:`${daysBetween(g.deadline,S.eta)} days after`} the deadline.`
      :`Log some time for every part of the goal to see when you'd finish.`;
    const warn=done||S.status==="future"?[]:this.balance(g);
    const todayBits=done||S.status==="missed"||S.status==="future"||S.todaySkipped?[]:S.rows.filter(r=>r.rem).map(r=>`<span class="${r.todayLeft<1?"ok":""}">${esc(r.type==="*"?"Any":r.type)} <b class="num">${r.todayM}</b>/${Math.ceil(r.todayM+r.todayLeft)} min</span>`);
    return `<div class="goal st-${S.status}">
      <div class="g-head"><div class="g-title"><h3>${esc(g.name)}</h3><span class="pill pill-${S.status}">${ST_TXT[S.status]}</span></div>
       <div class="g-meta">${esc(g.subject)} · ${shortDate(g.start)} → ${shortDate(g.deadline)}${!done&&S.daysLeft?` · <b>${S.daysLeft}</b> study day${S.daysLeft>1?"s":""} left${S.skippedLeft?` <span class="muted">(${S.calLeft} days − ${S.skippedLeft} skipped)</span>`:""}`:""}</div>
       ${ro?"":`<div class="g-tools">${done?`<button class="btn sec sm" data-garch="${esc(g.id)}">Archive</button>`:S.status!=="missed"?`<button class="btn sec sm" data-gskip="${esc(g.id)}" title="Take days out of the plan">Skip days</button>`:""}<button class="ib" data-gedit="${esc(g.id)}" title="Edit goal">${G_ICON.edit}</button></div>`}</div>
      <div class="g-total"><div class="g-bar big"><div class="fill" style="width:${pct}%"></div>${S.elapsedDays&&!done?`<i class="exp" style="left:${ex}%" title="Where a steady pace would put you today"></i>`:""}</div>
       <div class="g-tnum"><span><span class="num"><b>${H(a.done)}</b> / ${H(a.tgt)} h</span>${a.rem&&S.daysLeft&&S.elapsedDays?` · <span class="g-allneed">need ${this.need(a.needDay)} overall</span>`:""}</span><span class="muted">${Math.round(pct)}%${S.elapsedDays&&!done?` · steady pace would be ${H(a.expected)} h by now`:""}</span></div></div>
      <div class="g-rows">${S.rows.map(r=>{const p=r.tgt?Math.min(100,r.done/r.tgt*100):0,e=r.tgt?Math.min(100,r.expected/r.tgt*100):0;
        const det=r.status==="done"?`✓ done${r.reached?" "+shortDate(r.reached):""}`:r.status==="future"||r.status==="missed"?"":r.status==="on"?`you average ${fmtMin(r.pace)}/day ✓`:`you average ${fmtMin(r.pace)}/day`;
        return `<div class="g-row"><div class="g-name">${esc(r.type==="*"?"Any type":r.type)}</div>
         <div class="g-bar"><div class="fill" style="width:${p}%"></div>${S.elapsedDays&&r.rem?`<i class="exp" style="left:${e}%"></i>`:""}</div>
         <div class="g-num num">${H(r.done)}/${+r.h} h</div>
         <div class="g-need" title="Per study day — skipped days are left out">${r.rem&&S.daysLeft?this.need(r.needDay):r.rem?"—":"✓"}</div>
         <div class="g-det st-${r.status}">${det}</div></div>`}).join("")}</div>
      ${todayBits.length?`<div class="g-today"><span class="muted">Today</span>${todayBits.join("")}</div>`:S.todaySkipped&&!done&&S.status!=="break"?`<div class="g-today g-break"><span>🌿 On a break today${S.brk&&S.brk.to>today()?` until ${shortDate(S.brk.to)}`:""} — not counted, and your plan is spread over the other days.</span></div>`:""}
      ${this.skipLine(g,S)}
      <div class="g-eta${S.status==="break"?" g-today g-break":""}">${etaTxt}</div>
      ${warn.map(w=>`<div class="g-warn">⚖ ${esc(w)}</div>`).join("")}
    </div>`;
  },
  skipLine(g,S){
    const L=(g.skips||[]).slice().sort((a,b)=>a.from<b.from?-1:1);if(!L.length)return "";
    const n=S.sk.size;const t=today();
    const f=r=>`${shortDate(r.from)}${r.to&&r.to!==r.from?"–"+shortDate(r.to):""}${r.reason?` <span class="muted">(${esc(r.reason)})</span>`:""}`;
    const now=L.filter(r=>r.from<=t&&(r.to||r.from)>=t),up=L.filter(r=>r.from>t),past=L.filter(r=>(r.to||r.from)<t);
    return `<div class="g-skips"><span><b>${n}</b> day${n>1?"s":""} skipped</span>${now.length?` · now: ${now.map(f).join(", ")}`:""}${up.length?` · coming up: ${up.slice(0,2).map(f).join(", ")}${up.length>2?` +${up.length-2}`:""}`:""}${past.length?` · <span class="muted">${past.reduce((x,r)=>x+daysBetween(r.from,r.to||r.from)+1,0)} already passed</span>`:""}${readOnly()?"":` <button class="linkb" data-gskip="${esc(g.id)}">manage</button>`}</div>`;
  },
  skipSheet(id){
    const g=this.list().find(x=>x.id===id);if(!g)return;const t=today();
    const def=t<g.start?g.start:t;const L=(g.skips||[]).map((r,i)=>({...r,i})).sort((a,b)=>a.from<b.from?-1:1);
    const n=x=>daysBetween(x.from,x.to||x.from)+1;
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">Skip days · ${esc(g.name)}</h2><span class="spacer"></span><button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button></div>
     <p class="sub">A skipped day is taken out of the plan as if it didn't exist: what's left is spread over your other days, and it doesn't lower your average. If you study on it anyway, it counts as a normal day. It also won't break your streak.</p>
     <div class="two"><div class="field"><label>From</label><input type="date" id="skFrom" value="${def}" min="${g.start}" max="${g.deadline}"></div>
      <div class="field"><label>To <span class="muted" style="font-weight:400">— same day if just one</span></label><input type="date" id="skTo" value="${def}" min="${g.start}" max="${g.deadline}"></div></div>
     <div class="field"><label>Reason <span class="muted" style="font-weight:400">— optional</span></label><input type="text" id="skWhy" maxlength="80" placeholder="e.g. Dentist, travel, sick"></div>
     <div class="g-prev" id="skPrev"></div>
     <div class="row" style="justify-content:flex-end;margin:10px 0 4px"><button class="btn" data-g="addSkip" data-id="${esc(g.id)}">Skip</button></div>
     ${L.length?`<h3 style="font-size:13px;margin:14px 0 6px">Skipped</h3><div class="qlist">${L.map(r=>`<div class="log"><div class="main"><div class="act">${shortDate(r.from)}${r.to&&r.to!==r.from?" – "+shortDate(r.to):""} <span class="muted">· ${n(r)} day${n(r)>1?"s":""}</span></div>${r.reason?`<div class="meta">${esc(r.reason)}</div>`:""}</div><button class="ib" data-gunskip="${r.i}" data-id="${esc(g.id)}" title="Remove — count this day again">${ICONS.del}</button></div>`).join("")}</div>`:""}`;
    $("#scrim").classList.add("open");this._skipFor=g.id;this.skipPreview();
  },
  skipPreview(){
    const el=$("#skPrev");if(!el)return;const g=this.list().find(x=>x.id===this._skipFor);if(!g)return;
    const a=$("#skFrom").value,b=$("#skTo").value||a;if(!a||b<a){el.innerHTML="";return}
    const S0=this.stats(g),S1=this.stats({...g,skips:[...(g.skips||[]),{from:a,to:b}]});
    if(!S0.all.rem){el.innerHTML="";return}
    el.innerHTML=S1.daysLeft?`With this: <b>${S1.daysLeft}</b> study days left instead of ${S0.daysLeft}, so you'd need <b>${fmtMin(S1.all.needDay)}/day</b> (${fmtMin(S1.all.needDay*7)}/week) instead of ${fmtMin(S0.all.needDay)}/day (${fmtMin(S0.all.needDay*7)}/week).`:`<span style="color:var(--danger)">That would leave no study days before the deadline.</span>`;
  },
  async addSkip(id){
    const a=$("#skFrom").value,b=$("#skTo").value||a,why=$("#skWhy").value.trim().slice(0,80);const g=this.list().find(x=>x.id===id);if(!g)return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(a))return toast("Pick a date");if(b<a)return toast("“To” is before “From”");
    if(a<g.start||b>g.deadline)return toast("Pick days between the goal's start and deadline");
    if(daysBetween(a,b)>90)return toast("Skip at most 90 days at a time");
    const skips=[...(g.skips||[]),{from:a,to:b,reason:why}];
    await this.patch(id,{skips});toast(a===b?"Day skipped":`${daysBetween(a,b)+1} days skipped`);this.skipSheet(id);
  },
  async unskip(id,i){const g=this.list().find(x=>x.id===id);if(!g)return;const skips=(g.skips||[]).filter((_,j)=>j!==i);await this.patch(id,{skips});this.skipSheet(id)},
  card(){
    const L=this.list();const ro=readOnly();const act=L.filter(g=>!g.archived);const arch=L.filter(g=>g.archived);
    if(!L.length&&ro)return "";
    if(!L.length)return `<div class="card goals-card empty-goals"><div><h2>Set a goal</h2><p class="sub" style="margin:2px 0 0">Name it whatever you like, pick the hours for each type, and see what you need per day, week or month.</p></div><button class="btn" data-g="newGoal">New goal</button></div>`;
    const u=this.unit();
    return `<div class="card goals-card"><div class="head"><div><h2>Goals</h2><p class="sub">What it takes to get there, and whether you're on track.</p></div>
      <div class="row"><div class="seg sm">${Object.keys(G_UNIT).map(k=>`<button class="${k===u?"on":""}" data-gunit="${k}">Per ${G_UNIT[k][0]}</button>`).join("")}</div>${ro?"":`<button class="btn sec sm" data-g="newGoal">+ Goal</button>`}</div></div>
      ${act.map(g=>this.cardOne(g)).join("")||'<div class="muted">No active goals.</div>'}
      ${arch.length?`<details class="g-arch"><summary>Completed & archived (${arch.length})</summary>${arch.map(g=>`<div class="log"><div class="main"><div class="act">${esc(g.name)}</div><div class="meta">${esc(g.subject)} · ${shortDate(g.start)} → ${shortDate(g.deadline)} · ${H(this.stats(g).all.done)} h</div></div>${ro?"":`<button class="btn sec sm" data-gunarch="${esc(g.id)}">Restore</button>`}</div>`).join("")}</details>`:""}
    </div>`;
  },
  editor(id){
    const g0=this.list().find(x=>x.id===id);
    const g=g0?{...g0}:{id:null,name:"",subject:focus(),start:today(),deadline:ymd(addDays(new Date(),90)),count:"since",rows:[]};
    const have={};g.rows.forEach(r=>have[r.type]=r.h);
    const subs=subjects();const list=[...subs,...LANGS.filter(x=>!subs.includes(x))];if(!list.includes(g.subject))list.unshift(g.subject);
    const tps=[...types(),"*"];
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">${g0?"Edit goal":"New goal"}</h2><span class="spacer"></span><button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button></div>
     <div class="field"><label>Goal name</label><input type="text" id="gName" maxlength="60" placeholder="Anything — e.g. Writing push before summer" value="${esc(g.name)}"></div>
     <div class="two"><div class="field"><label>Subject</label><select id="gSubj">${list.map(s=>`<option ${s===g.subject?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Deadline</label><input type="date" id="gEnd" value="${g.deadline}"></div></div>
     <div class="two"><div class="field"><label>Start <span class="muted" style="font-weight:400">— can be in the future</span></label><input type="date" id="gStart" value="${g.start}"></div>
      <label class="gchk"><input type="checkbox" id="gAll" ${g.count==="all"?"checked":""}> Also count hours I logged before that date</label></div>
     <div class="field"><label>Hours for each type <span class="muted" style="font-weight:400">— fill in only the ones you want</span></label>
      <div class="g-edit">${tps.map(t=>`<div class="ge-row"><span>${t==="*"?"Total (any type)":esc(t)}</span><input type="number" min="0" max="5000" step="0.5" inputmode="decimal" data-gh="${esc(t)}" value="${have[t]??""}" placeholder="h"><small class="muted num" data-gnow="${esc(t)}"></small></div>`).join("")}</div>
      <p class="muted" style="font-size:12.5px;margin:6px 0 0">Only logs with that exact type count toward a skill (Mixed counts only toward “Total”).</p></div>
     <div class="g-prev" id="gPrev"></div>
     <div class="row" style="justify-content:flex-end;margin-top:12px">${g0?`<button class="btn danger" data-gdel="${esc(g0.id)}" style="margin-right:auto">Delete</button>`:""}<button class="btn sec" data-act="close">Cancel</button><button class="btn" data-g="saveGoal" data-id="${esc(g0?g0.id:"")}">Save goal</button></div>`;
    $("#scrim").classList.add("open");this.preview();
  },
  readEditor(){
    const name=$("#gName").value.trim(),subject=$("#gSubj").value,deadline=$("#gEnd").value,start=$("#gStart").value||today();
    const rows=[...document.querySelectorAll("[data-gh]")].map(i=>({type:i.dataset.gh,h:parseFloat(i.value)})).filter(r=>r.h>0).map(r=>({type:r.type,h:Math.round(r.h*2)/2}));
    return {name,subject,deadline,start,count:$("#gAll").checked?"all":"since",rows};
  },
  preview(){
    const el=$("#gPrev");if(!el)return;const g=this.readEditor();
    document.querySelectorAll("[data-gnow]").forEach(s=>{const t=s.dataset.gnow;let m=0;for(const l of all().logs){if(l.s!==g.subject||(t!=="*"&&l.t!==t))continue;if(g.count!=="all"&&l.d<g.start)continue;m+=l.m}s.textContent=m?`${H(m)} h so far`:""});
    if(!g.rows.length||!/^\d{4}-\d{2}-\d{2}$/.test(g.deadline)){el.innerHTML="";return}
    if(g.deadline<today()){el.innerHTML='<span style="color:var(--danger)">The deadline is in the past.</span>';return}
    const old=this.list().find(x=>x.id===($("[data-g=saveGoal]")||{dataset:{}}).dataset.id);
    const S=this.stats({...g,id:"x",skips:old?old.skips:[]});const a=S.all;
    el.innerHTML=!S.daysLeft?"No study days left before that deadline.":a.rem?`${g.start>today()?`Starting ${fmtDate(g.start)}, you'd`:"You'd"} need about <b>${fmtMin(a.needDay)}/day</b> · <b>${fmtMin(a.needDay*7)}/week</b> · <b>${fmtMin(a.needDay*30.44)}/month</b> (${H(a.rem)} h over ${S.daysLeft} study days${S.skippedLeft?`, ${S.skippedLeft} skipped`:""}).`:"You've already done this much — pick bigger numbers or a new goal.";
  },
  async save(id){
    const g=this.readEditor();
    if(!g.name)return toast("Give the goal a name");if(!g.rows.length)return toast("Set hours for at least one type");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(g.deadline)||g.deadline<=today())return toast("Pick a deadline after today");
    if(g.start>g.deadline)return toast("The start date is after the deadline");
    const L=[...(Prefs.mine().goals||[])];const i=L.findIndex(x=>x.id===id);
    if(i>=0)L[i]={...L[i],...g};else L.push({...g,id:Date.now().toString(36),created:today()});
    closeModal();await Prefs.set({goals:L});toast(i>=0?"Goal updated":"Goal saved");
  },
  async patch(id,p){const L=[...(Prefs.mine().goals||[])].map(g=>g.id===id?{...g,...p}:g);await Prefs.set({goals:L})}
};

/* ---------- Setup card: consistency ---------- */
function consistencyCard(){
  const c=cons();const D=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],idx=[1,2,3,4,5,6,0];
  return `<div class="card" id="consCard"><h2>Consistency</h2><p class="sub">A small daily goal, a weekly target, rest days and streak freezes. Synced to your account.</p>
   <div class="two"><div class="field"><label>Daily goal (minutes, 0 = off)</label><input type="number" id="cDaily" min="0" max="600" value="${c.daily}" inputmode="numeric"></div>
    <div class="field"><label>Weekly target (hours, 0 = off)</label><input type="number" id="cWeekly" min="0" max="100" step="0.5" value="${c.weekly}" inputmode="decimal"></div></div>
   <div class="field"><label>Rest days <span class="muted" style="font-weight:400">— never break your streak</span></label><div class="chips">${idx.map((d,i)=>`<button class="qchip tpl ${c.rest.includes(d)?"on":""}" data-crest="${d}">${D[i]}</button>`).join("")}</div></div>
   <label class="gchk" style="margin:4px 0 12px"><input type="checkbox" id="cFreeze" ${c.freezes?"checked":""}> Streak freezes: earn one for every 7 days in a row (hold up to 2); a missed day uses one automatically</label>
   <button class="btn" data-g="saveCons">Save</button></div>`;
}

/* ---------- events ---------- */
document.addEventListener("click",async e=>{
  const qf=e.target.closest("[data-qfill]");if(qf){const q=Quick.list().find(x=>x.id===qf.dataset.qfill);if(!q)return;$("#fA").value=q.a;const sel=$("#fS");if(![...sel.options].some(o=>o.value===q.s))sel.insertAdjacentHTML("afterbegin",`<option>${esc(q.s)}</option>`);sel.value=q.s;$("#fT").value=q.t;if(modalState&&modalState.mode!=="manual"){modalState.mode="manual";renderModeBody(null)}const fm=$("#fM");if(fm)fm.value=q.m;document.querySelectorAll(".qchip.on").forEach(b=>b.classList.remove("on"));qf.classList.add("on");return}
  const q=e.target.closest("[data-qlog]");if(q){Quick.log(q.dataset.qlog);return}
  const qs=e.target.closest("[data-qsug]");if(qs){const x=Quick._sug[+qs.dataset.qsug];if(x){$("#qA").value=x.a;$("#qS").value=x.s;$("#qT").value=x.t;$("#qM").value=x.m;document.querySelectorAll(".qs.on").forEach(b=>b.classList.remove("on"));qs.classList.add("on");$("#qA").focus()}return}
  const qd=e.target.closest("[data-qdel]");if(qd){const L=[...Quick.list()];L.splice(+qd.dataset.qdel,1);await Prefs.set({quick:L},true);Quick.sheet();render();return}
  const qu=e.target.closest("[data-qup]");if(qu){const i=+qu.dataset.qup;if(!i)return;const L=[...Quick.list()];[L[i-1],L[i]]=[L[i],L[i-1]];await Prefs.set({quick:L},true);Quick.sheet();render();return}
  const gu=e.target.closest("[data-gunit]");if(gu){ui.gUnit=gu.dataset.gunit;render();return}
  const ge=e.target.closest("[data-gedit]");if(ge){Goals.editor(ge.dataset.gedit);return}
  const gs=e.target.closest("[data-gskip]");if(gs){Goals.skipSheet(gs.dataset.gskip);return}
  const gu2=e.target.closest("[data-gunskip]");if(gu2){Goals.unskip(gu2.dataset.id,+gu2.dataset.gunskip);return}
  const ga=e.target.closest("[data-garch]");if(ga){Goals.patch(ga.dataset.garch,{archived:true});toast("Goal archived");return}
  const gn=e.target.closest("[data-gunarch]");if(gn){Goals.patch(gn.dataset.gunarch,{archived:false});return}
  const gd=e.target.closest("[data-gdel]");if(gd){if(!gd.classList.contains("confirm")){gd.classList.add("confirm");gd.textContent="Delete goal?";return}
    const L=(Prefs.mine().goals||[]).filter(g=>g.id!==gd.dataset.gdel);closeModal();await Prefs.set({goals:L});toast("Goal deleted");return}
  const cr=e.target.closest("[data-crest]");if(cr){cr.classList.toggle("on");return}
  const a=e.target.closest("[data-g]");if(!a)return;const k=a.dataset.g;
  if(k==="quick")Quick.sheet();
  else if(k==="qadd"){const m=parseInt($("#qM").value,10);if(!(m>0&&m<=1440))return toast("Minutes must be 1–1440");
    const nq={id:Date.now().toString(36),a:$("#qA").value.trim().slice(0,300),s:$("#qS").value,t:$("#qT").value,m};
    if(Quick.list().some(x=>x.a===nq.a&&x.s===nq.s&&x.t===nq.t&&x.m===nq.m))return toast("You already have that one");
    await Prefs.set({quick:[...Quick.list(),nq]},true);Quick.sheet();render();toast("Quick log added")}
  else if(k==="newGoal")Goals.editor(null);
  else if(k==="addSkip")Goals.addSkip(a.dataset.id);
  else if(k==="saveGoal")Goals.save(a.dataset.id);
  else if(k==="saveCons"){const d=Math.max(0,Math.min(600,parseInt($("#cDaily").value,10)||0)),w=Math.max(0,Math.min(100,parseFloat($("#cWeekly").value)||0));
    const rest=[...document.querySelectorAll("[data-crest].on")].map(b=>+b.dataset.crest);
    await Prefs.set({daily:d,weekly:Math.round(w*2)/2,rest,freezes:$("#cFreeze").checked});toast("Saved")}
  else if(k==="toCons"){e.preventDefault();location.hash="#manage";setTimeout(()=>{const c=$("#consCard");if(c)c.scrollIntoView({behavior:"smooth",block:"start"})},80)}
});
document.addEventListener("input",e=>{if(e.target.closest&&e.target.closest("#modal")&&$("#gPrev"))Goals.preview();if(e.target.id==="skFrom"){const t=$("#skTo");if(t&&(!t.value||t.value<e.target.value))t.value=e.target.value}if(e.target.id==="skFrom"||e.target.id==="skTo")Goals.skipPreview()});
document.addEventListener("change",e=>{if(e.target.closest&&e.target.closest("#modal")&&$("#gPrev"))Goals.preview()});
