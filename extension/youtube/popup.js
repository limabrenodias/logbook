const LANGS = ["French","Polish","German","Spanish","English","Portuguese","Italian","Dutch","Russian","Ukrainian","Czech","Swedish","Japanese","Korean","Chinese","Arabic","Turkish","Greek"];
const TYPES = ["Listening","Mixed","Reading","Speaking","Writing","Grammar","Vocabulary","Pronunciation"];
const DEFAULTS = { token: "", study: ["French","Polish"], auto: true, minMin: 2, type: "Listening", paused: false, lockedPause: true };
const $ = s => document.querySelector(s); const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const day = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const mm = s => { const m = Math.round(s/60); return m < 60 ? m + " min" : Math.floor(m/60) + " h " + String(m%60).padStart(2,"0"); };
let tab = "today";
async function st(){ const s = await chrome.storage.local.get(["settings","channels","sessions","status"]); return { settings:{...DEFAULTS,...(s.settings||{})}, channels:s.channels||{}, sessions:s.sessions||{}, status:s.status||{} }; }
const why = (r, s) => r.lang ? `<span class="ok">Logging as ${esc(r.lang)} · ${esc(r.type)}</span>${r.why==="detected"?` <span class="m">(detected)</span>`:""}`
  : r.why === "ignored" ? `<span class="m">Not logged — channel set to “never”</span>`
  : r.why === "not-studied" ? `<span class="m">Not logged — sounds like ${esc(r.det)}, which isn't one of your languages</span>`
  : `<span class="warn">Not logged — language unknown. Set this channel below.</span>`;
function chanSelect(id, rule){ const v = rule ? rule.lang : "";
  return `<select data-ch="${esc(id)}"><option value="">Automatic (spoken language)</option>${LANGS.map(l=>`<option ${v===l?"selected":""}>${l}</option>`).join("")}<option value="ignore" ${v==="ignore"?"selected":""}>Never log this channel</option></select>`; }
async function render(){
  const S = await st(); const t = day(); const err = S.status.error;
  $("#dot").className = "dot " + (!S.settings.token || err ? "bad" : "ok");
  $("#tabToday").classList.toggle("on", tab==="today"); $("#tabSet").classList.toggle("on", tab==="set");
  if (tab === "set") return renderSet(S);
  const today = Object.values(S.sessions).filter(s => s.date === t).sort((a,b)=>(b.updated||0)-(a.updated||0));
  const res = await Promise.all(today.map(s => chrome.runtime.sendMessage({type:"resolve", item:s})));
  const logged = today.reduce((a,s,i)=>a+(res[i].lang && s.sec>=S.settings.minMin*60 ? s.sec : 0),0);
  const cur = today[0] && Date.now() - (today[0].updated||0) < 30000 ? today[0] : null; const ci = cur ? 0 : -1;
  let h = "";
  if (!S.settings.token) h += `<div class="card"><b>Connect your Logbook</b><p class="m">Open Logbook → Setup → Connections, create a token called “YouTube on Brave”, copy it, and paste it in Settings here.</p><button class="b" id="goSet">Open settings</button></div>`;
  else if (err) h += `<div class="card bad">${err==="bad-token"?"The token was rejected — paste it again in Settings.":err==="offline"?"Couldn't reach Logbook — it will retry every minute.":"Sync problem ("+esc(err)+") — it will retry."}</div>`;
  if (S.settings.paused) h += `<div class="card warn">Tracking is paused. <button class="b s" id="resume">Resume</button></div>`;
  if (cur) h += `<div class="card"><h3>Now playing</h3><div class="t">${esc(cur.title||cur.vid)}</div><div class="m">${esc(cur.author||"Channel loading…")}${cur.shorts?" · Shorts":""}</div>
    <div class="row" style="margin-top:6px">${why(res[ci])}</div>
    ${cur.channelId?`<div class="row"><label>This channel</label>${chanSelect(cur.channelId, S.channels[cur.channelId])}</div>
    <div class="row"><label>Log as</label><select data-cht="${esc(cur.channelId)}">${TYPES.map(x=>`<option ${(S.channels[cur.channelId]?.type||S.settings.type)===x?"selected":""}>${x}</option>`).join("")}</select></div>`:""}</div>`;
  h += `<div class="card"><h3>Today</h3><div class="big">${mm(logged)}</div><div class="m">logged to your Logbook${S.status.lastOk?` · last sync ${new Date(S.status.lastOk).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:""}</div></div>`;
  if (today.length) h += `<div class="card"><h3>Watched today</h3>${today.map((s,i)=>{const r=res[i];const short=s.sec<S.settings.minMin*60;
    return `<div class="it"><div class="t" style="-webkit-line-clamp:1">${esc(s.title||s.vid)}</div><div class="n">${mm(s.sec)}</div><div class="st">${esc(s.author||"")}${s.author?" · ":""}${r.lang?(short?`<span class="m">${esc(r.lang)} — logs after ${S.settings.minMin} min</span>`:s.sentMin===Math.round(s.sec/60)||s.shorts?`<span class="ok">✓ ${esc(r.lang)}</span>`:`<span class="m">${esc(r.lang)} — sending…</span>`):r.why==="ignored"?'<span class="m">never logged</span>':r.why==="not-studied"?`<span class="m">${esc(r.det)} — not logged</span>`:'<span class="warn">language unknown</span>'}
      ${!r.lang&&s.channelId&&r.why!=="ignored"?`<div class="row">${chanSelect(s.channelId, S.channels[s.channelId])}</div>`:""}</div></div>`}).join("")}</div>`;
  else h += `<p class="m" style="text-align:center">Nothing watched today yet.</p>`;
  h += `<div class="row" style="justify-content:space-between"><button class="b s" id="sync">Sync now</button><button class="b s" id="pause">${S.settings.paused?"Resume tracking":"Pause tracking"}</button></div>`;
  $("#view").innerHTML = h;
}
function renderSet(S){
  const cs = Object.entries(S.channels); const names = {}; for (const s of Object.values(S.sessions)) if (s.channelId) names[s.channelId] = s.author;
  $("#view").innerHTML = `<div class="card"><h3>Connection</h3><p class="m">Logbook → Setup → Connections → create a token → Copy, then paste it here.</p>
    <div class="row"><input type="password" id="tok" placeholder="Paste token" value="${esc(S.settings.token)}"><button class="b" id="saveTok">Save</button></div></div>
   <div class="card"><h3>Languages I study</h3><div class="chips">${LANGS.map(l=>`<button class="chip ${S.settings.study.includes(l)?"on":""}" data-lang="${l}">${l}</button>`).join("")}</div>
    <label class="sw"><input type="checkbox" id="auto" ${S.settings.auto?"checked":""}> Log automatically when YouTube detects that the video is spoken in one of these (uses YouTube's automatic captions; channels you set below always win)</label></div>
   <div class="card"><h3>Rules</h3>
    <div class="row"><label>Log as</label><select id="type">${TYPES.map(x=>`<option ${S.settings.type===x?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="row"><label>Minimum</label><input type="number" id="minMin" min="1" max="30" value="${S.settings.minMin}" style="max-width:70px"><span class="m">minutes per video before it's logged</span></div>
    <label class="sw"><input type="checkbox" id="lockedPause" ${S.settings.lockedPause?"checked":""}> Don't count while the computer is locked</label></div>
   <div class="card"><h3>Channels (${cs.length})</h3>${cs.length?cs.map(([id,r])=>`<div class="it"><div class="t" style="-webkit-line-clamp:1">${esc(r.name||names[id]||id)}</div><div></div><div class="st">${chanSelect(id,r)}</div></div>`).join(""):`<p class="m">Channels you set from the Today tab appear here.</p>`}</div>
   <p class="m">Counts only real playing time: not paused, not muted, no ads. Speed doesn't matter. One log per video per day; Shorts are grouped into one log per day.</p>`;
}
document.addEventListener("click", async e => {
  const S = await st();
  if (e.target.id === "tabToday") { tab = "today"; return render(); }
  if (e.target.id === "tabSet" || e.target.id === "goSet") { tab = "set"; return render(); }
  if (e.target.id === "saveTok") { const token = $("#tok").value.trim(); await chrome.storage.local.set({ settings:{...S.settings, token} }); await chrome.runtime.sendMessage({type:"flush"}); tab="today"; return render(); }
  if (e.target.dataset.lang) { const l=e.target.dataset.lang; const study=S.settings.study.includes(l)?S.settings.study.filter(x=>x!==l):[...S.settings.study,l]; await chrome.storage.local.set({settings:{...S.settings,study}}); return render(); }
  if (e.target.id === "sync") { e.target.textContent="Syncing…"; await chrome.runtime.sendMessage({type:"flush"}); return render(); }
  if (e.target.id === "pause" || e.target.id === "resume") { await chrome.storage.local.set({settings:{...S.settings,paused:!S.settings.paused}}); return render(); }
});
document.addEventListener("change", async e => {
  const S = await st(); const el = e.target;
  if (el.dataset.ch) { const id=el.dataset.ch; const name=Object.values(S.sessions).find(s=>s.channelId===id)?.author||S.channels[id]?.name||"";
    const ch={...S.channels}; if(!el.value) delete ch[id]; else ch[id]={...(ch[id]||{}),lang:el.value,name}; await chrome.storage.local.set({channels:ch}); return render(); }
  if (el.dataset.cht) { const id=el.dataset.cht; const ch={...S.channels}; const name=Object.values(S.sessions).find(s=>s.channelId===id)?.author||""; ch[id]={...(ch[id]||{name}),type:el.value}; await chrome.storage.local.set({channels:ch}); return render(); }
  if (["auto","lockedPause"].includes(el.id)) { await chrome.storage.local.set({settings:{...S.settings,[el.id]:el.checked}}); return render(); }
  if (el.id === "type") await chrome.storage.local.set({settings:{...S.settings,type:el.value}});
  if (el.id === "minMin") await chrome.storage.local.set({settings:{...S.settings,minMin:Math.max(1,Math.min(30,parseInt(el.value,10)||2))}});
});
render(); setInterval(() => { if (tab === "today" && !document.activeElement?.matches("select,input")) render(); }, 3000);
