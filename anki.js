/* Anki statistics card for Insights (sent by the Anki add-on once a day per deck). */
"use strict";
const AnkiStats=(()=>{
  let rows=null,forUser=null,loading=false,ok=true;
  async function load(){
    if(loading||!sb||!ok)return;loading=true;const uid=viewing;
    try{const {data,error}=await sb.from("anki_stats").select("d,deck,subject,data").eq("user_id",uid).gte("d",ymd(addDays(new Date(),-180))).order("d",{ascending:true});
      if(error){if(/does not exist|schema cache/i.test(error.message||""))ok=false;rows=[];return}
      rows=data;forUser=uid;if(route()==="insights")render()}finally{loading=false}
  }
  function spark(pts){
    if(pts.length<2)return "";const W=160,H=36;const lo=Math.min(...pts),hi=Math.max(...pts);const sp=Math.max(1,hi-lo);
    const d=pts.map((v,i)=>(i?"L":"M")+(i/(pts.length-1)*W).toFixed(1)+","+(H-3-(v-lo)/sp*(H-6)).toFixed(1)).join("");
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }
  function card(){
    if(forUser!==viewing){rows=null;forUser=viewing}
    if(rows===null){load();return ""}
    const ankiMin=all().logs.reduce((a,l)=>a+(l.src==="anki"&&l.d>=ymd(addDays(new Date(),-29))?l.m:0),0);
    if(!rows.length)return ankiMin?`<div class="card"><h2>Anki</h2><p class="sub">${H(ankiMin)} h of reviews in the last 30 days. Update the Anki add-on (v1.1) to also see mature cards and retention here.</p></div>`:"";
    const by={};for(const r of rows)(by[r.deck]=by[r.deck]||[]).push(r);
    const decks=Object.entries(by).map(([deck,L])=>{const last=L[L.length-1].data;const cut=ymd(addDays(new Date(),-30));const base=L.find(r=>r.d>=cut)||L[0];
      return {deck,subject:L[L.length-1].subject,last,delta:(last.mature||0)-(base.data.mature||0),since:base.d,spark:L.map(r=>r.data.mature||0)}}).sort((a,b)=>(b.last.mature||0)-(a.last.mature||0));
    return `<div class="card"><div class="head"><div><h2>Anki</h2><p class="sub">Mature cards = interval of 21 days or more — words you really know. ${ankiMin?`${H(ankiMin)} h of reviews in the last 30 days.`:""}</p></div></div>
      ${decks.map(x=>{const r=x.last;const ret=r.retention!=null?Math.round(r.retention*100):null;
        return `<div class="anki-d"><div class="anki-h"><b>${esc(x.deck.replace(/::/g," › "))}</b><span class="muted">${esc(x.subject||"")}</span></div>
         <div class="anki-g"><div><span class="k">Mature</span><span class="v num">${(r.mature||0).toLocaleString()}</span>${x.delta?`<span class="${x.delta>0?"delta-up":"delta-down"} num">${x.delta>0?"+":""}${x.delta} in 30 days</span>`:""}</div>
          <div><span class="k">Retention</span><span class="v num ${ret!=null&&ret<80?"delta-down":""}">${ret!=null?ret+"%":"—"}</span><span class="muted">mature, 30 days</span></div>
          <div><span class="k">Due tomorrow</span><span class="v num">${r.due_tomorrow??"—"}</span><span class="muted">${r.reviews_7d??0} reviews this week</span></div>
          <div class="anki-sp">${spark(x.spark)}<span class="muted">${(r.young||0)+(r.learning||0)} young · ${r.new||0} new${r.suspended?` · ${r.suspended} suspended`:""}</span></div></div>
         ${ret!=null&&ret<80&&r.retention_n>=50?`<div class="g-warn">⚖ Retention under 80% — you're forgetting a lot of mature cards. Fewer new cards a day usually helps.</div>`:""}</div>`}).join("")}</div>`;
  }
  return {card,reset(){rows=null}};
})();
