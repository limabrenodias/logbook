// Logbook — YouTube tracker: collects watched seconds per video per day and sends them to your
// Logbook through the ingest function, using the token from Logbook → Setup → Connections.
const SB_URL = "https://bhbvnjcyubwrnebgewmj.supabase.co";
const SB_KEY = "sb_publishable_VvI57sGerWzNx9HkWIExzA_w0fhKsJa";
const LANG = { fr: "French", pl: "Polish", de: "German", es: "Spanish", en: "English", pt: "Portuguese", it: "Italian", nl: "Dutch",
  ru: "Russian", uk: "Ukrainian", cs: "Czech", sv: "Swedish", no: "Norwegian", da: "Danish", fi: "Finnish", ja: "Japanese",
  ko: "Korean", zh: "Chinese", ar: "Arabic", tr: "Turkish", el: "Greek", hu: "Hungarian", ro: "Romanian", hi: "Hindi", he: "Hebrew" };
const DEFAULTS = { token: "", study: ["French", "Polish"], auto: true, minMin: 2, type: "Listening", paused: false, lockedPause: true };

const get = async () => {
  const s = await chrome.storage.local.get(["settings", "channels", "sessions", "status"]);
  return { settings: { ...DEFAULTS, ...(s.settings || {}) }, channels: s.channels || {}, sessions: s.sessions || {}, status: s.status || {} };
};

// What should this session be logged as? Channel rules win; otherwise the spoken language YouTube detected.
function resolve(x, settings, channels) {
  const rule = x.channelId && channels[x.channelId];
  if (rule && rule.lang === "ignore") return { why: "ignored" };
  if (rule && rule.lang) return { lang: rule.lang, type: rule.type || settings.type, why: "channel" };
  const det = LANG[x.asr];
  if (settings.auto && det && settings.study.includes(det)) return { lang: det, type: (rule && rule.type) || settings.type, why: "detected" };
  return { why: det ? "not-studied" : "unknown", det };
}

let idleState = "active";
chrome.idle.onStateChanged.addListener(s => { idleState = s; });

let lock = Promise.resolve();
const serial = fn => (lock = lock.then(fn, fn));

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === "ticks") {
    serial(async () => {
      const st = await get();
      if (st.settings.paused || (st.settings.lockedPause && idleState === "locked")) return;
      for (const it of msg.items) {
        const k = it.date + "|" + it.vid; const s = st.sessions[k] || { date: it.date, vid: it.vid, sec: 0, sent: 0 };
        s.sec += Math.max(0, Math.min(60, it.sec)); s.shorts = it.shorts; s.live = it.live; s.updated = Date.now();
        for (const f of ["title", "author", "channelId", "asr"]) if (it[f]) s[f] = it[f];
        st.sessions[k] = s;
      }
      await chrome.storage.local.set({ sessions: st.sessions });
      if (Date.now() - (st.status.lastTry || 0) > 60000) await flush();
    });
    return false;
  }
  if (msg && msg.type === "flush") { serial(() => flush(true)).then(r => reply(r)); return true; }
  if (msg && msg.type === "resolve") { get().then(st => reply(resolve(msg.item, st.settings, st.channels))); return true; }
});

// Build entries: one log per video per day; Shorts are grouped into one log per day per language.
function entries(st) {
  const out = new Map(); const min = st.settings.minMin * 60;
  for (const [k, s] of Object.entries(st.sessions)) {
    const r = resolve(s, st.settings, st.channels); s.res = r;
    if (!r.lang) continue;
    if (s.shorts) {
      const id = s.date + "|shorts|" + r.lang; const e = out.get(id) || { ext_id: id, date: s.date, subject: r.lang, type: r.type, sec: 0, activity: "YouTube Shorts", keys: [] };
      e.sec += s.sec; e.keys.push(k); out.set(id, e);
    } else {
      out.set(k, { ext_id: k, date: s.date, subject: r.lang, type: r.type, sec: s.sec, keys: [k],
        activity: ("YouTube · " + (s.author ? s.author + " — " : "") + (s.title || s.vid)).slice(0, 300) });
    }
  }
  return [...out.values()].filter(e => e.sec >= min).map(e => ({ ...e, minutes: Math.round(e.sec / 60) }));
}

async function flush(manual) {
  const st = await get(); const now = Date.now();
  // forget sessions older than 14 days
  const cut = new Date(now - 14 * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(st.sessions)) if (st.sessions[k].date < cut) delete st.sessions[k];
  st.status.lastTry = now;
  if (!st.settings.token) { st.status.error = "no-token"; await chrome.storage.local.set({ sessions: st.sessions, status: st.status }); return st.status; }
  const all = entries(st);
  const todo = all.filter(e => e.keys.some(k => st.sessions[k].sentMin !== e.minutes || st.sessions[k].sentAs !== e.subject + "|" + e.type));
  if (!todo.length) { await chrome.storage.local.set({ sessions: st.sessions, status: st.status }); return st.status; }
  try {
    const res = await fetch(SB_URL + "/rest/v1/rpc/ingest", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SB_KEY },
      body: JSON.stringify({ p_token: st.settings.token, p_entries: todo.map(e => ({ date: e.date, subject: e.subject, type: e.type, minutes: e.minutes, activity: e.activity, src: "youtube", ext_id: e.ext_id })) })
    });
    if (!res.ok) { const t = await res.text(); st.status.error = res.status === 401 || /invalid token/.test(t) ? "bad-token" : "http " + res.status; }
    else {
      for (const e of todo) for (const k of e.keys) { st.sessions[k].sentMin = e.minutes; st.sessions[k].sentAs = e.subject + "|" + e.type; }
      st.status.error = ""; st.status.lastOk = now; st.status.lastCount = todo.length;
    }
  } catch (err) { st.status.error = "offline"; }
  await chrome.storage.local.set({ sessions: st.sessions, status: st.status });
  return st.status;
}

chrome.alarms.create("flush", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "flush") serial(() => flush()); });
chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch.channels || ch.settings)) serial(() => flush()); });
