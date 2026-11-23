// Logbook tracker — collects what every tab reports, makes sure each second is counted once
// (writing beats reading/watching in front, which beat listening in a background tab), decides the
// language, and sends one log per video / site / day to Logbook through the ingest function.
const SB_URL = "https://bhbvnjcyubwrnebgewmj.supabase.co";
const SB_KEY = "sb_publishable_VvI57sGerWzNx9HkWIExzA_w0fhKsJa";
const LANG = { fr: "French", pl: "Polish", de: "German", es: "Spanish", en: "English", pt: "Portuguese", it: "Italian", nl: "Dutch",
  ru: "Russian", uk: "Ukrainian", cs: "Czech", sv: "Swedish", no: "Norwegian", nb: "Norwegian", da: "Danish", fi: "Finnish", ja: "Japanese",
  ko: "Korean", zh: "Chinese", ar: "Arabic", tr: "Turkish", el: "Greek", hu: "Hungarian", ro: "Romanian", hi: "Hindi", he: "Hebrew", iw: "Hebrew", ca: "Catalan" };
const DEFAULT_IGNORE = ["mail.google.com", "accounts.google.com", "open.spotify.com", "limabrenodias.github.io", "localhost"];
const DEFAULTS = { token: "", study: ["French", "Polish"], auto: true, minMin: 2, readIdle: 45, paused: false, lockedPause: true,
  track: { media: true, read: true, write: true }, ignore: DEFAULT_IGNORE };
const TYPE = { m: "Listening", r: "Reading", w: "Writing" };

const get = async () => {
  const s = await chrome.storage.local.get(["settings", "rules", "channels", "sessions", "status"]);
  const rules = s.rules || {};
  // v1 stored YouTube channel choices in "channels" — keep them
  if (s.channels && !s.rulesMigrated) for (const [id, r] of Object.entries(s.channels)) if (!rules["yt:" + id]) rules["yt:" + id] = r;
  return { settings: { ...DEFAULTS, ...(s.settings || {}), track: { ...DEFAULTS.track, ...((s.settings || {}).track || {}) } }, rules, sessions: s.sessions || {}, status: s.status || {} };
};

// Which rule decides? Show > YouTube channel > site; otherwise the detected language if it's one you study.
function ruleKeys(x) {
  const k = [];
  if (x.kind === "m" && x.show) k.push(["show:" + x.host + "|" + x.show, "this show"]);
  if (x.kind === "m" && x.channelId) k.push(["yt:" + x.channelId, "this channel"]);
  k.push(["site:" + x.host, "this site"]);
  return k;
}
function resolve(x, settings, rules) {
  if (!x.kind) x.kind = "m";   // sessions from v1 were all YouTube
  if ((settings.ignore || []).some(d => x.host === d || (x.host || "").endsWith("." + d))) return { why: "ignored-site" };
  for (const [k] of ruleKeys(x)) {
    const r = rules[k];
    if (r && r.lang === "ignore") return { why: "ignored", rule: k };
    if (r && r.lang) return { lang: r.lang, type: r.type || TYPE[x.kind], why: "rule", rule: k };
  }
  const det = LANG[x.lang];
  const typeRule = ruleKeys(x).map(([k]) => rules[k]).find(r => r && r.type);
  if (settings.auto && det && settings.study.includes(det)) return { lang: det, type: (typeRule && typeRule.type) || TYPE[x.kind], why: "detected" };
  return { why: det ? "not-studied" : "unknown", det };
}

/* ---------- each second counted once ---------- */
const ledger = new Map();   // second → {prio, skey}   (last few minutes, in memory)
let idleState = "active";
chrome.idle.onStateChanged.addListener(s => { idleState = s; });
const lastByTab = {};
let lock = Promise.resolve();
const serial = fn => (lock = lock.then(fn, fn));

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === "claims") {
    serial(async () => {
      const st = await get();
      if (st.settings.paused || (st.settings.lockedPause && idleState === "locked")) return;
      const now = Math.floor(Date.now() / 1000);
      for (const it of msg.items) {
        const s = st.sessions[it.skey] || { date: it.date, kind: it.kind, sec: 0, sent: 0 };
        for (const f of ["host", "title", "author", "show", "channelId", "lang", "langSrc", "src", "key"]) if (it.meta && it.meta[f]) s[f] = it.meta[f];
        s.kind = it.kind; s.shorts = !!(it.meta && it.meta.shorts); s.updated = Date.now();
        for (let t = Math.max(it.from, now - 600); t <= Math.min(it.to, now + 5); t++) {
          const cur = ledger.get(t);
          if (!cur) { ledger.set(t, { prio: it.prio, skey: it.skey }); s.sec++; }
          else if (it.prio > cur.prio && cur.skey !== it.skey) { if (st.sessions[cur.skey]) st.sessions[cur.skey].sec--; ledger.set(t, { prio: it.prio, skey: it.skey }); s.sec++; }
        }
        st.sessions[it.skey] = s;
        if (sender.tab) lastByTab[sender.tab.id] = { skey: it.skey, at: Date.now() };
      }
      for (const t of ledger.keys()) if (t < now - 900) ledger.delete(t);
      await chrome.storage.local.set({ sessions: st.sessions });
      if (Date.now() - (st.status.lastTry || 0) > 60000) await flush();
    });
    return false;
  }
  if (msg && msg.type === "flush") { serial(() => flush(true)).then(r => reply(r)); return true; }
  if (msg && msg.type === "now") {
    get().then(st => {
      const l = lastByTab[msg.tabId]; const s = l && Date.now() - l.at < 20000 ? st.sessions[l.skey] : null;
      reply(s ? { skey: l.skey, s, r: resolve(s, st.settings, st.rules), keys: ruleKeys(s) } : null);
    });
    return true;
  }
  if (msg && msg.type === "resolveAll") {
    get().then(st => { const out = {}; for (const [k, s] of Object.entries(st.sessions)) out[k] = { r: resolve(s, st.settings, st.rules), keys: ruleKeys(s) }; reply(out); });
    return true;
  }
});

/* ---------- what gets sent ---------- */
function activity(s) {
  if (s.kind === "r") return "Reading · " + s.host;
  if (s.kind === "w") return "Writing · " + s.host;
  if (s.src === "youtube") return "YouTube · " + (s.author ? s.author + " — " : "") + (s.title || s.key || "");
  if (s.src === "netflix") return "Netflix · " + (s.show || s.title || "");
  return (s.host || "") + " · " + (s.title || "");
}
function entries(st) {
  const out = new Map(); const min = st.settings.minMin * 60;
  for (const [k, s] of Object.entries(st.sessions)) {
    if (!s.kind) s.kind = "m";
    const r = resolve(s, st.settings, st.rules);
    if (!r.lang || !st.settings.track[s.kind === "m" ? "media" : s.kind === "r" ? "read" : "write"]) continue;
    if (s.kind === "m" && s.shorts) {
      const id = s.date + "|shorts|" + r.lang; const e = out.get(id) || { ext_id: id, date: s.date, subject: r.lang, type: r.type, sec: 0, activity: "YouTube Shorts", src: "youtube", keys: [] };
      e.sec += s.sec; e.keys.push(k); out.set(id, e);
    } else out.set(k, { ext_id: k.slice(0, 200), date: s.date, subject: r.lang, type: r.type, sec: s.sec, keys: [k], activity: activity(s).slice(0, 300),
      src: s.kind === "r" ? "reading" : s.kind === "w" ? "writing" : (s.src || "video") });
  }
  return [...out.values()].filter(e => e.sec >= min).map(e => ({ ...e, minutes: Math.round(e.sec / 60) }));
}

async function flush(check) {
  const st = await get(); const now = Date.now();
  const cut = new Date(now - 14 * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(st.sessions)) if (st.sessions[k].date < cut) delete st.sessions[k];
  st.status.lastTry = now;
  if (!st.settings.token) { st.status.error = "no-token"; await chrome.storage.local.set({ sessions: st.sessions, status: st.status }); return st.status; }
  if (st.status.error === "no-token") st.status.error = "";          // a token was pasted since the last try
  if (check || st.status.checkedToken !== st.settings.token) {        // new token: make sure Logbook accepts it
    try {
      const r = await fetch(SB_URL + "/rest/v1/rpc/token_lists", { method: "POST", headers: { "Content-Type": "application/json", apikey: SB_KEY }, body: JSON.stringify({ p_token: st.settings.token }) });
      if (r.ok) { st.status.error = ""; st.status.checkedToken = st.settings.token; st.status.lastOk = now; }
      else if (/invalid token/.test(await r.text())) st.status.error = "bad-token";
      else st.status.checkedToken = st.settings.token;                 // older database without the check: rely on sending instead
    } catch (_) { st.status.error = "offline"; }
  }
  const todo = entries(st).filter(e => e.keys.some(k => st.sessions[k].sentMin !== e.minutes || st.sessions[k].sentAs !== e.subject + "|" + e.type));
  if (todo.length) {
    try {
      const res = await fetch(SB_URL + "/rest/v1/rpc/ingest", { method: "POST", headers: { "Content-Type": "application/json", apikey: SB_KEY },
        body: JSON.stringify({ p_token: st.settings.token, p_entries: todo.map(e => ({ date: e.date, subject: e.subject, type: e.type, minutes: e.minutes, activity: e.activity, src: e.src, ext_id: e.ext_id })) }) });
      if (!res.ok) { const t = await res.text(); st.status.error = res.status === 401 || /invalid token/.test(t) ? "bad-token" : "http " + res.status; }
      else { for (const e of todo) for (const k of e.keys) { st.sessions[k].sentMin = e.minutes; st.sessions[k].sentAs = e.subject + "|" + e.type; }
        st.status.error = ""; st.status.lastOk = now; st.status.lastCount = todo.length; }
    } catch (_) { st.status.error = "offline"; }
  }
  await chrome.storage.local.set({ sessions: st.sessions, status: st.status, rules: st.rules, rulesMigrated: true });
  return st.status;
}

chrome.alarms.create("flush", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "flush") serial(() => flush()); });
chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch.rules || ch.settings)) serial(() => flush()); });
