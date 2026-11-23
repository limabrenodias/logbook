// Logbook — Spotify tracker (Supabase Edge Function "spotify").
//   POST /spotify/auth-url   (signed-in user)  → link to connect your Spotify account
//   GET  /spotify/callback   (Spotify sends you back here) → saves the connection, returns you to Logbook
//   POST /spotify/poll       (every minute, from pg_cron, needs x-cron-secret) → counts what each person is listening to
// Counting: every minute it asks Spotify what's playing. Time only counts while it's really playing and is the
// smaller of the clock time and how far the episode moved, so pausing, skipping ahead or 2× speed never inflate it.
// Secrets to set (Edge Functions → Secrets): SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, CRON_SECRET, APP_URL.

const LANG = { fr: "French", pl: "Polish", de: "German", es: "Spanish", en: "English", pt: "Portuguese", it: "Italian", nl: "Dutch",
  ru: "Russian", uk: "Ukrainian", cs: "Czech", sv: "Swedish", ja: "Japanese", ko: "Korean", zh: "Chinese", ar: "Arabic", tr: "Turkish", el: "Greek" };

function localDay(ms, tz) {
  try { return new Date(ms).toLocaleDateString("en-CA", { timeZone: tz || "UTC" }); } catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}

// What should this be logged as? A choice for the show/artist wins; otherwise the episode's own language if you study it.
function resolveItem(it, sp) {
  const rule = (sp.shows || {})[it.group];
  if (rule && rule.lang === "ignore") return null;
  if (rule && rule.lang) return { lang: rule.lang, type: rule.type || "Listening" };
  if (it.kind === "track" && !sp.music) return null;
  const det = LANG[(it.langs[0] || "").split("-")[0]];
  if (det && (sp.langs || []).includes(det)) return { lang: det, type: (rule && rule.type) || "Listening" };
  return null;
}

// One poll for one person. state = {cur:{key,at,prog}, acc:{"day|key":{sec,sent,...}}}. Returns {state, seen, logs}.
function step(state, now, playing, sp, seen) {
  state = { cur: null, acc: {}, ...(state || {}) }; seen = { ...(seen || {}) };
  const logs = [];
  if (playing && playing.item) {
    const it = playing.item; const day = localDay(now, sp.tz);
    let add = 0;
    if (state.cur && state.cur.key === it.key && state.cur.playing) {
      const wall = Math.min(150, (now - state.cur.at) / 1000);
      const prog = (playing.progress - state.cur.prog) / 1000;
      add = prog > 0 ? Math.min(wall, prog) : 0;
    } else if (playing.progress < 90000) add = Math.min(60, playing.progress / 1000);   // just started: count from the beginning
    state.cur = { key: it.key, at: now, prog: playing.progress, playing: true };
    const k = day + "|" + it.key;
    const a = state.acc[k] || { sec: 0, sent: 0, day, key: it.key, title: it.title, group: it.group, groupName: it.groupName, kind: it.kind, langs: it.langs };
    a.sec += add; state.acc[k] = a;
    seen[it.group] = { name: it.groupName, kind: it.kind === "episode" ? "show" : "artist", lang: (it.langs[0] || "").split("-")[0], last: day };
  } else if (state.cur) state.cur = { ...state.cur, playing: false };
  // what's ready to log (2 minutes or more), including earlier items whose language you just chose
  for (const [k, a] of Object.entries(state.acc)) {
    const r = resolveItem(a, sp); const min = Math.round(a.sec / 60);
    if (r && a.sec >= 120 && (min !== a.sent || a.sentAs !== r.lang + "|" + r.type)) {
      logs.push({ d: a.day, subject: r.lang, type: r.type, minutes: Math.min(min, 1440), ext_id: k.slice(0, 200), src: "spotify",
        activity: ("Spotify · " + (a.groupName ? a.groupName + " — " : "") + a.title).slice(0, 300) });
      a.sent = min; a.sentAs = r.lang + "|" + r.type;
    }
  }
  const cut = localDay(now - 3 * 864e5, sp.tz);
  for (const k of Object.keys(state.acc)) if (state.acc[k].day < cut) delete state.acc[k];
  const keys = Object.keys(seen).sort((x, y) => (seen[y].last || "").localeCompare(seen[x].last || ""));
  for (const k of keys.slice(60)) delete seen[k];
  return { state, seen, logs };
}

function parsePlaying(j) {
  if (!j || !j.item || !j.is_playing) return null;
  const t = j.currently_playing_type, it = j.item;
  if (t === "episode") return { progress: j.progress_ms || 0, item: { key: "ep:" + it.id, kind: "episode", title: it.name || "", group: "show:" + ((it.show || {}).id || ""), groupName: (it.show || {}).name || "", langs: it.languages || (it.language ? [it.language] : []) } };
  if (t === "track") { const ar = (it.artists || [])[0] || {}; return { progress: j.progress_ms || 0, item: { key: "tr:" + it.id, kind: "track", title: it.name || "", group: "artist:" + (ar.id || ""), groupName: ar.name || "", langs: [] } }; }
  return null;
}

if (typeof Deno !== "undefined") {
  const env = k => Deno.env.get(k) || "";
  const SB = env("SUPABASE_URL"), KEY = env("SERVICE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const APP = env("APP_URL") || "https://limabrenodias.github.io/logbook/";
  const CID = env("SPOTIFY_CLIENT_ID") || env("CLIENT_ID"), CSECRET = env("SPOTIFY_CLIENT_SECRET") || env("CLIENT_SECRET");
  const REDIRECT = SB + "/functions/v1/spotify/callback";
  const H = (extra = {}) => ({ apikey: KEY, ...(KEY.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + KEY }), "Content-Type": "application/json", ...extra });
  const db = (path, init = {}) => fetch(SB + "/rest/v1/" + path, { ...init, headers: H(init.headers || {}) });
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const basic = "Basic " + btoa(CID + ":" + CSECRET);

  async function userFrom(req) {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return null;
    const r = await fetch(SB + "/auth/v1/user", { headers: { apikey: KEY, Authorization: "Bearer " + jwt } });
    return r.ok ? (await r.json()).id : null;
  }
  async function token(body) {
    const r = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
    const j = await r.json(); if (!r.ok) throw new Error("Spotify token: " + (j.error_description || j.error || r.status)); return j;
  }
  async function pollOne(link, prefs) {
    const sp = { langs: ["French"], music: false, shows: {}, tz: "Europe/Warsaw", ...((prefs || {}).spotify || {}) };
    let access = link.access_token, exp = link.expires_at ? Date.parse(link.expires_at) : 0, refresh = link.refresh_token;
    const patch = { last_poll: new Date().toISOString(), last_error: null };
    if (!access || exp < Date.now() + 60000) {
      const t = await token({ grant_type: "refresh_token", refresh_token: refresh });
      access = t.access_token; patch.access_token = access; patch.expires_at = new Date(Date.now() + t.expires_in * 1000).toISOString();
      if (t.refresh_token) patch.refresh_token = t.refresh_token;
    }
    const r = await fetch("https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode", { headers: { Authorization: "Bearer " + access } });
    let playing = null;
    if (r.status === 200) playing = parsePlaying(await r.json());
    else if (r.status === 401) { patch.expires_at = new Date(0).toISOString(); }
    else if (r.status === 403) patch.last_error = "Spotify refused (403). In development mode, add this person's Spotify email under User Management in your Spotify app.";
    else if (r.status === 429) patch.last_error = "Spotify asked to slow down; trying again next minute.";
    const out = step(link.state, Date.now(), playing, sp, link.seen);
    patch.state = out.state; patch.seen = out.seen;
    if (out.logs.length) {
      const rows = out.logs.map(l => ({ user_id: link.user_id, ...l }));
      const w = await db("logs?on_conflict=user_id,src,ext_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
      if (!w.ok) patch.last_error = "Couldn't save to Logbook: " + (await w.text()).slice(0, 200);
    }
    await db("spotify_links?user_id=eq." + link.user_id, { method: "PATCH", body: JSON.stringify(patch) });
  }

  Deno.serve(async req => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    const path = new URL(req.url).pathname.replace(/^.*\/spotify/, "") || "/";
    try {
      if (path === "/auth-url") {
        const uid = await userFrom(req); if (!uid) return json({ error: "Sign in first" }, 401);
        if (!CID || !CSECRET) return json({ error: "Spotify isn't set up yet (missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)" }, 500);
        const state = crypto.randomUUID().replace(/-/g, "");
        await db("spotify_states", { method: "POST", body: JSON.stringify({ state, user_id: uid }) });
        const u = new URL("https://accounts.spotify.com/authorize");
        u.search = new URLSearchParams({ client_id: CID, response_type: "code", redirect_uri: REDIRECT, state,
          scope: "user-read-currently-playing user-read-playback-state user-read-playback-position" }).toString();
        return json({ url: u.toString() });
      }
      if (path === "/callback") {
        const q = new URL(req.url).searchParams; const back = (s) => Response.redirect(APP + "?spotify=" + s + "#manage", 302);
        if (q.get("error")) return back("cancelled");
        const st = await (await db("spotify_states?state=eq." + encodeURIComponent(q.get("state") || "") + "&select=user_id,created_at")).json();
        if (!st.length || Date.now() - Date.parse(st[0].created_at) > 15 * 60000) return back("expired");
        await db("spotify_states?state=eq." + encodeURIComponent(q.get("state") || ""), { method: "DELETE" });
        const t = await token({ grant_type: "authorization_code", code: q.get("code") || "", redirect_uri: REDIRECT });
        const me = await (await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: "Bearer " + t.access_token } })).json();
        await db("spotify_links?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({
          user_id: st[0].user_id, refresh_token: t.refresh_token, access_token: t.access_token, expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
          spotify_name: me.display_name || me.id || "", connected_at: new Date().toISOString(), last_error: null }) });
        return back("connected");
      }
      if (path === "/poll") {
        if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return json({ error: "forbidden" }, 403);
        const links = await (await db("spotify_links?select=*")).json();
        const ids = links.map(l => l.user_id);
        const profs = ids.length ? await (await db("profiles?select=id,prefs&id=in.(" + ids.join(",") + ")")).json() : [];
        const pm = Object.fromEntries(profs.map(p => [p.id, p.prefs]));
        let ok = 0;
        await Promise.all(links.map(l => pollOne(l, pm[l.user_id]).then(() => ok++).catch(e =>
          db("spotify_links?user_id=eq." + l.user_id, { method: "PATCH", body: JSON.stringify({ last_poll: new Date().toISOString(), last_error: String(e.message || e).slice(0, 300) }) }))));
        return json({ users: links.length, ok });
      }
      return json({ error: "not found" }, 404);
    } catch (e) { return json({ error: String(e.message || e) }, 500); }
  });
}
