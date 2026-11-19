/* Focus-mode scenes: palette, default sounds, caption, and an animated SVG illustration.
   update(root, p) is called every second with p = progress of the current phase (0 → 1). */
"use strict";
const Scenes=(()=>{
  function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const wc=`<filter id="wc" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="6"/><feGaussianBlur stdDeviation=".4"/></filter>`;
  const frame=(inner,defs="")=>`<svg viewBox="0 0 360 360" class="fz-svg" aria-hidden="true"><defs>${wc}<clipPath id="frm"><rect x="0" y="0" width="360" height="360" rx="44"/></clipPath>${defs}</defs><g clip-path="url(#frm)">${inner}</g></svg>`;

  const S={};

  /* ---------------- Matcha ---------------- */
  S.matcha={name:"Matcha",caption:"sipping matcha…",ambient:"silence",bell:"bell",breakBell:"kalimba",light:true,
    pal:{bg:"radial-gradient(120% 90% at 30% 10%,#f7f3ec 0%,#efe8dc 60%,#e9e1d3 100%)",card:"rgba(252,250,246,.82)",ink:"#6c5f56",muted:"#a2978c",accent:"#8a9a6b",chip:"#e9ecdf",line:"#ebe5dc"},
    art(){return `<svg viewBox="0 0 300 340" class="fz-svg" aria-hidden="true"><defs>${wc}
      <linearGradient id="mMilk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1ead9"/><stop offset="1" stop-color="#e3d8bf"/></linearGradient>
      <linearGradient id="mGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93ad5c"/><stop offset=".7" stop-color="#a9bf72"/><stop offset="1" stop-color="#c8d39e" stop-opacity=".9"/></linearGradient>
      <clipPath id="mCup"><path d="M58 44 L242 44 L216 298 Q214 310 202 310 L98 310 Q86 310 84 298 Z"/></clipPath>
      <clipPath id="mLiq"><rect id="mLvl" x="0" y="80" width="300" height="300"/></clipPath></defs>
      <ellipse cx="150" cy="322" rx="92" ry="9" fill="#d9cfbf" opacity=".55"/>
      <g clip-path="url(#mCup)"><g filter="url(#wc)">
        <rect x="0" y="0" width="300" height="340" fill="#f6f3ee" opacity=".55"/>
        <g clip-path="url(#mLiq)"><rect x="0" y="0" width="300" height="340" fill="url(#mMilk)"/>
          <path id="mGr" fill="url(#mGreen)" d=""/>
          <path id="mSw" fill="none" stroke="#c6d39a" stroke-width="5" stroke-linecap="round" opacity=".7" d=""/></g>
      </g>
      <g id="mIce"><g class="fz-bob"><rect x="98" y="0" width="40" height="36" rx="9" fill="#fff" opacity=".55" stroke="#e5ece6" stroke-width="2" transform="rotate(-12 118 18)"/>
        <rect x="148" y="-6" width="42" height="38" rx="10" fill="#fff" opacity=".5" stroke="#e5ece6" stroke-width="2" transform="rotate(9 169 13)"/>
        <rect x="126" y="22" width="34" height="30" rx="8" fill="#fff" opacity=".45" stroke="#e5ece6" stroke-width="2" transform="rotate(20 143 37)"/></g></g></g>
      <path d="M58 44 L242 44 L216 298 Q214 310 202 310 L98 310 Q86 310 84 298 Z" fill="none" stroke="#c4cfcc" stroke-width="3" opacity=".9" filter="url(#wc)"/>
      <path d="M74 64 L94 286" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="150" cy="44" rx="92" ry="6" fill="none" stroke="#d3dcd9" stroke-width="2" opacity=".8"/></svg>`},
    update(r,p){const top=78+p*196,bot=Math.min(306,top+(310-top)*.58);const w=x=>bot+Math.sin(x/22+p*6)*6;
      let d=`M40 ${top} L260 ${top} L260 ${w(260)}`;for(let x=260;x>=40;x-=10)d+=` L${x} ${w(x)}`;d+=" Z";
      r.querySelector("#mLvl").setAttribute("y",top);r.querySelector("#mGr").setAttribute("d",d);
      r.querySelector("#mSw").setAttribute("d",`M90 ${w(90)-4} C 120 ${bot-24}, 150 ${bot+10}, 205 ${w(205)-6}`);
      r.querySelector("#mIce").setAttribute("transform",`translate(0 ${top-14})`)}};

  /* ---------------- Sunrise ---------------- */
  S.sunrise={name:"Sunrise",caption:"watching the sun come up…",ambient:"forest",bell:"kalimba",breakBell:"chimes",light:true,
    pal:{bg:"linear-gradient(160deg,#fbe4d6 0%,#f4cfd3 55%,#e8c8dc 100%)",card:"rgba(255,250,248,.62)",ink:"#5d4350",muted:"#a2878f",accent:"#e08a6b",chip:"#f8e1d9",line:"#f1d9d4"},
    art(){const R=rng(7);let birds="";for(let i=0;i<4;i++){const y=60+R()*70,s=.6+R()*.6;birds+=`<g class="fz-drift" style="animation-duration:${38+R()*30}s;animation-delay:-${R()*40}s"><path transform="translate(0 ${y}) scale(${s})" d="M0 0 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="#7d5c68" stroke-width="2" stroke-linecap="round"/></g>`}
      return frame(`<rect width="360" height="360" fill="url(#sky)"/>
        <g id="sun"><circle cx="180" cy="0" r="90" fill="url(#glow)"/><circle cx="180" cy="0" r="44" fill="#fff4d6"/></g>
        <g class="fz-drift slow"><ellipse cx="80" cy="90" rx="46" ry="12" fill="#fff" opacity=".5"/><ellipse cx="270" cy="130" rx="60" ry="13" fill="#fff" opacity=".4"/></g>
        ${birds}
        <path d="M0 250 Q70 205 150 236 T360 222 L360 360 L0 360Z" fill="#eab3a8" opacity=".9"/>
        <path d="M0 280 Q90 240 190 270 T360 262 L360 360 L0 360Z" fill="#d9979a"/>
        <path d="M0 312 Q110 282 220 306 T360 300 L360 360 L0 360Z" fill="#b97d8c"/>`,
        `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c9c4"/><stop offset=".55" stop-color="#fbdcc6"/><stop offset="1" stop-color="#ffe9cf"/></linearGradient>
         <radialGradient id="glow"><stop offset="0" stop-color="#fff1c9" stop-opacity=".95"/><stop offset="1" stop-color="#ffd9b0" stop-opacity="0"/></radialGradient>`)},
    update(r,p){r.querySelector("#sun").setAttribute("transform",`translate(0 ${262-p*150})`)}};

  /* ---------------- Rain ---------------- */
  S.rain={name:"Rainy window",caption:"rain on the window…",ambient:"rain",bell:"bowl",breakBell:"chimes",
    pal:{bg:"linear-gradient(170deg,#283244 0%,#1d2533 60%,#171d28 100%)",card:"rgba(255,255,255,.06)",ink:"#e7edf5",muted:"#97a5b8",accent:"#9ec0e4",chip:"rgba(255,255,255,.08)",line:"rgba(255,255,255,.08)"},
    art(){const R=rng(11);let bokeh="",drops="",glass="";
      const cols=["#f6c27a","#e98f6f","#9ec0e4","#f3d9a6","#c99ad8"];
      for(let i=0;i<16;i++)bokeh+=`<circle cx="${R()*360}" cy="${150+R()*190}" r="${8+R()*22}" fill="${cols[i%5]}" opacity="${.22+R()*.35}"/>`;
      for(let i=0;i<55;i++){const x=R()*380-10,l=14+R()*22;drops+=`<line class="fz-fall" x1="${x}" y1="-30" x2="${x-3}" y2="${-30+l}" stroke="#cfe0f5" stroke-width="${.8+R()}" opacity="${.25+R()*.4}" stroke-linecap="round" style="animation-duration:${.55+R()*.7}s;animation-delay:-${R()*2}s"/>`}
      for(let i=0;i<34;i++){const rr=1.5+R()*4.5;glass+=`<circle class="${R()<.25?"fz-slide":""}" cx="${R()*360}" cy="${R()*360}" r="${rr}" fill="rgba(220,235,255,.10)" stroke="rgba(235,245,255,.35)" stroke-width=".8" style="animation-duration:${14+R()*20}s;animation-delay:-${R()*20}s"/>`}
      return frame(`<rect width="360" height="360" fill="url(#rsky)"/><g filter="url(#blur)">${bokeh}</g><rect y="250" width="360" height="110" fill="#141a24" opacity=".55"/>${drops}${glass}
        <rect x="5" y="5" width="350" height="350" rx="40" fill="none" stroke="#3a4558" stroke-width="10"/><line x1="180" y1="0" x2="180" y2="360" stroke="#3a4558" stroke-width="8"/><line x1="0" y1="180" x2="360" y2="180" stroke="#3a4558" stroke-width="8"/>`,
        `<linearGradient id="rsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4760"/><stop offset="1" stop-color="#202838"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="7"/></filter>`)}};

  /* ---------------- Night ---------------- */
  S.night={name:"Starry night",caption:"under the stars…",ambient:"night",bell:"chimes",breakBell:"kalimba",
    pal:{bg:"radial-gradient(120% 100% at 50% 0%,#252a5c 0%,#151a3a 55%,#0d1128 100%)",card:"rgba(255,255,255,.06)",ink:"#ece9ff",muted:"#a09cc6",accent:"#b9a8ff",chip:"rgba(255,255,255,.08)",line:"rgba(255,255,255,.08)"},
    art(){const R=rng(23);let stars="";for(let i=0;i<70;i++)stars+=`<circle class="fz-tw" cx="${R()*360}" cy="${R()*240}" r="${.6+R()*1.6}" fill="#fff" style="animation-duration:${2+R()*4}s;animation-delay:-${R()*5}s"/>`;
      return frame(`<rect width="360" height="360" fill="url(#nsky)"/>${stars}
        <line class="fz-shoot" x1="60" y1="40" x2="120" y2="70" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
        <g id="moon"><circle cx="262" cy="92" r="70" fill="url(#mglow)"/><circle cx="262" cy="92" r="32" fill="#f5efd6" mask="url(#cres)"/></g>
        <path d="M0 270 L60 225 L110 255 L170 205 L235 250 L290 215 L360 255 L360 360 L0 360Z" fill="#232857"/>
        <path d="M0 300 Q80 270 160 292 T360 286 L360 360 L0 360Z" fill="#161a3d"/>`,
        `<linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2150"/><stop offset="1" stop-color="#2c2d66"/></linearGradient>
         <radialGradient id="mglow"><stop offset="0" stop-color="#f5efd6" stop-opacity=".35"/><stop offset="1" stop-color="#f5efd6" stop-opacity="0"/></radialGradient>
         <mask id="cres"><rect width="360" height="360" fill="#fff"/><circle cx="278" cy="80" r="28" fill="#000"/></mask>`)},
    update(r,p){r.querySelector("#moon").setAttribute("transform",`translate(${-p*40} ${p*18})`)}};

  /* ---------------- Ocean ---------------- */
  S.ocean={name:"Ocean",caption:"listening to the waves…",ambient:"ocean",bell:"bowl",breakBell:"chimes",light:true,
    pal:{bg:"linear-gradient(180deg,#e9f1ee 0%,#d7e8e6 50%,#f1e7d6 100%)",card:"rgba(255,255,255,.6)",ink:"#2f5056",muted:"#7f9da1",accent:"#3f8f97",chip:"#e0eeec",line:"#dbe8e5"},
    art(){const wave=(y,c,d,o)=>`<g class="fz-wave" style="animation-duration:${d}s"><path d="M-120 ${y} ${Array.from({length:9},(_,i)=>`q30 -12 60 0 t60 0`).join(" ")} L600 360 L-120 360Z" fill="${c}" opacity="${o}"/></g>`;
      return frame(`<rect width="360" height="360" fill="url(#osky)"/><circle cx="250" cy="150" r="30" fill="#fff6e3" opacity=".9"/><circle cx="250" cy="150" r="60" fill="#fff6e3" opacity=".25"/>
        <rect y="185" width="360" height="175" fill="#9ccfd0"/>${wave(200,"#86c2c4",14,.9)}${wave(228,"#6aaeb3",10,.95)}${wave(258,"#4f9aa2",8,1)}
        <path d="M0 300 Q120 284 240 298 T360 292 L360 360 L0 360Z" fill="#f1dfc0"/><path class="fz-foam" d="M0 300 Q120 284 240 298 T360 292" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/>`,
        `<linearGradient id="osky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e3d3"/><stop offset="1" stop-color="#d9ecec"/></linearGradient>`)}};

  /* ---------------- Forest ---------------- */
  S.forest={name:"Misty forest",caption:"a walk in the woods…",ambient:"forest",bell:"wood",breakBell:"kalimba",light:true,
    pal:{bg:"linear-gradient(175deg,#eef1e8 0%,#dfe7da 60%,#d2dccd 100%)",card:"rgba(255,255,255,.58)",ink:"#34453a",muted:"#7f8f80",accent:"#5f8360",chip:"#e3eadd",line:"#dde4d7"},
    art(){const R=rng(31);const layer=(base,h,c,n)=>{let s="";for(let i=0;i<n;i++){const x=i*(400/n)-20+R()*14,hh=h*(.7+R()*.5),w=hh*.42;s+=`<path d="M${x} ${base} L${x+w/2} ${base-hh} L${x+w} ${base}Z" fill="${c}"/>`}return s+`<rect y="${base-1}" width="360" height="${360-base}" fill="${c}"/>`};
      return frame(`<rect width="360" height="360" fill="url(#fsky)"/><circle cx="110" cy="96" r="34" fill="#fbf7ea" opacity=".85"/>
        ${layer(210,95,"#b8c7b2",14)}<g class="fz-fog"><ellipse cx="120" cy="215" rx="170" ry="22" fill="#fff" opacity=".55"/></g>
        ${layer(262,120,"#8ba486",12)}<g class="fz-fog rev"><ellipse cx="250" cy="268" rx="190" ry="24" fill="#fff" opacity=".45"/></g>
        ${layer(320,150,"#5d7a5f",10)}`,
        `<linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f1e4"/><stop offset="1" stop-color="#dce6d6"/></linearGradient>`)}};

  /* ---------------- Cozy ---------------- */
  S.cozy={name:"Cozy candle",caption:"tea by candlelight…",ambient:"fire",bell:"bell",breakBell:"kalimba",
    pal:{bg:"radial-gradient(110% 90% at 60% 30%,#4a2f20 0%,#2b1c15 60%,#1f140f 100%)",card:"rgba(255,235,215,.06)",ink:"#f6e6d6",muted:"#bd9f88",accent:"#f0a35e",chip:"rgba(255,235,215,.08)",line:"rgba(255,235,215,.08)"},
    art(){return frame(`<rect width="360" height="360" fill="#2a1b14"/><circle class="fz-glow" cx="130" cy="150" r="150" fill="url(#cglow)"/>
        <rect x="0" y="262" width="360" height="98" fill="#3c2619"/><rect x="0" y="262" width="360" height="4" fill="#5a3a26"/>
        <ellipse cx="130" cy="262" rx="38" ry="7" fill="#1d120c" opacity=".6"/><rect x="104" y="176" width="52" height="88" rx="8" fill="#f2e2cc"/><path d="M104 186 q26 10 52 0" stroke="#e3cdb1" stroke-width="3" fill="none"/>
        <line x1="130" y1="176" x2="130" y2="164" stroke="#3a2a20" stroke-width="2.5"/>
        <g class="fz-flicker"><path d="M130 116 C 146 140 144 160 130 166 C 116 160 114 140 130 116Z" fill="url(#flame)"/><path d="M130 136 C 137 148 136 158 130 162 C 124 158 123 148 130 136Z" fill="#fff6d8"/></g>
        <g><rect x="214" y="206" width="70" height="58" rx="12" fill="#c87a58"/><path d="M284 220 q24 2 22 20 q-2 16 -22 16" stroke="#c87a58" stroke-width="9" fill="none"/>
        <path class="fz-steam" d="M236 196 q-10 -16 0 -30 q10 -14 0 -30" stroke="#f6e6d6" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>
        <path class="fz-steam d2" d="M258 196 q-10 -16 0 -30 q10 -14 0 -30" stroke="#f6e6d6" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/></g>`,
        `<radialGradient id="cglow"><stop offset="0" stop-color="#ffb46b" stop-opacity=".45"/><stop offset="1" stop-color="#ffb46b" stop-opacity="0"/></radialGradient>
         <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient>`)}};

  return S;
})();
