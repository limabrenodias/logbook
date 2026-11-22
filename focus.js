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
    imm:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 15l5-4 4 3 3-2 6 4"/></svg>',
    clean:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M12 5v14"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l7 6-7 6M17 6v12"/></svg>'};

  const DEF={scene:"parasol",living:true,timer:"classic",custom:{f:30,s:5,l:15,r:4},ambient:null,bell:null,breakBell:null,vol:.6,muted:false,
    autoBreak:true,autoFocus:false,autoLog:false,notify:false,awake:true,task:null,clock:"ring",presets:[],layout:"clean"};
  let cfg=load(),st=cfg._st||fresh("focus",1);delete cfg._st;
  let sheet=null,pending=null,wake=null,lastP=-1,mounted=false;Scenes._living=cfg.living!==false;

  function load(){try{const o=JSON.parse(localStorage.getItem(LS)||"{}");return {...DEF,...o,custom:{...DEF.custom,...(o.custom||{})}}}catch(_){return {...DEF}}}
  function save(){try{localStorage.setItem(LS,JSON.stringify({...cfg,_st:st}))}catch(_){}try{document.dispatchEvent(new CustomEvent("focus-state"))}catch(_){}}
  function T(){return cfg.timer==="custom"?{n:"Custom",...cfg.custom}:TIMERS[cfg.timer]||TIMERS.classic}
  function mins(ph){const t=T();return ph==="focus"?t.f:ph==="short"?t.s:t.l}
  function fresh(ph,round){return {phase:ph,round,running:false,endAt:0,remain:mins(ph)*60000,startedAt:null,segs:[]}}
  function scene(){const s=Scenes[cfg.scene];return s&&s.art?s:Scenes.parasol}
  function ambient(){return cfg.ambient||scene().ambient}
  function bell(){return cfg.bell||scene().bell}
  function breakBell(){return cfg.breakBell||scene().breakBell}
  function task(){const t=cfg.task||{};return {s:t.s||focus(),t:t.t||"Mixed",a:t.a||""}}
  function remaining(){return st.running?Math.max(0,st.endAt-Date.now()):st.remain}
  function total(){return st.tot||mins(st.phase)*60000}
  function elapsed(){return total()-remaining()}
  function fmt(ms){const s=Math.ceil(ms/1000);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
  const PH={focus:"Focus mode",short:"Short break",long:"Long break"};const TAB={focus:"Focus",short:"Short break",long:"Long break"};const LBL={focus:"focus",short:"short break",long:"long break"};
  function idle(){return !st.running&&elapsed()<1000}

  /* ---------- focus timeline (this device) ---------- */
  const TLK="lb-timeline";
  function tlLoad(){try{return JSON.parse(localStorage.getItem(TLK)||"[]")}catch(_){return []}}
  function tlSave(a){try{localStorage.setItem(TLK,JSON.stringify(a.slice(-3000)))}catch(_){}}
  function segOpen(){st.segs=st.segs||[];const l=st.segs[st.segs.length-1];if(!l||l[1])st.segs.push([Date.now(),null])}
  function segClose(at){const l=(st.segs||[])[(st.segs||[]).length-1];if(l&&!l[1])l[1]=Math.max(l[0],at||Date.now())}
  function record(full,award,minOverride){
    const segs=(st.segs||[]).filter(x=>x[1]&&x[1]-x[0]>=15000);if(!segs.length)return;
    const ms=segs.reduce((a,x)=>a+x[1]-x[0],0);const m=minOverride||Math.max(1,Math.round(ms/60000));if(ms<45000)return;
    const tk=task();const a=tlLoad();a.push({id:Date.now().toString(36),day:ymd(new Date(segs[0][0])),segs,s:tk.s,t:tk.t,a:tk.a,min:m,full,pts:award?award.total:0});tlSave(a);
  }

  /* ---------- timer control ---------- */
  function start(manual=true){
    if(st.remain<=0)st.remain=total();
    const first=!st.startedAt;
    Sound.ensure();Sound.setVolume(cfg.muted?0:cfg.vol);if(Sound.ambient!==ambient()||!amPlaying)Sound.setAmbient(ambient());amPlaying=true;
    st.running=true;st.endAt=Date.now()+st.remain;if(!st.startedAt)st.startedAt=Date.now();
    if(st.phase==="focus"){if(first)Points.begin(st,manual);else{if(manual)Points.confirm(st);Points.resume(st)}segOpen()}
    save();keepAwake(true);paint(true);
  }
  let amPlaying=false;
  function pause(){Points.pause(st);if(st.phase==="focus")segClose(Date.now());st.remain=remaining();st.running=false;save();Sound.stopAmbient();amPlaying=false;keepAwake(false);paint(true)}
  function reset(){if(st.phase==="focus"&&st.startedAt)partial();st=fresh(st.phase,st.round);save();if(amPlaying){Sound.stopAmbient();amPlaying=false}keepAwake(false);paint(true)}
  function advance(auto){
    const t=T();const was=st.phase;
    if(was==="focus")st=fresh(st.round%t.r===0?"long":"short",st.round);
    else st=fresh("focus",was==="long"?1:st.round+1);
    save();
    if(auto){start(false)}else paint(true);
  }
  function complete(){
    const was=st.phase;const started=st.startedAt||Date.now()-total();
    const rt=document.getElementById("fzRoot");if(rt){rt.classList.add("fz-root-done");setTimeout(()=>rt.classList.remove("fz-root-done"),2500)}
    if(was==="focus"){const m=Math.max(1,Math.round(total()/60000));Sound.play(bell());notify("Focus session complete","Time for a gentle break 🍵");
      const t0=T();const award=Points.finish(st,true,m,st.round%t0.r===0?t0.l:t0.s);lastAward=award;segClose(st.endAt);record(true,award,m);
      if(cfg.autoLog)doLog(m,started,task(),award);else if(award)toast(`+${award.total} focus points ✨`);
      advance(cfg.autoBreak);if(!cfg.autoBreak){Sound.stopAmbient();amPlaying=false;keepAwake(false)}
      if(!(cfg.autoLog&&cfg.autoBreak)){pending={m,d:ymd(new Date(started)),logged:cfg.autoLog,done:true,award};sheet="done";if(mounted)renderSheet()}}
    else{Sound.play(breakBell());notify("Break's over","Ready when you are 🌿");advance(cfg.autoFocus);if(!cfg.autoFocus){Sound.stopAmbient();amPlaying=false;keepAwake(false)}}
  }
  function partial(){if(st.phase==="focus"&&st.startedAt){segClose(Date.now());const a=Points.finish(st,false,mins("focus"),0);record(false,a);if(a)toast(`+${a.total} focus points for the time you put in`)}}
  // stop mid-session but keep the work: log the minutes done, points for them, then move on as usual
  function finishEarly(){
    if(st.phase!=="focus"||!st.startedAt)return;const m=Math.max(1,Math.round(elapsed()/60000));const started=st.startedAt;
    segClose(Date.now());const award=Points.finish(st,false,mins("focus"),0);record(false,award,m);
    Sound.play(bell());const t0=T();
    if(cfg.autoLog)doLog(m,started,task(),award);
    advance(cfg.autoBreak);if(!cfg.autoBreak){Sound.stopAmbient();amPlaying=false;keepAwake(false)}
    if(!(cfg.autoLog&&cfg.autoBreak)){pending={m,d:ymd(new Date(started)),logged:cfg.autoLog,done:true,award,early:true};sheet="done";renderSheet()}
    else rerender();
  }
  // stop mid-session and throw it away: no log, no points, not in the timeline
  function skipNoLog(){
    if(st.phase!=="focus")return;Points.abandon();st.segs=[];
    advance(st.running&&cfg.autoBreak);if(!st.running){Sound.stopAmbient();amPlaying=false;keepAwake(false)}
    toast("Skipped — nothing logged");rerender();
  }
  function switchPhase(ph){
    if(ph===st.phase&&idle())return;
    if(st.phase==="focus"){partial();const m=Math.round(elapsed()/60000);if(m>=1)askLog(m,st.startedAt||Date.now())}
    else if(ph==="focus")Points.skipBreak();
    const round=ph==="focus"?(st.phase==="long"?1:st.phase==="short"?st.round+1:st.round):st.round;
    st=fresh(ph,round);save();if(amPlaying){Sound.stopAmbient();amPlaying=false}keepAwake(false);refresh();
  }
  function setTimer(k,v){
    const was=idle();
    if(cfg.timer!=="custom"){const t=T();cfg.custom={f:t.f,s:t.s,l:t.l,r:t.r};cfg.timer="custom"}
    const c=cfg.custom,cl=(x,a,b)=>Math.max(a,Math.min(b,x));
    if(k==="f")c.f=cl(v,1,180);else if(k==="s")c.s=cl(v,1,60);else if(k==="l")c.l=cl(v,1,90);else if(k==="x")c.r=cl(v+1,2,13);
    if(st.round>c.r)st.round=1;if(was)st=fresh(st.phase,st.round);save();refresh();
  }
  function adjust(k,dir){const t=T();const cur={f:t.f,s:t.s,l:t.l,x:t.r-1}[k];const step=(k==="f"||k==="l")&&(cur>10||(cur===10&&dir>0))?5:1;
    let v=cur+dir*step;if(step===5&&v%5)v=dir>0?Math.ceil(v/5)*5:Math.floor(v/5)*5;setTimer(k,v)}
  function applyPreset(p){const was=idle();cfg.timer="custom";cfg.custom={f:p.f,s:p.s,l:p.l,r:p.r};["scene","ambient","bell","breakBell","clock"].forEach(k=>cfg[k]=p[k]===undefined?cfg[k]:p[k]);if(p.task)cfg.task={...p.task};
    if(was)st=fresh(st.phase,1);save();if(amPlaying)Sound.setAmbient(ambient());rerender();toast("Preset: "+p.name)}
  function doneChoice(choice){
    if(pending&&!pending.logged){const t=readLogForm();if(!t)return;doLog(t.m,pending.d,t)}
    pending=null;sheet=null;
    if(choice==="focus"){Points.skipBreak();st=fresh("focus",st.phase==="long"?1:st.phase==="focus"?st.round:st.round+1);save();start(true)}
    else if(choice==="break"&&!st.running)start();
    rerender();
  }
  function readLogForm(){const t={s:document.getElementById("fzlS").value,t:document.getElementById("fzlT").value,a:document.getElementById("fzlA").value.trim()};
    const m=parseInt(document.getElementById("fzlM").value,10);if(!(m>0&&m<=1440)){toast("Check the minutes");return null}
    if(document.getElementById("fzlAuto").checked)cfg.autoLog=true;cfg.task={s:t.s,t:t.t,a:t.a};save();return {...t,m}}
  function next(){
    if(st.phase==="focus"){partial();const m=Math.round(elapsed()/60000);if(m>=1)askLog(m,st.startedAt||Date.now())}else Points.skipBreak();
    advance(st.running&&(st.phase==="focus"?cfg.autoBreak:cfg.autoFocus));
  }
  function end(){
    if(st.phase==="focus"){partial();const m=Math.round(elapsed()/60000);if(m>=1)askLog(m,st.startedAt||Date.now())}else Points.abandon();
    st=fresh("focus",1);save();Sound.stopAmbient();amPlaying=false;keepAwake(false);paint(true);
  }

  /* ---------- logging ---------- */
  function handleLog(m,started){if(cfg.autoLog)doLog(m,started,task());else askLog(m,started)}
  function askLog(m,started){pending={m,d:ymd(new Date(started))};sheet="log";if(mounted)renderSheet()}
  let lastAward=null;
  function doLog(m,started,t,award){
    if(typeof readOnly==="function"&&readOnly()){toast("Switch to your own logbook to save sessions");return}
    saveLog({a:t.a,s:t.s,t:t.t,m,d:typeof started==="string"?started:ymd(new Date(started)),src:"pomodoro"});toast(`Logged ${m} min of ${t.s} 🌿${award?` · +${award.total} points`:""}`);
  }

  /* ---------- extras ---------- */
  async function keepAwake(on){try{if(on&&cfg.awake&&"wakeLock" in navigator&&!wake){wake=await navigator.wakeLock.request("screen");wake.addEventListener("release",()=>wake=null)}else if(!on&&wake){await wake.release();wake=null}}catch(_){}}
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&st.running)keepAwake(true)});
  function notify(title,body){try{if(cfg.notify&&"Notification" in window&&Notification.permission==="granted"&&document.hidden)new Notification(title,{body,icon:"icon.png",silent:true})}catch(_){}}

  /* ---------- rendering ---------- */
  function imm(){return cfg.layout==="immersive"}
  function vars(){const p=scene().pal;const light=scene().light;
    if(imm()&&!scene().painting){const d=(scene().imm||{dark:!light}).dark;
      return d?`--fz-bg:${p.bg};--fz-card:transparent;--fz-ink:#fff;--fz-muted:rgba(255,255,255,.78);--fz-accent:#fff;--fz-chip:rgba(255,255,255,.14);--fz-line:rgba(255,255,255,.3);--fz-on-accent:#1a1a1a;--fz-face:rgba(255,255,255,.08);--fz-card-solid:rgba(255,255,255,.24)`
              :`--fz-bg:${p.bg};--fz-card:transparent;--fz-ink:${p.ink};--fz-muted:${p.muted};--fz-accent:${p.accent};--fz-chip:rgba(255,255,255,.5);--fz-line:rgba(0,0,0,.12);--fz-on-accent:#fff;--fz-face:rgba(255,255,255,.55);--fz-card-solid:rgba(255,255,255,.85)`}
    return `--fz-bg:${p.bg};--fz-card:${p.card};--fz-ink:${p.ink};--fz-muted:${p.muted};--fz-accent:${p.accent};--fz-chip:${p.chip};--fz-line:${p.line};--fz-on-accent:${light?"#fff":"#1a1a1a"};--fz-face:${light?"#fffdf9":"rgba(255,255,255,.07)"};--fz-card-solid:${light?"#fff":"rgba(255,255,255,.13)"}`}
  function quote(){const q=QUOTES[st.phase];return q[(st.round*3+(st.phase==="focus"?0:1))%q.length]}
  function upNext(){const t=T();if(st.phase==="focus")return (st.round%t.r===0?"Long break":"Break")+" • "+(st.round%t.r===0?t.l:t.s)+"m";return "Focus • "+t.f+"m"}
  function ptsChip(){const s=Points.summary();return `★ ${s.total.toLocaleString()}${s.today?`<small>+${s.today} today</small>`:""}${s.chain>1?`<small>🔥${s.chain}</small>`:""}`}
  function topBar(){return `
        <a class="fz-chip icon" href="#home" title="Back to Logbook">${IC.back}<span class="lbl">Logbook</span></a>
        <button class="fz-chip" data-fz="settings" id="fzChip">${chipText()}</button>
        <span class="fz-sp"></span>
        <button class="fz-chip icon" data-fz="day" title="Today's focus timeline">${IC.cal}<span class="lbl">Today</span></button>
        <button class="fz-chip fz-pts" data-fz="points" id="fzPts" title="Focus points">${ptsChip()}</button>
        <div class="fz-sound"><button class="fz-round" data-fz="mute" title="Mute">${cfg.muted?IC.mute:IC.vol}</button><input class="fz-vol" type="range" id="fzVol" min="0" max="1" step="0.01" value="${cfg.vol}" style="--v:${cfg.vol*100}%"><select id="fzAmb" title="Ambient sound">${Sound.AMBIENTS.map(([k,n])=>`<option value="${k}" ${k===ambient()?"selected":""}>${n}</option>`).join("")}</select></div>
        <button class="fz-chip icon" data-fz="layout" title="${imm()?"Clean layout":"Immersive layout"}">${imm()?IC.clean:IC.imm}</button>
        <button class="fz-chip icon" data-fz="settings" title="Settings">${IC.gear}</button>
        <button class="fz-chip icon" data-fz="full" title="Full screen">${IC.full}</button>
        <button class="fz-chip" data-fz="end">${IC.x}<span class="lbl">End</span></button>`}
  function tabsHTML(){return `<div class="fz-tabs" id="fzTabs">${["focus","short","long"].map(ph=>`<button data-fzphase="${ph}" class="${ph===st.phase?"on":""}">${TAB[ph]}</button>`).join("")}</div>`}
  function midFocus(){return st.phase==="focus"&&!!st.startedAt&&elapsed()>=60000}
  function ctrlHTML(){const mid=midFocus();return `<div class="fz-ctrl" id="fzCtrl" data-mid="${mid?1:0}"><button class="fz-btn primary" data-fz="toggle" id="fzToggle">${st.running?IC.pause+"Pause":IC.play+(elapsed()>500?"Resume":"Start")}</button>
            <button class="fz-btn round" data-fz="reset" title="Restart this session">${IC.reset}</button>
            ${mid?`<button class="fz-btn" data-fz="finishEarly" title="Stop now and log the minutes you've done">✓ Finish &amp; log</button><button class="fz-btn ghost" data-fz="skipNoLog" title="Stop without logging or points">Skip</button>`:`<button class="fz-btn" data-fz="next">Next ${IC.next}</button>`}</div>`}
  function bgHTML(){const sc=scene();return sc.bg?sc.bg():`<div class="fz-bg-art">${sc.art()}</div>`}
  function viewImm(){const tk=task(),sc=scene(),d=(sc.imm||{}).dark;
    return `<div class="fz fz-imm ${d?"imm-dark":"imm-light"}" id="fzRoot" style="${vars()}">
      <div class="fz-bg" id="fzBg">${bgHTML()}</div><canvas class="fz-fx" id="fzFx"></canvas><div class="fz-shade"></div>
      <div class="fz-imm-top fz-top">${topBar()}</div>
      <div class="fz-imm-center">${tabsHTML()}
        <div class="fz-clock" id="fzClock" data-style="${cfg.clock}" data-fz="cycleClock" title="Tap to change the clock style">${Clocks.html(cfg.clock)}</div>
        <p class="fz-quote" id="fzQuote">“${quote()}”</p>${ctrlHTML()}
        <div id="fzSetup">${setupHTML()}</div>
        <button class="fz-imm-task" data-fz="task"><small>Working on</small><span>${esc(tk.s)} · ${esc(tk.t)}${tk.a?" — "+esc(tk.a):""}</span></button>
        <div class="fz-dots" id="fzDots">${dotsHTML()}</div></div>
      <div class="fz-imm-foot"><span class="cap">${sc.credit?esc(sc.credit):esc(sc.name)} · <i>${esc(sc.caption)}</i></span><span class="nx"><small>UP NEXT</small> <b id="fzNext">${upNext()}</b></span></div>
      <div id="fzPresence"></div><div id="fzSheet"></div></div>`}
  function viewGallery(){const tk=task(),sc=scene();
    return `<div class="fz fz-imm fz-gal imm-light" id="fzRoot" style="${vars()}">
      <div class="fz-imm-top fz-top">${topBar()}</div>
      <div class="gal">
        <figure class="gal-art"><div class="gal-hang" id="fzArt">${sc.art()}${sc.fx?`<canvas class="pt-fx" id="fzFx"></canvas>`:""}</div>
          <figcaption><span class="cap-h">${esc(sc.caption)}</span><span>${esc(sc.credit||sc.name)}</span></figcaption></figure>
        <div class="gal-panel">${tabsHTML()}
          <div class="fz-clock" id="fzClock" data-style="${cfg.clock}" data-fz="cycleClock" title="Tap to change the clock style">${Clocks.html(cfg.clock)}</div>
          <p class="fz-quote" id="fzQuote">“${quote()}”</p>${ctrlHTML()}
          <div id="fzSetup">${setupHTML()}</div>
          <button class="fz-imm-task" data-fz="task"><small>Working on</small><span>${esc(tk.s)} · ${esc(tk.t)}${tk.a?" — "+esc(tk.a):""}</span></button>
          <div class="fz-dots" id="fzDots">${dotsHTML()}</div>
          <div class="gal-next"><small>UP NEXT</small> <b id="fzNext">${upNext()}</b></div></div>
      </div>
      <div id="fzPresence"></div><div id="fzSheet"></div></div>`}
  function view(){
    if(imm())return scene().painting?viewGallery():viewImm();
    const t=T(),tk=task();
    return `<div class="fz" id="fzRoot" style="${vars()}"><div class="fz-shell">
      <div class="fz-top">${topBar()}</div>      <div class="fz-card">
        <div class="fz-left">
          <div class="fz-tabs" id="fzTabs">${["focus","short","long"].map(ph=>`<button data-fzphase="${ph}" class="${ph===st.phase?"on":""}">${TAB[ph]}</button>`).join("")}</div>
          <div class="fz-clock" id="fzClock" data-style="${cfg.clock}" data-fz="cycleClock" title="Tap to change the clock style">${Clocks.html(cfg.clock)}</div>
          <p class="fz-quote" id="fzQuote">“${quote()}”</p>
          ${ctrlHTML()}
          <div id="fzSetup">${setupHTML()}</div>
          <button class="fz-task" data-fz="task"><small>Working on</small><b>${esc(tk.s)} · ${esc(tk.t)}</b><span class="a">${tk.a?"— "+esc(tk.a):""}</span><span style="margin-left:auto">✎</span></button>
          <div class="fz-dots" id="fzDots">${dotsHTML()}</div>
        </div>
        <div class="fz-right"><div class="fz-art" id="fzArt">${scene().art()}</div><div class="fz-caption">${esc(scene().caption)}</div>${scene().credit?`<div class="fz-credit">${esc(scene().credit)}</div>`:""}
          <div class="fz-next"><small>UP NEXT</small><b id="fzNext">${upNext()}</b></div></div>
      </div></div><div id="fzPresence"></div><div id="fzSheet"></div></div>`;
  }
  function chipText(){const t=T();return `${esc(scene().name)} • ${t.f}/${t.s}`}
  function dotsHTML(){const t=T();const done=st.round-(st.phase==="focus"?1:0);return Array.from({length:t.r},(_,i)=>`<i class="${i<done?"on":""}"></i>`).join("")+`<span style="margin-left:6px">session ${Math.min(st.round,t.r)} of ${t.r} · long break after ${t.r-1} short ${t.r-1===1?"break":"breaks"}</span>`}
  function step(k,label,val,unit){return `<div class="fz-step"><small>${label}</small><div class="fz-stepper"><button data-fzadj="${k}:-1" aria-label="Less">−</button><b>${val}</b><button data-fzadj="${k}:1" aria-label="More">+</button></div><span>${unit}</span></div>`}
  function setupHTML(){if(!idle())return "";const t=T();
    return `<div class="fz-setup">${step("f","Focus",t.f,"min")}${step("s","Short break",t.s,"min")}${step("l","Long break",t.l,"min")}${step("x","Long break after",t.r-1,t.r-1===1?"short break":"short breaks")}</div>
    <div class="fz-quick"><small>Quick focus</small>${[15,25,30,45,60,90].map(m=>`<button data-fzquick="${m}" class="${m===t.f?"on":""}">${m}</button>`).join("")}</div>
    ${cfg.presets.length?`<div class="fz-quick"><small>Presets</small>${cfg.presets.map((p,i)=>`<button data-fzpreset="${i}">${esc(p.name)}</button>`).join("")}</div>`:""}`}
  let wasIdle=null;
  function refresh(){if(!mounted)return;const c=document.getElementById("fzChip");if(c)c.innerHTML=chipText();const sp=document.getElementById("fzSetup");if(sp)sp.innerHTML=setupHTML();wasIdle=idle();paint(true)}
  function render(el){
    if(typeof readOnly==="function"&&readOnly()&&typeof switchView==="function"){switchView(me);return}
    mounted=true;el.innerHTML=view();lastP=-1;paint(true);renderSheet();
    const sc=scene();if(Scenes.fitPaintings){Scenes.fitPaintings();requestAnimationFrame(Scenes.fitPaintings)}
    if(imm()&&sc.fx)Fx.start(sc.fx,document.getElementById("fzFx"));else Fx.stop();
    document.querySelectorAll(".pt-img").forEach(i=>i.addEventListener("load",()=>Scenes.fitPaintings&&Scenes.fitPaintings(),{once:true}));
  }
  function unmount(){if(mounted)Fx.stop();mounted=false}
  function paint(full){
    const r=remaining(),p=Math.min(1,Math.max(0,1-r/total()));
    const mini=document.getElementById("fzMini");
    if(mini){const show=!mounted&&(st.running||elapsed()>1000);mini.classList.toggle("on",show);if(show)mini.innerHTML=`<span>${st.running?"●":"❚❚"}</span><b>${PH[st.phase]}</b><span class="num">${fmt(r)}</span><span class="muted">${esc(task().s)}</span><span style="margin-left:auto">Open focus →</span>`}
    document.title=st.running?`${fmt(r)} · ${st.phase==="focus"?"Focus":"Break"} — Logbook`:"Logbook";
    if(!mounted||!document.getElementById("fzRoot"))return;
    if(full){const g=id=>document.getElementById(id);
      g("fzQuote").textContent="“"+quote()+"”";g("fzNext").textContent=upNext();
      g("fzToggle").innerHTML=st.running?IC.pause+"Pause":IC.play+(elapsed()>500?"Resume":"Start");
      g("fzDots").innerHTML=dotsHTML();document.querySelectorAll("#fzTabs button").forEach(b=>b.classList.toggle("on",b.dataset.fzphase===st.phase))}
    const cc=document.getElementById("fzCtrl");if(cc&&cc.dataset.mid!==(midFocus()?"1":"0"))cc.outerHTML=ctrlHTML();
    if(wasIdle!==idle()){wasIdle=idle();const sp=document.getElementById("fzSetup");if(sp)sp.innerHTML=setupHTML()}
    const ck=document.getElementById("fzClock");if(ck){const inner=ck.firstElementChild;if(inner){inner.dataset.run=st.running?"1":"0";Clocks.paint(cfg.clock,inner,r,total(),LBL[st.phase])}}
    const sc=scene();if(full||Math.abs(p-lastP)>.002){const ctx={phase:st.phase,started:!!st.startedAt,running:st.running,focusMin:mins("focus"),raw:p};const pp=st.phase==="focus"?p:1-p;
      if(imm()&&!sc.painting){const b=document.getElementById("fzBg");if(b){if(sc.bgUpdate)sc.bgUpdate(b,pp,ctx);else if(!sc.bg&&sc.update)sc.update(b,pp,ctx)}}
      else{const a=document.getElementById("fzArt");if(a&&sc.update)sc.update(a,pp,ctx)}lastP=p}
    const pr=document.getElementById("fzPresence");if(pr){const need=Points.needsPresence(st);if(need!==(pr.dataset.on==="1")){pr.dataset.on=need?"1":"0";
      pr.innerHTML=need?`<div class="fz-presence"><div><b>Welcome back 👋</b><span>The next session started on its own. Tap anywhere or press a key to confirm you're here — focus points count from now.</span></div></div>`:""}}
    if(full){const pt=document.getElementById("fzPts");if(pt)pt.innerHTML=ptsChip()}
    const rt=document.getElementById("fzRoot");if(rt&&imm()){rt.classList.toggle("calm",st.running&&!sheet&&Date.now()-lastMove>4500);rt.classList.toggle("running",!idle())}
  }
  let lastMove=Date.now();["pointermove","pointerdown","keydown","touchstart"].forEach(ev=>document.addEventListener(ev,()=>{lastMove=Date.now()},{passive:true}));
  ["pointerdown","keydown"].forEach(ev=>document.addEventListener(ev,()=>{if(Points.needsPresence(st)){Points.confirm(st);save();paint(true)}},true));
  let lastSave=0;
  setInterval(()=>{if(st.running){Points.tick(st);if(Date.now()-lastSave>15000){lastSave=Date.now();save()}}if(st.running&&Date.now()>=st.endAt)complete();if(st.running||mounted)paint(false)},250);

  /* ---------- sheets ---------- */
  function pv(k){return Scenes.preview?Scenes.preview(k):`background:${Scenes[k].pal.bg}`}
  const sceneKeys=()=>Object.keys(Scenes).filter(k=>Scenes[k]&&Scenes[k].art);
  function renderSheet(){
    const host=document.getElementById("fzSheet");if(!host)return;
    if(!sheet){host.innerHTML="";return}
    let h="";const t=T(),tk=task();
    if(sheet==="settings"){
      h=`<div class="row"><h3>Focus settings</h3><span class="spacer"></span><button class="fz-pbtn sec" data-fz="close">Done</button></div>
      <h4>Layout</h4><div class="fz-layouts"><button class="fz-lay ${!imm()?"on":""}" data-fzlayout="clean"><div class="pv lay-clean"><i></i><i></i></div><b>Clean</b><small>Card with the timer and an illustration</small></button>
        <button class="fz-lay ${imm()?"on":""}" data-fzlayout="immersive"><div class="pv lay-imm" style="${pv("alpine")}"><i></i></div><b>Immersive</b><small>Full-screen scene, big centred clock</small></button></div>
      ${["Paintings","Illustrations"].map(g=>`<h4>${g==="Paintings"?"Paintings <small style='text-transform:none;letter-spacing:0;font-weight:500'>· public-domain impressionist works</small>":"Illustrations"}</h4><div class="fz-scenes">${sceneKeys().filter(k=>(Scenes[k].group||"Illustrations")===g).map(k=>`<button class="fz-sc ${k===cfg.scene?"on":""}" data-fzscene="${k}"><div class="pv" style="${pv(k)}"></div><span>${Scenes[k].name}</span></button>`).join("")}</div>`).join("")}
      <h4>Clock</h4><div class="fz-clocks">${Clocks.STYLES.map(([k,n])=>`<button class="fz-ckopt ${k===cfg.clock?"on":""}" data-fzclock="${k}">${Clocks.icon(k)}<span>${n}</span></button>`).join("")}</div>
      <h4>Timer</h4><div class="fz-pills">${Object.entries(TIMERS).map(([k,v])=>`<button class="fz-pill ${k===cfg.timer?"on":""}" data-fztimer="${k}">${v.n}<small>${v.f}/${v.s}</small></button>`).join("")}<button class="fz-pill ${cfg.timer==="custom"?"on":""}" data-fztimer="custom">Custom</button></div>
      ${cfg.timer==="custom"?`<div class="fz-nums"><label>Focus (min)<input type="number" min="1" max="180" id="fzcf" value="${cfg.custom.f}"></label><label>Short break<input type="number" min="1" max="60" id="fzcs" value="${cfg.custom.s}"></label><label>Long break<input type="number" min="1" max="90" id="fzcl" value="${cfg.custom.l}"></label><label>Short breaks before long<input type="number" min="1" max="12" id="fzcx" value="${cfg.custom.r-1}"></label></div>`:`<p style="color:#958a80;font-size:13px;margin:10px 0 0">${t.f} min focus · ${t.s} min break · ${t.l} min long break after ${t.r-1} short breaks</p>`}
      <h4>My presets</h4><p style="color:#958a80;font-size:13px;margin:-4px 0 10px">Saves the timer, scene, sounds, clock and what you're working on.</p>
      <div class="fz-presets">${cfg.presets.map((p,i)=>`<div class="fz-preset"><button data-fzpreset="${i}"><b>${esc(p.name)}</b><small>${p.f}/${p.s}/${p.l} · ${esc((Scenes[p.scene]||{}).name||"")} · ${esc((Clocks.STYLES.find(c=>c[0]===p.clock)||["",""])[1])}${p.task?" · "+esc(p.task.s):""}</small></button><button class="x" data-fzpdel="${i}" aria-label="Delete preset">×</button></div>`).join("")||'<p style="color:#958a80;font-size:13px">No presets yet.</p>'}</div>
      <div class="row" style="margin-top:10px"><input type="text" id="fzpName" maxlength="40" placeholder="Name, e.g. DALF deep work" style="flex:1"><button class="fz-pbtn sec" data-fz="savePreset">Save current</button></div>
      <h4>Sounds</h4>
      <div class="fz-sw"><div>Ambient sound<small>Plays while the timer runs</small></div><select id="fzsAmb"><option value="">Scene default (${Sound.AMBIENTS.find(a=>a[0]===scene().ambient)[1]})</option>${Sound.AMBIENTS.map(([k,n])=>`<option value="${k}" ${k===cfg.ambient?"selected":""}>${n}</option>`).join("")}</select></div>
      <div class="fz-sw"><div>End of focus<small>A gentle signal, never an alarm</small></div><div class="row"><select id="fzsBell"><option value="">Scene default (${Sound.BELLS.find(a=>a[0]===scene().bell)[1]})</option>${Sound.BELLS.map(([k,n])=>`<option value="${k}" ${k===cfg.bell?"selected":""}>${n}</option>`).join("")}</select><button class="fz-pbtn sec" data-fz="testBell">▶</button></div></div>
      <div class="fz-sw"><div>End of break</div><div class="row"><select id="fzsBreak"><option value="">Scene default (${Sound.BELLS.find(a=>a[0]===scene().breakBell)[1]})</option>${Sound.BELLS.map(([k,n])=>`<option value="${k}" ${k===cfg.breakBell?"selected":""}>${n}</option>`).join("")}</select><button class="fz-pbtn sec" data-fz="testBreak">▶</button></div></div>
      <h4>Flow</h4>
      ${sw("living","Living paintings","Gentle motion on the paintings — rippling water, wind in the grass, a shimmering sky")}
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
    }else if(sheet==="day"){h=dayHTML();
    }else if(sheet==="points"){
      const S=Points.summary();const ex=Points.score(25,25,3,30000,true);
      h=`<div class="row"><h3>Focus points</h3><span class="spacer"></span><button class="fz-pbtn sec" data-fz="close">Close</button></div>
      <div class="fz-ptgrid"><div><small>Today</small><b>${S.today}</b></div><div><small>Last 7 days</small><b>${S.week}</b></div><div><small>All time</small><b>${S.total.toLocaleString()}</b></div><div><small>Chain</small><b>${S.chain?"🔥 "+S.chain:"—"}</b></div></div>
      ${S.due?`<p class="fz-due">${S.due>Date.now()?`Be back by <b>${new Date(S.due).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</b> to keep your chain and get the on-time bonus.`:`Your break ended — start within ${Math.max(0,Math.ceil((S.due+S.graceMin*60000-Date.now())/60000))} min to keep the chain.`}</p>`:""}
      <h4>How you earn</h4><ul class="fz-rules">
        <li><b>1 point per minute</b> of focus while the timer runs — pausing earns nothing.</li>
        <li><b>Longer sessions</b> earn more per minute: up to ×1.4 for 65+ minute sessions.</li>
        <li><b>Finishing</b> a session adds +20%. Ending early still pays for the minutes you did.</li>
        <li><b>Chains</b>: each session started on time after its break adds ×0.1 (up to ×1.5), plus an on-time bonus of +5 (within 1 min), +3 (3 min) or +1 (5 min).</li>
        <li><b>No stalling</b>: the break deadline is set when focus ends. Waiting on the start screen or pausing the break doesn't move it — more than ${S.graceMin} min late resets the chain.</li>
        <li><b>Presence</b>: a session that starts automatically needs one tap to confirm you're there; until then it earns nothing.</li></ul>
      <p style="color:#958a80;font-size:12.5px">Example: a finished 25-min session, 3rd in a row, back within 30 s → ${ex.base} + ${ex.comp} + ${ex.onT} = <b>${ex.total} points</b>.</p>
      <h4>Recent sessions</h4>${S.recent.map(r=>`<div class="fz-ptrow"><span>${new Date(r.t).toLocaleString([], {weekday:"short",hour:"2-digit",minute:"2-digit"})} · ${r.min} min${r.n>1?` · 🔥${r.n}`:""}</span><b>+${r.total}</b></div>`).join("")||'<p style="color:#958a80;font-size:13px">No sessions yet — start one!</p>'}`;
    }else if(sheet==="done"&&pending){
      const brk=st.phase!=="focus",bm=mins(st.phase),fm=mins("focus");const aw=pending.award;
      h=`<div class="fz-done"><div class="leaf">🌿</div><h3>${pending.early?"Stopped early — the work still counts":"Nicely done"}</h3><p>${pending.m} minute${pending.m===1?"":"s"} of focus${pending.logged?" — saved to your logbook ✓":". It'll be saved with:"}</p>
        ${aw?`<div class="fz-earn"><b>+${aw.total} focus points</b><span>${aw.min} min${aw.lenM>1?` × ${aw.lenM.toFixed(2)} length`:""}${aw.chM>1?` × ${aw.chM.toFixed(1)} chain`:""}${aw.comp?` · +${aw.comp} finish`:""}${aw.onT?` · +${aw.onT} on time`:""}</span></div>`:`<div class="fz-earn none"><span>No points this time — the session wasn't confirmed as attended.</span></div>`}</div>
      ${pending.logged?"":logFields(tk)}
      <h4 style="text-align:center;margin-top:18px">What's next?</h4>
      ${brk?`<p class="fz-due" style="text-align:center">Break until <b>${new Date(Date.now()+bm*60000).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</b> — come back on time to grow your chain 🔥</p>`:""}
      <div class="fz-choice">${brk?`<button data-fzdone="break"><span>☕</span><b>${st.running?"Continue":"Take a"} ${bm}-min ${st.phase==="long"?"long ":""}break</b><small>${st.phase==="long"?"You've earned a proper rest":"Stretch, water, look away"}</small></button>`:""}
        <button data-fzdone="focus"><span>🎯</span><b>Keep focusing · ${fm} min</b><small>${brk?"Skip the break this time":"Start the next session"}</small></button></div>
      <p style="text-align:center;margin:14px 0 0"><button class="fz-link" data-fzdone="later">${pending.logged?"Decide later":"Don't save this session"}</button></p>`;
    }else if(sheet==="log"&&pending){
      h=`<div class="fz-done"><div class="leaf">🌿</div><h3>Nicely done</h3><p>${pending.m} minute${pending.m===1?"":"s"} of focus. Save it to your logbook?</p></div>${logFields(tk)}
      <div class="row" style="justify-content:flex-end"><button class="fz-pbtn sec" data-fz="skipLog">Not now</button><button class="fz-pbtn" data-fz="saveLog">Save to logbook</button></div>`;
    }
    host.innerHTML=`<div class="fz-scrim" data-fz="scrim"><div class="fz-panel">${h}</div></div>`;
  }
  let dayView=null;
  const HUES=["#8fa287","#7891a6","#a9a0c6","#6e9e99","#c99c84","#b48fa6","#9aa86e","#8c9db8"];
  function hue(sub){let h=0;for(const c of sub)h=(h*31+c.charCodeAt(0))>>>0;return HUES[h%HUES.length]}
  const hm=t=>new Date(t).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  function dayHTML(){
    const day=dayView||ymd(new Date());const d0=new Date(day+"T00:00:00").getTime();
    const list=tlLoad().filter(e=>e.day===day);
    if(day===ymd(new Date())&&st.phase==="focus"&&st.startedAt&&(st.segs||[]).length){const tk=task();list.push({live:true,segs:st.segs.map(x=>[x[0],x[1]||Date.now()]),s:tk.s,t:tk.t,a:tk.a,min:Math.round(elapsed()/60000)})}
    list.sort((a,b)=>a.segs[0][0]-b.segs[0][0]);
    const total=list.reduce((a,e)=>a+e.segs.reduce((x,g)=>x+g[1]-g[0],0),0);
    let h0=8,h1=20;if(list.length){const st0=Math.min(...list.map(e=>e.segs[0][0])),en=Math.max(...list.map(e=>e.segs[e.segs.length-1][1]));h0=Math.max(0,Math.floor((st0-d0)/36e5)-1);h1=Math.min(24,Math.max(h0+4,Math.ceil((en-d0)/36e5)+1))}
    const PX=56,H=(h1-h0)*PX;const y=t=>((t-d0)/36e5-h0)*PX;
    let grid="";for(let hh=h0;hh<=h1;hh++)grid+=`<div class="tl-hr" style="top:${(hh-h0)*PX}px"><span>${String(hh).padStart(2,"0")}:00</span></div>`;
    let blocks="";list.forEach(e=>{const c=hue(e.s);e.segs.forEach((g,i)=>{const top=y(g[0]),hgt=Math.max(5,y(g[1])-top);
      blocks+=`<div class="tl-blk${e.live?" live":""}" style="top:${top}px;height:${hgt}px;--c:${c}" title="${hm(g[0])}–${hm(g[1])} · ${esc(e.s)} · ${esc(e.t)}${e.a?" — "+esc(e.a):""}">${i===0&&hgt>=22?`<b>${hm(g[0])}–${hm(e.segs[e.segs.length-1][1])}</b> ${esc(e.s)} · ${esc(e.t)}${e.a?` <span>— ${esc(e.a)}</span>`:""}`:""}</div>`})});
    const nowL=day===ymd(new Date())?`<div class="tl-now" style="top:${y(Date.now())}px"></div>`:"";
    let rows="";list.forEach((e,i)=>{if(i){const gap=e.segs[0][0]-list[i-1].segs[list[i-1].segs.length-1][1];if(gap>=60000)rows+=`<div class="tl-gap">${gap<3*36e5?`☕ ${Math.round(gap/60000)} min break`:`· · ·`}</div>`}
      const ms=e.segs.reduce((x,g)=>x+g[1]-g[0],0);
      rows+=`<div class="tl-row"><i style="background:${hue(e.s)}"></i><div><b>${hm(e.segs[0][0])} – ${hm(e.segs[e.segs.length-1][1])}</b> · ${Math.round(ms/60000)} min${e.segs.length>1?` <small>(${e.segs.length} parts, paused in between)</small>`:""}<br><span>${esc(e.s)} · ${esc(e.t)}${e.a?" — "+esc(e.a):""}</span></div><em>${e.live?"in progress":e.full?"✓ finished":"stopped early"}${e.pts?` · +${e.pts}★`:""}</em></div>`});
    const dd=new Date(day+"T12:00:00");
    return `<div class="row"><h3>Focus timeline</h3><span class="spacer"></span><button class="fz-pbtn sec" data-fz="close">Close</button></div>
      <div class="tl-nav"><button class="fz-pbtn sec" data-fzday="-1">‹</button><b>${dd.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"})}</b><button class="fz-pbtn sec" data-fzday="1" ${day>=ymd(new Date())?"disabled":""}>›</button></div>
      <p class="tl-sum">${list.length?`<b>${total>=36e5?Math.floor(total/36e5)+" h ":""}${Math.round(total%36e5/60000)} min</b> focused in ${list.length} session${list.length===1?"":"s"}`:"No focus sessions on this day."}</p>
      ${list.length?`<div class="tl-wrap"><div class="tl" style="height:${H}px">${grid}${blocks}${nowL}</div></div><h4>Sessions</h4>${rows}`:""}
      <p style="color:#958a80;font-size:12px;margin-top:14px">Only sessions run with the focus timer appear here (they're the ones with exact start and end times). Saved on this device.</p>`;
  }
  function logFields(tk){const subs=subjects();if(!subs.includes(tk.s))subs.unshift(tk.s);
    return `<div class="field"><label>Activity</label><input type="text" id="fzlA" maxlength="300" value="${esc(tk.a)}" placeholder="What did you do?"></div>
      <div class="two"><div class="field"><label>Subject</label><select id="fzlS">${subs.map(s=>`<option ${s===tk.s?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Type</label><select id="fzlT">${types().map(x=>`<option ${x===tk.t?"selected":""}>${esc(x)}</option>`).join("")}</select></div></div>
      <div class="two"><div class="field"><label>Minutes</label><input type="number" id="fzlM" min="1" max="1440" value="${pending.m}"></div><div class="field"><label>&nbsp;</label><label style="font-weight:500;display:flex;gap:8px;align-items:center"><input type="checkbox" id="fzlAuto"> Always log automatically</label></div></div>`}
  function sw(k,label,sub){return `<label class="fz-sw"><div>${label}${sub?`<small>${sub}</small>`:""}</div><input type="checkbox" data-fzsw="${k}" ${cfg[k]?"checked":""}></label>`}
  function rerender(){const v=document.getElementById("view");if(mounted&&v)render(v)}

  /* ---------- events ---------- */
  document.addEventListener("click",e=>{
    const sc=e.target.closest("[data-fzscene]");if(sc){cfg.scene=sc.dataset.fzscene;save();if(amPlaying&&!cfg.ambient)Sound.setAmbient(ambient());rerender();return}
    const tm=e.target.closest("[data-fztimer]");if(tm){const was=!st.running&&elapsed()<1000;cfg.timer=tm.dataset.fztimer;save();if(was){st=fresh(st.phase,st.round);save()}rerender();return}
    const ph=e.target.closest("[data-fzphase]");if(ph){switchPhase(ph.dataset.fzphase);return}
    const adj=e.target.closest("[data-fzadj]");if(adj){const [k,d]=adj.dataset.fzadj.split(":");adjust(k,+d);return}
    const q=e.target.closest("[data-fzquick]");if(q){setTimer("f",+q.dataset.fzquick);return}
    const ckb=e.target.closest("[data-fzclock]");if(ckb){cfg.clock=ckb.dataset.fzclock;save();rerender();sheet="settings";renderSheet();return}
    const pr=e.target.closest("[data-fzpreset]");if(pr){const p=cfg.presets[+pr.dataset.fzpreset];if(p){sheet=null;applyPreset(p)}return}
    const pd=e.target.closest("[data-fzpdel]");if(pd){cfg.presets.splice(+pd.dataset.fzpdel,1);save();renderSheet();refresh();return}
    const dn=e.target.closest("[data-fzdone]");if(dn){const c=dn.dataset.fzdone;if(c==="later"){pending=null;sheet=null;rerender()}else doneChoice(c);return}
    const dv=e.target.closest("[data-fzday]");if(dv){const d=new Date((dayView||ymd(new Date()))+"T12:00:00");d.setDate(d.getDate()+(+dv.dataset.fzday));const nd=ymd(d);if(nd<=ymd(new Date())){dayView=nd;renderSheet()}return}
    const ly=e.target.closest("[data-fzlayout]");if(ly){cfg.layout=ly.dataset.fzlayout;save();rerender();sheet="settings";renderSheet();return}
    const a=e.target.closest("[data-fz]");if(!a)return;const k=a.dataset.fz;
    if(k==="scrim"&&e.target!==a)return;
    if(k==="toggle"){st.running?pause():start(true)}
    else if(k==="reset")reset();
    else if(k==="next")next();
    else if(k==="end")end();
    else if(k==="settings"){sheet="settings";renderSheet()}
    else if(k==="points"){sheet="points";renderSheet()}
    else if(k==="day"){dayView=null;sheet="day";renderSheet()}
    else if(k==="finishEarly")finishEarly();
    else if(k==="skipNoLog")skipNoLog();
    else if(k==="layout"){cfg.layout=imm()?"clean":"immersive";save();rerender()}
    else if(k==="task"){sheet="task";renderSheet()}
    else if(k==="close"||k==="scrim"){if(sheet==="log"||sheet==="done")return;sheet=null;renderSheet()}
    else if(k==="cycleClock"){const i=Clocks.STYLES.findIndex(c=>c[0]===cfg.clock);cfg.clock=Clocks.STYLES[(i+1)%Clocks.STYLES.length][0];save();const ck=document.getElementById("fzClock");ck.dataset.style=cfg.clock;ck.innerHTML=Clocks.html(cfg.clock);paint(true);toast("Clock: "+Clocks.STYLES.find(c=>c[0]===cfg.clock)[1])}
    else if(k==="savePreset"){const n=(document.getElementById("fzpName").value||"").trim();if(!n)return toast("Give the preset a name");const t=T();
      const pre={name:n,f:t.f,s:t.s,l:t.l,r:t.r,scene:cfg.scene,ambient:cfg.ambient,bell:cfg.bell,breakBell:cfg.breakBell,clock:cfg.clock,task:cfg.task?{...cfg.task}:null};
      const i=cfg.presets.findIndex(p=>p.name.toLowerCase()===n.toLowerCase());if(i>=0)cfg.presets[i]=pre;else cfg.presets.push(pre);save();renderSheet();refresh();toast("Preset saved")}
    else if(k==="mute"){cfg.muted=!cfg.muted;Sound.setVolume(cfg.muted?0:cfg.vol);save();a.innerHTML=cfg.muted?IC.mute:IC.vol}
    else if(k==="full"){try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}catch(_){}}
    else if(k==="testBell"){Sound.ensure();Sound.setVolume(cfg.muted?0:cfg.vol);Sound.play(bell())}
    else if(k==="testBreak"){Sound.ensure();Sound.setVolume(cfg.muted?0:cfg.vol);Sound.play(breakBell())}
    else if(k==="saveTask"){cfg.task={s:document.getElementById("fztS").value,t:document.getElementById("fztT").value,a:document.getElementById("fztA").value.trim()};save();sheet=null;rerender()}
    else if(k==="saveLog"&&pending){const t=readLogForm();if(!t)return;doLog(t.m,pending.d,t);pending=null;sheet=null;rerender()}
    else if(k==="skipLog"){pending=null;sheet=null;renderSheet()}
  });
  document.addEventListener("change",e=>{
    const id=e.target.id;
    if(id==="fzAmb"){cfg.ambient=e.target.value===scene().ambient?null:e.target.value;save();if(st.running)Sound.setAmbient(ambient())}
    else if(id==="fzsAmb"){cfg.ambient=e.target.value||null;save();if(st.running)Sound.setAmbient(ambient());const s=document.getElementById("fzAmb");if(s)s.value=ambient()}
    else if(id==="fzsBell"){cfg.bell=e.target.value||null;save()}
    else if(id==="fzsBreak"){cfg.breakBell=e.target.value||null;save()}
    else if(/^fzc[fslx]$/.test(id)){const v=parseInt(e.target.value,10);if(v>0)setTimer(id[3],v)}
    else if(e.target.dataset&&e.target.dataset.fzsw){const k=e.target.dataset.fzsw;cfg[k]=e.target.checked;save();
      if(k==="living"){Scenes._living=cfg.living;rerender();sheet="settings";renderSheet()}if(k==="notify"&&cfg.notify&&"Notification" in window&&Notification.permission==="default")Notification.requestPermission();if(k==="awake")keepAwake(cfg.awake&&st.running)}
  });
  document.addEventListener("input",e=>{if(e.target.id==="fzVol"){cfg.vol=+e.target.value;cfg.muted=false;e.target.style.setProperty("--v",cfg.vol*100+"%");Sound.setVolume(cfg.vol);save()}});
  document.addEventListener("keydown",e=>{if(!mounted||sheet)return;if(e.code==="Space"&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();st.running?pause():start(true)}});

  // resume a session that was running when the page was closed/reloaded
  if(st.running&&Date.now()>=st.endAt){setTimeout(complete,1500)}
  // study together: start a focus that ends at the same moment as someone else's
  function joinAt(endAt){
    const ms=endAt-Date.now();if(ms<60000){toast("That session is almost over");return false}
    if(st.phase==="focus"&&st.running){toast("Finish or skip your current focus first");return false}
    if(st.phase==="focus"&&st.startedAt)partial();
    if(st.phase!=="focus")Points.skipBreak();
    st=fresh("focus",st.phase==="long"?1:st.phase==="short"?st.round+1:st.round);st.tot=ms;st.remain=ms;st.joined=true;
    start(true);if(mounted)rerender();return true;
  }
  function state(){const tk=task();return {phase:st.phase,running:st.running,started:!!st.startedAt,endAt:st.running?st.endAt:null,remain:remaining(),total:total(),s:tk.s,t:tk.t,focusMin:T().f}}
  function reloadCfg(){cfg=load();delete cfg._st;Scenes._living=cfg.living!==false;if(mounted)rerender()}
  return{render,unmount,paint,joinAt,state,reloadCfg,get running(){return st.running}};
})();
