/* Clock faces for focus mode. Each style: html(label) → markup, paint(el, remainingMs, totalMs, label). */
"use strict";
const Clocks=(()=>{
  const fmt=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return [Math.floor(s/60),s%60]};
  const mmss=ms=>{const [m,s]=fmt(ms);return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")};
  const STYLES=[["ring","Ring"],["digital","Digital"],["classic","Classic dial"],["alarm","Alarm clock"]];

  /* ---------- Ring ---------- */
  const R=132,C=2*Math.PI*R;
  const ring={
    html:()=>`<div class="ck ck-ring"><svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="${R}" fill="none" stroke="var(--fz-line)" stroke-width="9"/>
      <circle class="ck-arc" cx="150" cy="150" r="${R}" fill="none" stroke="var(--fz-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 150 150)"/>
      <circle class="ck-knob" r="8" fill="var(--fz-accent)" stroke="var(--fz-card-solid,#fff)" stroke-width="3"/></svg>
      <div class="ck-center"><div class="ck-t"></div><div class="ck-sub"></div></div></div>`,
    paint(el,r,t,label){const f=t?r/t:0;el.querySelector(".ck-arc").setAttribute("stroke-dashoffset",C*(1-f));
      const a=-Math.PI/2+f*2*Math.PI;const k=el.querySelector(".ck-knob");k.setAttribute("cx",150+R*Math.cos(a));k.setAttribute("cy",150+R*Math.sin(a));k.style.opacity=f>0.002?1:0;
      el.querySelector(".ck-t").textContent=mmss(r);el.querySelector(".ck-sub").textContent=label}};

  /* ---------- Digital ---------- */
  const digital={html:()=>`<div class="ck ck-digital"><div class="ck-t fz-time"></div><div class="fz-bar"><i class="ck-bar"></i></div></div>`,
    paint(el,r,t){el.querySelector(".ck-t").textContent=mmss(r);el.querySelector(".ck-bar").style.width=(t?(1-r/t)*100:0)+"%"}};

  /* ---------- Classic dial (wedge counts down, like a kitchen time-timer) ---------- */
  function scaleFor(t){const m=t/60000;return m<=60?60:Math.ceil(m/30)*30}
  const classic={
    html(){return `<div class="ck ck-classic"><svg viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="140" fill="var(--fz-face,#fff)" stroke="var(--fz-line)" stroke-width="2"/>
      <g class="ck-ticks"></g><g class="ck-nums"></g>
      <path class="ck-wedge" fill="var(--fz-accent)" opacity=".88"/>
      <line class="ck-hand" x1="150" y1="150" x2="150" y2="40" stroke="var(--fz-ink)" stroke-width="4" stroke-linecap="round"/>
      <circle cx="150" cy="150" r="13" fill="var(--fz-ink)"/><circle cx="150" cy="150" r="5" fill="var(--fz-face,#fff)"/></svg>
      <div class="ck-small"><span class="ck-t"></span> <span class="ck-sub"></span></div></div>`},
    paint(el,r,t,label){
      const sc=scaleFor(t);
      if(el.dataset.sc!=String(sc)){el.dataset.sc=sc;let ticks="",nums="";
        for(let i=0;i<60;i++){const a=-i*6*Math.PI/180,big=i%5===0,r1=big?118:124;ticks+=`<line x1="${150+Math.sin(a)*r1}" y1="${150-Math.cos(a)*r1}" x2="${150+Math.sin(a)*132}" y2="${150-Math.cos(a)*132}" stroke="var(--fz-ink)" stroke-width="${big?2.6:1.2}" opacity="${big?.75:.35}"/>`}
        for(let i=0;i<12;i++){const a=-i*30*Math.PI/180;nums+=`<text x="${150+Math.sin(a)*100}" y="${150-Math.cos(a)*100+6}" text-anchor="middle" font-size="16" font-weight="700" fill="var(--fz-ink)" opacity=".8">${i*sc/12}</text>`}
        el.querySelector(".ck-ticks").innerHTML=ticks;el.querySelector(".ck-nums").innerHTML=nums}
      const ang=Math.min(359.99,(r/60000)/sc*360),rad=-ang*Math.PI/180,W=92;
      const x=150+Math.sin(rad)*W,y=150-Math.cos(rad)*W;
      el.querySelector(".ck-wedge").setAttribute("d",r<=0?"":`M150 150 L150 ${150-W} A${W} ${W} 0 ${ang>180?1:0} 0 ${x} ${y} Z`);
      const h=el.querySelector(".ck-hand");h.setAttribute("x2",150+Math.sin(rad)*112);h.setAttribute("y2",150-Math.cos(rad)*112);
      el.querySelector(".ck-t").textContent=mmss(r);el.querySelector(".ck-sub").textContent=label}};

  /* ---------- Alarm clock (twin bells + glowing segment digits) ---------- */
  const SEGS={0:"abcdef",1:"bc",2:"abged",3:"abgcd",4:"fgbc",5:"afgcd",6:"afgedc",7:"abc",8:"abcdefg",9:"abcdfg"};
  function segPaths(x,y,w,h,t){const m=h/2,g=1.2;const H=(yy)=>`M${x+t/2+g} ${yy} L${x+t+g} ${yy-t/2} L${x+w-t-g} ${yy-t/2} L${x+w-t/2-g} ${yy} L${x+w-t-g} ${yy+t/2} L${x+t+g} ${yy+t/2}Z`;
    const V=(xx,y1,y2)=>`M${xx} ${y1+g} L${xx+t/2} ${y1+t/2+g} L${xx+t/2} ${y2-t/2-g} L${xx} ${y2-g} L${xx-t/2} ${y2-t/2-g} L${xx-t/2} ${y1+t/2+g}Z`;
    return {a:H(y+t/2),g:H(y+m),d:H(y+h-t/2),f:V(x+t/2,y+t/2,y+m),b:V(x+w-t/2,y+t/2,y+m),e:V(x+t/2,y+m,y+h-t/2),c:V(x+w-t/2,y+m,y+h-t/2)}}
  function digit(i,x){const p=segPaths(x,128,30,52,6.5);return `<g class="sd" data-i="${i}">${"abcdefg".split("").map(s=>`<path data-s="${s}" d="${p[s]}"/>`).join("")}</g>`}
  const alarm={
    html(){return `<div class="ck ck-alarm"><svg viewBox="0 0 300 300">
      <g class="ck-bells"><path d="M74 78 a42 42 0 0 1 66 -26 z" fill="var(--fz-accent)"/><path d="M226 78 a42 42 0 0 0 -66 -26 z" fill="var(--fz-accent)"/>
      <line x1="150" y1="40" x2="150" y2="58" stroke="var(--fz-ink)" stroke-width="5" stroke-linecap="round"/><rect x="136" y="32" width="28" height="9" rx="4" fill="var(--fz-ink)"/></g>
      <line x1="92" y1="250" x2="76" y2="274" stroke="var(--fz-ink)" stroke-width="8" stroke-linecap="round"/><line x1="208" y1="250" x2="224" y2="274" stroke="var(--fz-ink)" stroke-width="8" stroke-linecap="round"/>
      <circle cx="150" cy="160" r="108" fill="var(--fz-accent)"/><circle cx="150" cy="160" r="92" fill="#1b1918"/>
      <circle cx="150" cy="160" r="92" fill="url(#ckShine)"/>
      <defs><radialGradient id="ckShine" cx=".35" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <filter id="ckGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <text class="ck-lbl" x="150" y="114" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="2.5" fill="#ff8a5c" opacity=".85"></text>
      <g class="ck-digits" filter="url(#ckGlow)">${digit(0,78)}${digit(1,114)}<circle cx="150" cy="144" r="3.6" class="ck-col"/><circle cx="150" cy="166" r="3.6" class="ck-col"/>${digit(2,158)}${digit(3,194)}</g>
      <circle class="ck-led" cx="150" cy="208" r="4"/></svg></div>`},
    paint(el,r,t,label){const [m,s]=fmt(r);const ds=[Math.floor(m/10)%10,m%10,Math.floor(s/10),s%10];
      el.querySelectorAll(".sd").forEach(g=>{const on=SEGS[ds[+g.dataset.i]];g.querySelectorAll("path").forEach(p=>p.classList.toggle("on",on.includes(p.dataset.s)))});
      el.querySelector(".ck-lbl").textContent=label.toUpperCase();
      el.querySelectorAll(".ck-col").forEach(c=>c.classList.toggle("on",Math.floor(Date.now()/500)%2===0||el.dataset.run!=="1"))}};

  const ALL={ring,digital,classic,alarm};
  return {STYLES,html:(st)=>(ALL[st]||ring).html(),paint:(st,el,r,t,label)=>(ALL[st]||ring).paint(el,r,t,label),
    icon(st){return {ring:'<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#d8d1c7" stroke-width="4"/><path d="M20 5 A15 15 0 1 1 6 25" fill="none" stroke="#3d3631" stroke-width="4" stroke-linecap="round"/></svg>',
      digital:'<svg viewBox="0 0 40 40"><text x="20" y="26" text-anchor="middle" font-size="15" font-weight="800" fill="#3d3631" font-family="sans-serif">25:00</text></svg>',
      classic:'<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#fff" stroke="#3d3631" stroke-width="2"/><path d="M20 20 L20 8 A12 12 0 0 0 9 25 Z" fill="#c9667f"/><circle cx="20" cy="20" r="2.5" fill="#3d3631"/></svg>',
      alarm:'<svg viewBox="0 0 40 40"><path d="M8 12 a6 6 0 0 1 9 -4z M32 12 a6 6 0 0 0 -9 -4z" fill="#3d3631"/><circle cx="20" cy="22" r="13" fill="#3d3631"/><circle cx="20" cy="22" r="10" fill="#1b1918"/><text x="20" y="26" text-anchor="middle" font-size="8" font-weight="700" fill="#ff8a5c" font-family="monospace">25:00</text></svg>'}[st]}};
})();
