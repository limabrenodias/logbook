// Logbook tracker — runs in every page. Each second it decides what you're doing here:
//   • writing  — you typed in a text box in the last 15 s (the page must be in front)
//   • watching / listening — a video or audio is really playing, unmuted, not an ad
//     (counts even in a background tab: listening counts)
//   • reading  — the page is in front, the window is focused, you scrolled / moved / typed
//     in the last N seconds, and the page has real text
// Languages are detected here, on your computer, with Brave/Chrome's built-in detector.
// No page text ever leaves your computer — only the site, the title and the minutes are sent.
// The one exception is a word you save yourself (Alt+click, or select + Alt+W): that word and its sentence are sent.
(() => {
  if (window.top !== window) return;
  const HOST = location.hostname.replace(/^www\./, "");
  const day = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  let S = { readIdle: 45, track: { media: true, read: true, write: true }, words: true };
  const loadSettings = () => { try { chrome.storage.local.get("settings", r => { const s = r.settings || {}; S = { readIdle: s.readIdle || 45, track: { media: true, read: true, write: true, ...(s.track || {}) }, words: s.words !== false }; }); } catch (_) {} };
  loadSettings(); try { chrome.storage.onChanged.addListener(c => { if (c.settings) loadSettings(); }); } catch (_) {}

  /* ---------- language detection (local) ---------- */
  const detect = text => new Promise(res => {
    text = (text || "").replace(/\s+/g, " ").trim();
    if (text.length < 40) return res(null);
    try {
      chrome.i18n.detectLanguage(text.slice(0, 4000), r => {
        const top = r && r.languages && r.languages.sort((a, b) => b.percentage - a.percentage)[0];
        res(top && top.percentage >= 60 && top.language !== "und" ? { code: top.language.split("-")[0], reliable: !!r.isReliable, pct: top.percentage } : null);
      });
    } catch (_) { res(null); }
  });

  /* ---------- reading: is there real text on this page, and in which language? ---------- */
  let page = { url: "", lang: null, chars: 0, at: 0 };
  function mainText() {
    const el = document.querySelector("article") || document.querySelector("main,[role=main]") || document.body;
    return el ? (el.innerText || "").slice(0, 6000) : "";
  }
  async function checkPage(force) {
    if (!force && page.url === location.href && Date.now() - page.at < 60000 && page.lang) return;
    const t = mainText(); const res = await detect(t);
    const htmlLang = (document.documentElement.lang || "").split("-")[0].toLowerCase();
    page = { url: location.href, chars: t.replace(/\s+/g, " ").length, at: Date.now(),
             lang: res && (res.reliable || res.pct >= 80) ? res.code : (res ? res.code : htmlLang || null), src: res ? "page text" : htmlLang ? "page language" : "" };
  }

  /* ---------- activity ---------- */
  let lastInput = 0, lastType = 0, typeEl = null, typeLang = null, typeCheck = 0;
  const bump = () => { lastInput = Date.now(); };
  ["scroll", "wheel", "pointerdown", "touchstart", "keydown", "selectionchange"].forEach(ev => addEventListener(ev, bump, { passive: true, capture: true }));
  let mm = 0; addEventListener("mousemove", () => { const n = Date.now(); if (n - mm > 2000) { mm = n; bump(); } }, { passive: true, capture: true });
  const editable = el => el && (el.isContentEditable || el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|)$/i.test(el.type || "")));
  addEventListener("keydown", e => {
    const el = e.composedPath ? e.composedPath()[0] : e.target;
    if (!editable(el) || e.ctrlKey || e.metaKey || e.altKey || (e.key && e.key.length > 1 && e.key !== "Backspace" && e.key !== "Enter")) return;
    lastType = Date.now(); typeEl = el;
  }, { capture: true });
  async function checkTyping() {
    if (!typeEl || Date.now() - typeCheck < 3000) return; typeCheck = Date.now();
    const v = typeEl.isContentEditable ? typeEl.innerText : typeEl.value;
    const r = await detect((v || "").slice(-600)); if (r) typeLang = r.code;
  }

  /* ---------- media ---------- */
  const yt = {}; // YouTube player data from page.js
  window.addEventListener("message", e => { if (e.source === window && e.data && e.data.__lbyt && e.data.meta) yt[e.data.meta.vid] = e.data.meta; });
  function playingMedia() {
    for (const v of document.querySelectorAll("video,audio")) {
      if (v.paused || v.ended || v.readyState < 2 || v.muted || v.volume === 0) continue;
      const pl = v.closest(".html5-video-player");
      if (pl && pl.classList.contains("ad-showing")) continue;
      if (v.closest("ytd-video-preview, #inline-preview-player, ytd-thumbnail")) continue;  // hover previews
      if (v.tagName === "VIDEO" && v.clientWidth && v.clientWidth < 160 && !document.pictureInPictureElement) continue;  // little autoplay ads/thumbnails
      return v;
    }
    return null;
  }
  // subtitles on screen (Netflix, Prime, Disney+, any <track>) → language of what's being said
  let capText = {}, capLang = {};
  function sampleCaptions(key, v) {
    let t = "";
    try { for (const tr of v.textTracks || []) if (tr.mode === "showing" && tr.activeCues) for (const c of tr.activeCues) t += " " + (c.text || ""); } catch (_) {}
    for (const el of document.querySelectorAll(".player-timedtext, [class*='subtitle' i], [class*='caption-window' i], [data-testid*='subtitle' i], .atvwebplayersdk-captions-text"))
      if (el.offsetParent !== null) t += " " + el.innerText;
    t = t.replace(/\s+/g, " ").trim();
    if (!t) return;
    const prev = capText[key] || "";
    if (!prev.endsWith(t)) capText[key] = (prev + " " + t).slice(-1500);
    if ((capText[key] || "").length >= 200 && !capLang[key]) detect(capText[key]).then(r => { if (r) capLang[key] = r.code; });
  }
  function mediaInfo(v) {
    const u = new URL(location.href); let key, kind = "video", title = "", author = "", show = "", channelId = "", lang = "", langSrc = "", shorts = false, src = "video";
    if (/(^|\.)youtube\.com$/.test(location.hostname)) {
      const m = u.pathname.match(/^\/(shorts|live)\/([\w-]{6,})/);
      const vid = u.pathname === "/watch" ? u.searchParams.get("v") : m ? m[2] : null; if (!vid) return null;
      const meta = yt[vid] || {}; key = vid; shorts = !!(m && m[1] === "shorts"); src = "youtube";
      title = meta.title || document.title.replace(/ - YouTube$/, ""); author = meta.author || ""; channelId = meta.channelId || "";
      if (meta.asr) { lang = meta.asr; langSrc = "YouTube captions"; }
    } else if (/(^|\.)netflix\.com$/.test(location.hostname)) {
      const m = u.pathname.match(/\/watch\/(\d+)/); key = "nf-" + (m ? m[1] : u.pathname); src = "netflix";
      const h = document.querySelector("[data-uia='video-title'] h4, [data-uia='video-title']");
      show = h ? h.innerText.split("\n")[0].trim() : ""; title = show || "Netflix";
    } else {
      const md = navigator.mediaSession && navigator.mediaSession.metadata;
      title = (md && md.title) || document.title || HOST; author = (md && md.artist) || "";
      show = (md && md.album) || "";
      key = HOST + (u.pathname.length > 1 ? u.pathname.slice(0, 80) : "");
      if (v.tagName === "AUDIO") kind = "audio";
    }
    sampleCaptions(key, v);
    if (!lang && capLang[key]) { lang = capLang[key]; langSrc = "subtitles"; }
    return { key, kind, title: title.slice(0, 200), author: author.slice(0, 100), show: show.slice(0, 100), channelId, lang, langSrc, shorts, src };
  }

  /* ---------- every second: what are you doing here? ---------- */
  let buf = [], lastTick = Date.now(), alive = true;
  function claim(rec) {
    const s = Math.floor(Date.now() / 1000), last = buf[buf.length - 1];
    if (last && last.skey === rec.skey && last.to === s - 1 && last.prio === rec.prio) { last.to = s; Object.assign(last.meta, rec.meta); }
    else buf.push({ ...rec, from: s, to: s });
  }
  setInterval(() => {
    lastTick = Date.now();
    const front = document.visibilityState === "visible" && document.hasFocus();
    const d = day(); const v = S.track.media ? playingMedia() : null;
    if (S.track.write && front && Date.now() - lastType < 15000 && typeEl) {
      checkTyping();
      claim({ kind: "w", prio: 3, skey: d + "|w|" + HOST, date: d, meta: { host: HOST, lang: typeLang || "", langSrc: "what you typed" } });
    } else if (v) {
      const m = mediaInfo(v);
      if (m) claim({ kind: "m", prio: front ? 2 : 1, skey: m.src === "youtube" ? d + "|" + m.key : d + "|m|" + m.key.slice(0, 160), date: d, meta: { host: HOST, ...m } });
    } else if (S.track.read && front && Date.now() - lastInput < S.readIdle * 1000) {
      checkPage(false);
      if (page.chars >= 600 && page.lang) claim({ kind: "r", prio: 2, skey: d + "|r|" + HOST, date: d, meta: { host: HOST, lang: page.lang, langSrc: page.src, title: document.title.slice(0, 200) } });
    }
    send(false);
  }, 1000);
  let lastSend = 0;
  function send(force) {
    if (!buf.length || !alive) return;
    if (!force && Date.now() - lastSend < 5000) return;
    const items = buf; buf = []; lastSend = Date.now();
    try { chrome.runtime.sendMessage({ type: "claims", items }).catch(() => {}); } catch (_) { alive = false; }  // extension was reloaded
  }
  document.addEventListener("visibilitychange", () => { send(true); if (document.visibilityState === "visible") checkPage(true); });
  addEventListener("pagehide", () => send(true));
  // single-page sites (YouTube, news sites) change pages without reloading
  let lastUrl = location.href;
  setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; page.at = 0; setTimeout(() => checkPage(true), 1500); } }, 1000);
  setTimeout(() => checkPage(true), 1500);

  /* ---------- save a word: Alt+click it, or select a word or phrase and press Alt+W ---------- */
  let lastMediaLang = "";
  setInterval(() => { const v = playingMedia(); if (v) { const m = mediaInfo(v); if (m && m.lang) lastMediaLang = m.lang; } }, 4000);
  const seg = (g) => { try { return new Intl.Segmenter(undefined, { granularity: g }); } catch (_) { return null; } };
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) return { node: p.offsetNode, off: p.offset }; }
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) return { node: r.startContainer, off: r.startOffset }; }
    return null;
  }
  function wordAt(x, y) {
    const c = caretAt(x, y); if (!c || !c.node || c.node.nodeType !== 3) return null;
    const text = c.node.data; const ws = seg("word");
    if (ws) { for (const w of ws.segment(text)) if (w.isWordLike && c.off >= w.index && c.off <= w.index + w.segment.length) return { word: w.segment, el: c.node.parentElement }; return null; }
    const m = /[\p{L}\p{M}'’-]+/gu; let r; while ((r = m.exec(text))) if (c.off >= r.index && c.off <= r.index + r[0].length) return { word: r[0], el: c.node.parentElement };
    return null;
  }
  function sentenceOf(el, word) {
    let box = el; while (box && box.parentElement && (box.innerText || "").length < 40 && box !== document.body) box = box.parentElement;
    const text = ((box && box.innerText) || "").replace(/\s+/g, " ").trim().slice(0, 4000);
    const ss = seg("sentence"); const lw = word.toLowerCase();
    if (ss) for (const x of ss.segment(text)) if (x.segment.toLowerCase().includes(lw)) return x.segment.trim().slice(0, 500);
    const i = text.toLowerCase().indexOf(lw); return i < 0 ? "" : text.slice(Math.max(0, i - 160), i + lw.length + 160).trim();
  }
  let tip = null;
  function feedback(x, y, msg, ok) {
    if (!tip) { tip = document.createElement("div"); const sh = tip.attachShadow({ mode: "closed" }); tip._sh = sh; document.documentElement.appendChild(tip); }
    tip._sh.innerHTML = `<style>div{position:fixed;z-index:2147483647;font:600 13px/1.3 system-ui,sans-serif;padding:8px 12px;border-radius:999px;color:#fff;
      background:${ok ? "#1f7a4d" : "#7a2e2e"};box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:none;transition:opacity .3s;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style><div></div>`;
    const d = tip._sh.querySelector("div"); d.textContent = msg; d.style.left = Math.min(innerWidth - 330, Math.max(8, x + 12)) + "px"; d.style.top = Math.max(8, y - 44) + "px";
    clearTimeout(tip._t); tip._t = setTimeout(() => { d.style.opacity = "0"; }, 1800);
  }
  async function saveWord(word, el, x, y) {
    word = (word || "").replace(/^[\s"'“”«»(\[]+|[\s"'“”«».,;:!?)\]]+$/g, "").slice(0, 80);
    if (!word || !alive) return;
    const sentence = el ? sentenceOf(el, word) : "";
    const inPlayer = el && el.closest && el.closest(".html5-video-player, .watch-video, [class*='player' i]");
    const r = sentence.length >= 40 ? await detect(sentence) : null;
    await checkPage(false);
    const code = (r && r.code) || (inPlayer && lastMediaLang) || page.lang || "";
    const item = { code, word, sentence, source: (document.title || HOST).slice(0, 200), url: location.href.slice(0, 500) };
    try { chrome.runtime.sendMessage({ type: "word", item }, res => { const lang = res && res.lang; feedback(x, y, lang ? `Saved “${word}” · ${lang}` : `Saved “${word}”`, true); }); }
    catch (_) { alive = false; feedback(x, y, "Reload the page to save words", false); }
  }
  addEventListener("click", e => {
    if (!S.words || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    const w = wordAt(e.clientX, e.clientY); if (!w) return;
    e.preventDefault(); e.stopPropagation(); saveWord(w.word, w.el, e.clientX, e.clientY);
  }, true);
  addEventListener("keydown", e => {
    if (!S.words || !e.altKey || e.ctrlKey || e.metaKey || (e.code !== "KeyW")) return;
    const sel = getSelection(); const t = sel && sel.toString().trim(); if (!t || t.length > 80) return;
    e.preventDefault(); const rr = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : { left: 20, top: 60 };
    const el = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
    saveWord(t, el, rr.left, rr.top);
  }, true);
})();
