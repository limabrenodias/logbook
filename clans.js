/* Clans: small invite-only groups (up to 30) with a shared weekly and monthly goal in hours, kudos, and a clan streak.
   Everyone's minutes count toward the goal (or only one subject, if the clan picks one). Finishing a weekly goal gives
   every member who studied that week 60 coins, a monthly goal 200. Also here: saving a friend's streak.
   Needs database update 7. */
"use strict";
const Clans=(()=>{
  let mine=null,ok=null,loading=false,detail={},toSave=null;
  const pct=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0;
  const hh=m=>m>=600?Math.round(m/60)+" h":(m/60).toFixed(1).replace(/\.0$/,"")+" h";
  async function load(force){
    if(!sb||!me||loading||(mine&&!force))return;loading=true;
    try{const r=await sb.rpc("my_clans",{p_today:today()});if(r.error){ok=/function|schema cache|does not exist/i.test(r.error.message||"")?false:ok;mine=[]}else{ok=true;mine=r.data||[]}}
    finally{loading=false}
  }
  async function loadDetail(id){const r=await sb.rpc("clan_detail",{p_clan:id,p_today:today()});if(r.error){toast(r.error.message||"Couldn't open the clan");ui.clanId=null;return}detail[id]=r.data;if(route()==="friends")render()}
  async function loadSaves(){const r=await sb.rpc("friends_to_save",{p_today:today()});toSave=r.error?[]:(r.data||[]);if(route()==="friends")render()}
  function reset(){mine=null;ok=null;detail={};toSave=null}

  function goalBar(label,cur,goal,days){const p=pct(cur,goal);const done=goal>0&&cur>=goal;
    return `<div class="cg ${done?"done":""}"><div class="row"><span class="cg-l">${label}</span><span class="spacer"></span><span class="num"><b>${hh(cur)}</b> / ${hh(goal)}</span></div>
      <div class="bar lg ${done?"ok":""}"><i style="width:${p}%"></i></div><div class="small muted">${done?"Goal reached 🎉":goal?`${hh(goal-cur)} to go${days!=null?` · ${days} day${days===1?"":"s"} left`:""}`:"No goal set"}</div></div>`}
  function daysLeft(kind){const d=new Date();if(kind==="week")return 7-((d.getDay()+6)%7);return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-d.getDate()+1}
  function weekStreak(D){const w=D.weeks||[];let n=0;const cur=w[w.length-1];const met=x=>D.weekly_goal>0&&x.total>=D.weekly_goal;
    for(let i=w.length-2;i>=0;i--){if(met(w[i]))n++;else break}return n+(cur&&met(cur)?1:0)}

  function list(){
    if(ok===false)return `<div class="card"><h2>One more step in Supabase</h2><p class="sub">Clans need database update 7: open Supabase → SQL Editor → New query, paste <b>supabase-update-7.sql</b> and press Run.</p></div>`;
    if(mine===null){load().then(()=>route()==="friends"&&render());return `<div class="card empty-state">Loading…</div>`}
    return `<div class="clan-actions card"><div class="grow1"><h2>Clans</h2><p class="sub" style="margin:2px 0 0">Study as a team: a shared goal every week and month, kudos, and a clan streak. Invite-only, up to 30 people.</p></div>
        <div class="row"><input type="text" id="clanCode" placeholder="Invite code" maxlength="8" style="width:140px;text-transform:uppercase" aria-label="Invite code"><button class="btn sec" data-cl="join">Join</button><button class="btn" data-cl="new">Create a clan</button></div></div>
      ${mine.length?`<div class="clan-grid">${mine.map(c=>`<button class="clan-card" data-clopen="${c.id}">
          <div class="row"><span class="clan-tag">${esc(c.tag)}</span><b class="grow1 clan-name">${esc(c.name)}</b><span class="muted small">${c.members} member${c.members>1?"s":""}</span></div>
          ${c.subject?`<div class="small muted">${esc(c.subject)} only</div>`:""}
          ${goalBar("This week",c.week_min,c.weekly_goal,daysLeft("week"))}${goalBar("This month",c.month_min,c.monthly_goal,daysLeft("month"))}</button>`).join("")}</div>`
      :`<div class="card empty-state"><div style="font-size:30px">🛡️</div><p><b>No clan yet.</b></p><p class="sub" style="max-width:440px;margin:6px auto 0">Create one and share the invite code with friends, classmates or your language exchange group — or join with a code someone sent you.</p></div>`}`;
  }
  function view(){
    if(ui.clanId){const D=detail[ui.clanId];if(!D){loadDetail(ui.clanId);return `<div class="card empty-state">Loading…</div>`}return clanView(D)}
    return list();
  }
  function clanView(D){
    const wk=D.weeks[D.weeks.length-1]||{total:0},mo=D.months[D.months.length-1]||{total:0};const st=weekStreak(D);
    const maxW=Math.max(D.weekly_goal,...D.weeks.map(w=>w.total),1);const top=Math.max(...D.members.map(m=>m.week),1);
    const link=`${location.origin}${location.pathname}?clan=${D.code}`;
    return `<div class="row"><button class="linkb" data-cl="back">← All clans</button></div>
      <div class="clan-hero card"><div class="row"><span class="clan-tag lg">${esc(D.tag)}</span><div class="grow1"><h1 style="margin:0">${esc(D.name)}</h1>
        <div class="muted small">${D.members.length} member${D.members.length>1?"s":""}${D.subject?` · ${esc(D.subject)} only`:" · all subjects count"}${st?` · 🔥 ${st}-week streak`:""}</div></div>
        ${D.owner?`<button class="btn sec" data-cl="edit">Edit</button>`:""}</div>${D.about?`<p class="sub" style="margin:12px 0 0">${esc(D.about)}</p>`:""}
        <div class="clan-goals">${goalBar("This week",wk.total,D.weekly_goal,daysLeft("week"))}${goalBar("This month",mo.total,D.monthly_goal,daysLeft("month"))}</div>
        <p class="small muted" style="margin:10px 0 0">Reaching the weekly goal gives everyone who studied that week ${coins(60)}; the monthly goal ${coins(200)}.</p></div>
      <div class="grid g2"><div class="card"><div class="sec-h"><h2>This week</h2><span class="muted small">Kudos: one per person per day</span></div>
        ${D.members.map((m,i)=>`<div class="mem"><span class="rank num">${i+1}</span><span class="avatar sm">${esc(m.username[0].toUpperCase())}</span>
          <div class="grow1"><div class="row"><b>@${esc(m.username)}</b>${m.role==="owner"?`<span class="tag">owner</span>`:""}${m.today>0?`<span class="sdot on" title="Studied today"></span>`:""}</div>
            <div class="bar"><i style="width:${Math.round(m.week/top*100)}%"></i></div></div>
          <span class="num mem-h">${hh(m.week)}</span>
          ${m.id===D.me?`<span class="kudos-n" title="Kudos this week">👏 ${m.kudos_week}</span>`:`<button class="kudos ${m.kudos_from_me?"on":""}" data-kudos="${m.id}" ${m.kudos_from_me?"disabled":""} title="${m.kudos_from_me?"You gave kudos today":"Give kudos"}">👏 ${m.kudos_week}</button>`}
          ${D.owner&&m.id!==D.me?`<button class="ib" data-clkick="${m.id}" title="Remove from clan" aria-label="Remove @${esc(m.username)}">×</button>`:""}</div>`).join("")}</div>
        <div class="card"><h2>Last 12 weeks</h2><p class="sub">Team hours each week against the goal${D.weekly_goal?` (${hh(D.weekly_goal)})`:""}.</p>
          <div class="wkbars" role="img" aria-label="Weekly team hours for the last 12 weeks">${D.weeks.map(w=>`<div class="wkb ${D.weekly_goal&&w.total>=D.weekly_goal?"met":""}" title="${esc(shortDate(w.start))}: ${hh(w.total)} (you: ${hh(w.mine)})"><i style="height:${Math.round(w.total/maxW*100)}%"></i></div>`).join("")}
            ${D.weekly_goal?`<div class="wkgoal" style="bottom:${Math.round(D.weekly_goal/maxW*100)}%"></div>`:""}</div>
          <div class="row small muted" style="margin-top:8px"><span>${esc(shortDate(D.weeks[0].start))}</span><span class="spacer"></span><span>this week</span></div></div></div>
      <div class="card"><h2>Invite people</h2><p class="sub">Share the code or the link. Anyone with it can join while there's room.</p>
        <div class="row"><code class="invite">${esc(D.code)}</code><button class="btn sec" data-clcopy="${esc(link)}">Copy link</button>${D.owner?`<button class="linkb" data-cl="newcode">New code</button>`:""}<span class="spacer"></span><button class="linkb danger-t" data-cl="leave">Leave clan</button></div></div>`;
  }
  function editor(D){const subs=subjects();
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">${D?"Edit clan":"Create a clan"}</h2><span class="spacer"></span><button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button></div>
      <div class="two"><div class="field"><label>Name</label><input type="text" id="ceName" maxlength="40" value="${esc(D?D.name:"")}" placeholder="Les Polyglottes"></div>
        <div class="field"><label>Tag <span class="muted" style="font-weight:400">2–5 letters</span></label><input type="text" id="ceTag" maxlength="5" value="${esc(D?D.tag:"")}" placeholder="POLY" style="text-transform:uppercase"></div></div>
      <div class="field"><label>About <span class="muted" style="font-weight:400">— optional</span></label><input type="text" id="ceAbout" maxlength="200" value="${esc(D?D.about:"")}"></div>
      <div class="field"><label>What counts</label><select id="ceSubj"><option value="">Every subject</option>${subs.map(s=>`<option ${D&&D.subject===s?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="two"><div class="field"><label>Weekly goal (team hours)</label><input type="number" id="ceW" min="0" max="1500" step="1" value="${D?Math.round(D.weekly_goal/60):10}"></div>
        <div class="field"><label>Monthly goal (team hours)</label><input type="number" id="ceM" min="0" max="6000" step="1" value="${D?Math.round(D.monthly_goal/60):40}"></div></div>
      <div class="row"><span class="spacer"></span><button class="btn" data-cl="${D?"save":"create"}">${D?"Save":"Create clan"}</button></div>`;
    $("#scrim").classList.add("open");
  }
  function readEditor(){const name=$("#ceName").value.trim(),tag=$("#ceTag").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(name.length<2)return toast("Give the clan a name"),null;if(tag.length<2)return toast("The tag needs 2–5 letters or numbers"),null;
    return {p_name:name,p_tag:tag,p_about:$("#ceAbout").value.trim(),p_subject:$("#ceSubj").value,p_weekly:Math.max(0,Math.round((+$("#ceW").value||0)*60)),p_monthly:Math.max(0,Math.round((+$("#ceM").value||0)*60))}}

  /* friends who missed yesterday: save their streak (one save per person per month) */
  function saveCard(){
    if(toSave===null){toSave=[];loadSaves();return ""}
    if(!toSave.length)return "";
    return `<div class="callout"><div class="callout-i">🛟</div><div class="grow1"><b>${toSave.length===1?`@${esc(toSave[0].username)} missed yesterday`:`${toSave.length} friends missed yesterday`}.</b><div class="muted">You can save one friend's streak each month.</div></div>
      <div class="row">${toSave.slice(0,3).map(f=>`<button class="btn sec" data-save="${f.id}" ${f.can_save?"":"disabled title='You already saved a streak this month'"}>Save @${esc(f.username)}</button>`).join("")}</div></div>`;
  }

  document.addEventListener("click",async e=>{
    const o=e.target.closest("[data-clopen]");if(o){ui.clanId=o.dataset.clopen;render();loadDetail(ui.clanId);return}
    const k=e.target.closest("[data-kudos]");if(k){k.disabled=true;const r=await sb.rpc("clan_kudos_give",{p_clan:ui.clanId,p_to:k.dataset.kudos,p_today:today()});if(r.error)return toast(r.error.message);toast("Kudos sent 👏");loadDetail(ui.clanId);return}
    const kk=e.target.closest("[data-clkick]");if(kk){if(!kk.classList.contains("confirm")){kk.classList.add("confirm");kk.textContent="Remove?";return}
      const r=await sb.rpc("clan_kick",{p_clan:ui.clanId,p_user:kk.dataset.clkick});if(r.error)return toast(r.error.message);loadDetail(ui.clanId);return}
    const cp=e.target.closest("[data-clcopy]");if(cp){try{await navigator.clipboard.writeText(cp.dataset.clcopy);toast("Invite link copied")}catch(_){toast(cp.dataset.clcopy,8000)}return}
    const sv=e.target.closest("[data-save]");if(sv){sv.disabled=true;const y=ymd(addDays(new Date(),-1));const r=await sb.rpc("streak_save",{p_friend:sv.dataset.save,p_day:y});
      if(r.error){toast(r.error.message);sv.disabled=false;return}toast("Streak saved — they'll see it was you 🛟");loadSaves();return}
    const b=e.target.closest("[data-cl]");if(!b)return;const a=b.dataset.cl;
    if(a==="back"){ui.clanId=null;load(true).then(()=>render());render()}
    else if(a==="new")editor(null);
    else if(a==="edit")editor(detail[ui.clanId]);
    else if(a==="create"){const v=readEditor();if(!v)return;const r=await sb.rpc("clan_create",v);if(r.error)return toast(r.error.message);closeModal();ui.clanId=r.data;await load(true);loadDetail(r.data);toast("Clan created — share the invite code")}
    else if(a==="save"){const v=readEditor();if(!v)return;const r=await sb.rpc("clan_update",{p_clan:ui.clanId,...v});if(r.error)return toast(r.error.message);closeModal();loadDetail(ui.clanId);toast("Saved")}
    else if(a==="join"){const c=($("#clanCode").value||"").trim().toUpperCase();if(c.length<8)return toast("Invite codes have 8 characters");join(c)}
    else if(a==="newcode"){const r=await sb.rpc("clan_new_code",{p_clan:ui.clanId});if(r.error)return toast(r.error.message);loadDetail(ui.clanId);toast("New code made — the old one no longer works")}
    else if(a==="leave"){if(!b.classList.contains("confirm")){b.classList.add("confirm");b.textContent="Leave this clan?";return}
      const r=await sb.rpc("clan_leave",{p_clan:ui.clanId});if(r.error)return toast(r.error.message);delete detail[ui.clanId];ui.clanId=null;await load(true);render();toast("You left the clan")}
  });
  async function join(code){const r=await sb.rpc("clan_join",{p_code:code});if(r.error)return toast(r.error.message);ui.socTab="clans";ui.clanId=r.data;await load(true);loadDetail(r.data);if(location.hash!=="#friends")location.hash="#friends";else render();toast("Welcome to the clan 🛡️")}
  // invite links: …/logbook/?clan=CODE
  function launch(){const p=new URLSearchParams(location.search);const c=p.get("clan");if(!c)return;p.delete("clan");history.replaceState(null,"",location.pathname+(p.toString()?"?"+p:"")+location.hash);if(/^[A-Z0-9]{8}$/i.test(c))join(c.toUpperCase())}
  return {view,load,reset,saveCard,launch};
})();
