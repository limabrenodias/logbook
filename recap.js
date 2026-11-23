/* Recaps for a week, a month or a year — one engine, with a picture you can save or share.
   Opened from Insights → Recaps (and the banners on Home). Worked out from your logs; nothing extra is stored. */
"use strict";
const Recap=(()=>{
  const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
  const tl=()=>{try{return JSON.parse(localStorage.getItem("lb-timeline")||"[]")}catch(_){return []}};
  const MF=["January","February","March","April","May","June","July","August","September","October","November","December"];
  function bounds(kind,anchor){const d=parseD(anchor);
    if(kind==="week"){const a=weekStart(d);return {a:ymd(a),b:ymd(addDays(a,6)),pa:ymd(addDays(a,-7)),pb:ymd(addDays(a,-1))}}
    if(kind==="month"){const a=new Date(d.getFullYear(),d.getMonth(),1),b=new Date(d.getFullYear(),d.getMonth()+1,0),pa=new Date(d.getFullYear(),d.getMonth()-1,1),pb=new Date(d.getFullYear(),d.getMonth(),0);return {a:ymd(a),b:ymd(b),pa:ymd(pa),pb:ymd(pb)}}
    const y=d.getFullYear();return {a:`${y}-01-01`,b:`${y}-12-31`,pa:`${y-1}-01-01`,pb:`${y-1}-12-31`}}
  function label(kind,B){const a=parseD(B.a),b=parseD(B.b);
    if(kind==="week")return `${a.toLocaleDateString(undefined,{day:"numeric",month:"short"})} – ${b.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}`;
    if(kind==="month")return `${MF[a.getMonth()]} ${a.getFullYear()}`;return String(a.getFullYear())}
  // the last finished period, so a recap is complete when you open it
  function defaultAnchor(kind){const n=new Date();if(kind==="week")return ymd(addDays(weekStart(n),-7));if(kind==="month")return ymd(new Date(n.getFullYear(),n.getMonth()-1,1));
    return n.getMonth()===11&&n.getDate()>=15?ymd(n):`${n.getFullYear()-1}-06-01`}
  function shift(kind,anchor,dir){const d=parseD(anchor);if(kind==="week")return ymd(addDays(d,7*dir));if(kind==="month")return ymd(new Date(d.getFullYear(),d.getMonth()+dir,1));return `${d.getFullYear()+dir}-06-01`}

  function data(kind,anchor){
    const B=bounds(kind,anchor);const t=today();const end=B.b<t?B.b:t;
    const L=all().logs.filter(l=>l.d>=B.a&&l.d<=B.b),P=all().logs.filter(l=>l.d>=B.pa&&l.d<=B.pb);
    const tot=sum(L,l=>l.m),ptot=sum(P,l=>l.m);const days={};for(const l of L)days[l.d]=(days[l.d]||0)+l.m;
    const span=daysBetween(B.a,end)+1;const dk=Object.keys(days).sort();
    let run=0,best=0,prev=null;for(const k of dk){run=prev&&daysBetween(prev,k)===1?run+1:1;best=Math.max(best,run);prev=k}
    const bestDay=Object.entries(days).sort((a,b)=>b[1]-a[1])[0];
    const subs={};for(const l of L)subs[l.s]=(subs[l.s]||0)+l.m;const T={};for(const l of L)T[l.t]=(T[l.t]||0)+l.m;
    const acts={};for(const l of L){const k=(l.a||"").trim();if(k)acts[k]=(acts[k]||0)+l.m}
    let series;
    if(kind==="year"){const m=new Array(12).fill(0);for(const l of L)m[+l.d.slice(5,7)-1]+=l.m;series=m.map((v,i)=>({label:MONTHS[i],title:MF[i],v}))}
    else{series=[];for(let d=parseD(B.a);ymd(d)<=B.b;d=addDays(d,1)){const k=ymd(d);series.push({label:kind==="week"?d.toLocaleDateString(undefined,{weekday:"short"}):String(d.getDate()),title:fmtDate(k),v:days[k]||0})}}
    const ms=(typeof Rewards!=="undefined"&&!readOnly())?Rewards.milestones().filter(m=>m.done&&m.d&&m.d>=B.a&&m.d<=B.b):[];
    const f=tl().filter(x=>x.day>=B.a&&x.day<=B.b);
    const fin=(Lib.res||[]).filter(r=>r.finished_at&&r.finished_at>=B.a&&r.finished_at<=B.b);
    const auto=sum(L.filter(isAuto),l=>l.m);
    return {kind,B,label:label(kind,B),L,tot,ptot,days:dk.length,span,sessions:L.length,best,bestDay,subs:Object.entries(subs).sort((a,b)=>b[1]-a[1]),T,
      acts:Object.entries(acts).sort((a,b)=>b[1]-a[1]).slice(0,5),series,ms,focus:f.length,focusMin:sum(f,x=>x.min||0),fin,auto,avg:dk.length?tot/dk.length:0,complete:B.b<t};
  }

  function view(){
    const kind=ui.rcKind||"week";const anchor=ui.rcAt||defaultAnchor(kind);const D=data(kind,anchor);
    const canNext=shift(kind,anchor,1)<=today()&&bounds(kind,shift(kind,anchor,1)).a<=today();
    const delta=D.ptot?Math.round((D.tot-D.ptot)/D.ptot*100):null;const core=["Listening","Reading","Speaking","Writing"];
    const name={week:"week",month:"month",year:"year"}[kind];
    const tile=(k,v,d)=>`<div class="tile"><div class="k">${k}</div><div class="v num">${v}</div>${d?`<div class="d">${d}</div>`:""}</div>`;
    return roNote()+`<div class="row"><button class="linkb" data-insback>← Insights</button></div>
      <div class="page-head" style="margin-top:8px"><div><h1>Recap</h1><p class="sub">${D.complete?"":"So far · "}${esc(D.label)}</p></div>
        <div class="row"><div class="seg" role="tablist">${["week","month","year"].map(k=>`<button class="${k===kind?"on":""}" data-rck="${k}" role="tab" aria-selected="${k===kind}">${k[0].toUpperCase()+k.slice(1)}</button>`).join("")}</div>
        <button class="ib" data-rcnav="-1" aria-label="Previous ${name}" title="Previous ${name}">‹</button><button class="ib" data-rcnav="1" aria-label="Next ${name}" title="Next ${name}" ${canNext?"":"disabled"}>›</button></div></div>
      ${!D.L.length?`<div class="card empty-state">Nothing logged in this ${name}.</div>`:`
      <div class="card rc-hero"><div class="rc-hero-l"><div class="sub" style="margin:0">This ${name} you studied</div><div class="rc-big num">${H(D.tot)}<small> h</small></div>
        <div class="sub" style="margin:0">${D.days} of ${D.span} days · ${D.sessions} sessions${delta!=null?` · <span class="${delta>=0?"delta-up":"delta-down"}">${delta>=0?"▲":"▼"} ${Math.abs(delta)}%</span> vs the ${name} before`:""}</div></div>
        <button class="btn" data-rcshare>${navigator.share?"Share":"Save picture"}</button></div>
      <div class="grid g4 tiles">${tile("Longest run",D.best+" days")}${tile("Best day",dur(D.bestDay[1]),esc(shortDate(D.bestDay[0])))}${tile("Average study day",dur(Math.round(D.avg)))}${tile("By trackers",H(D.auto)+" h",D.tot?Math.round(D.auto/D.tot*100)+"% of your time":"")}</div>
      <div class="card sec"><h2>${kind==="year"?"Month by month":"Day by day"}</h2><div class="chart" id="rcChart"></div></div>
      <div class="grid g2"><div class="card"><h2>Subjects</h2>${ratioBars(D.subs.slice(0,6))}</div>
        <div class="card"><h2>Skills</h2>${ratioBars(core.map(k=>[k,D.T[k]||0]).filter(x=>x[1]>0))||`<p class="muted small">No skill-specific logs.</p>`}</div></div>
      <div class="grid g2">${D.acts.length?`<div class="card"><h2>What you did most</h2>${D.acts.map(([a,m],i)=>`<div class="kv"><span>${i+1}. ${esc(a)}</span><span class="spacer"></span><span class="num">${dur(m)}</span></div>`).join("")}</div>`:""}
        ${D.ms.length||D.fin.length||D.focus?`<div class="card"><h2>Highlights</h2>${D.ms.slice(0,6).map(m=>`<div class="kv"><span>🏅 ${esc(m.title)}</span><span class="spacer"></span>${coins(m.coins)}</div>`).join("")}
          ${D.fin.map(r=>`<div class="kv"><span>📚 Finished “${esc(r.title)}”</span></div>`).join("")}${D.focus?`<div class="kv"><span>🎯 ${D.focus} focus sessions</span><span class="spacer"></span><span class="num">${dur(D.focusMin)}</span></div>`:""}</div>`:""}</div>`}`;
  }
  function after(){const el=$("#rcChart");if(el){const D=data(ui.rcKind||"week",ui.rcAt||defaultAnchor(ui.rcKind||"week"));barChart(el,D.series)}}

  /* ---------- share picture (1080 × 1350) ---------- */
  async function picture(){
    const D=data(ui.rcKind||"week",ui.rcAt||defaultAnchor(ui.rcKind||"week"));const cs=getComputedStyle(document.documentElement);const v=n=>cs.getPropertyValue(n).trim()||"#888";
    try{await document.fonts.ready}catch(_){}
    const W=1080,Hh=1350,c=document.createElement("canvas");c.width=W;c.height=Hh;const g=c.getContext("2d");
    const bg=g.createLinearGradient(0,0,W,Hh);bg.addColorStop(0,v("--surface-2"));bg.addColorStop(1,v("--bg"));g.fillStyle=bg;g.fillRect(0,0,W,Hh);
    const glow=g.createRadialGradient(W*.85,0,0,W*.85,0,W*.8);glow.addColorStop(0,v("--accent")+"55");glow.addColorStop(1,"transparent");g.fillStyle=glow;g.fillRect(0,0,W,Hh);
    const F="'Plus Jakarta Sans', Inter, system-ui, sans-serif";const ink=v("--text-primary"),mut=v("--text-secondary"),acc=v("--accent");
    g.fillStyle=acc;roundRect(g,80,80,64,64,18);g.fill();g.strokeStyle=v("--accent-ink");g.lineWidth=7;g.lineCap="round";g.lineJoin="round";g.beginPath();g.moveTo(100,96);g.lineTo(100,128);g.lineTo(128,128);g.stroke();
    g.fillStyle=ink;g.font=`700 38px ${F}`;g.fillText("Logbook",162,126);
    g.fillStyle=mut;g.font=`600 34px ${F}`;g.fillText(({week:"My week",month:"My month",year:"My year"})[D.kind]+" · "+D.label,80,250);
    g.fillStyle=ink;g.font=`800 220px ${F}`;const big=H(D.tot);g.fillText(big,72,470);const bw=g.measureText(big).width;g.font=`700 72px ${F}`;g.fillStyle=mut;g.fillText("hours",92+bw,470);
    const stats=[["days",`${D.days}/${D.span}`],["sessions",String(D.sessions)],["longest run",`${D.best} d`]];
    stats.forEach(([k,val],i)=>{const x=80+i*320;g.fillStyle=ink;g.font=`800 64px ${F}`;g.fillText(val,x,610);g.fillStyle=mut;g.font=`600 30px ${F}`;g.fillText(k,x,656)});
    const top=D.subs.slice(0,4);const max=Math.max(1,...top.map(x=>x[1]));
    top.forEach(([s,m],i)=>{const y=760+i*112;g.fillStyle=ink;g.font=`700 38px ${F}`;g.fillText(s,80,y);g.fillStyle=mut;g.font=`600 32px ${F}`;const t=dur(m);g.fillText(t,W-80-g.measureText(t).width,y);
      g.fillStyle=v("--surface-3");roundRect(g,80,y+22,W-160,22,11);g.fill();const gr=g.createLinearGradient(80,0,W-80,0);gr.addColorStop(0,acc);gr.addColorStop(1,acc+"aa");g.fillStyle=gr;roundRect(g,80,y+22,Math.max(22,(W-160)*m/max),22,11);g.fill()});
    g.fillStyle=mut;g.font=`600 28px ${F}`;g.fillText(D.ms.length?`🏅 ${D.ms.length} milestone${D.ms.length>1?"s":""} unlocked`:"Every minute counts.",80,Hh-90);
    return new Promise(r=>c.toBlob(r,"image/png"));
  }
  function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
  async function share(){
    const blob=await picture();if(!blob)return toast("Couldn't make the picture");const kind=ui.rcKind||"week";
    const file=new File([blob],`logbook-${kind}-recap.png`,{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:"My Logbook recap"});return}catch(e){if(e&&e.name==="AbortError")return}}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast("Picture saved");
  }

  function open(kind,anchor){ui.rcKind=kind;ui.rcAt=anchor||defaultAnchor(kind);ui.insView="recap";if(location.hash!=="#insights")location.hash="#insights";else render();scrollTo(0,0)}
  document.addEventListener("click",e=>{
    const k=e.target.closest("[data-rck]");if(k){ui.rcKind=k.dataset.rck;ui.rcAt=defaultAnchor(ui.rcKind);render();return}
    const n=e.target.closest("[data-rcnav]");if(n&&!n.disabled){const kind=ui.rcKind||"week";ui.rcAt=shift(kind,ui.rcAt||defaultAnchor(kind),+n.dataset.rcnav);render();return}
    if(e.target.closest("[data-rcshare]"))share();
    const o=e.target.closest("[data-rcopen]");if(o)open(o.dataset.rcopen,o.dataset.at||null);
  });
  return {view,after,open,data,picture,defaultAnchor};
})();
