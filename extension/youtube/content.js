// Counts real seconds of playback: the video must be playing (not paused, not ended, not an ad,
// not muted). Speed doesn't matter — 10 minutes at 2x counts as 10 minutes, because that's the time you spent.
(() => {
  const metas = {};
  window.addEventListener("message", e => { if (e.source === window && e.data && e.data.__lbyt && e.data.meta) metas[e.data.meta.vid] = e.data.meta; });
  const urlVid = () => {
    const u = new URL(location.href);
    if (u.pathname === "/watch") return { vid: u.searchParams.get("v"), shorts: false };
    const m = u.pathname.match(/^\/(shorts|live)\/([\w-]{6,})/); if (m) return { vid: m[2], shorts: m[1] === "shorts" };
    return null;
  };
  const playing = () => {
    for (const v of document.querySelectorAll("video")) {
      if (v.paused || v.ended || v.readyState < 2 || v.muted || v.volume === 0) continue;
      const pl = v.closest(".html5-video-player");
      if (pl && pl.classList.contains("ad-showing")) continue;
      if (pl && pl.closest("ytd-video-preview, #inline-preview-player, ytd-thumbnail")) continue;   // hover previews on the home page
      return v;
    }
    return null;
  };
  const day = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  let buf = {}, lastTick = Date.now(), lastSend = Date.now(), alive = true;
  function send(force) {
    const keys = Object.keys(buf); if (!keys.length || !alive) return;
    if (!force && Date.now() - lastSend < 10000) return;
    const items = keys.map(k => buf[k]); buf = {}; lastSend = Date.now();
    try { chrome.runtime.sendMessage({ type: "ticks", items }).catch(() => {}); } catch (_) { alive = false; }   // extension was reloaded
  }
  setInterval(() => {
    const now = Date.now(); const dt = Math.min(5, (now - lastTick) / 1000); lastTick = now;
    const u = urlVid(); const v = playing();
    if (u && u.vid && v) {
      const d = day(), k = d + "|" + u.vid; const m = metas[u.vid] || {};
      const b = buf[k] || (buf[k] = { date: d, vid: u.vid, shorts: u.shorts, sec: 0 });
      b.sec += dt; b.title = m.title || document.title.replace(/ - YouTube$/, ""); b.author = m.author || ""; b.channelId = m.channelId || "";
      b.asr = m.asr || ""; b.live = !!m.live;
    }
    send(false);
  }, 1000);
  document.addEventListener("visibilitychange", () => send(true));
  window.addEventListener("pagehide", () => send(true));
})();
