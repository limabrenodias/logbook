/* Progress page: levels per language and skill, streaks (and how to save them), weekly challenges, milestones and coins. */
"use strict";
const COIN='<svg class="coin-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="var(--coin)" /><circle cx="12" cy="12" r="6.4" fill="none" stroke="var(--coin-ink)" stroke-width="1.6" opacity=".55"/><path d="M12 8.2v7.6M9.8 10.2h3.4a1.6 1.6 0 0 1 0 3.2H10.8" fill="none" stroke="var(--coin-ink)" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></svg>';
const coins=n=>`<span class="coins">${COIN}<b class="num">${Math.round(n).toLocaleString()}</b></span>`;
const Progress=(()=>{
  const pct=p=>Math.round(Math.max(0,Math.min(1,p))*100);
  const bar=(p,cls="")=>`<div class="bar ${cls}" role="progressbar" aria-valuenow="${pct(p)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct(p)}%"></i></div>`;
  const hrs=h=>h<10?h.toFixed(1)+" h":Math.round(h).toLocaleString()+" h";
  function eta(days){if(days==null)return "";if(days<=1)return "tomorrow at this pace";if(days<14)return `about ${days} days at your pace`;if(days<60)return `about ${Math.round(days/7)} weeks at your pace`;
    if(days<730)return `about ${Math.round(days/30)} months at your pace`;return `${(days/365).toFixed(1)} years at your pace`}

  function rescue(si){
    if(si.repairable){const r=si.repairable;const can=Rewards.balance()>=r.cost;
      return `<div class="callout warn"><div class="callout-i">🔥</div><div class="grow1"><b>Your ${r.before}-day streak broke on ${esc(shortDate(r.d))}.</b><div class="muted">Repair it within 2 days${si.makeup?`, or study ${dur(si.makeup.need)} today (make-up day)`:""}.</div></div>
        <button class="btn" data-pg="repair" ${can?"":"disabled"} title="${can?"":"Not enough coins yet"}">Repair · ${coins(r.cost)}</button></div>`}
    if(si.makeup){const m=si.makeup;return `<div class="callout"><div class="callout-i">⏳</div><div class="grow1"><b>You missed yesterday — make it up today.</b><div class="muted">Study ${dur(m.need)} today and your ${m.before}-day streak continues.</div>${bar(m.done/m.need)}</div><span class="num muted">${m.done}/${m.need} min</span></div>`}
    return "";
  }
  function langCard(x){
    const o=x.overall,next=o.next;const conf=x.conf.by;
    const save=Math.round((1-x.dist.f/Levels.fsi(x.lang))*100);
    const dist=x.dist.from&&save>0?`<p class="hint">You know ${esc(x.dist.from)}, so ${esc(x.lang)} takes about ${save}% fewer hours than it does for an English speaker.</p>`:"";
    return `<article class="card lvl" data-lang="${esc(x.lang)}">
      <header class="lvl-h"><div class="lvl-badge ${o.confirmed?"ok":""} ${o.i<0?"pre":""}"><b>${o.name}</b><small>${o.confirmed?"confirmed":"estimated"}</small></div>
        <div class="grow1"><h2>${esc(x.lang)}</h2><div class="muted small">${hrs(x.hours)} logged${x.start?` · started at ${x.start}`:""}${x.auto>=.1?` · ${hrs(x.auto)} by trackers, ${hrs(x.manual)} added by you`:""}</div>
        ${next?`<div class="lvl-next">${bar(o.p,"lg")}<div class="row small"><span><b class="num">${Math.ceil(o.need)} h</b> to ${next}</span><span class="spacer"></span><span class="muted">${esc(eta(x.eta))}</span></div></div>`:`<div class="small muted" style="margin-top:8px">Top of the scale — keep it alive.</div>`}
        ${conf?`<div class="small ok-t">✓ ${esc(conf.exam)} on ${esc(shortDate(conf.d))}: ${esc(String(conf.total))}/${esc(String(conf.max_total))}</div>`:""}</div></header>
      <div class="skills">${x.skills.map(s=>`<div class="skill"><span class="sk-n">${esc(s.name)}</span><span class="chip-l ${s.lv.confirmed?"ok":""}">${s.lv.name}</span>${bar(s.lv.p)}<span class="num small muted" title="${esc(s.name)} hours, plus a quarter of grammar, vocabulary and other study">${hrs(s.eff)}</span></div>`).join("")}</div>
      <details class="cando"><summary>What you can do now</summary>
        <p><b>Overall (${o.name}).</b> ${esc(Levels.can("overall",o.i))}</p>
        ${x.skills.filter(s=>Levels.SKILLS.some(k=>k[0]===s.name)).map(s=>`<p><b>${esc(s.name)} (${s.lv.name}).</b> ${esc(Levels.can(s.name,s.lv.i))}${s.lv.next?` <span class="muted">Next, ${s.lv.next}: ${esc(Levels.can(s.name,s.lv.i+1))}</span>`:""}</p>`).join("")}
        ${dist}
        <p class="muted small">Levels are estimates from your hours. A passed exam or mock in Logs → Scores (e.g. “DALF C1 mock”, 50% or more) confirms a level.</p>
      </details></article>`;
  }
  function msTile(m){const p=m.done?1:Math.min(1,m.cur/m.target);
    return `<div class="ms ${m.done?"done":""}"><div class="ms-t">${esc(m.title)}</div>${m.done?`<div class="small muted">${m.d&&/^\d{4}/.test(m.d)?esc(shortDate(m.d)):"Unlocked"}</div>`:bar(p)}<div class="ms-c">${coins(m.coins)}</div></div>`}

  function view(){
    if(readOnly())return `${roNote()}<div class="card"><p class="sub" style="margin:0">Progress is private to each person.</p></div>`;
    const si=streakInfo();const wk=Rewards.weekly();const L=Rewards.ledger();const ch=Rewards.challenges();const P=Levels.profile();
    const langs=Levels.studied().map(Levels.forLang);const ms=Rewards.milestones();
    const nextUp=ms.filter(m=>!m.done&&m.cur>0).sort((a,b)=>b.cur/b.target-a.cur/a.target).slice(0,6);
    const recent=ms.filter(m=>m.done&&m.d&&/^\d{4}/.test(m.d)).sort((a,b)=>b.d.localeCompare(a.d)).slice(0,6);
    const others=Object.entries(all().subjMin).filter(([s])=>!LANGS.includes(s)).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const per=Rewards.perSubject();
    return `<div class="page-head"><div><h1>Progress</h1><p class="sub">Levels, streaks, weekly challenges and coins.</p></div>
      <div class="row"><button class="pill-btn" data-pg="coins" title="How coins work">${coins(L.balance)}</button></div></div>
      ${rescue(si)}
      <div class="grid g4 tiles">
        <div class="tile"><div class="k">Daily streak</div><div class="v num">${si.cur}<small>days</small></div><div class="d">Best ${si.best} · ${si.freezes?`${"❄️".repeat(Math.min(3,si.freezes))} ${si.freezes} freeze${si.freezes>1?"s":""}`:"no freezes"}</div></div>
        <div class="tile"><div class="k">Weekly streak</div><div class="v num">${wk.cur}<small>wk</small></div><div class="d">${wk.thisWeek}/${wk.need} days this week</div></div>
        <div class="tile"><div class="k">Days studied</div><div class="v num">${si.days.toLocaleString()}</div><div class="d">Never resets</div></div>
        <div class="tile"><div class="k">Challenges</div><div class="v num">${ch.list.filter(c=>c.done).length}<small>/ 3</small></div><div class="d">${ch.earned?`+${ch.earned} coins so far`:"Resets on Monday"}</div></div>
      </div>
      <section class="sec"><div class="sec-h"><h2>Languages</h2><button class="linkb" data-pg="profile">${P.native.length?"Your languages":"Set up your languages"}</button></div>
        ${!P.native.length?`<div class="callout"><div class="callout-i">🧭</div><div class="grow1"><b>Tell Logbook which languages you already speak.</b><div class="muted">A language close to one you know takes fewer hours — Portuguese to Spanish is much shorter than English to Polish.</div></div><button class="btn" data-pg="profile">Set up</button></div>`:""}
        ${langs.length?langs.map(langCard).join(""):`<div class="card empty"><p>Log an hour in a language and its level appears here.</p></div>`}
      </section>
      <section class="sec"><div class="sec-h"><h2>Weekly challenges</h2><span class="muted small">${esc(shortDate(ch.ws))} – ${esc(shortDate(ch.we))} · sized to your last 4 weeks</span></div>
        <div class="card chal">${ch.list.map(c=>`<div class="ch ${c.done?"done":""}"><div class="ch-ic">${c.done?"✓":""}</div><div class="grow1"><div class="ch-t">${esc(c.title)}</div>${bar(c.p)}</div><div class="ch-r"><span class="num small muted">${c.unit==="min"?dur(c.cur):c.cur}${c.unit==="min"?"":" / "+c.target}</span>${coins(c.coins)}</div></div>`).join("")}
          <div class="ch bonus ${ch.bonus.done?"done":""}"><div class="ch-ic">★</div><div class="grow1"><div class="ch-t">All three this week</div></div><div class="ch-r">${coins(ch.bonus.coins)}</div></div></div>
      </section>
      <section class="sec"><div class="sec-h"><h2>Milestones</h2><button class="linkb" data-pg="allms">All milestones</button></div>
        ${nextUp.length?`<h3 class="mini-h">Next up</h3><div class="ms-grid">${nextUp.map(msTile).join("")}</div>`:""}
        ${recent.length?`<h3 class="mini-h">Recently unlocked</h3><div class="ms-grid">${recent.map(msTile).join("")}</div>`:""}
      </section>
      <section class="grid g2 sec">
        <div class="card"><div class="sec-h"><h2>Streaks by subject</h2><button class="linkb" data-pg="streakset">Streak settings</button></div>
          ${per.length?per.slice(0,8).map(x=>`<div class="kv"><span>${esc(x.s)}</span><span class="spacer"></span><span class="num">${x.cur} day${x.cur>1?"s":""}</span>${x.today?`<span class="sdot on" title="Done today"></span>`:`<span class="sdot" title="Not yet today"></span>`}</div>`).join(""):`<p class="muted small">Study two days in a row to start one.</p>`}
          <div class="row" style="margin-top:14px"><button class="btn sec" data-pg="freeze" ${si.freezes>=3?"disabled":""}>Buy a freeze · ${coins(100)}</button><span class="muted small">Hold up to 3</span></div></div>
        <div class="card"><h2>Other subjects</h2><p class="sub">Levels by hours for anything that isn't a language.</p>
          ${others.length?others.map(([s,m])=>{const h=m/60,lv=Levels.hourLevel(h);return `<div class="sub-lv"><div class="row"><b>${esc(s)}</b><span class="chip-l">${lv.name}</span><span class="spacer"></span><span class="num small muted">${hrs(h)}</span></div>${lv.next?`${bar(lv.p)}<div class="small muted">${Math.ceil(lv.need)} h to ${lv.next}</div>`:""}</div>`}).join(""):`<p class="muted small">Nothing yet.</p>`}</div>
      </section>`;
  }
  function after(){Rewards.load();if(typeof Lib!=="undefined"&&Lib.ok===null)Lib.load()}

  /* ---------- sheets ---------- */
  const close=`<button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button>`;
  const lvlOpts=(sel,withNone)=>`${withNone?`<option value="">${withNone}</option>`:""}${Levels.CEFR.map(c=>`<option ${c===sel?"selected":""}>${c}</option>`).join("")}`;
  function profileSheet(){const P=Levels.profile();const st=Levels.studied();
    const sp=P.speaks.length?P.speaks:[];
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">Your languages</h2><span class="spacer"></span>${close}</div>
      <p class="sub">Used to estimate how many hours each level takes. Nothing here is shared.</p>
      <div class="field"><label>Native language(s)</label><div id="pfNative" class="chips">${P.native.map(l=>`<button class="qchip on" data-pfrm="${esc(l)}">${esc(l)} ×</button>`).join("")}
        <select id="pfNatAdd" aria-label="Add a native language"><option value="">Add…</option>${LANGS.filter(l=>!P.native.includes(l)).map(l=>`<option>${l}</option>`).join("")}</select></div></div>
      <div class="field"><label>Other languages you speak</label><div id="pfSpeaks">${sp.map((k,i)=>`<div class="row pf-row"><select data-pfsl="${i}">${LANGS.map(l=>`<option ${l===k.lang?"selected":""}>${l}</option>`).join("")}</select><select data-pfsv="${i}">${lvlOpts(k.level)}</select><button class="ib" data-pfdel="${i}" aria-label="Remove">×</button></div>`).join("")}</div>
        <button class="linkb" data-pg="pfadd">+ Add a language</button></div>
      ${st.length?`<div class="field"><label>Your level when you started logging <span class="muted" style="font-weight:400">— so earlier study counts</span></label>${st.map(l=>`<div class="row pf-row"><span style="min-width:140px">${esc(l)}</span><select data-pfstart="${esc(l)}">${lvlOpts(P.start[l],"From zero")}</select></div>`).join("")}</div>`:""}
      <label class="gchk"><input type="checkbox" id="pfPron" ${P.pron?"checked":""}> Track pronunciation as its own skill (uses your Pronunciation logs)</label>
      <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn sec" data-act="close">Cancel</button><button class="btn" data-pg="pfsave">Save</button></div>`;
    $("#scrim").classList.add("open");
  }
  function readProfile(){
    const native=[...document.querySelectorAll("[data-pfrm]")].map(b=>b.dataset.pfrm);
    const speaks=[...document.querySelectorAll("[data-pfsl]")].map(s=>({lang:s.value,level:document.querySelector(`[data-pfsv="${s.dataset.pfsl}"]`).value})).filter(k=>!native.includes(k.lang));
    const start={};document.querySelectorAll("[data-pfstart]").forEach(s=>{if(s.value)start[s.dataset.pfstart]=s.value});
    return {native,speaks:speaks.filter((k,i,a)=>a.findIndex(x=>x.lang===k.lang)===i),start,pron:$("#pfPron").checked};
  }
  function coinsSheet(){const L=Rewards.ledger();const sp=(Prefs.get().coins||{}).spent||[];
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">Coins</h2><span class="spacer"></span>${close}</div>
      <div class="big-coins">${coins(L.balance)}</div>
      <p class="sub">You earn coins for real study, and spend them to protect your streak. They're worked out from your logs, so every device shows the same balance.</p>
      <div class="kv"><span>Milestones (hours, skills, streaks, levels)</span><span class="spacer"></span>${coins(L.parts.milestones)}</div>
      <div class="kv"><span>Weekly challenges</span><span class="spacer"></span>${coins(L.parts.challenges)}</div>
      <div class="kv"><span>Focus sessions</span><span class="spacer"></span>${coins(L.parts.focus)}</div>
      <div class="kv"><span>Clan goals</span><span class="spacer"></span>${coins(L.parts.clans)}</div>
      <div class="kv"><span>Kudos received</span><span class="spacer"></span>${coins(L.parts.kudos)}</div>
      <div class="kv"><span>Spent</span><span class="spacer"></span><span class="num">−${L.spent.toLocaleString()}</span></div>
      ${sp.length?`<h3 class="mini-h">Spent on</h3>${sp.slice(-8).reverse().map(x=>`<div class="kv small"><span>${x.kind==="repair"?"Streak repair ("+esc(shortDate(x.d))+")":"Streak freeze"}</span><span class="spacer"></span><span class="muted">${esc(shortDate(x.at.slice(0,10)))}</span><span class="num">−${x.cost}</span></div>`).join("")}`:""}
      <p class="muted small" style="margin-top:14px">Bigger milestones pay more: each step is worth about 1.5× the one before. Speaking and writing pay more than listening, because they're harder to build up.</p>`;
    $("#scrim").classList.add("open");
  }
  function allSheet(){const ms=Rewards.milestones();const groups=["Levels","Hours","Skills","Streak","Days"];
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">All milestones</h2><span class="spacer"></span>${close}</div>
      <p class="sub">${ms.filter(m=>m.done).length} of ${ms.length} unlocked.</p>
      ${groups.map(g=>{const L=ms.filter(m=>m.group===g);if(!L.length)return "";return `<h3 class="mini-h">${g}</h3><div class="ms-grid sm">${L.filter((m,i)=>m.done||i<1||L[i-1].done).slice(0,40).map(msTile).join("")}</div>`}).join("")}`;
    $("#scrim").classList.add("open");
  }
  function streakSheet(){const p=Prefs.get();
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">Streak settings</h2><span class="spacer"></span>${close}</div>
      <div class="field"><label>Minutes that keep the daily streak alive</label><input type="number" id="ssMin" min="1" max="120" value="${Math.max(1,+p.streakMin||1)}"><div class="small muted">Your daily goal stays separate — this is the bare minimum for a day to count.</div></div>
      <div class="field"><label>Days a week for the weekly streak</label><input type="number" id="ssWeek" min="1" max="7" value="${Math.max(1,Math.min(7,+p.weekDays||5))}"></div>
      <p class="small muted">Ways to keep a streak: rest days (Setup → Consistency), freezes (one for every 7 days in a row, or buy one), a make-up day (double your daily goal the day after a miss, once every 14 days), a repair with coins within 2 days, or a friend who saves it (each person can save one streak a month).</p>
      <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn" data-pg="ssave">Save</button></div>`;
    $("#scrim").classList.add("open");
  }

  document.addEventListener("click",async e=>{
    const rm=e.target.closest("[data-pfrm]");if(rm){rm.remove();return}
    const dl=e.target.closest("[data-pfdel]");if(dl){dl.closest(".pf-row").remove();return}
    const b=e.target.closest("[data-pg]");if(!b)return;const k=b.dataset.pg;
    if(k==="profile")profileSheet();
    else if(k==="coins")coinsSheet();
    else if(k==="allms")allSheet();
    else if(k==="streakset")streakSheet();
    else if(k==="repair")Rewards.repair();
    else if(k==="freeze")Rewards.buyFreeze();
    else if(k==="pfadd"){const box=$("#pfSpeaks");const i=Date.now();box.insertAdjacentHTML("beforeend",`<div class="row pf-row"><select data-pfsl="${i}">${LANGS.map(l=>`<option>${l}</option>`).join("")}</select><select data-pfsv="${i}">${lvlOpts("B2")}</select><button class="ib" data-pfdel="${i}" aria-label="Remove">×</button></div>`)}
    else if(k==="pfsave"){const v=readProfile();closeModal();await Prefs.set({levels:v});toast("Saved — your roadmap is updated")}
    else if(k==="ssave"){const m=Math.max(1,Math.min(120,parseInt($("#ssMin").value,10)||1)),w=Math.max(1,Math.min(7,parseInt($("#ssWeek").value,10)||5));closeModal();await Prefs.set({streakMin:m,weekDays:w});toast("Saved")}
  });
  document.addEventListener("change",e=>{if(e.target.id==="pfNatAdd"&&e.target.value){const l=e.target.value;e.target.insertAdjacentHTML("beforebegin",`<button class="qchip on" data-pfrm="${esc(l)}">${esc(l)} ×</button>`);[...e.target.options].find(o=>o.text===l)?.remove();e.target.value=""}});
  return {view,after,rescue};
})();
