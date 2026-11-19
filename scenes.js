/* Focus-mode scenes — one watercolour style, one calm palette.
   Palette ("calm paper"): low-saturation blues, sages, lavenders and seafoam, warmed with sand and blush,
   on warm paper neutrals. Saturation is kept low (it drives arousal); hues stay in the blue–green–purple range
   rated most pleasant, with yellow-green kept to small accents.
   Each art() is a painted vignette (360×360): soft blob mask with bleeding edges, wobble on shapes, paper grain.
   update(root, p, ctx) runs every second with p = progress of the current phase. */
"use strict";
const Scenes=(()=>{
  function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const f1=v=>v.toFixed(1);
  function blobPath(seed,cx=180,cy=180,r=166,n=12,j=.06){const R=rng(seed),P=[];
    for(let i=0;i<n;i++){const a=i/n*2*Math.PI,rr=r*(1+(R()-.5)*2*j);P.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr])}
    let d=`M${f1(P[0][0])} ${f1(P[0][1])}`;
    for(let i=0;i<n;i++){const p0=P[(i-1+n)%n],p1=P[i],p2=P[(i+1)%n],p3=P[(i+2)%n];
      d+=` C${f1(p1[0]+(p2[0]-p0[0])/6)} ${f1(p1[1]+(p2[1]-p0[1])/6)} ${f1(p2[0]-(p3[0]-p1[0])/6)} ${f1(p2[1]-(p3[1]-p1[1])/6)} ${f1(p2[0])} ${f1(p2[1])}`}
    return d+"Z"}
  const FX=`<filter id="wc" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter>
    <filter id="wcEdge" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves="3" seed="8"/><feDisplacementMap in="SourceGraphic" scale="16"/><feGaussianBlur stdDeviation="1.4"/></filter>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .28  0 0 0 0 .24  0 0 0 .32 0"/></filter>`;
  function washes(seed,cols,n=6){const R=rng(seed);let s="";for(let i=0;i<n;i++)s+=`<ellipse cx="${f1(R()*360)}" cy="${f1(R()*360)}" rx="${f1(50+R()*80)}" ry="${f1(30+R()*60)}" fill="${cols[i%cols.length]}" opacity="${(.08+R()*.12).toFixed(2)}" filter="url(#soft)"/>`;return s}
  function vignette(seed,inner,defs,edge){const b=blobPath(seed);
    return `<svg viewBox="0 0 360 360" class="fz-svg" aria-hidden="true"><defs>${FX}${defs||""}<mask id="vm${seed}"><path d="${b}" fill="#fff" filter="url(#wcEdge)"/></mask></defs>
      <g mask="url(#vm${seed})"><g filter="url(#wc)">${inner}</g><rect width="360" height="360" filter="url(#grain)" opacity=".55"/></g>
      <path d="${b}" fill="none" stroke="${edge}" stroke-width="3" opacity=".28" filter="url(#wcEdge)"/></svg>`}
  const lg=(id,stops)=>`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`;

  const S={};

  /* ---------------- Matcha ---------------- */
  S.matcha={name:"Matcha",caption:"sipping matcha…",ambient:"silence",bell:"bell",breakBell:"kalimba",light:true,
    pal:{bg:"radial-gradient(120% 90% at 30% 10%,#f7f3ec 0%,#efe8dc 60%,#e9e1d3 100%)",card:"rgba(252,250,246,.82)",ink:"#5e544b",muted:"#9c9286",accent:"#7f936a",chip:"#e9ecdf",line:"#e6dfd4"},
    art(){return `<svg viewBox="0 0 300 340" class="fz-svg" aria-hidden="true"><defs>${FX}
      ${lg("mMilk",[[0,"#f1ead9"],[1,"#e3d8bf"]])}
      <linearGradient id="mGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#96aa68"/><stop offset=".7" stop-color="#abbd7d"/><stop offset="1" stop-color="#cad3a6" stop-opacity=".9"/></linearGradient>
      <clipPath id="mCup"><path d="M58 44 L242 44 L216 298 Q214 310 202 310 L98 310 Q86 310 84 298 Z"/></clipPath>
      <clipPath id="mLiq"><rect id="mLvl" x="0" y="80" width="300" height="300"/></clipPath></defs>
      <ellipse cx="150" cy="322" rx="92" ry="9" fill="#d9cfbf" opacity=".55" filter="url(#wc)"/>
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
      const q=s=>r.querySelector(s);if(!q("#mLvl"))return;
      q("#mLvl").setAttribute("y",top);q("#mGr").setAttribute("d",d);
      q("#mSw").setAttribute("d",`M90 ${w(90)-4} C 120 ${bot-24}, 150 ${bot+10}, 205 ${w(205)-6}`);
      q("#mIce").setAttribute("transform",`translate(0 ${top-14})`)}};

  /* ---------------- Alpine ---------------- */
  S.alpine={name:"Alpine dusk",caption:"above the clouds…",ambient:"forest",bell:"bowl",breakBell:"chimes",light:true,
    pal:{bg:"linear-gradient(170deg,#f0edf3 0%,#ebe6ee 45%,#f2e8e1 100%)",card:"rgba(252,250,252,.74)",ink:"#4b475c",muted:"#8e889e",accent:"#7b7496",chip:"#ebe8f1",line:"#e3dee8"},
    art(){return vignette(11,`<rect width="360" height="360" fill="url(#alS)"/>${washes(3,["#fff","#c9c2dc","#f2d9cc"])}
      <circle cx="250" cy="150" r="60" fill="#f6e3cb" opacity=".55" filter="url(#soft)"/><circle cx="250" cy="150" r="30" fill="#f5e2c8"/>
      <path d="M0 210 L40 182 L82 196 L122 160 L162 186 L205 150 L250 184 L300 166 L360 192 V360 H0Z" fill="#bdb7cf"/>
      <path d="M0 252 L58 212 L110 140 L134 166 L170 94 L206 150 L236 126 L292 200 L360 226 V360 H0Z" fill="#8e88a8"/>
      <path d="M170 94 L157 120 L166 115 L172 124 L181 113 L188 120Z M110 140 L100 158 L108 153 L114 160 L120 153Z M236 126 L226 142 L234 139 L240 146 L246 139Z" fill="#f2eff6" opacity=".92"/>
      <path d="M170 94 L206 150 L236 126 L292 200 L360 226 V360 H180Z" fill="#6f6a88" opacity=".22"/>
      <ellipse class="fz-fog" cx="170" cy="236" rx="230" ry="20" fill="#fff" opacity=".7" filter="url(#soft)"/>
      <path d="M0 300 Q60 266 120 282 T240 270 T360 286 V360 H0Z" fill="#706b89"/>
      <path d="M0 330 Q90 310 180 323 T360 316 V360 H0Z" fill="#5b5773"/>`,
      lg("alS",[[0,"#d8d2e5"],[.6,"#e9dcdc"],[1,"#f3e1d2"]]),"#6f6a88")}};

  /* ---------------- Sunrise ---------------- */
  S.sunrise={name:"Sunrise",caption:"watching the sun come up…",ambient:"forest",bell:"kalimba",breakBell:"chimes",light:true,
    pal:{bg:"linear-gradient(165deg,#f8efe9 0%,#f4e6e1 55%,#efe4e6 100%)",card:"rgba(255,251,249,.72)",ink:"#5a4846",muted:"#a08e89",accent:"#c4917b",chip:"#f4e6df",line:"#ecdcd6"},
    art(){const R=rng(7);let birds="";for(let i=0;i<4;i++){const y=60+R()*70,s=.6+R()*.6;birds+=`<g class="fz-drift" style="animation-duration:${(38+R()*30).toFixed(1)}s;animation-delay:-${(R()*40).toFixed(1)}s"><path transform="translate(0 ${f1(y)}) scale(${s.toFixed(2)})" d="M0 0 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="#8f7f7a" stroke-width="2" stroke-linecap="round"/></g>`}
      return vignette(21,`<rect width="360" height="360" fill="url(#srS)"/>${washes(5,["#fff","#f0cfc3","#e9d6e2"])}
        <g id="sun"><circle cx="180" cy="0" r="80" fill="#f6dcc0" opacity=".6" filter="url(#soft)"/><circle cx="180" cy="0" r="40" fill="#f4d9b8"/></g>
        <g class="fz-drift slow"><ellipse cx="80" cy="90" rx="50" ry="12" fill="#fff" opacity=".6" filter="url(#soft)"/><ellipse cx="270" cy="128" rx="62" ry="13" fill="#fff" opacity=".5" filter="url(#soft)"/></g>${birds}
        <path d="M0 226 Q90 196 180 216 T360 206 V360H0Z" fill="#e6cbc2"/>
        <path d="M0 256 Q100 226 200 249 T360 239 V360H0Z" fill="#d3b1ac"/>
        <path d="M0 290 Q120 262 230 285 T360 275 V360H0Z" fill="#b9a5b6"/>
        <path d="M0 322 Q110 302 220 318 T360 312 V360H0Z" fill="#a2ae98"/>`,
        lg("srS",[[0,"#f1d5cc"],[.6,"#f6e3d8"],[1,"#f9ede2"]]),"#b98f8a")},
    update(r,p){const s=r.querySelector("#sun");if(s)s.setAttribute("transform",`translate(0 ${f1(262-p*150)})`)}};

  /* ---------------- Rain ---------------- */
  S.rain={name:"Rainy window",caption:"rain on the window…",ambient:"rain",bell:"bowl",breakBell:"chimes",light:true,
    pal:{bg:"linear-gradient(170deg,#eef1f3 0%,#e5eaee 55%,#dde4ea 100%)",card:"rgba(250,252,253,.72)",ink:"#3f4d5a",muted:"#8796a3",accent:"#6f8ba3",chip:"#e4eaef",line:"#d9e0e6"},
    art(){const R=rng(13);let city="",glow="",drops="",glass="";
      for(let i=0;i<9;i++){const x=i*42-10+R()*12,h=60+R()*90;city+=`<rect x="${f1(x)}" y="${f1(250-h)}" width="${f1(30+R()*16)}" height="${f1(h+40)}" fill="#9fb0bf" opacity="${(.45+R()*.3).toFixed(2)}"/>`}
      for(let i=0;i<7;i++)glow+=`<circle cx="${f1(R()*360)}" cy="${f1(170+R()*90)}" r="${f1(8+R()*12)}" fill="${["#eed9b4","#e3c3ba","#f2e6cf"][i%3]}" opacity=".75" filter="url(#soft)"/>`;
      for(let i=0;i<44;i++){const x=R()*380-10,l=14+R()*20;drops+=`<line class="fz-fall" x1="${f1(x)}" y1="-30" x2="${f1(x-3)}" y2="${f1(-30+l)}" stroke="#f6f8fa" stroke-width="${(.9+R()).toFixed(2)}" opacity="${(.35+R()*.35).toFixed(2)}" stroke-linecap="round" style="animation-duration:${(.6+R()*.7).toFixed(2)}s;animation-delay:-${(R()*2).toFixed(2)}s"/>`}
      for(let i=0;i<26;i++){const rr=1.5+R()*4;glass+=`<circle class="${R()<.25?"fz-slide":""}" cx="${f1(R()*360)}" cy="${f1(R()*290)}" r="${f1(rr)}" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.55)" stroke-width=".8" style="animation-duration:${(14+R()*20).toFixed(1)}s;animation-delay:-${(R()*20).toFixed(1)}s"/>`}
      return vignette(31,`<rect width="360" height="360" fill="url(#rnS)"/>${washes(9,["#fff","#b9c8d3","#d8cfe3"])}<g filter="url(#soft)" opacity=".8">${city}</g>${glow}${drops}${glass}
        <rect x="18" y="18" width="324" height="282" rx="10" fill="none" stroke="#8a9cad" stroke-width="10"/><line x1="180" y1="18" x2="180" y2="300" stroke="#8a9cad" stroke-width="8"/><line x1="18" y1="160" x2="342" y2="160" stroke="#8a9cad" stroke-width="8"/>
        <rect x="0" y="300" width="360" height="60" fill="#d9cbb9"/><rect x="0" y="300" width="360" height="6" fill="#c7b7a3"/>
        <path d="M62 300 q-4 -26 6 -40 h28 q10 14 6 40z" fill="#c99c84"/><path d="M80 262 q-18 -30 -6 -54 q10 20 6 54z M80 262 q16 -34 2 -60 q-12 22 -2 60z M82 262 q26 -18 34 -44 q-24 8 -34 44z" fill="#8fa287"/>`,
        lg("rnS",[[0,"#c9d4de"],[.7,"#b4c4d1"],[1,"#a7b8c6"]]),"#7891a6")}};

  /* ---------------- Night ---------------- */
  S.night={name:"Starry night",caption:"under the stars…",ambient:"night",bell:"chimes",breakBell:"kalimba",
    pal:{bg:"radial-gradient(120% 100% at 50% 0%,#3a4063 0%,#2d3250 55%,#242840 100%)",card:"rgba(255,255,255,.055)",ink:"#ece8f4",muted:"#a9a5bf",accent:"#bcb3d8",chip:"rgba(255,255,255,.07)",line:"rgba(255,255,255,.1)"},
    art(){const R=rng(23);let stars="";for(let i=0;i<60;i++)stars+=`<circle class="fz-tw" cx="${f1(R()*360)}" cy="${f1(R()*230)}" r="${(.6+R()*1.5).toFixed(2)}" fill="#f2ead6" style="animation-duration:${(2+R()*4).toFixed(1)}s;animation-delay:-${(R()*5).toFixed(1)}s"/>`;
      return vignette(41,`<rect width="360" height="360" fill="url(#ntS)"/>${washes(4,["#cfc8e6","#5a6290","#8f88b8"])}
        <ellipse cx="170" cy="130" rx="220" ry="34" transform="rotate(-20 170 130)" fill="#d6cfec" opacity=".18" filter="url(#soft)"/>${stars}
        <line class="fz-shoot" x1="60" y1="40" x2="120" y2="70" stroke="#f2ead6" stroke-width="1.6" stroke-linecap="round"/>
        <g id="moon"><circle cx="258" cy="96" r="62" fill="#f2ead6" opacity=".16" filter="url(#soft)"/><circle cx="258" cy="96" r="30" fill="#f2ead6" mask="url(#cres)"/></g>
        <path d="M0 268 L60 228 L110 252 L170 206 L232 248 L290 216 L360 252 V360H0Z" fill="#30354f"/>
        <path d="M0 300 Q80 272 160 292 T360 286 V360H0Z" fill="#232739"/>`,
        lg("ntS",[[0,"#2f3452"],[1,"#454a6c"]])+`<mask id="cres"><rect width="360" height="360" fill="#fff"/><circle cx="273" cy="84" r="26" fill="#000"/></mask>`,"#1e2236")},
    update(r,p){const m=r.querySelector("#moon");if(m)m.setAttribute("transform",`translate(${f1(-p*40)} ${f1(p*18)})`)}};

  /* ---------------- Ocean ---------------- */
  S.ocean={name:"Ocean",caption:"listening to the waves…",ambient:"ocean",bell:"bowl",breakBell:"chimes",light:true,
    pal:{bg:"linear-gradient(180deg,#eef3f1 0%,#e6efec 50%,#f3ede4 100%)",card:"rgba(252,253,252,.68)",ink:"#3a5451",muted:"#84a09c",accent:"#6a9a95",chip:"#e2ede9",line:"#d8e5e1"},
    art(){const wave=(y,c,d,o)=>`<g class="fz-wave" style="animation-duration:${d}s"><path d="M-120 ${y} ${Array.from({length:9},()=>`q30 -10 60 0 t60 0`).join(" ")} L600 360 L-120 360Z" fill="${c}" opacity="${o}"/></g>`;
      return vignette(51,`<rect width="360" height="360" fill="url(#ocS)"/>${washes(6,["#fff","#f1dccd","#c9e0db"])}
        <circle cx="248" cy="148" r="56" fill="#f6e5cd" opacity=".5" filter="url(#soft)"/><circle cx="248" cy="148" r="26" fill="#f4e1c7"/>
        <rect y="186" width="360" height="174" fill="#b5d3cd"/>${wave(200,"#a3c8c1",14,.9)}${wave(228,"#8bb8b1",10,.95)}${wave(258,"#74a6a0",8,1)}
        <path d="M0 300 Q120 284 240 298 T360 292 V360H0Z" fill="#eadabd"/><path class="fz-foam" d="M0 300 Q120 284 240 298 T360 292" stroke="#fbf8f2" stroke-width="3" fill="none" opacity=".9"/>`,
        lg("ocS",[[0,"#f3e6dc"],[1,"#e2eeeb"]]),"#5e8f8a")}};

  /* ---------------- Forest ---------------- */
  S.forest={name:"Misty forest",caption:"a walk in the woods…",ambient:"forest",bell:"wood",breakBell:"kalimba",light:true,
    pal:{bg:"linear-gradient(175deg,#f1f2ec 0%,#e8ece2 60%,#e1e7da 100%)",card:"rgba(252,253,250,.66)",ink:"#3c4a3b",muted:"#87937f",accent:"#6b8460",chip:"#e3e9dd",line:"#dbe2d4"},
    art(){const R=rng(31);const layer=(base,h,c,n)=>{let s="";for(let i=0;i<n;i++){const x=i*(400/n)-20+R()*14,hh=h*(.7+R()*.5),w=hh*.42;s+=`<path d="M${f1(x)} ${base} L${f1(x+w/2)} ${f1(base-hh)} L${f1(x+w)} ${base}Z" fill="${c}"/>`}return s+`<rect y="${base-1}" width="360" height="${360-base}" fill="${c}"/>`};
      return vignette(61,`<rect width="360" height="360" fill="url(#foS)"/>${washes(8,["#fff","#c9d4c0","#e8e2cc"])}<circle cx="112" cy="96" r="30" fill="#f7f2e2" opacity=".95"/>
        ${layer(210,95,"#c9d4c0",14)}<g class="fz-fog"><ellipse cx="120" cy="214" rx="170" ry="22" fill="#fff" opacity=".65" filter="url(#soft)"/></g>
        ${layer(262,120,"#a3b59a",12)}<g class="fz-fog rev"><ellipse cx="250" cy="266" rx="190" ry="24" fill="#fff" opacity=".5" filter="url(#soft)"/></g>
        ${layer(320,150,"#7c9273",10)}`,lg("foS",[[0,"#f2f1e6"],[1,"#dfe6d8"]]),"#5f7458")}};

  /* ---------------- Cozy ---------------- */
  S.cozy={name:"Cozy candle",caption:"tea by candlelight…",ambient:"fire",bell:"bell",breakBell:"kalimba",
    pal:{bg:"radial-gradient(110% 90% at 60% 30%,#4a3b33 0%,#3a2f2a 60%,#2e2622 100%)",card:"rgba(255,240,225,.055)",ink:"#f1e6da",muted:"#b8a595",accent:"#d9a774",chip:"rgba(255,240,225,.07)",line:"rgba(255,240,225,.09)"},
    art(){return vignette(71,`<rect width="360" height="360" fill="url(#czS)"/>${washes(2,["#8a6a55","#2a201b","#c99c84"])}
        <g><rect x="232" y="44" width="92" height="112" rx="8" fill="#4e5a78"/><circle cx="296" cy="74" r="12" fill="#f2ead6" opacity=".85"/><rect x="232" y="44" width="92" height="112" rx="8" fill="none" stroke="#2e2622" stroke-width="7"/><line x1="278" y1="44" x2="278" y2="156" stroke="#2e2622" stroke-width="5"/></g>
        <rect x="0" y="262" width="360" height="98" fill="#5b463b"/><rect x="0" y="262" width="360" height="4" fill="#6e5547"/>
        ${Candle.svg(130,264,170,46)}
        <g><rect x="214" y="206" width="70" height="58" rx="12" fill="#b9755a"/><path d="M284 220 q24 2 22 20 q-2 16 -22 16" stroke="#b9755a" stroke-width="9" fill="none"/>
        <path class="fz-steam" d="M236 196 q-10 -16 0 -30 q10 -14 0 -30" stroke="#f1e6da" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>
        <path class="fz-steam d2" d="M258 196 q-10 -16 0 -30 q10 -14 0 -30" stroke="#f1e6da" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/></g>`,
        lg("czS",[[0,"#4a3b33"],[1,"#3a2f2a"]])+Candle.defs,"#1f1916")}};

  return S;
})();
