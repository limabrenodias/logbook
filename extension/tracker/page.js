// Runs inside the YouTube page so it can read the player's own data (title, channel and
// the language YouTube detected for its automatic captions). It only reads; it never sends anything anywhere.
(() => {
  let last = "";
  function read() {
    for (const id of ["movie_player", "shorts-player"]) {
      const p = document.getElementById(id);
      if (!p || typeof p.getPlayerResponse !== "function") continue;
      let r; try { r = p.getPlayerResponse(); } catch (_) { continue; }
      const v = r && r.videoDetails; if (!v || !v.videoId) continue;
      const tracks = (((r.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
      const asr = tracks.find(t => t.kind === "asr");
      const meta = { vid: v.videoId, title: v.title || "", author: v.author || "", channelId: v.channelId || "",
        live: !!v.isLiveContent, asr: asr ? String(asr.languageCode || "").split("-")[0] : "",
        captions: tracks.map(t => String(t.languageCode || "").split("-")[0]).slice(0, 12) };
      const key = JSON.stringify(meta);
      if (key !== last) { last = key; window.postMessage({ __lbyt: true, meta }, location.origin); }
    }
  }
  setInterval(read, 2000); read();
})();
