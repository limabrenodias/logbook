/* Insights — patterns worked out from your logs (and, for focus hours, the Focus timeline on this device). */
"use strict";
const CORE=["Listening","Reading","Writing","Speaking"];
const MILESTONES=[10,25,50,100,150,200,250,300,400,500,600,750,1000,1250,1500,2000,2500,3000,4000,5000,7500,10000];
const Insights={
  sum(logs,from,to,subj){let m=0;for(const l of logs){if(l.d<from)break;if(l.d>to)continue;if(subj&&subj!=="All"&&l.s!==subj)continue;m+=l.m}return m},
  pct(a,b){if(!b)return a?"new":"—";const p=Math.round((a-b)/b*100);return (p>=0?"+":"")+p+"%"},
  dir(a,b){return a>=b?"delta-up":"delta-down"},
  timeline(){try{return JSON.parse(localStorage.getItem("lb-timeline")||"[]")}catch(_){return []}},
  headlines(){
    const L=all().logs;const t=today(),d=n=>ymd(addDays(new Date(),-n));
    const w0=this.sum(L,d(6),t),w1=this.sum(L,d(13),d(7));
    const act=(a,b)=>{const s=new Set();for(const l of L){if(l.d<a)break;if(l.d<=b)s.add(l.d)}return s.size};
    const a0=act(d(29),t),a1=act(d(59),d(30));
    const map=byDate();let bestDay=null;for(const k in map)if(!bestDay||map[k].m>map[bestDay].m)bestDay=k;
    const wk={};for(const k in map){const w=ymd(weekStart(parseD(k)));wk[w]=(wk[w]||0)+map[k].m}let bestWk=null;for(const k in wk)if(!bestWk||wk[k]>wk[bestWk])bestWk=k;
    const y=new Date().getFullYear();const ly=ymd(new Date(y-1,new Date().getMonth(),new Date().getDate()));
    const ytd=this.sum(L,y+"-01-01",t),lytd=this.sum(L,(y-1)+"-01-01",ly);
    const si=streakInfo();
    const len=(a,b)=>{let m=0,n=0;for(const l of L){if(l.d<a)break;if(l.d<=b){m+=l.m;n++}}return n?m/n:0};const s0=len(d(29),t),s1=len(d(119),d(30));
    const card=(k,v,txt,cls="")=>`<div class="stat ins"><div class="k">${k}</div><div class="v num ${cls}">${v}</div><div class="d">${txt}</div></div>`;
    return `<div class="grid g4 ins-grid">
      ${card("Last 7 days",H(w0)+"<small>h</small>",`<span class="${this.dir(w0,w1)}">${this.pct(w0,w1)}</span> vs the 7 days before (${H(w1)} h)`)}
      ${card("Active days · 30",a0+"<small>/ 30</small>",`<span class="${this.dir(a0,a1)}">${a0>=a1?"▲":"▼"} ${Math.abs(a0-a1)}</span> vs the 30 days before`)}
      ${card("This year",H(ytd)+"<small>h</small>",lytd?`<span class="${this.dir(ytd,lytd)}">${ytd>=lytd?"+":"−"}${H(Math.abs(ytd-lytd))} h</span> vs this point last year`:"No logs at this point last year")}
      ${card("Streak",si.cur+"<small>days</small>",`Best ever: ${si.best} days${si.freezes?` · ❄ ${si.freezes}`:""}`)}
      ${card("Avg session · 30 days",Math.round(s0)+"<small>min</small>",s1?`<span class="${this.dir(s0,s1)}">${this.pct(s0,s1)}</span> vs the 3 months before`:"—")}
      ${card("Best day ever",bestDay?H(map[bestDay].m)+"<small>h</small>":"—",bestDay?esc(fmtDate(bestDay)):"")}
      ${card("Best week ever",bestWk?H(wk[bestWk])+"<small>h</small>":"—",bestWk?"Week of "+esc(shortDate(bestWk)):"")}
      ${card("Sessions · 30 days",String(L.filter(l=>l.d>=d(29)).length),`${L.filter(l=>l.d>=d(29)&&!MANUAL_SRC.includes(l.src)).length} added automatically`)}
    </div>`;
  },
  balance(subj){
    const cut=ymd(addDays(new Date(),-29));const m={};let tot=0;
    for(const l of all().logs){if(l.d<cut)break;if(subj!=="All"&&l.s!==subj)continue;m[l.t]=(m[l.t]||0)+l.m;tot+=l.m}
    const warn=[];const g=Goals.list().find(x=>!x.archived&&x.subject===subj);
    if(g)warn.push(...Goals.balance(g));
    else if(tot>=120){const core=CORE.reduce((a,k)=>a+(m[k]||0),0);if(core>=60)for(const k of CORE){const s=(m[k]||0)/core;if(s<.1)warn.push(`${k} is only ${Math.round(s*100)}% of your listening/reading/writing/speaking time this month.`)}}
    if(tot&&(m.Mixed||0)/tot>.4)warn.push(`${Math.round(m.Mixed/tot*100)}% is logged as Mixed, so the split above is only part of the picture.`);
    return `<div class="card"><h2>Skill balance</h2><p class="sub">${subj==="All"?"All subjects":esc(subj)} · last 30 days${g?` · compared with “${esc(g.name)}”`:""}</p>
      ${ratioBars(Object.entries(m).sort((a,b)=>b[1]-a[1]))}
      ${warn.map(w=>`<div class="g-warn">⚖ ${esc(w)}</div>`).join("")||(tot?`<div class="ins-ok">No skill is being left behind.</div>`:"")}</div>`;
  },
  weekday(subj){
    const cut=ymd(addDays(weekStart(new Date()),-7*12));const end=ymd(addDays(weekStart(new Date()),-1));const sums=[0,0,0,0,0,0,0];
    for(const l of all().logs){if(l.d<cut)break;if(l.d>end)continue;if(subj!=="All"&&l.s!==subj)continue;sums[(parseD(l.d).getDay()+6)%7]+=l.m}
    const N=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],F=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    this._wd=sums.map((v,i)=>({label:N[i],title:F[i]+" · average over 12 weeks",v:Math.round(v/12)}));
    const tot=sums.reduce((a,b)=>a+b,0);const hi=sums.indexOf(Math.max(...sums)),lo=sums.indexOf(Math.min(...sums));
    return `<div class="card"><h2>Your week</h2><p class="sub">Average per weekday over the last 12 full weeks.</p><div class="chart" id="insWd"></div>
      <p class="ins-say">${tot?`<b>${F[hi]}</b> is your strongest day (${dur(Math.round(sums[hi]/12))} on average); <b>${F[lo]}</b> is the lightest (${dur(Math.round(sums[lo]/12))}).`:"Not enough history yet."}</p></div>`;
  },
  hours(){
    const cut=Date.now()-60*864e5;const tl=this.timeline().filter(x=>x.segs&&x.segs[0]&&x.segs[0][0]>=cut);
    const h=new Array(24).fill(0);const byStart={};let full=0;
    for(const x of tl){if(x.full)full++;for(const [a,b] of x.segs){let t=a;while(t<b){const d=new Date(t);const next=new Date(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours()+1).getTime();const e=Math.min(b,next);h[d.getHours()]+=(e-t)/60000;t=e}}
      const sh=new Date(x.segs[0][0]).getHours();(byStart[sh]=byStart[sh]||[]).push(x.min)}
    if(!tl.length)return `<div class="card"><h2>Best focus hours</h2><p class="sub">From Focus sessions on this device.</p><div class="empty-state" style="padding:16px">Use <a href="#focus">Focus</a> for a few sessions and this shows when you concentrate best.</div></div>`;
    this._hr=h.map((v,i)=>({label:String(i),title:`${pad(i)}:00–${pad((i+1)%24)}:00`,v:Math.round(v)}));
    let bw=0,bs=0;for(let i=0;i<24;i++){const s=h[i]+h[(i+1)%24];if(s>bs){bs=s;bw=i}}
    let ls=null,la=0;for(const k in byStart){const a=byStart[k];if(a.length<2)continue;const avg=a.reduce((x,y)=>x+y,0)/a.length;if(avg>la){la=avg;ls=+k}}
    return `<div class="card"><h2>Best focus hours</h2><p class="sub">Focus sessions on this device, last 60 days (${tl.length} sessions).</p><div class="chart" id="insHr"></div>
      <p class="ins-say">You focus most between <b>${pad(bw)}:00 and ${pad((bw+2)%24)}:00</b>.${ls!=null?` Sessions you start around <b>${pad(ls)}:00</b> run longest (${Math.round(la)} min on average).`:""} You finished ${Math.round(full/tl.length*100)}% of them without stopping early.</p></div>`;
  },
  lengths(subj){
    const cut=ymd(addDays(new Date(),-89));const B=[["Under 15 min",0],["15–29 min",0],["30–59 min",0],["1–2 h",0],["2 h +",0]];
    for(const l of all().logs){if(l.d<cut)break;if(subj!=="All"&&l.s!==subj)continue;const i=l.m<15?0:l.m<30?1:l.m<60?2:l.m<120?3:4;B[i][1]+=l.m}
    const n=B.reduce((a,b)=>a+b[1],0);
    return `<div class="card"><h2>Session lengths</h2><p class="sub">Where your time went by session length · last 90 days.</p>${ratioBars(n?B:[])}</div>`;
  },
  momentum(){
    const L=all().logs;const d=n=>ymd(addDays(new Date(),-n));const a={},b={};
    for(const l of L){if(l.d<d(59))break;if(l.d>=d(29))a[l.s]=(a[l.s]||0)+l.m;else b[l.s]=(b[l.s]||0)+l.m}
    const ks=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>(a[k]||0)+(b[k]||0)>=30).sort((x,y)=>(a[y]||0)-(a[x]||0));
    return `<div class="card"><h2>Momentum</h2><p class="sub">Last 30 days vs the 30 before, by subject.</p>
      ${ks.map(k=>{const x=a[k]||0,y=b[k]||0;return `<div class="mo"><span>${esc(k)}</span><span class="num">${H(x)} h</span><span class="num ${this.dir(x,y)}">${x>=y?"▲":"▼"} ${this.pct(x,y)}</span></div>`}).join("")||'<div class="muted">Not enough recent logs.</div>'}</div>`;
  },
  milestones(){
    const c=all();const cut=ymd(addDays(new Date(),-29));const pace={};for(const l of c.logs){if(l.d<cut)break;pace[l.s]=(pace[l.s]||0)+l.m/30}
    const rows=Object.entries(c.subjMin).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([s,m])=>{const h=m/60;const nx=MILESTONES.find(x=>x>h);const pv=[...MILESTONES].reverse().find(x=>x<=h)||0;
      const p=nx?(h-pv)/(nx-pv)*100:100;const pc=pace[s]||0;const eta=nx&&pc>0?ymd(addDays(new Date(),Math.ceil((nx*60-m)/pc))):null;
      const passed=(()=>{if(!pv)return null;let cum=m;for(const l of c.logs){if(l.s!==s)continue;if(cum-l.m<pv*60)return l.d>=cut?l.d:null;cum-=l.m}return null})();
      return `<div class="ms"><div class="ms-h"><b>${esc(s)}</b><span class="num">${H(m)} h</span>${passed?`<span class="pill pill-done">🎉 ${pv} h reached ${esc(relDay(passed))}</span>`:""}</div>
        <div class="g-bar"><div class="fill" style="width:${p}%"></div></div>
        <div class="ms-f"><span>${pv} h</span><span>${nx?`next: <b>${nx} h</b> · ${eta?"about "+esc(shortDate(eta))+" at your current pace":"log more to see when"}`:"🏆"}</span></div></div>`}).join("");
    return `<div class="card"><h2>Milestones</h2><p class="sub">Hour milestones per subject, with an estimate from your last 30 days.</p>${rows||'<div class="muted">No logs yet.</div>'}</div>`;
  },
  goals(){
    const L=Goals.list().filter(g=>!g.archived);if(!L.length)return "";
    return `<div class="card"><div class="head"><div><h2>Goals</h2><p class="sub">Projection at your current pace.</p></div><a href="#home" style="font-size:13.5px">Details on Home →</a></div>
     ${L.map(g=>{const S=Goals.stats(g);return `<div class="ins-goal"><b>${esc(g.name)}</b><span class="pill pill-${S.status}">${ST_TXT[S.status]}</span><span class="muted">${S.status==="done"?"Completed":S.eta?`finish ≈ ${esc(shortDate(S.eta))} · deadline ${esc(shortDate(g.deadline))}`:`deadline ${esc(shortDate(g.deadline))}`}</span></div>`}).join("")}</div>`;
  },
  view(){
    if(ui.insView==="year")return Report.yearView();
    const c=all();
    if(!c.logs.length)return roNote()+`<h1>Insights</h1><div class="card empty-state">Log a few sessions and patterns will show up here.</div>`;
    if(!ui.insSubj)ui.insSubj=focus();const s=ui.insSubj;
    return roNote()+`<div class="row" style="align-items:flex-start"><div style="flex:1"><h1>Insights</h1><p class="sub">Patterns in how you study — what's working and what's slipping.</p></div><button class="btn sec" data-yropen>Year in review</button></div>
      ${Report.card()}${this.headlines()}${this.goals()}
      <div class="row" style="margin:6px 0 14px"><h2 style="margin:0">By subject</h2><span class="spacer"></span><select id="insSubj">${subjOptions(s,true)}</select></div>
      <div class="grid g2">${this.balance(s)}${this.weekday(s)}</div>
      <div class="grid g2">${this.hours()}${this.lengths(s)}</div>
      <div class="grid g2">${this.momentum()}${this.milestones()}</div>`;
  },
  after(){Report.after();const a=$("#insWd");if(a&&this._wd)barChart(a,this._wd);const b=$("#insHr");if(b&&this._hr)barChart(b,this._hr)}
};
document.addEventListener("change",e=>{if(e.target.id==="insSubj"){ui.insSubj=e.target.value;render()}});
