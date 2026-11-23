/* Friends, communities and study together.
   • Friends, feed, reactions, communities: Postgres functions in supabase-social.sql.
   • Live status: the presence table (friends see what you're doing in Focus right now).
   • Study rooms: Supabase Realtime channels (presence + broadcast) — nothing stored. */
"use strict";
const Social=(()=>{
  const EMO=["👏","🔥","💪","❤️","🎉"];
  let ok=null,friends=[],feed=[],toMe=[],boards=[],comm=null,commKey="",lastLoad=0,loading=null,presenceOk=true;
  let room=null,ch=null,members={},invite=null,roomStatus="",lastPub=0,lastKey="";
  const tab=()=>ui.socTab||"activity";
  const missing=e=>e&&(e.code==="PGRST202"||e.code==="42883"||e.code==="42P01"||/could not find the function|does not exist|schema cache/i.test(e.message||""));
  const ini=u=>esc((u||"?")[0].toUpperCase());
  function ago(iso){const s=(Date.now()-Date.parse(iso))/1000;if(s<60)return "just now";if(s<3600)return Math.round(s/60)+" min ago";if(s<86400)return Math.round(s/3600)+" h ago";const d=Math.round(s/86400);return d===1?"yesterday":d+" days ago"}
  function left(endIso){const ms=(typeof endIso==="number"?endIso:Date.parse(endIso))-Date.now();if(!(ms>0))return "";const m=Math.floor(ms/60000),s=Math.floor(ms/1000)%60;return pad(m)+":"+pad(s)}
  const prefsSocial=()=>({community:false,details:false,...(Prefs.mine().social||{})});

  /* ---------- data ---------- */
  async function load(force){
    if(!sb||!me)return;if(loading)return loading;if(!force&&Date.now()-lastLoad<15000)return;
    loading=(async()=>{try{
      lastLoad=Date.now();const r=await sb.rpc("friends_overview",{p_today:today()});
      if(r.error){ok=missing(r.error)?false:ok;console.warn(r.error);return}
      ok=true;friends=r.data||[];
      const [f,t]=await Promise.all([sb.rpc("friend_feed",{p_days:14}),sb.rpc("reactions_to_me",{p_days:14})]);
      feed=f.data||[];toMe=t.data||[];
    }finally{loading=null}})();
    return loading;
  }
  async function loadComm(){
    const s=ui.commSubj||focus(),n=ui.commDays||7;const key=s+"|"+n;
    const [b,c]=await Promise.all([sb.rpc("community_boards",{p_today:today()}),sb.rpc("community",{p_subject:s,p_days:n,p_today:today()})]);
    if(b.error||c.error){if(missing(b.error||c.error))ok=false;return}
    boards=b.data||[];comm=c.data;commKey=key;
  }
  function refreshView(){if(phase==="app"&&route()==="friends")render();else if(phase==="app"&&route()==="home")render()}

  /* ---------- live status (presence table + room presence) ---------- */
  function myState(){
    if(typeof Focus==="undefined")return {state:"idle"};const s=Focus.state();
    const state=s.phase==="focus"?(s.running?"focus":s.started?"paused":"idle"):(s.running?"break":"idle");
    return {state,s:s.s,t:s.t,endAt:s.running?s.endAt:null,remain:s.remain,tot:s.total};
  }
  function publish(force){
    if(phase!=="app"||!sb||!me)return;const st=myState();
    const key=[st.state,st.endAt,st.s,st.t,room].join("|");
    if(!force&&key===lastKey&&Date.now()-lastPub<55000)return;lastKey=key;lastPub=Date.now();
    if(presenceOk)sb.from("presence").upsert({user_id:me,state:st.state,subject:st.s||null,type:st.t||null,ends_at:st.endAt?new Date(st.endAt).toISOString():null,
      total_min:st.tot?Math.round(st.tot/60000):null,room,updated_at:new Date().toISOString()}).then(r=>{if(r.error&&missing(r.error))presenceOk=false});
    if(ch&&roomStatus==="SUBSCRIBED")ch.track({u:myProfile.username,...st,at:Date.now()});
  }
  let pubT=null;
  document.addEventListener("focus-state",()=>{clearTimeout(pubT);pubT=setTimeout(()=>publish(),1500)});
  setInterval(()=>{if(phase==="app"&&!document.hidden&&(myState().state!=="idle"||room))publish()},60000);
  setInterval(()=>{if(phase==="app"&&!document.hidden&&(route()==="friends"||route()==="home")&&ok!==false){load(true).then(()=>{if(route()==="friends"&&tab()!=="communities")render();else if(route()==="home")render()})}},45000);
  setInterval(()=>{document.querySelectorAll("[data-ends]").forEach(el=>{const t=left(+el.dataset.ends);el.textContent=t?t+" left":"finishing…"})},1000);

  /* ---------- study rooms ---------- */
  function code(){const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let s="";const r=crypto.getRandomValues(new Uint8Array(6));for(const x of r)s+=A[x%A.length];return s}
  // Rooms are private when database update 4 is in place: only people who joined with the code can
  // listen or send, and names come from the database, not from what a member's app says.
  let names={},namesAt=0,priv=false;
  async function refreshNames(){if(!priv||!room||Date.now()-namesAt<5000)return;namesAt=Date.now();
    const {data,error}=await sb.rpc("room_names",{p_code:room});if(!error&&data){names={};data.forEach(r=>names[r.user_id]=r.username);rerenderRoom()}}
  async function joinRoom(c,quiet,forcePublic){
    c=String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);if(c.length<4){toast("Room codes have 6 letters");return}
    leaveRoom(true);room=c;members={};names={};namesAt=0;roomStatus="connecting";try{localStorage.setItem("lb-room",c)}catch(_){}
    priv=false;
    if(!forcePublic){try{const r=await sb.rpc("join_room",{p_code:c});priv=!r.error;if(priv&&sb.realtime&&sb.realtime.setAuth)await sb.realtime.setAuth()}catch(_){priv=false}}
    if(room!==c)return;
    try{
      ch=sb.channel("lb-room-"+c,{config:{private:priv,presence:{key:me},broadcast:{self:false}}});
      ch.on("presence",{event:"sync"},()=>{members=ch.presenceState();refreshNames();rerenderRoom()})
        .on("broadcast",{event:"start"},({payload})=>{invite={...payload,u:names[payload.id]||(priv?"someone":payload.u)};showInvite();rerenderRoom()})
        .on("broadcast",{event:"wave"},({payload})=>toast(`👋 @${names[payload.id]||(priv?"someone":payload.u)} says hi`))
        .subscribe(async status=>{roomStatus=status;if(status==="SUBSCRIBED"){await ch.track({u:myProfile.username,...myState(),at:Date.now()});refreshNames()}
          else if((status==="CHANNEL_ERROR"||status==="TIMED_OUT")&&priv&&!forcePublic){toast("Private rooms aren't switched on in Supabase yet — using an open room",5000);return joinRoom(c,true,true)}
          else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")toast("Couldn't connect to the room — check Realtime is enabled in Supabase",5000);rerenderRoom()});
    }catch(e){console.error(e);roomStatus="CHANNEL_ERROR"}
    publish(true);if(!quiet)toast("Joined room "+c);rerenderRoom();
  }
  function leaveRoom(silent){if(ch){try{sb.removeChannel(ch)}catch(_){}ch=null}const was=room;room=null;members={};roomStatus="";if(!silent){try{localStorage.removeItem("lb-room")}catch(_){}publish(true);if(was)toast("Left the room");rerenderRoom()}}
  function rerenderRoom(){if(phase==="app"&&route()==="friends"&&tab()==="together")render()}
  function memberList(){return Object.entries(members).map(([k,v])=>({...v[v.length-1],id:k,u:names[k]||(priv?"…":v[v.length-1].u)})).sort((a,b)=>(a.id===me?-1:b.id===me?1:(a.u||"").localeCompare(b.u||"")))}
  function startTogether(min){
    if(!room)return;min=Math.max(5,Math.min(180,min|0));const endAt=Date.now()+min*60000;
    if(!Focus.joinAt(endAt))return;
    if(ch)ch.send({type:"broadcast",event:"start",payload:{u:myProfile.username,id:me,endAt,min}});
    toast(`Started ${min} min together`);location.hash="#focus";
  }
  function showInvite(){
    let b=document.getElementById("togetherBar");if(!b){b=document.createElement("div");b.id="togetherBar";document.body.appendChild(b)}
    if(!invite||invite.endAt-Date.now()<60000){b.style.display="none";return}
    b.innerHTML=`<span>🌿 <b>@${esc(invite.u)}</b> started a ${invite.min}-min focus</span><span class="num" data-ends="${invite.endAt}"></span><button class="btn sm" data-s="joinInvite">Join</button><button class="ib" data-s="hideInvite" aria-label="Dismiss">×</button>`;b.style.display="flex";
  }
  function joinAt(endAt){if(Focus.joinAt(endAt)){invite=null;showInvite();location.hash="#focus";return true}return false}

  /* ---------- views ---------- */
  function setupNeeded(){return `<div class="card"><h2>One more step in Supabase</h2><p class="sub">Friends, communities, live status and synced goals need the new database update.</p>
    <ol class="steps"><li>Open your project at supabase.com → <b>SQL Editor</b> → <b>New query</b>.</li><li>Paste everything from <b>supabase-social.sql</b> (in the GitHub repo) and press <b>Run</b>.</li><li>Come back and reload this page.</li></ol></div>`}
  function liveLine(f){
    if(!f.state||f.state==="idle")return "";const e=f.ends_at?Date.parse(f.ends_at):0;
    if(f.state==="focus"&&e>Date.now())return `<div class="live on"><span class="dot g"></span>Focusing · ${esc(f.subject||"")} · <span class="num" data-ends="${e}">${left(e)} left</span></div>`;
    if(f.state==="paused")return `<div class="live"><span class="dot y"></span>Paused · ${esc(f.subject||"")}</div>`;
    if(f.state==="break")return `<div class="live"><span class="dot b"></span>On a break</div>`;return "";
  }
  function joinBtn(f){const e=f.ends_at?Date.parse(f.ends_at):0;return f.state==="focus"&&e-Date.now()>60000?`<button class="btn sm" data-joinf="${esc(f.id)}">Join</button>`:""}
  function friendCard(f){
    return `<div class="fr"><div class="av">${ini(f.username)}</div><div class="fr-main"><div class="fr-n">@${esc(f.username)}${f.streak?`<span class="muted num"> · 🔥 ${f.streak}</span>`:""}</div>
      <div class="fr-s"><span class="num">${dur(f.today_min||0)}</span> today · <span class="num">${H(f.week_min||0)} h</span> this week${f.top_subject?` · mostly ${esc(f.top_subject)}`:""}</div>${liveLine(f)}</div>${joinBtn(f)}</div>`;
  }
  function homeCard(){
    if(readOnly()||ok!==true)return "";const fr=friends.filter(f=>f.status==="friend");if(!fr.length)return "";
    const req=friends.filter(f=>f.status==="incoming").length;
    return `<div class="card"><div class="head"><div><h2>Friends</h2><p class="sub">${req?`<b>${req}</b> friend request${req>1?"s":""} waiting · `:""}Who's studying today.</p></div><a href="#friends" style="font-size:13.5px">Activity →</a></div>
      <div class="fr-list">${fr.slice(0,6).map(friendCard).join("")}</div></div>`;
  }
  function viewActivity(){
    const fr=friends.filter(f=>f.status==="friend"),inc=friends.filter(f=>f.status==="incoming"),out=friends.filter(f=>f.status==="outgoing");
    let lastD=null,html="";
    const lim=ui.feedLim||30;
    for(const x of feed.slice(0,lim)){if(x.d!==lastD){if(lastD)html+="</div>";lastD=x.d;html+=`<div class="day"><h3><span>${esc(fmtDate(x.d))}</span></h3>`}
      const rs=x.reactions||{};
      html+=`<div class="fd"><div class="av sm">${ini(x.username)}</div><div class="fd-main"><div><b>@${esc(x.username)}</b> · ${esc(x.subject)} · ${esc(x.type)} · <b class="num">${dur(x.minutes)}</b>${MANUAL_SRC.includes(x.src)?"":`<span class="auto">${esc(x.src)}</span>`}</div>
        ${x.activity?`<div class="fd-a">${esc(x.activity)}</div>`:""}<div class="fd-r">${EMO.map(em=>`<button class="rx ${x.mine===em?"on":""}" data-react="${esc(x.log_id)}" data-emo="${em}">${em}${rs[em]?`<span class="num">${rs[em]}</span>`:""}</button>`).join("")}<span class="muted fd-t">${esc(ago(x.created_at))}</span></div></div></div>`}
    if(lastD)html+="</div>";if(feed.length>lim)html+=`<div style="text-align:center;margin-top:12px"><button class="btn sec" data-s="moreFeed">Show more (${feed.length-lim})</button></div>`;
    return `<div class="grid g2 soc-top">
      <div class="card"><h2>Add a friend</h2><p class="sub">They'll see your daily totals, what you're focusing on and your logs (descriptions only if you allow it in Setup).</p>
        <div class="row"><input type="text" id="frUser" placeholder="Their username" autocapitalize="none" style="flex:1;min-width:140px"><button class="btn" data-s="addFriend">Send request</button></div>
        ${inc.length?`<div class="req"><h3>Requests</h3>${inc.map(f=>`<div class="fr"><div class="av">${ini(f.username)}</div><div class="fr-main"><div class="fr-n">@${esc(f.username)}</div><div class="fr-s">wants to be friends</div></div><button class="btn sm" data-acc="${esc(f.id)}">Accept</button><button class="btn sec sm" data-dec="${esc(f.id)}">Decline</button><button class="ib" data-block="${esc(f.id)}" data-bname="${esc(f.username)}" title="Block @${esc(f.username)}">⛔</button></div>`).join("")}</div>`:""}
        ${out.length?`<p class="sub" style="margin:12px 0 0">Waiting for: ${out.map(f=>`@${esc(f.username)} <button class="linkb" data-dec="${esc(f.id)}">cancel</button>`).join(", ")}</p>`:""}</div>
      <div class="card"><h2>Your friends</h2><p class="sub">Live status updates every minute.</p>
        <div class="fr-list">${fr.map(f=>friendCard(f)+(f.room?`<div class="fr-room">In room <b>${esc(f.room)}</b> <button class="linkb" data-roomj="${esc(f.room)}">join room</button></div>`:"")).join("")||'<div class="muted">No friends yet — add someone by username.</div>'}</div>
        ${fr.length?`<div class="row" style="margin-top:8px"><span class="spacer"></span><button class="linkb" data-rmf>Remove a friend…</button></div><div id="rmBox"></div>`:""}</div></div>
      ${toMe.length?`<div class="card"><h2>Cheers for you</h2><div class="cheers">${toMe.slice(0,12).map(r=>`<span class="cheer">${r.emoji} <b>@${esc(r.username)}</b> on your ${dur(r.minutes)} of ${esc(r.subject)} <span class="muted">${esc(ago(r.created_at))}</span></span>`).join("")}</div></div>`:""}
      <div class="card"><h2>Activity</h2><p class="sub">Your friends' logs from the last two weeks.</p>${html||'<div class="empty-state" style="padding:18px">Nothing here yet.</div>'}</div>`;
  }
  function viewComm(){
    const ps=prefsSocial();const s=ui.commSubj||focus(),n=ui.commDays||7;
    if(commKey!==s+"|"+n){loadComm().then(()=>{if(route()==="friends"&&tab()==="communities")render()});}
    const subs=[...new Set([...boards.map(b=>b.subject),...subjects()])];const bmap={};boards.forEach(b=>bmap[b.subject]=b);
    const c=commKey===s+"|"+n?comm:null;const mine=c&&c.me;const bt=c?c.by_type||{}:{};
    const meT={};const cut=ymd(addDays(new Date(),-(n-1)));for(const l of all().logs){if(l.d<cut)break;if(l.s===s)meT[l.t]=(meT[l.t]||0)+l.m}
    const tt=Object.values(bt).reduce((a,b)=>a+b,0)||1,mt=Object.values(meT).reduce((a,b)=>a+b,0)||1;
    const typesU=[...new Set([...Object.keys(bt),...Object.keys(meT)])].sort((a,b)=>(bt[b]||0)-(bt[a]||0));
    return `${ps.community?"":`<div class="card opt"><div><h2>Join the community boards</h2><p class="sub" style="margin:0">Your username and hours per subject appear on the boards for everyone using this app. Descriptions are never shown. You can leave any time.</p></div><button class="btn" data-s="optIn">Join</button></div>`}
      <div class="row" style="margin-bottom:12px;flex-wrap:wrap"><div class="chips comm-subj">${subs.map(x=>`<button class="qchip tpl ${x===s?"on":""}" data-csubj="${esc(x)}">${esc(x)}${bmap[x]?` <span class="muted num">${bmap[x].members}</span>`:""}</button>`).join("")}</div><span class="spacer"></span>
        <div class="seg sm">${[[7,"7 days"],[30,"30 days"]].map(([d,l])=>`<button class="${d===n?"on":""}" data-cdays="${d}">${l}</button>`).join("")}</div></div>
      ${!c?'<div class="card empty-state">Loading…</div>':`
      <div class="grid g4" style="margin-bottom:16px">
        <div class="stat"><div class="k">${esc(s)} learners</div><div class="v num">${c.members}</div><div class="d">active in the last ${n} days${c.now?` · <b>${c.now}</b> focusing now`:""}</div></div>
        <div class="stat"><div class="k">Community hours</div><div class="v num">${H(c.total_min)}</div><div class="d">all members together</div></div>
        <div class="stat"><div class="k">Typical learner</div><div class="v num">${H(c.median_min)}<small>h</small></div><div class="d">median over ${n} days</div></div>
        <div class="stat"><div class="k">You</div><div class="v num">${mine?"#"+mine.rank:"—"}${mine?`<small>of ${c.members}</small>`:""}</div><div class="d">${mine?`${H(mine.minutes)} h · ${c.median_min?(mine.minutes>=c.median_min?"above":"below")+" the median":""}`:ps.community?`No ${esc(s)} logged in ${n} days`:"Join the boards to be ranked"}</div></div></div>
      <div class="grid g2"><div class="card"><h2>Leaderboard</h2><p class="sub">${esc(s)} · last ${n} days</p>
        ${(c.top||[]).map(r=>`<div class="lb ${r.me?"me":""}"><span class="lb-r num">${r.rank}</span><div class="av sm">${ini(r.username)}</div><span class="lb-n">@${esc(r.username)}${r.me?" (you)":""}</span><span class="num">${H(r.minutes)} h</span></div>`).join("")||'<div class="muted">Nobody on this board yet.</div>'}</div>
        <div class="card"><h2>How the time is spent</h2><p class="sub">Community vs you, by type · last ${n} days</p>
        ${typesU.map(k=>`<div class="cmp"><span>${esc(k)}</span><div class="cmp-b"><i style="width:${(bt[k]||0)/tt*100}%"></i><i class="you" style="width:${(meT[k]||0)/mt*100}%"></i></div><span class="num muted">${Math.round((bt[k]||0)/tt*100)}% · <b>${Math.round((meT[k]||0)/mt*100)}%</b></span></div>`).join("")||'<div class="muted">No data yet.</div>'}
        <div class="cmp-key"><span><i></i>Community</span><span><i class="you"></i>You</span></div></div></div>`}
      <p class="muted" style="font-size:12.5px">Boards only count people using this app who switched them on — right now that's a small group, so they grow as friends join.</p>`;
  }
  function viewTogether(){
    const fr=friends.filter(f=>f.status==="friend"&&f.state==="focus"&&f.ends_at&&Date.parse(f.ends_at)>Date.now());
    const now=fr.length?`<div class="card"><h2>Friends focusing now</h2><div class="fr-list">${fr.map(friendCard).join("")}</div><p class="muted" style="font-size:12.5px;margin:8px 0 0">Join starts your own focus timer so you both finish at the same moment.</p></div>`:"";
    if(!room)return `<div class="grid g2"><div class="card"><h2>Study together</h2><p class="sub">Open a room, share the code, and start sessions at the same time. Everyone keeps their own timer, subject and points.</p>
        <button class="btn" data-s="newRoom">Create a room</button>
        <div class="row" style="margin-top:14px"><input type="text" id="roomCode" placeholder="Room code" maxlength="8" autocapitalize="characters" style="text-transform:uppercase;flex:1;min-width:120px"><button class="btn sec" data-s="joinRoom">Join</button></div></div>${now||`<div class="card"><h2>Friends focusing now</h2><div class="muted">Nobody right now. When a friend starts a Focus session it shows up here.</div></div>`}</div>`;
    const ms=memberList();const f=typeof Focus!=="undefined"?Focus.state():{focusMin:25};
    return `<div class="grid g2"><div class="card room"><div class="head"><div><h2>Room <span class="num room-code">${esc(room)}</span></h2><p class="sub">${roomStatus==="SUBSCRIBED"?`${ms.length} here`:roomStatus==="connecting"?"Connecting…":"Not connected"}</p></div>
        <div class="row"><button class="btn sec sm" data-s="copyRoom">Copy invite link</button><button class="btn sec sm" data-s="leaveRoom">Leave</button></div></div>
        <div class="fr-list">${ms.map(m=>`<div class="fr"><div class="av">${ini(m.u)}</div><div class="fr-main"><div class="fr-n">@${esc(m.u)}${m.id===me?" (you)":""}</div>
          ${m.state==="focus"&&m.endAt?`<div class="live on"><span class="dot g"></span>Focusing · ${esc(m.s||"")} · <span class="num" data-ends="${m.endAt}">${left(m.endAt)}</span></div>`:m.state==="paused"?`<div class="live"><span class="dot y"></span>Paused</div>`:m.state==="break"?`<div class="live"><span class="dot b"></span>On a break</div>`:`<div class="fr-s">Ready</div>`}</div>
          ${m.id!==me&&m.state==="focus"&&m.endAt-Date.now()>60000?`<button class="btn sm" data-joinat="${m.endAt}">Join</button>`:""}</div>`).join("")||'<div class="muted">Just you so far — send the invite link.</div>'}</div>
        <div class="together"><label>Start together for <input type="number" id="togMin" min="5" max="180" value="${f.focusMin||25}" inputmode="numeric"> min</label><button class="btn" data-s="startTog">Start together</button><button class="btn sec" data-s="wave" title="Say hi">👋</button></div></div>${now}</div>`;
  }
  function view(){
    if(readOnly())return roNote()+`<h1>Friends</h1><div class="card empty-state"><p>Switch back to your own logbook to see your friends.</p><button class="btn" data-act="viewMe">Back to my logbook</button></div>`;
    if(ok===null&&!loading)load(true).then(()=>{if(route()==="friends")render()});
    const t=tab();const inc=friends.filter(f=>f.status==="incoming").length;
    const body=ok===false?setupNeeded():ok===null?'<div class="card empty-state">Loading…</div>':t==="communities"?viewComm():t==="together"?viewTogether():t==="clans"?Clans.view():Clans.saveCard()+viewActivity();
    return `<h1>Friends</h1><p class="sub">Study with friends, see what they're doing, and how your languages' communities are going.</p>
      <div class="seg" style="margin-bottom:16px">${[["activity","Activity"+(inc?` (${inc})`:"")],["clans","Clans"],["communities","Communities"],["together","Study together"+(room?" •":"")]].map(([k,l])=>`<button class="${k===t?"on":""}" data-soctab="${k}">${l}</button>`).join("")}</div>${body}`;
  }
  let blocked=null;
  function privacyCard(){
    const ps=prefsSocial();
    if(blocked===null&&ok!==false){blocked=[];sb.rpc("blocked_list").then(r=>{if(!r.error){blocked=r.data||[];if(route()==="manage"&&blocked.length)render()}})}
    return `<div class="card"><h2>Friends & privacy</h2><p class="sub">Friends always see your daily totals, subjects, types and live Focus status.</p>
      <label class="gchk"><input type="checkbox" data-priv="details" ${ps.details?"checked":""}> Show my log descriptions to friends</label>
      <label class="gchk"><input type="checkbox" data-priv="community" ${ps.community?"checked":""}> Appear on community boards (username + hours per subject)</label>
      ${blocked&&blocked.length?`<p class="sub" style="margin:10px 0 4px">Blocked: ${blocked.map(b=>`@${esc(b.username)} <button class="linkb" data-unblock="${esc(b.id)}">unblock</button>`).join(" · ")}</p>`:""}</div>`;
  }


  /* ---------- events ---------- */
  document.addEventListener("click",async e=>{
    const t=e.target.closest("[data-soctab]");if(t){ui.socTab=t.dataset.soctab;if(ui.socTab==="clans")ui.clanId=null;render();if(ui.socTab!=="communities")load(true).then(()=>route()==="friends"&&render());return}
    const rx=e.target.closest("[data-react]");if(rx){const x=feed.find(f=>f.log_id===rx.dataset.react);if(!x)return;const em=rx.dataset.emo;const next=x.mine===em?null:em;
      const rs={...(x.reactions||{})};if(x.mine)rs[x.mine]=Math.max(0,(rs[x.mine]||1)-1);if(next)rs[next]=(rs[next]||0)+1;Object.keys(rs).forEach(k=>{if(!rs[k])delete rs[k]});x.reactions=rs;x.mine=next;render();
      const {error}=await sb.rpc("react",{p_log:x.log_id,p_emoji:next});if(error){fail(error,"Couldn't react");load(true).then(render)}return}
    const ac=e.target.closest("[data-acc]");if(ac){const {error}=await sb.rpc("friend_respond",{p_user:ac.dataset.acc,p_accept:true});if(error)return fail(error);await load(true);render();toast("You're now friends");return}
    const dc=e.target.closest("[data-dec]");if(dc){const {error}=await sb.rpc("friend_respond",{p_user:dc.dataset.dec,p_accept:false});if(error)return fail(error);await load(true);render();return}
    const rm=e.target.closest("[data-rmf]");if(rm){const b=$("#rmBox");if(b)b.innerHTML=`<div class="row" style="margin-top:8px">${friends.filter(f=>f.status==="friend").map(f=>`<button class="btn sec sm" data-rmid="${esc(f.id)}">Remove @${esc(f.username)}</button><button class="btn sec sm" data-block="${esc(f.id)}" data-bname="${esc(f.username)}">Block</button>`).join("")}</div>`;return}
    const ri=e.target.closest("[data-rmid]");if(ri){if(!ri.classList.contains("confirm")){ri.classList.add("confirm");ri.textContent="Tap again to remove";return}const {error}=await sb.rpc("friend_respond",{p_user:ri.dataset.rmid,p_accept:false});if(error)return fail(error);await load(true);render();toast("Friend removed");return}
    const bl=e.target.closest("[data-block]");if(bl){if(!bl.classList.contains("confirm")){bl.classList.add("confirm");bl.textContent="Block @"+bl.dataset.bname+"?";return}
      const {error}=await sb.rpc("block_user",{p_user:bl.dataset.block});if(error)return fail(error,/function|schema cache/i.test(error.message)?"Run supabase-update-4.sql in Supabase first":"Couldn't block");
      await load(true);blocked=null;render();toast("@"+bl.dataset.bname+" is blocked — they can't find you or send requests");return}
    const ub=e.target.closest("[data-unblock]");if(ub){const {error}=await sb.from("blocks").delete().eq("blocker",me).eq("blocked",ub.dataset.unblock);if(error)return fail(error);blocked=null;render();toast("Unblocked");return}
    const jf=e.target.closest("[data-joinf]");if(jf){const f=friends.find(x=>x.id===jf.dataset.joinf);if(!f)return;if(f.room&&f.room!==room)joinRoom(f.room,true);joinAt(Date.parse(f.ends_at));return}
    const ja=e.target.closest("[data-joinat]");if(ja){joinAt(+ja.dataset.joinat);return}
    const rj=e.target.closest("[data-roomj]");if(rj){joinRoom(rj.dataset.roomj);ui.socTab="together";render();return}
    const cs=e.target.closest("[data-csubj]");if(cs){ui.commSubj=cs.dataset.csubj;render();return}
    const cd=e.target.closest("[data-cdays]");if(cd){ui.commDays=+cd.dataset.cdays;render();return}
    const a=e.target.closest("[data-s]");if(!a)return;const k=a.dataset.s;
    if(k==="addFriend"){const u=($("#frUser").value||"").trim().toLowerCase().replace(/^@/,"");if(!u)return;
      const {data,error}=await sb.rpc("friend_request",{p_username:u});if(error)return fail(error);
      toast(data==="rate_limited"?"That's a lot of requests today — try again tomorrow":data==="not_found"?"No user called @"+u:data==="self"?"That's you 🙂":data==="accepted"?"You're now friends with @"+u:"Request sent to @"+u);await load(true);render()}
    else if(k==="optIn"){await Prefs.set({social:{...prefsSocial(),community:true}},true);commKey="";render();toast("You're on the community boards")}
    else if(k==="newRoom"){joinRoom(code(),true);ui.socTab="together";render()}
    else if(k==="joinRoom"){joinRoom($("#roomCode").value);render()}
    else if(k==="leaveRoom")leaveRoom();
    else if(k==="copyRoom"){const u=location.origin+location.pathname+"?room="+room;navigator.clipboard.writeText(u).then(()=>toast("Invite link copied")).catch(()=>toast("Room code: "+room,6000))}
    else if(k==="startTog")startTogether(parseInt($("#togMin").value,10)||25);
    else if(k==="moreFeed"){ui.feedLim=(ui.feedLim||30)+50;render()}
    else if(k==="wave"){if(ch)ch.send({type:"broadcast",event:"wave",payload:{u:myProfile.username,id:me}});toast("👋 sent")}
    else if(k==="joinInvite"&&invite)joinAt(invite.endAt);
    else if(k==="hideInvite"){invite=null;showInvite()}
  });
  document.addEventListener("change",async e=>{const k=e.target.dataset&&e.target.dataset.priv;if(!k)return;await Prefs.set({social:{...prefsSocial(),[k]:e.target.checked}},true);commKey="";toast("Saved")});
  document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.id==="frUser"){e.preventDefault();document.querySelector('[data-s="addFriend"]').click()}if(e.key==="Enter"&&e.target.id==="roomCode"){e.preventDefault();document.querySelector('[data-s="joinRoom"]').click()}});

  function start(){
    load(true).then(refreshView);publish(true);
    const p=new URLSearchParams(location.search).get("room");
    if(p){history.replaceState(null,"",location.pathname+location.hash);joinRoom(p);ui.socTab="together";location.hash="#friends"}
    else{let r=null;try{r=localStorage.getItem("lb-room")}catch(_){}if(r)joinRoom(r,true)}
  }
  function stop(){blocked=null;leaveRoom(true);try{localStorage.removeItem("lb-room")}catch(_){}ok=null;friends=[];feed=[];toMe=[];boards=[];comm=null;commKey=""}
  return {view,homeCard,privacyCard,start,stop,load,publish,get ok(){return ok}};
})();
