/* Weekly report (last full Monday–Sunday) and Year in review. Worked out from your logs,
   Focus history, goals, resources and scores — nothing extra is stored. */
"use strict";
const Report=(()=>{
  const sum=(arr,f)=>arr.reduce((a,x)=>a+f(x),0);
  const tl=()=>{try{return JSON.parse(localStorage.getItem("lb-timeline")||"[]")}catch(_){return []}};
  const pts=()=>(typeof Points!=="undefined"?Points.awards():[]);
  const weekKey=()=>ymd(addDays(weekStart(new Date()),-7));
  function range(a,b){return all().logs.filter(l=>l.d>=a&&l.d<=b)}
  function bySubject(L){const m={};for(const l of L)m[l.s]=(m[l.s]||0)+l.m;return Object.entries(m).sort((x,y)=>y[1]-x[1])}
  function weekly(){
    const a=weekKey(),b=ymd(addDays(parseD(a),6)),pa=ymd(addDays(parseD(a),-7)),pb=ymd(addDays(parseD(a),-1));
    const L=range(a,b),P=range(pa,pb);const tot=sum(L,l=>l.m),ptot=sum(P,l=>l.m);
    const days={};for(const l of L)days[l.d]=(days[l.d]||0)+l.m;const best=Object.entries(days).sort((x,y)=>y[1]-x[1])[0];
    const c=cons();const met=Object.values(days).filter(m=>c.daily&&m>=c.daily).length;
    const T={};for(const l of L)T[l.t]=(T[l.t]||0)+l.m;
    const f=tl().filter(x=>x.day>=a&&x.day<=b);const P2=pts().filter(h=>h.d>=a&&h.d<=b);
    const fin=Lib.res.filter(r=>r.finished_at&&r.finished_at>=a&&r.finished_at<=b);const sc=Lib.scores.filter(s=>s.d>=a&&s.d<=b);
    // hour milestones crossed this week
    const ms=[];const before={},after={};for(const l of all().logs){if(l.d<a)before[l.s]=(before[l.s]||0)+l.m;if(l.d<=b)after[l.s]=(after[l.s]||0)+l.m}
    for(const s in after){const h0=(before[s]||0)/60,h1=after[s]/60;const crossed=MILESTONES.filter(x=>x>h0&&x<=h1).pop();if(crossed)ms.push(`${s}: ${crossed} h`)}
    const goals=Goals.list().filter(g=>!g.archived).map(g=>({g,S:Goals.stats(g)}));
    const say=[];
    if(ptot)say.push(tot>=ptot?`${H(tot-ptot)} h more than the week before (${Math.round((tot-ptot)/ptot*100)}%).`:`${H(ptot-tot)} h less than the week before.`);
    if(best)say.push(`Best day: ${fmtDate(best[0])} with ${dur(best[1])}.`);
    if(c.daily)say.push(`Daily goal reached on ${met} of 7 days.`);
    const core=["Listening","Reading","Writing","Speaking"];const coreTot=sum(core,k=>T[k]||0);
    if(coreTot>=60){const low=core.filter(k=>(T[k]||0)/coreTot<.1);if(low.length)say.push(`Little ${low.join(" and ").toLowerCase()} this week.`)}
    ms.forEach(x=>say.push(`🎉 Milestone — ${x}.`));
    fin.forEach(r=>say.push(`📚 Finished “${r.title}”.`));
    for(const {g,S} of goals)if(S.status==="behind"||S.status==="close")say.push(`“${g.name}” is ${S.status==="behind"?"behind":"almost on track"} — ${fmtMin(S.all.needDay)}/day needed now.`);
    return {a,b,tot,ptot,days:Object.keys(days).length,subs:bySubject(L).slice(0,4),T,focus:f.length,focusMin:sum(f,x=>x.min||0),points:sum(P2,h=>h.total||0),fin,sc,say};
  }
  function card(){
    const W=weekly();if(!W.tot&&!W.ptot)return "";
    return `<div class="card wr"><div class="head"><div><h2>Weekly report</h2><p class="sub">${esc(shortDate(W.a))} – ${esc(shortDate(W.b))}</p></div></div>
      <div class="wr-grid"><div><div class="k">Studied</div><div class="v num">${H(W.tot)} h</div></div><div><div class="k">Active days</div><div class="v num">${W.days} / 7</div></div>
       <div><div class="k">Focus sessions</div><div class="v num">${W.focus}</div></div><div><div class="k">Focus points</div><div class="v num">${W.points}</div></div></div>
      ${W.subs.length?ratioBars(W.subs):""}
      ${W.say.length?`<ul>${W.say.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}</div>`;
  }
  function homeBanner(){
    if(readOnly())return "";const d=new Date();let seen="";try{seen=localStorage.getItem("lb-wr-seen")||""}catch(_){}
    const m=d.getMonth(),day=d.getDate();
    if((m===11&&day>=15)||(m===0&&day<=15)){const y=m===0?d.getFullYear()-1:d.getFullYear();let ys="";try{ys=localStorage.getItem("lb-yr-seen")||""}catch(_){}
      if(ys!==String(y)&&all().logs.some(l=>l.d.startsWith(String(y))))return `<div class="card wr home-banner"><div><b>Your ${y} in review is ready ✨</b><div class="sub" style="margin:2px 0 0">Hours, streaks, favourite resources and more.</div></div><div class="row"><button class="btn" data-yr="${y}">Open</button><button class="ib" data-yrhide="${y}" aria-label="Dismiss">×</button></div></div>`}
    if(d.getDay()>=1&&d.getDay()<=3&&seen!==weekKey()){const W=weekly();if(!W.tot)return "";
      return `<div class="card wr home-banner"><div><b>Your weekly report is ready</b><div class="sub" style="margin:2px 0 0">${H(W.tot)} h last week${W.ptot?` · ${W.tot>=W.ptot?"▲":"▼"} vs the week before`:""}</div></div><div class="row"><button class="btn" data-wr>See it</button><button class="ib" data-wrhide aria-label="Dismiss">×</button></div></div>`}
    return "";
  }
  /* ---------- Year in review ---------- */
  function years(){return [...new Set(all().logs.map(l=>l.d.slice(0,4)))].sort().reverse()}
  function year(y){
    y=String(y);const L=all().logs.filter(l=>l.d.startsWith(y));const PL=all().logs.filter(l=>l.d.startsWith(String(+y-1)));
    if(!L.length)return `<div class="card empty-state">No logs in ${esc(y)}.</div>`;
    const tot=sum(L,l=>l.m),ptot=sum(PL,l=>l.m);const days={};for(const l of L)days[l.d]=(days[l.d]||0)+l.m;const dk=Object.keys(days).sort();
    let run=0,best=0,prev=null;for(const k of dk){run=prev&&daysBetween(prev,k)===1?run+1:1;best=Math.max(best,run);prev=k}
    const bestDay=Object.entries(days).sort((a,b)=>b[1]-a[1])[0];
    const months=new Array(12).fill(0);for(const l of L)months[+l.d.slice(5,7)-1]+=l.m;const bm=months.indexOf(Math.max(...months));
    const wd=new Array(7).fill(0);for(const l of L)wd[(parseD(l.d).getDay()+6)%7]+=l.m;const W=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const acts={};for(const l of L){const k=(l.a||"").trim();if(k)acts[k]=(acts[k]||0)+l.m}const topA=Object.entries(acts).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const f=tl().filter(x=>(x.day||"").startsWith(y));const P=pts().filter(h=>(h.d||"").startsWith(y));
    const fin=Lib.res.filter(r=>(r.finished_at||"").startsWith(y));
    const ex={};for(const s of Lib.scores)if(s.d.startsWith(y)&&s.max_total)(ex[s.exam]=ex[s.exam]||[]).push(s);
    ui._yrMonths=months.map((v,i)=>({label:MONTHS[i],title:MONTHS[i]+" "+y,v}));
    const card=(k,v,d)=>`<div class="card"><div class="k muted" style="font-size:12.5px">${k}</div><div class="v num">${v}</div><div class="sub" style="margin:0">${d||""}</div></div>`;
    return `<div class="card wr yr-hero"><div class="sub">In ${esc(y)} you studied</div><div class="big num">${Math.round(tot/60)} h</div>
       <div class="sub">across <b>${dk.length}</b> days · ${L.length} sessions${ptot?` · ${tot>=ptot?"▲":"▼"} ${Math.abs(Math.round((tot-ptot)/ptot*100))}% vs ${+y-1}`:""}</div></div>
     <div class="yr-cards">
      ${card("Longest streak",best+" days")}${card("Best day",dur(bestDay[1]),esc(fmtDate(bestDay[0])))}
      ${card("Busiest month",MONTHS[bm],dur(months[bm]))}${card("Favourite day",W[wd.indexOf(Math.max(...wd))])}
      ${card("Average on a study day",dur(Math.round(tot/dk.length)))}${f.length?card("Focus sessions",f.length,`${H(sum(f,x=>x.min||0))} h · ${sum(P,h=>h.total||0)} points`):""}
     </div>
     <div class="grid g2" style="margin-top:12px"><div class="card"><h2>Subjects</h2>${ratioBars(bySubject(L).slice(0,6))}</div>
      <div class="card"><h2>Month by month</h2><div class="chart" id="yrMonths"></div></div></div>
     <div class="grid g2">${topA.length?`<div class="card"><h2>What you did most</h2>${topA.map(([a,m],i)=>`<div class="mo"><span>${i+1}. ${esc(a)}</span><span></span><span class="num">${H(m)} h</span></div>`).join("")}</div>`:""}
      ${fin.length||Object.keys(ex).length?`<div class="card"><h2>Finished & improved</h2>${fin.map(r=>`<div class="mo"><span>📚 ${esc(r.title)}</span><span></span><span class="muted">${esc(shortDate(r.finished_at))}</span></div>`).join("")}
        ${Object.entries(ex).map(([n,a])=>{a.sort((x,y)=>x.d<y.d?-1:1);const p0=a[0].total/a[0].max_total*100,p1=a[a.length-1].total/a[a.length-1].max_total*100;return `<div class="mo"><span>📝 ${esc(n)}</span><span></span><span class="num">${Math.round(p0)}% → <b>${Math.round(p1)}%</b></span></div>`}).join("")}</div>`:""}</div>`;
  }
  function yearView(){
    const ys=years();const y=ui.yr&&ys.includes(String(ui.yr))?String(ui.yr):ys[0];
    return roNote()+`<div class="row"><button class="linkb" data-insback>← Insights</button><span class="spacer"></span><select id="yrSel">${ys.map(x=>`<option ${x===y?"selected":""}>${x}</option>`).join("")}</select></div>
      <h1 style="margin-top:10px">${esc(y)} in review</h1>${year(y)}`;
  }
  function after(){const el=$("#yrMonths");if(el&&ui._yrMonths)barChart(el,ui._yrMonths)}
  document.addEventListener("click",e=>{
    const t=e.target.closest("[data-wr],[data-wrhide],[data-yr],[data-yrhide],[data-insback],[data-yropen]");if(!t)return;const d=t.dataset;
    if(d.wr!=null){try{localStorage.setItem("lb-wr-seen",weekKey())}catch(_){}ui.insView=null;location.hash="#insights";render()}
    else if(d.wrhide!=null){try{localStorage.setItem("lb-wr-seen",weekKey())}catch(_){}render()}
    else if(d.yr){try{localStorage.setItem("lb-yr-seen",d.yr)}catch(_){}ui.yr=d.yr;ui.insView="year";location.hash="#insights";render()}
    else if(d.yrhide){try{localStorage.setItem("lb-yr-seen",d.yrhide)}catch(_){}render()}
    else if(d.yropen!=null){ui.insView="year";render();scrollTo(0,0)}
    else if(d.insback!=null){ui.insView=null;render()}
  });
  document.addEventListener("change",e=>{if(e.target.id==="yrSel"){ui.yr=e.target.value;render()}});
  return {card,homeBanner,yearView,after,weekly};
})();
