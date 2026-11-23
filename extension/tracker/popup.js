const LANGS = ["French","Polish","German","Spanish","English","Portuguese","Italian","Dutch","Russian","Ukrainian","Czech","Swedish","Japanese","Korean","Chinese","Arabic","Turkish","Greek"];
const TYPES = ["Listening","Reading","Writing","Speaking","Mixed","Grammar","Vocabulary","Pronunciation"];
const DEFAULT_IGNORE = ["mail.google.com","accounts.google.com","open.spotify.com","limabrenodias.github.io","localhost"];
const DEFAULTS = { token: "", study: ["French","Polish"], auto: true, minMin: 2, readIdle: 45, paused: false, lockedPause: true, words: true, track: { media: true, read: true, write: true }, ignore: DEFAULT_IGNORE };
const KIND = { m: ["▶︎", "Watching & listening"], r: ["📖", "Reading"], w: ["✍︎", "Writing"] };
const $ = s => document.querySelector(s); const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const day = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const mm = s => { const m = Math.round(Math.max(0, s)/60); return m < 60 ? m + " min" : Math.floor(m/60) + " h " + String(m%60).padStart(2,"0"); };
let tab = "today";
async function st(){ const s = await chrome.storage.local.get(["settings","rules","sessions","status","lastWord","words","wordsError"]); const set = {...DEFAULTS,...(s.settings||{})}; set.track = {...DEFAULTS.track,...(set.track||{})}; return { settings:set, rules:s.rules||{}, sessions:s.sessions||{}, status:s.status||{}, lastWord:s.lastWord||null, wordsWaiting:(s.words||[]).length, wordsError:s.wordsError||"" }; }
const label = x => x.kind === "r" || x.kind === "w" ? x.host : (x.title || x.key || x.host);
const sub = x => x.kind === "m" ? [x.author || x.show, x.host].filter(Boolean).join(" · ") : (x.title || "");
function why(r, x){
  if (r.lang) return `<span class="ok">Logging as ${esc(r.lang)} · ${esc(r.type)}</span>${r.why==="detected"?` <span class="m">(detected from ${esc(x.langSrc||"the page")})</span>`:""}`;
  if (r.why === "ignored" || r.why === "ignored-site") return `<span class="m">Not logged — ${r.why==="ignored"?"set to “never”":"this site is on your ignore list"}</span>`;
  if (r.why === "not-studied") return `<span class="m">Not logged — it's in ${esc(r.det)}, which isn't one of your languages</span>`;
  return `<span class="warn">Not logged — language unknown. Choose it below.</span>`;
}
function ruleSelect(key, rule){ const v = rule ? rule.lang : "";
  return `<select data-rule="${esc(key)}"><option value="">Automatic (detected language)</option>${LANGS.map(l=>`<option ${v===l?"selected":""}>${l}</option>`).join("")}<option value="ignore" ${v==="ignore"?"selected":""}>Never log</option></select>`; }
async function render(){
  const S = await st(); const t = day(); const err = S.status.error;
  $("#dot").className = "dot " + (!S.settings.token || err ? "bad" : "ok");
  $("#tabToday").classList.toggle("on", tab==="today"); $("#tabSet").classList.toggle("on", tab==="set");
  if (tab === "set") return renderSet(S);
  const [tabInfo] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [null]);
  const now = tabInfo ? await chrome.runtime.sendMessage({ type: "now", tabId: tabInfo.id }) : null;
  const all = await chrome.runtime.sendMessage({ type: "resolveAll" });
  const today = Object.entries(S.sessions).filter(([,s]) => s.date === t && s.sec > 0).map(([k,s]) => ({ k, s: { kind: "m", ...s }, ...(all[k] || { r: {} }) })).sort((a,b)=>(b.s.updated||0)-(a.s.updated||0));
  const min = S.settings.minMin * 60;
  const logged = today.reduce((a,x)=>a+(x.r.lang && x.s.sec>=min ? x.s.sec : 0),0);
  let h = "";
  if (!S.settings.token) h += `<div class="card"><b>Connect your Logbook</b><p class="m">Logbook → Setup → Connections → create a token (e.g. “Brave”), copy it, and paste it in Settings here.</p><button class="b" id="goSet">Open settings</button></div>`;
  else if (err) h += `<div class="card bad">${err==="bad-token"?"The token was rejected — paste it again in Settings.":err==="offline"?"Couldn't reach Logbook — it will retry every minute.":"Sync problem ("+esc(err)+") — it will retry."}</div>`;
  if (S.settings.paused) h += `<div class="card warn">Tracking is paused. <button class="b s" id="resume">Resume</button></div>`;
  if (now) { const x = { kind: "m", ...now.s }; const [k0, scope] = now.keys[0];
    h += `<div class="card"><h3>${KIND[x.kind][0]} ${KIND[x.kind][1]} now</h3><div class="t">${esc(label(x))}</div><div class="m">${esc(sub(x))}</div>
      <div class="row" style="margin-top:6px">${why(now.r, x)}</div>
      <div class="row"><label>Language for ${esc(scope)}</label>${ruleSelect(k0, S.rules[k0])}</div>
      <div class="row"><label>Log as</label><select data-rtype="${esc(k0)}">${TYPES.map(y=>`<option ${((S.rules[k0]||{}).type||({m:"Listening",r:"Reading",w:"Writing"})[x.kind])===y?"selected":""}>${y}</option>`).join("")}</select></div></div>`; }
  else h += `<p class="m" style="margin:2px 0 10px">Nothing counted in this tab right now.</p>`;
  h += `<div class="card"><h3>Today</h3><div class="big">${mm(logged)}</div><div class="m">logged to your Logbook${S.status.lastOk?` · last sync ${new Date(S.status.lastOk).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:""}</div></div>`;
  for (const kd of ["m","r","w"]) { const L = today.filter(x => x.s.kind === kd); if (!L.length) continue;
    h += `<div class="card"><h3>${KIND[kd][0]} ${KIND[kd][1]}</h3>${L.slice(0,25).map(x => { const r = x.r, s = x.s, short = s.sec < min;
      const stt = r.lang ? (short ? `<span class="m">${esc(r.lang)} — logs after ${S.settings.minMin} min</span>` : s.sentMin===Math.round(s.sec/60)||s.shorts ? `<span class="ok">✓ ${esc(r.lang)}</span>` : `<span class="m">${esc(r.lang)} — sending…</span>`)
        : r.why==="ignored"||r.why==="ignored-site" ? '<span class="m">never logged</span>' : r.why==="not-studied" ? `<span class="m">${esc(r.det)} — not logged</span>` : '<span class="warn">language unknown</span>';
      const k0 = x.keys && x.keys[0];
      return `<div class="it"><div class="t" style="-webkit-line-clamp:1">${esc(label(s))}</div><div class="n">${mm(s.sec)}</div><div class="st">${esc(sub(s))}${sub(s)?" · ":""}${stt}
        ${!r.lang&&k0&&r.why==="unknown"?`<div class="row">${ruleSelect(k0[0], S.rules[k0[0]])}</div>`:""}</div></div>`; }).join("")}</div>`; }
  h += `<div class="row" style="justify-content:space-between"><button class="b s" id="sync">Sync now</button><button class="b s" id="pause">${S.settings.paused?"Resume tracking":"Pause tracking"}</button></div>`;
  $("#view").innerHTML = h;
}
function renderSet(S){
  const rules = Object.entries(S.rules);
  const nice = k => k.startsWith("yt:") ? "YouTube channel" : k.startsWith("show:") ? "Show · " + k.slice(5).split("|")[0] : "Site";
  const name = (k, r) => r.name || (k.startsWith("site:") ? k.slice(5) : k.startsWith("show:") ? k.split("|").slice(1).join("|") : k.slice(3));
  $("#view").innerHTML = `<div class="card"><h3>Connection</h3><p class="m">Logbook → Setup → Connections → create a token → Copy, then paste it here.</p>
    <div class="row"><input type="password" id="tok" placeholder="Paste token" value="${esc(S.settings.token)}"><button class="b" id="saveTok">Save</button></div></div>
   <div class="card"><h3>Languages I study</h3><div class="chips">${LANGS.map(l=>`<button class="chip ${S.settings.study.includes(l)?"on":""}" data-lang="${l}">${l}</button>`).join("")}</div>
    <label class="sw"><input type="checkbox" id="auto" ${S.settings.auto?"checked":""}> Log automatically when what you watch, read or write is in one of these (detected on your computer — page text is never sent, except a word you save)</label></div>
   <div class="card"><h3>What to count</h3>
    <label class="sw"><input type="checkbox" data-track="media" ${S.settings.track.media?"checked":""}> <span><b>Watching & listening</b> — YouTube, Netflix, any video or audio that's really playing. Counts in background tabs too.</span></label>
    <label class="sw"><input type="checkbox" data-track="read" ${S.settings.track.read?"checked":""}> <span><b>Reading</b> — only while the page is in front and you've scrolled, moved or typed recently.</span></label>
    <label class="sw"><input type="checkbox" data-track="write" ${S.settings.track.write?"checked":""}> <span><b>Writing</b> — while you're typing in a text box (chats, emails, documents).</span></label>
    <div class="row"><label>Reading stops after</label><select id="readIdle">${[20,30,45,60,90,120].map(v=>`<option value="${v}" ${S.settings.readIdle==v?"selected":""}>${v} s without activity</option>`).join("")}</select></div>
    <div class="row"><label>Minimum</label><input type="number" id="minMin" min="1" max="30" value="${S.settings.minMin}" style="max-width:70px"><span class="m">minutes per video / site per day</span></div>
    <label class="sw"><input type="checkbox" id="lockedPause" ${S.settings.lockedPause?"checked":""}> Don't count while the computer is locked</label></div>
   <div class="card"><h3>Saved words</h3>
    <label class="sw"><input type="checkbox" id="words" ${S.settings.words!==false?"checked":""}> <span><b>Alt+click a word</b> (or select a word or phrase and press <b>Alt+W</b>) to save it with its sentence to Logbook → Logs → Words. Only words you save this way are sent.</span></label>
    ${S.lastWord?`<p class="m">Last saved: <b>${esc(S.lastWord.word)}</b> · ${esc(S.lastWord.lang)}${S.wordsWaiting?` · ${S.wordsWaiting} waiting to send`:""}</p>`:""}${S.wordsError?`<p class="warn">${esc(S.wordsError)}</p>`:""}</div>
   <div class="card"><h3>Never track these sites</h3><textarea id="ignore" rows="4" spellcheck="false">${esc((S.settings.ignore||[]).join("\n"))}</textarea><p class="m">One per line. Spotify is here because the Spotify tracker in Logbook already counts it.</p></div>
   <div class="card"><h3>Your choices (${rules.length})</h3>${rules.length?rules.map(([k,r])=>`<div class="it"><div class="t" style="-webkit-line-clamp:1">${esc(name(k,r))}</div><div class="m">${esc(nice(k))}</div><div class="st">${ruleSelect(k,r)}</div></div>`).join(""):`<p class="m">Choices you make from the Today tab appear here.</p>`}</div>
   <p class="m">Only real time counts: playing (not paused, muted or an ad), actively reading, or typing. Each second is counted once — writing beats reading and watching, which beat audio in a background tab.</p>`;
}
document.addEventListener("click", async e => {
  const S = await st();
  if (e.target.id === "tabToday") { tab = "today"; return render(); }
  if (e.target.id === "tabSet" || e.target.id === "goSet") { tab = "set"; return render(); }
  if (e.target.id === "saveTok") { await chrome.storage.local.set({ settings:{...S.settings, token:$("#tok").value.trim()} }); await chrome.runtime.sendMessage({type:"flush"}); tab="today"; return render(); }
  if (e.target.dataset.lang) { const l=e.target.dataset.lang; const study=S.settings.study.includes(l)?S.settings.study.filter(x=>x!==l):[...S.settings.study,l]; await chrome.storage.local.set({settings:{...S.settings,study}}); return render(); }
  if (e.target.id === "sync") { e.target.textContent="Syncing…"; await chrome.runtime.sendMessage({type:"flush"}); return render(); }
  if (e.target.id === "pause" || e.target.id === "resume") { await chrome.storage.local.set({settings:{...S.settings,paused:!S.settings.paused}}); return render(); }
});
document.addEventListener("change", async e => {
  const S = await st(); const el = e.target;
  if (el.dataset.rule) { const k=el.dataset.rule; const r={...S.rules}; const nameOf=Object.values(S.sessions).find(s=>("yt:"+s.channelId)===k)?.author;
    if(!el.value){if(r[k]&&r[k].type){r[k]={...r[k]};delete r[k].lang}else delete r[k]}else r[k]={...(r[k]||{}),lang:el.value,...(nameOf?{name:nameOf}:{})};
    await chrome.storage.local.set({rules:r}); return render(); }
  if (el.dataset.rtype) { const k=el.dataset.rtype; const r={...S.rules}; r[k]={...(r[k]||{}),type:el.value}; await chrome.storage.local.set({rules:r}); return render(); }
  if (el.dataset.track) { await chrome.storage.local.set({settings:{...S.settings,track:{...S.settings.track,[el.dataset.track]:el.checked}}}); return; }
  if (["auto","lockedPause","words"].includes(el.id)) { await chrome.storage.local.set({settings:{...S.settings,[el.id]:el.checked}}); return render(); }
  if (el.id === "readIdle") await chrome.storage.local.set({settings:{...S.settings,readIdle:+el.value}});
  if (el.id === "minMin") await chrome.storage.local.set({settings:{...S.settings,minMin:Math.max(1,Math.min(30,parseInt(el.value,10)||2))}});
  if (el.id === "ignore") await chrome.storage.local.set({settings:{...S.settings,ignore:el.value.split(/\s+/).map(x=>x.trim().replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/.*$/,"")).filter(Boolean)}});
});
render(); setInterval(() => { if (tab === "today" && !document.activeElement?.matches("select,input,textarea")) render(); }, 3000);
