/* Focus mode — immersive Pomodoro. Uses globals from index.html: saveLog, subjects, types, focus,
   LANGS, toast, esc, ymd, readOnly, me, switchView, phase, route. Settings live on this device. */
"use strict";
const Focus=(()=>{
  const LS="lb-focus";
  const TIMERS={classic:{n:"Classic",f:25,s:5,l:15,r:4},gentle:{n:"Gentle",f:15,s:3,l:10,r:4},deep:{n:"Deep work",f:50,s:10,l:20,r:3},sprint:{n:"Sprint",f:10,s:2,l:5,r:4}};
  const QUOTES={focus:["Just this page. Just this minute.","Slow and steady is still moving.","Breathe in, keep going.","Small steps add up quietly.","Stay with it, softly.","Focus is a quiet kind of strength.","One thing at a time is plenty.","You showed up. That's the hard part."],
    short:["Stretch, sip some water, look far away.","Rest is part of the work.","Let your eyes wander for a moment.","Unclench your shoulders."],
    long:["A proper break — you earned it.","Step outside, or just breathe for a while.","Refill your cup, literally and otherwise."]};
  const IC={
    play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
    reset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>',
    vol:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>',
    mute:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16 10l5 5M21 10l-5 5"/></svg>',
    gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
    full:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l7 6-7 6M17 6v12"/></svg>'};

  const DEF={scene:"matcha",timer:"classic",custom:{f:30,s:5,l:15,r:4},ambient:null,bell:null,breakBell:null,vol:.6,muted:false,
    autoBreak:true,autoFocus:false,autoLog:false,notify:false,awake:true,task:null};
  let cfg=load(),st=cfg._st||fresh("focus",1);delete cfg._st;
  let sheet=null,pending=null,wake=null,lastP=-1,mounted=false;

  function load(){try{const o=JSON.parse(localStorage.getItem(LS)||"{}");return {...DEF,...o,custom:{...DEF.custom,...(o.custom||{})}}}catch(_){return {...DEF}}}
  function save(){try{localStorage.setItem(LS,JSON.stringify({...cfg,_st:st}))}catch(_){}}
  function T(){return cfg.timer==="custom"?{n:"Custom",...cfg.custom}:TIMERS[cfg.timer]||TIMERS.classic}
  function mins(ph){const t=T();return ph==="focus"?t.f:ph==="short"?t.s:t.l}
  function fresh(ph,round){return {phase:ph,round,running:false,endAt:0,remain:mins(ph)*60000,startedAt:null}}
  function scene(){return Scenes[cfg.scene]||Scenes.matcha}
  function ambient(){return cfg.ambient||scene().ambient}
  function bell(){return cfg.bell||scene().bell}
  function breakBell(){return cfg.breakBell||scene().breakBell}
  function task(){const t=cfg.task||{};return {s:t.s||focus(),t:t.t||"Mixed",a:t.a||""}}
  function remaining(){return st.running?Math.max(0,st.endAt-Date.now()):st.remain}
  function total(){return mins(st.phase)*60000}
  function elapsed(){return total()-remaining()}
  function fmt(ms){const s=Math.ceil(ms/1000);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
  const PH={focus:"Focus mode",short:"Short break",long:"Long break"};

  /* ---------- timer control ---------- */
  function start(){
    if(st.remain<=0)st.remain=total();
    Sound.ensure();Sound.setVolume(cfg.muted?0:cfg.vol);if(Sound.ambient!==ambient()||!amPlaying)Sound.setAmbient(ambient());amPlaying=true;
    st.running=true;st.endAt=Date.now()+st.remain;if(!st.startedAt)st.startedAt=Date.now();save();keepAwake(true);paint(true);
  }
  let amPlaying=false;
  function pause(){st.remain=remaining();st.running=false;save();Sound.stopAmbient();amPlaying=false;keepAwake(false);paint(true)}
  function reset(){st=fresh(st.phase,st.round);save();if(amPlaying){Sound.stopAmbient();amPlaying=false}keepAwake(false);paint(true)}
  function advance(auto){
    const t=T();const was=st.phase;
    if(was==="focus")st=fresh(st.round%t.r===0?"long":"short",st.round);
    else st=fresh("focus",was==="long"?1:st.round+1);
    save();
    if(auto){start()}else{if(amPlaying&&st.phase!=="focus"){} paint(true)}
  }
  function complete(){
    const was=st.phase;const started=st.startedAt||Date.now()-total();
    if(was==="focus"){Sound.play(bell());notify("Focus session complete","Time for a gentle break 🍵");handleLog(mins("focus"),started);if(!cfg.autoBreak){Sound.stopAmbient();amPlaying=false;keepAwake(false)}}
    else{Sound.play(breakBell());notify("Break's over","Ready when you are 🌿")}
    if(was==="focus")advance(cfg.autoBreak);else{advance(cfg.autoFocus);if(!cfg.autoFocus){Sound.stopAmbient();amPlaying=false;keepAwake(false)}}
  }
  function next(){
    if(st.phase==="focus"){const m=Math.round(elapsed()/60000);if(m>=1)askLog(m,st.startedAt||Date.now())}
    advance(st.running&&(st.phase==="focus"?cfg.autoBreak:cfg.autoFocus));
  }
  function end(){
    if(st.phase==="focus"){const m=Math.round(elapsed()/60000);if(m>=1)askLog(m,st.startedAt||Date.now())}
    st=fresh("focus",1);save();Sound.stopAmbient();amPlaying=false;keepAwake(false);paint(true);
  }

  /* ---------- logging ---------- */
  function handleLog(m,started){if(cfg.autoLog)doLog(m,started,task());else askLog(m,started)}
  function askLog(m,started){pending={m,d:ymd(new Date(started))};sheet="log";if(mounted)renderSheet()}
  function doLog(m,started,t){
    if(typeof readOnly==="function"&&readOnly()){toast("Switch to your own logbook to save sessions");return}
    saveLog({a:t.a,s:t.s,t:t.t,m,d:typeof started==="string"?started:ymd(new Date(started)),src:"pomodoro"});toast(`Logged ${m} min of ${t.s} 🌿`);
  }

  /* ---------- extras ---------- */
  async function keepAwake(on){try{if(on&&cfg.awake&&"wakeLock" in navigator&&!wake){wake=await navigator.wakeLock.request("screen");wake.addEventListener("release",()=>wake=null)}else if(!on&&wake){await wake.release();wake=null}}catch(_){}}
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&st.running)keepAwake(true)});
  function notify(title,body){try{if(cfg.notify&&"Notification" in window&&Notification.permission==="granted"&&document.hidden)new Notification(title,{body,icon:"icon.png",silent:true})}catch(_){}}

  /* ---------- rendering ---------- */
  function vars(){const p=scene().pal;const light=scene().light;
    return `--fz-bg:${p.bg};--fz-card:${p.card};--fz-ink:${p.ink};--fz-muted:${p.muted};--fz-accent:${p.accent};--fz-chip:${p.chip};--fz-line:${p.line};--fz-on-accent:${light?"#fff":"#1a1a1a"}`}
  function quote(){const q=QUOTES[st.phase];return q[(st.round*3+(st.phase==="focus"?0:1))%q.length]}
  function upNext(){const t=T();if(st.phase==="focus")return (st.round%t.r===0?"Long break":"Break")+" • "+(st.round%t.r===0?t.l:t.s)+"m";return "Focus • "+t.f+"m"}
  function view(){
    const t=T(),tk=task();
    const dots=Array.from({length:t.r},(_,i)=>`<i class="${i<st.round-(st.phase==="focus"?1:0)?"on":""}"></i>`).join("");
    return `<div class="fz" id="fzRoot" style="${vars()}"><div class="fz-shell">
      <div class="fz-top">
        <a class="fz-chip icon" href="#home" title="Back to Logbook">${IC.back}<span class="lbl">Logbook</span></a>
        <button class="fz-chip" data-fz="settings">${esc(scene().name)} • ${t.f}/${t.s}</button>
        <span class="fz-sp"></span>
        <div class="fz-sound"><button class="fz-round" data-fz="mute" title="Mute">${cfg.muted?IC.mute:IC.vol}</button><input class="fz-vol" type="range" id="fzVol" min="0" max="1" step="0.01" value="${cfg.vol}" style="--v:${cfg.vol*100}%"><select id="fzAmb" title="Ambient sound">${Sound.AMBIENTS.map(([k,n])=>`<option value="${k}" ${k===ambient()?"selected":""}>${n}</option>`).join("")}</select></div>
        <button class="fz-chip icon" data-fz="settings" title="Settings">${IC.gear}</button>
        <button class="fz-chip icon" data-fz="full" title="Full screen">${IC.full}</button>
        <button class="fz-chip" data-fz="end">${IC.x}<span class="lbl">End</span></button>
      </div>
      <div class="fz-card">
        <div class="fz-left">
          <span class="fz-mode" id="fzMode">${PH[st.phase]}</span>
          <div class="fz-time" id="fzTime">${fmt(remaining())}</div>
          <div class="fz-bar"><i id="fzBar"></i></div>
          <p class="fz-quote" id="fzQuote">“${quote()}”</p>
          <div class="fz-ctrl"><button class="fz-btn primary" data-fz="toggle" id="fzToggle">${st.running?IC.pause+"Pause":IC.play+(elapsed()>500?"Resume":"Start")}</button>
            <button class="fz-btn round" data-fz="reset" title="Restart this session">${IC.reset}</button>
            <button class="fz-btn" data-fz="next">Next ${IC.next}</button></div>
          <button class="fz-task" data-fz="task"><small>Working on</small><b>${esc(tk.s)} · ${esc(tk.t)}</b><span class="a">${tk.a?"— "+esc(tk.a):""}</span><span style="margin-left:auto">✎</span></button>
          <div class="fz-dots">${dots}<span style="margin-left:6px">round ${Math.min(st.round,t.r)} of ${t.r}</span></div>
        </div>
        <div class="fz-right"><div class="fz-art" id="fzArt">${scene().art()}</div><div class="fz-caption">${esc(scene().caption)}</div>
          <div class="fz-next"><small>UP NEXT</small><b id="fzNext">${upNext()}</b></div></div>
      </div></div><div id="fzSheet"></div></div>`;
  }
  function render(el){
    if(typeof readOnly==="function"&&readOnly()&&typeof switchView==="function"){switchView(me);return}
    mounted=true;el.innerHTML=view();lastP=-1;paint(true);renderSheet();
  }
  function unmount(){mounted=false}
  function paint(full){
    const r=remaining(),p=Math.min(1,Math.max(0,1-r/total()));
    const mini=document.getElementById("fzMini");
    if(mini){const show=!mounted&&(st.running||elapsed()>1000);mini.classList.toggle("on",show);if(show)mini.innerHTML=`<span>${st.running?"●":"❚❚"}</span><b>${PH[st.phase]}</b><span class="num">${fmt(r)}</span><span class="muted">${esc(task().s)}</span><span style="margin-left:auto">Open focus →</span>`}
    document.title=st.running?`${fmt(r)} · ${st.phase==="focus"?"Focus":"Break"} — Logbook`:"Logbook";
    if(!mounted||!document.getElementById("fzRoot"))return;
    if(full){const root=document.getElementById("fzRoot");if(root){const c=root.querySelector(".fz-left");if(c){
      document.getElementById("fzMode").textContent=PH[st.phase];document.getElementById("fzQuote").textContent="“"+quote()+"”";document.getElementById("fzNext").textContent=upNext();
      document.getElementById("fzToggle").innerHTML=st.running?IC.pause+"Pause":IC.play+(elapsed()>500?"Resume":"Start");
      const t=T();root.querySelector(".fz-dots").innerHTML=Array.from({length:t.r},(_,i)=>`<i class="${i<st.round-(st.phase==="focus"?1:0)?"on":""}"></i>`).join("")+`<span style="margin-left:6px">round ${Math.min(st.round,t.r)} of ${t.r}</span>`}}}
    document.getElementById("fzTime").textContent=fmt(r);document.getElementById("fzBar").style.width=(p*100)+"%";
    const sc=scene();if(sc.update&&(full||Math.abs(p-lastP)>.002)){const a=document.getElementById("fzArt");if(a)sc.update(a,st.phase==="focus"?p:1-p);lastP=p}
  }
  setInterval(()=>{if(st.running&&Date.now()>=st.endAt)complete();if(st.running||mounted)paint(false)},250);

  /* ---------- sheets ---------- */
  function pv(k){const s=Scenes[k];return `background:${s.pal.bg}`}
  function renderSheet(){
    const host=document.getElementById("fzSheet");if(!host)return;
    if(!sheet){host.innerHTML="";return}
    let h="";const t=T(),tk=task();
    if(sheet==="settings"){
      h=`<div class="row"><h3>Focus settings</h3><span class="spacer"></span><button class="fz-pbtn sec" data-fz="close">Done</button></div>
      <h4>Scene</h4><div class="fz-scenes">${Object.keys(Scenes).map(k=>`<button class="fz-sc ${k===cfg.scene?"on":""}" data-fzscene="${k}"><div class="pv" style="${pv(k)}"></div><span>${Scenes[k].name}</span></button>`).join("")}</div>
      <h4>Timer</h4><div class="fz-pills">${Object.entries(TIMERS).map(([k,v])=>`<button class="fz-pill ${k===cfg.timer?"on":""}" data-fztimer="${k}">${v.n}<small>${v.f}/${v.s}</small></button>`).join("")}<button class="fz-pill ${cfg.timer==="custom"?"on":""}" data-fztimer="custom">Custom</button></div>
      ${cfg.timer==="custom"?`<div class="fz-nums"><label>Focus (min)<input type="number" min="1" max="180" id="fzcf" value="${cfg.custom.f}"></label><label>Short break<input type="number" min="1" max="60" id="fzcs" value="${cfg.custom.s}"></label><label>Long break<input type="number" min="1" max="90" id="fzcl" value="${cfg.custom.l}"></label><label>Rounds<input type="number" min="1" max="12" id="fzcr" value="${cfg.custom.r}"></label></div>`:`<p style="color:#958a80;font-size:13px;margin:10px 0 0">${t.f} min focus · ${t.s} min break · ${t.l} min long break after ${t.r} rounds</p>`}
      <h4>Sounds</h4>
      <div class="fz-sw"><div>Ambient sound<small>Plays while the timer runs</small></div><select id="fzsAmb"><option value="">Scene default (${Sound.AMBIENTS.find(a=>a[0]===scene().ambient)[1]})</option>${Sound.AMBIENTS.map(([k,n])=>`<option value="${k}" ${k===cfg.ambient?"selected":""}>${n}</option>`).join("")}</select></div>
      <div class="fz-sw"><div>End of focus<small>A gentle signal, never an alarm</small></div><div class="row"><select id="fzsBell"><option value="">Scene default (${Sound.BELLS.find(a=>a[0]===scene().bell)[1]})</option>${Sound.BELLS.map(([k,n])=>`<option value="${k}" ${k===cfg.bell?"selected":""}>${n}</option>`).join("")}</select><button class="fz-pbtn sec" data-fz="testBell">▶</button></div></div>
      <div class="fz-sw"><div>End of break</div><div class="row"><select id="fzsBreak"><option value="">Scene default (${Sound.BELLS.find(a=>a[0]===scene().breakBell)[1]})</option>${Sound.BELLS.map(([k,n])=>`<option value="${k}" ${k===cfg.breakBell?"selected":""}>${n}</option>`).join("")}</select><button class="fz-pbtn sec" data-fz="testBreak">▶</button></div></div>
      <h4>Flow</h4>
      ${sw("autoLog","Log focus sessions automatically","Otherwise you'll get a gentle prompt to save each one")}
      ${sw("autoBreak","Start breaks automatically","")}
      ${sw("autoFocus","Start the next focus automatically","")}
      ${sw("notify","Notify me when a session ends","Shows a system notification if this tab is in the background")}
      ${sw("awake","Keep the screen on while focusing","Handy on an iPad or a phone stand")}`;
    }else if(sheet==="task"){
      const subs=subjects();const list=[...subs,...LANGS.filter(l=>!subs.includes(l))];
      h=`<h3>What are you working on?</h3><p style="color:#958a80;margin:4px 0 16px">Sessions are logged with this.</p>
      <div class="field"><label>Activity (optional)</label><input type="text" id="fztA" maxlength="300" value="${esc(tk.a)}" placeholder="e.g. DALF reading practice"></div>
      <div class="two"><div class="field"><label>Subject</label><select id="fztS">${list.map(s=>`<option ${s===tk.s?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Type</label><select id="fztT">${types().map(x=>`<option ${x===tk.t?"selected":""}>${esc(x)}</option>`).join("")}</select></div></div>
      <div class="row" style="justify-content:flex-end"><button class="fz-pbtn sec" data-fz="close">Cancel</button><button class="fz-pbtn" data-fz="saveTask">Save</button></div>`;
    }else if(sheet==="log"&&pending){
      h=`<div class="fz-done"><div class="leaf">🌿</div><h3>Nicely done</h3><p>${pending.m} minute${pending.m===1?"":"s"} of focus. Save it to your logbook?</p></div>
      <div class="field"><label>Activity</label><input type="text" id="fzlA" maxlength="300" value="${esc(tk.a)}" placeholder="What did you do?"></div>
      <div class="two"><div class="field"><label>Subject</label><select id="fzlS">${subjects().map(s=>`<option ${s===tk.s?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Type</label><select id="fzlT">${types().map(x=>`<option ${x===tk.t?"selected":""}>${esc(x)}</option>`).join("")}</select></div></div>
      <div class="two"><div class="field"><label>Minutes</label><input type="number" id="fzlM" min="1" max="1440" value="${pending.m}"></div><div class="field"><label>&nbsp;</label><label style="font-weight:500;display:flex;gap:8px;align-items:center"><input type="checkbox" id="fzlAuto"> Always log automatically</label></div></div>
      <div class="row" style="justify-content:flex-end"><button class="fz-pbtn sec" data-fz="skipLog">Not now</button><button class="fz-pbtn" data-fz="saveLog">Save to logbook</button></div>`;
    }
    host.innerHTML=`<div class="fz-scrim" data-fz="scrim"><div class="fz-panel">${h}</div></div>`;
  }
  function sw(k,label,sub){return `<label class="fz-sw"><div>${label}${sub?`<small>${sub}</small>`:""}</div><input type="checkbox" data-fzsw="${k}" ${cfg[k]?"checked":""}></label>`}
  function rerender(){const v=document.getElementById("view");if(mounted&&v)render(v)}

  /* ---------- events ---------- */
  document.addEventListener("click",e=>{
    const sc=e.target.closest("[data-fzscene]");if(sc){cfg.scene=sc.dataset.fzscene;save();if(amPlaying&&!cfg.ambient)Sound.setAmbient(ambient());rerender();return}
    const tm=e.target.closest("[data-fztimer]");if(tm){const was=!st.running&&elapsed()<1000;cfg.timer=tm.dataset.fztimer;save();if(was){st=fresh(st.phase,st.round);save()}rerender();return}
    const a=e.target.closest("[data-fz]");if(!a)return;const k=a.dataset.fz;
    if(k==="scrim"&&e.target!==a)return;
    if(k==="toggle"){st.running?pause():start()}
    else if(k==="reset")reset();
    else if(k==="next")next();
    else if(k==="end")end();
    else if(k==="settings"){sheet="settings";renderSheet()}
    else if(k==="task"){sheet="task";renderSheet()}
    else if(k==="close"||k==="scrim"){if(sheet==="log")return;sheet=null;renderSheet()}
    else if(k==="mute"){cfg.muted=!cfg.muted;Sound.setVolume(cfg.muted?0:cfg.vol);save();a.innerHTML=cfg.muted?IC.mute:IC.vol}
    else if(k==="full"){try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}catch(_){}}
    else if(k==="testBell"){Sound.ensure();Sound.setVolume(cfg.muted?0:cfg.vol);Sound.play(bell())}
    else if(k==="testBreak"){Sound.ensure();Sound.setVolume(cfg.muted?0:cfg.vol);Sound.play(breakBell())}
    else if(k==="saveTask"){cfg.task={s:document.getElementById("fztS").value,t:document.getElementById("fztT").value,a:document.getElementById("fztA").value.trim()};save();sheet=null;rerender()}
    else if(k==="saveLog"&&pending){const t={s:document.getElementById("fzlS").value,t:document.getElementById("fzlT").value,a:document.getElementById("fzlA").value.trim()};
      const m=parseInt(document.getElementById("fzlM").value,10);if(!(m>0&&m<=1440))return toast("Check the minutes");
      if(document.getElementById("fzlAuto").checked)cfg.autoLog=true;cfg.task=t;save();doLog(m,pending.d,t);pending=null;sheet=null;rerender()}
    else if(k==="skipLog"){pending=null;sheet=null;renderSheet()}
  });
  document.addEventListener("change",e=>{
    const id=e.target.id;
    if(id==="fzAmb"){cfg.ambient=e.target.value===scene().ambient?null:e.target.value;save();if(st.running)Sound.setAmbient(ambient())}
    else if(id==="fzsAmb"){cfg.ambient=e.target.value||null;save();if(st.running)Sound.setAmbient(ambient());const s=document.getElementById("fzAmb");if(s)s.value=ambient()}
    else if(id==="fzsBell"){cfg.bell=e.target.value||null;save()}
    else if(id==="fzsBreak"){cfg.breakBell=e.target.value||null;save()}
    else if(/^fzc[fslr]$/.test(id)){const v=parseInt(e.target.value,10);if(v>0){cfg.custom[id[3]]=v;save();if(!st.running&&elapsed()<1000){st=fresh(st.phase,st.round);save()}paint(true)}}
    else if(e.target.dataset&&e.target.dataset.fzsw){const k=e.target.dataset.fzsw;cfg[k]=e.target.checked;save();
      if(k==="notify"&&cfg.notify&&"Notification" in window&&Notification.permission==="default")Notification.requestPermission();if(k==="awake")keepAwake(cfg.awake&&st.running)}
  });
  document.addEventListener("input",e=>{if(e.target.id==="fzVol"){cfg.vol=+e.target.value;cfg.muted=false;e.target.style.setProperty("--v",cfg.vol*100+"%");Sound.setVolume(cfg.vol);save()}});
  document.addEventListener("keydown",e=>{if(!mounted||sheet)return;if(e.code==="Space"&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();st.running?pause():start()}});

  // resume a session that was running when the page was closed/reloaded
  if(st.running&&Date.now()>=st.endAt){setTimeout(complete,1500)}
  return{render,unmount,paint,get running(){return st.running}};
})();
