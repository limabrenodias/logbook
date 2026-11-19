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
    autoBreak:true,autoFocus:false,autoLog:false,notify:false,awake:true,task:null,clock:"ring",presets:[]};
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
  const PH={focus:"Focus mode",short:"Short break",long:"Long break"};const TAB={focus:"Focus",short:"Short break",long:"Long break"};const LBL={focus:"focus",short:"short break",long:"long break"};
  function idle(){return !st.running&&elapsed()<1000}

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
    const rt=document.getElementById("fzRoot");if(rt){rt.classList.add("fz-root-done");setTimeout(()=>rt.classList.remove("fz-root-done"),2500)}
    if(was==="focus"){const m=mins("focus");Sound.play(bell());notify("Focus session complete","Time for a gentle break 🍵");
      if(cfg.autoLog)doLog(m,started,task());
      advance(cfg.autoBreak);if(!cfg.autoBreak){Sound.stopAmbient();amPlaying=false;keepAwake(false)}
      if(!(cfg.autoLog&&cfg.autoBreak)){pending={m,d:ymd(new Date(started)),logged:cfg.autoLog,done:true};sheet="done";if(mounted)renderSheet()}}
    else{Sound.play(breakBell());notify("Break's over","Ready when you are 🌿");advance(cfg.autoFocus);if(!cfg.autoFocus){Sound.stopAmbient();amPlaying=false;keepAwake(false)}}
  }
  function switchPhase(ph){
    if(ph===st.phase&&idle())return;
    if(st.phase==="focus"){const m=Math.round(elapsed()/60000);if(m>=1)askLog(m,st.startedAt||Date.now())}
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
    if(choice==="focus"){st=fresh("focus",st.phase==="long"?1:st.phase==="focus"?st.round:st.round+1);save();start()}
    else if(choice==="break"&&!st.running)start();
    rerender();
  }
  function readLogForm(){const t={s:document.getElementById("fzlS").value,t:document.getElementById("fzlT").value,a:document.getElementById("fzlA").value.trim()};
    const m=parseInt(document.getElementById("fzlM").value,10);if(!(m>0&&m<=1440)){toast("Check the minutes");return null}
    if(document.getElementById("fzlAuto").checked)cfg.autoLog=true;cfg.task={s:t.s,t:t.t,a:t.a};save();return {...t,m}}
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
    return `--fz-bg:${p.bg};--fz-card:${p.card};--fz-ink:${p.ink};--fz-muted:${p.muted};--fz-accent:${p.accent};--fz-chip:${p.chip};--fz-line:${p.line};--fz-on-accent:${light?"#fff":"#1a1a1a"};--fz-face:${light?"#fffdf9":"rgba(255,255,255,.07)"};--fz-card-solid:${light?"#fff":"#1c1f2a"}`}
  function quote(){const q=QUOTES[st.phase];return q[(st.round*3+(st.phase==="focus"?0:1))%q.length]}
  function upNext(){const t=T();if(st.phase==="focus")return (st.round%t.r===0?"Long break":"Break")+" • "+(st.round%t.r===0?t.l:t.s)+"m";return "Focus • "+t.f+"m"}
  function view(){
    const t=T(),tk=task();
    return `<div class="fz" id="fzRoot" style="${vars()}"><div class="fz-shell">
      <div class="fz-top">
        <a class="fz-chip icon" href="#home" title="Back to Logbook">${IC.back}<span class="lbl">Logbook</span></a>
        <button class="fz-chip" data-fz="settings" id="fzChip">${chipText()}</button>
        <span class="fz-sp"></span>
        <div class="fz-sound"><button class="fz-round" data-fz="mute" title="Mute">${cfg.muted?IC.mute:IC.vol}</button><input class="fz-vol" type="range" id="fzVol" min="0" max="1" step="0.01" value="${cfg.vol}" style="--v:${cfg.vol*100}%"><select id="fzAmb" title="Ambient sound">${Sound.AMBIENTS.map(([k,n])=>`<option value="${k}" ${k===ambient()?"selected":""}>${n}</option>`).join("")}</select></div>
        <button class="fz-chip icon" data-fz="settings" title="Settings">${IC.gear}</button>
        <button class="fz-chip icon" data-fz="full" title="Full screen">${IC.full}</button>
        <button class="fz-chip" data-fz="end">${IC.x}<span class="lbl">End</span></button>
      </div>
      <div class="fz-card">
        <div class="fz-left">
          <div class="fz-tabs" id="fzTabs">${["focus","short","long"].map(ph=>`<button data-fzphase="${ph}" class="${ph===st.phase?"on":""}">${TAB[ph]}</button>`).join("")}</div>
          <div class="fz-clock" id="fzClock" data-style="${cfg.clock}" data-fz="cycleClock" title="Tap to change the clock style">${Clocks.html(cfg.clock)}</div>
          <p class="fz-quote" id="fzQuote">“${quote()}”</p>
          <div class="fz-ctrl"><button class="fz-btn primary" data-fz="toggle" id="fzToggle">${st.running?IC.pause+"Pause":IC.play+(elapsed()>500?"Resume":"Start")}</button>
            <button class="fz-btn round" data-fz="reset" title="Restart this session">${IC.reset}</button>
            <button class="fz-btn" data-fz="next">Next ${IC.next}</button></div>
          <div id="fzSetup">${setupHTML()}</div>
          <button class="fz-task" data-fz="task"><small>Working on</small><b>${esc(tk.s)} · ${esc(tk.t)}</b><span class="a">${tk.a?"— "+esc(tk.a):""}</span><span style="margin-left:auto">✎</span></button>
          <div class="fz-dots" id="fzDots">${dotsHTML()}</div>
        </div>
        <div class="fz-right"><div class="fz-art" id="fzArt">${scene().art()}</div><div class="fz-caption">${esc(scene().caption)}</div>
          <div class="fz-next"><small>UP NEXT</small><b id="fzNext">${upNext()}</b></div></div>
      </div></div><div id="fzSheet"></div></div>`;
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
  }
  function unmount(){mounted=false}
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
    if(wasIdle!==idle()){wasIdle=idle();const sp=document.getElementById("fzSetup");if(sp)sp.innerHTML=setupHTML()}
    const ck=document.getElementById("fzClock");if(ck){const inner=ck.firstElementChild;if(inner){inner.dataset.run=st.running?"1":"0";Clocks.paint(cfg.clock,inner,r,total(),LBL[st.phase])}}
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
    }else if(sheet==="done"&&pending){
      const brk=st.phase!=="focus",bm=mins(st.phase),fm=mins("focus");
      h=`<div class="fz-done"><div class="leaf">🌿</div><h3>Nicely done</h3><p>${pending.m} minute${pending.m===1?"":"s"} of focus${pending.logged?" — saved to your logbook ✓":". It'll be saved with:"}</p></div>
      ${pending.logged?"":logFields(tk)}
      <h4 style="text-align:center;margin-top:18px">What's next?</h4>
      <div class="fz-choice">${brk?`<button data-fzdone="break"><span>☕</span><b>${st.running?"Continue":"Take a"} ${bm}-min ${st.phase==="long"?"long ":""}break</b><small>${st.phase==="long"?"You've earned a proper rest":"Stretch, water, look away"}</small></button>`:""}
        <button data-fzdone="focus"><span>🎯</span><b>Keep focusing · ${fm} min</b><small>${brk?"Skip the break this time":"Start the next session"}</small></button></div>
      <p style="text-align:center;margin:14px 0 0"><button class="fz-link" data-fzdone="later">${pending.logged?"Decide later":"Don't save this session"}</button></p>`;
    }else if(sheet==="log"&&pending){
      h=`<div class="fz-done"><div class="leaf">🌿</div><h3>Nicely done</h3><p>${pending.m} minute${pending.m===1?"":"s"} of focus. Save it to your logbook?</p></div>${logFields(tk)}
      <div class="row" style="justify-content:flex-end"><button class="fz-pbtn sec" data-fz="skipLog">Not now</button><button class="fz-pbtn" data-fz="saveLog">Save to logbook</button></div>`;
    }
    host.innerHTML=`<div class="fz-scrim" data-fz="scrim"><div class="fz-panel">${h}</div></div>`;
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
    const a=e.target.closest("[data-fz]");if(!a)return;const k=a.dataset.fz;
    if(k==="scrim"&&e.target!==a)return;
    if(k==="toggle"){st.running?pause():start()}
    else if(k==="reset")reset();
    else if(k==="next")next();
    else if(k==="end")end();
    else if(k==="settings"){sheet="settings";renderSheet()}
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
      if(k==="notify"&&cfg.notify&&"Notification" in window&&Notification.permission==="default")Notification.requestPermission();if(k==="awake")keepAwake(cfg.awake&&st.running)}
  });
  document.addEventListener("input",e=>{if(e.target.id==="fzVol"){cfg.vol=+e.target.value;cfg.muted=false;e.target.style.setProperty("--v",cfg.vol*100+"%");Sound.setVolume(cfg.vol);save()}});
  document.addEventListener("keydown",e=>{if(!mounted||sheet)return;if(e.code==="Space"&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();st.running?pause():start()}});

  // resume a session that was running when the page was closed/reloaded
  if(st.running&&Date.now()>=st.endAt){setTimeout(complete,1500)}
  return{render,unmount,paint,get running(){return st.running}};
})();
