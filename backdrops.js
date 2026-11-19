/* Immersive (full-screen) backdrops for each scene + the burning candle.
   Extends Scenes with: bg() → full-bleed SVG (1600×1000, cropped to fill), imm → palette for the overlay UI.
   Ridges are generated with midpoint displacement so mountains look natural, with haze for depth. */
"use strict";
const Candle={
  defs:`<linearGradient id="cdlWax" x1="0" x2="1"><stop offset="0" stop-color="#e6d1b3"/><stop offset=".45" stop-color="#f8ecda"/><stop offset="1" stop-color="#d8c09e"/></linearGradient>
    <radialGradient id="cdlGlowG"><stop offset="0" stop-color="#ffb76e" stop-opacity=".55"/><stop offset=".5" stop-color="#ff9d4d" stop-opacity=".15"/><stop offset="1" stop-color="#ff9d4d" stop-opacity="0"/></radialGradient>
    <linearGradient id="cdlFlameG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".55" stop-color="#ffb24a"/><stop offset="1" stop-color="#ff7a2e"/></linearGradient>`,
  svg(cx,base,hmax,w){const fw=w*.9;
    return `<g class="cdl" data-cx="${cx}" data-base="${base}" data-hmax="${hmax}" data-w="${w}">
      <g class="cdl-glowwrap"><circle class="cdl-glow fz-glow" r="${w*5}" fill="url(#cdlGlowG)"/></g>
      <ellipse cx="${cx}" cy="${base}" rx="${w*.95}" ry="${w*.13}" fill="#000" opacity=".28"/>
      <rect class="cdl-body" rx="${w*.1}" fill="url(#cdlWax)"/>
      <path class="cdl-drip" fill="#f3e2c8"/>
      <ellipse class="cdl-top" fill="#fbf2e4" stroke="#e2cfb2" stroke-width="${w*.02}"/>
      <line class="cdl-wick" stroke="#2b2018" stroke-width="${Math.max(1.5,w*.045)}" stroke-linecap="round"/>
      <g class="cdl-flame"><g class="fz-flicker"><path d="M0 ${-fw*1.45} C ${fw*.38} ${-fw*.8} ${fw*.34} ${-fw*.22} 0 0 C ${-fw*.34} ${-fw*.22} ${-fw*.38} ${-fw*.8} 0 ${-fw*1.45}Z" fill="url(#cdlFlameG)"/>
        <path d="M0 ${-fw*.72} C ${fw*.15} ${-fw*.42} ${fw*.13} ${-fw*.1} 0 0 C ${-fw*.13} ${-fw*.1} ${-fw*.15} ${-fw*.42} 0 ${-fw*.72}Z" fill="#fff8e1"/></g></g>
      <g class="cdl-smokewrap"><path class="cdl-smoke fz-smoke" fill="none" stroke="#d8ccc0" stroke-width="${Math.max(1.5,w*.05)}" stroke-linecap="round"/></g>
    </g>`},
  // p = progress of the CURRENT phase; ctx = {phase, started, focusMin}
  update(root,p,ctx){root.querySelectorAll(".cdl").forEach(g=>{
    const cx=+g.dataset.cx,base=+g.dataset.base,hmax=+g.dataset.hmax,w0=+g.dataset.w;
    const sz=Math.max(0,Math.min(1,((ctx.focusMin||25)-5)/85));           // 5 min → small candle, 90 min → tall
    const w=w0*(.78+.44*sz),H0=hmax*(.28+.72*sz),stub=w*.22;
    const focus=ctx.phase==="focus",lit=focus&&ctx.started&&p<1;
    const h=focus?stub+(H0-stub)*(1-p):stub;const top=base-h;
    const q=s=>g.querySelector(s);
    const b=q(".cdl-body");b.setAttribute("x",cx-w/2);b.setAttribute("y",top);b.setAttribute("width",w);b.setAttribute("height",h);
    const t=q(".cdl-top");t.setAttribute("cx",cx);t.setAttribute("cy",top);t.setAttribute("rx",w/2);t.setAttribute("ry",w*.12);
    const dl=Math.min(w*.7,h*.55);q(".cdl-drip").setAttribute("d",`M${cx-w*.46} ${top} v${dl} a${w*.06} ${w*.06} 0 0 0 ${w*.12} 0 v${-dl*.6} q${w*.1} ${dl*.3} ${w*.2} 0 v${-dl*.4}Z`);
    const k=q(".cdl-wick");k.setAttribute("x1",cx);k.setAttribute("y1",top);k.setAttribute("x2",cx+w*.03);k.setAttribute("y2",top-w*.2);
    q(".cdl-flame").setAttribute("transform",`translate(${cx} ${top-w*.16})`);q(".cdl-flame").style.opacity=lit?1:0;
    const gl=q(".cdl-glow");gl.setAttribute("cx",cx);gl.setAttribute("cy",top-w*.6);q(".cdl-glowwrap").style.opacity=lit?1:.0;
    q(".cdl-smoke").setAttribute("d",`M${cx+w*.03} ${top-w*.22} q${-w*.35} ${-w*.6} 0 ${-w*1.2} q${w*.35} ${-w*.6} 0 ${-w*1.2}`);
    q(".cdl-smokewrap").style.opacity=!lit&&(ctx.started||!focus)?1:0;
  })}
};

(()=>{
  const W=1600,HH=1000;
  function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function ridge(R,y0,amp,rough,bumps=[],it=7){let pts=[[0,y0+(R()-.5)*amp],[W,y0+(R()-.5)*amp]],d=amp;
    for(let k=0;k<it;k++){const np=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];np.push(a,[(a[0]+b[0])/2,(a[1]+b[1])/2+(R()-.5)*d])}np.push(pts[pts.length-1]);pts=np;d*=rough}
    return pts.map(([x,y])=>[x,y-bumps.reduce((s,[bx,bh,bw])=>s+bh*Math.exp(-Math.abs(x-bx)/bw),0)])}
  const fill=pts=>`M0 ${HH} L${pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" L")} L${W} ${HH}Z`;
  const line=pts=>"M"+pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" L");
  const svg=(inner,defs="")=>`<svg class="fz-bgsvg" viewBox="0 0 ${W} ${HH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><filter id="bblur" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="18"/></filter><filter id="sblur" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="6"/></filter>${defs}</defs>${inner}</svg>`;
  const lg=(id,stops,v=true)=>`<linearGradient id="${id}" x1="0" y1="0" x2="${v?0:1}" y2="${v?1:0}">${stops.map(([o,c,a])=>`<stop offset="${o}" stop-color="${c}"${a!=null?` stop-opacity="${a}"`:""}/>`).join("")}</linearGradient>`;
  const DARK={dark:true};

  /* ---------- Alpine (new) ---------- */
  Scenes.alpine={name:"Alpine dusk",caption:"above the clouds…",ambient:"forest",bell:"bowl",breakBell:"chimes",
    pal:{bg:"linear-gradient(180deg,#2b3350 0%,#6a5b6e 55%,#d9a481 100%)",card:"rgba(255,255,255,.08)",ink:"#f5efe9",muted:"#cdbfb8",accent:"#f0a77a",chip:"rgba(255,255,255,.1)",line:"rgba(255,255,255,.14)"},
    art(){return `<svg viewBox="0 0 360 360" class="fz-svg"><defs><clipPath id="afrm"><rect width="360" height="360" rx="44"/></clipPath></defs><g clip-path="url(#afrm)"><svg x="-180" y="0" width="720" height="360" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><defs><filter id="bblur" x="-50%" y="-300%" width="200%" height="700%"><feGaussianBlur stdDeviation="18"/></filter>${Scenes.alpine._defs()}</defs>${Scenes.alpine._inner()}</svg></g></svg>`},
    bg(){return svg(this._inner(),this._defs())},
    _defs(){return lg("aSky",[[0,"#1d2440"],[.38,"#454a6c"],[.62,"#9a7a82"],[.8,"#e2a985"],[1,"#f3c79a"]])+`<radialGradient id="aSun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1090 610) scale(560 360)"><stop offset="0" stop-color="#ffe2b0" stop-opacity=".95"/><stop offset=".35" stop-color="#ffc58f" stop-opacity=".45"/><stop offset="1" stop-color="#ffc58f" stop-opacity="0"/></radialGradient>`+
      lg("aRock",[[0,"#6b5260"],[.55,"#43323f"],[1,"#2a1f29"]])+lg("aRock2",[[0,"#3a2b33"],[1,"#1b1418"]])+lg("aHaze",[[0,"#f3d2c0",0],[.5,"#f3d2c0",.35],[1,"#f3d2c0",0]])},
    _inner(){if(this._c)return this._c;const R=rng(42);
      const far=ridge(R,640,80,.55,[[300,60,160],[1400,90,200]]);
      const peaks=ridge(R,770,50,.6,[[620,230,150],[800,380,115],[960,320,95],[1100,230,130],[1260,140,150]]);
      const near=ridge(R,870,60,.52,[[200,90,180],[1450,70,160]]);const fg=ridge(R,950,40,.5);
      return this._c=`<rect width="${W}" height="${HH}" fill="url(#aSky)"/><rect width="${W}" height="${HH}" fill="url(#aSun)"/>
        <path d="${fill(far)}" fill="#8a86a3" opacity=".75"/><g class="fz-fog"><ellipse cx="520" cy="655" rx="520" ry="42" fill="#fff" opacity=".35" filter="url(#bblur)"/></g>
        <path d="${fill(peaks)}" fill="url(#aRock)"/><path d="${line(peaks)}" fill="none" stroke="#ffb98a" stroke-width="3" opacity=".55"/>
        <g class="fz-fog rev"><ellipse cx="900" cy="520" rx="260" ry="34" fill="#fff" opacity=".55" filter="url(#bblur)"/></g>
        <rect y="690" width="${W}" height="140" fill="url(#aHaze)"/>
        <path d="${fill(near)}" fill="url(#aRock2)"/><path d="${line(near)}" fill="none" stroke="#e8996b" stroke-width="2.5" opacity=".45"/>
        <path d="${fill(fg)}" fill="#140f13"/>`},
    imm:DARK};

  /* ---------- Sunrise ---------- */
  Scenes.sunrise.bg=function(){const R=rng(9);const hills=[[720,40,"#eab3a8",.9],[790,50,"#dc9c9e",1],[860,45,"#c48896",1],[935,35,"#a5788a",1]].map(([y,a,c,o])=>`<path d="${fill(ridge(R,y,a,.42,[],6))}" fill="${c}" opacity="${o}"/>`).join("");
    let birds="";for(let i=0;i<6;i++){const y=220+R()*200,s=1.2+R()*1.4;birds+=`<g class="fz-drift xl" style="animation-duration:${60+R()*50}s;animation-delay:-${R()*60}s"><path transform="translate(0 ${y}) scale(${s})" d="M0 0 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="#7d5c68" stroke-width="2" stroke-linecap="round"/></g>`}
    return svg(`<rect width="${W}" height="${HH}" fill="url(#sSky)"/><g id="sun"><circle cx="800" cy="0" r="330" fill="url(#sGlow)"/><circle cx="800" cy="0" r="92" fill="#fff4d6"/></g>
      <g class="fz-drift slow xl"><ellipse cx="200" cy="260" rx="200" ry="26" fill="#fff" opacity=".45" filter="url(#sblur)"/><ellipse cx="1100" cy="330" rx="260" ry="30" fill="#fff" opacity=".35" filter="url(#sblur)"/></g>${birds}${hills}`,
      lg("sSky",[[0,"#e8b6bd"],[.5,"#f8d3c3"],[1,"#ffe7cc"]])+`<radialGradient id="sGlow"><stop offset="0" stop-color="#fff1c9" stop-opacity=".95"/><stop offset="1" stop-color="#ffd9b0" stop-opacity="0"/></radialGradient>`)};
  Scenes.sunrise.bgUpdate=(r,p)=>{const s=r.querySelector("#fzBg #sun");if(s)s.setAttribute("transform",`translate(0 ${700-p*360})`)};
  Scenes.sunrise.imm={dark:false};

  /* ---------- Rain ---------- */
  Scenes.rain.bg=function(){const R=rng(5);let bokeh="",glass="",win="";const cols=["#f6c27a","#e98f6f","#9ec0e4","#f3d9a6","#c99ad8","#ffe0a3"];
    for(let i=0;i<70;i++)bokeh+=`<circle cx="${R()*W}" cy="${380+R()*560}" r="${14+R()*46}" fill="${cols[i%6]}" opacity="${.18+R()*.35}"/>`;
    for(let i=0;i<40;i++){const x=R()*W,y=150+R()*420;win+=`<rect x="${x}" y="${y}" width="${6+R()*10}" height="${8+R()*12}" fill="#ffd79a" opacity="${.2+R()*.5}"/>`}
    for(let i=0;i<110;i++){const r=2+R()*7;glass+=`<circle class="${R()<.22?"fz-slide xl":""}" cx="${R()*W}" cy="${R()*HH}" r="${r}" fill="rgba(220,235,255,.08)" stroke="rgba(235,245,255,.3)" stroke-width="1" style="animation-duration:${18+R()*24}s;animation-delay:-${R()*30}s"/>`}
    return svg(`<rect width="${W}" height="${HH}" fill="url(#rSky)"/><g filter="url(#bblur)">${win}${bokeh}</g><rect y="760" width="${W}" height="240" fill="#0f141c" opacity=".45"/>${glass}`,lg("rSky",[[0,"#33405a"],[.6,"#222b3b"],[1,"#141922"]]))};
  Scenes.rain.imm=DARK;Scenes.rain.fx="rain";

  /* ---------- Night ---------- */
  Scenes.night.bg=function(){const R=rng(17);let stars="";for(let i=0;i<320;i++){const tw=R()<.25;stars+=`<circle ${tw?`class="fz-tw" style="animation-duration:${2+R()*4}s;animation-delay:-${R()*5}s"`:""} cx="${R()*W}" cy="${R()*700}" r="${.4+R()*1.5}" fill="#fff" opacity="${tw?1:.35+R()*.6}"/>`}
    return svg(`<rect width="${W}" height="${HH}" fill="url(#nSky2)"/><ellipse cx="800" cy="330" rx="900" ry="120" transform="rotate(-18 800 330)" fill="url(#mw)" filter="url(#bblur)"/>${stars}
      <line class="fz-shoot xl" x1="300" y1="140" x2="420" y2="200" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <g id="moon2"><circle cx="1250" cy="230" r="150" fill="url(#mg2)"/><circle cx="1250" cy="230" r="54" fill="#f5efd6" mask="url(#cres2)"/></g>
      <path d="${fill(ridge(R,760,90,.55,[[500,120,200],[1100,90,160]]))}" fill="#232857"/><path d="${fill(ridge(R,860,50,.5))}" fill="#141838"/>`,
      lg("nSky2",[[0,"#090d26"],[.6,"#1b2052"],[1,"#2e2c66"]])+`<radialGradient id="mw"><stop offset="0" stop-color="#c9c3ff" stop-opacity=".28"/><stop offset="1" stop-color="#c9c3ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="mg2"><stop offset="0" stop-color="#f5efd6" stop-opacity=".3"/><stop offset="1" stop-color="#f5efd6" stop-opacity="0"/></radialGradient><mask id="cres2"><rect width="${W}" height="${HH}" fill="#fff"/><circle cx="1278" cy="212" r="48" fill="#000"/></mask>`)};
  Scenes.night.imm=DARK;

  /* ---------- Ocean ---------- */
  Scenes.ocean.bg=function(){const wave=(y,c,d,o,a)=>`<g class="fz-wave xl" style="animation-duration:${d}s"><path d="M-400 ${y} ${Array.from({length:22},()=>`q50 -${a} 100 0 t100 0`).join(" ")} L4000 ${HH} L-400 ${HH}Z" fill="${c}" opacity="${o}"/></g>`;
    return svg(`<rect width="${W}" height="${HH}" fill="url(#oSky2)"/><circle cx="800" cy="470" r="70" fill="#fff6e3"/><circle cx="800" cy="470" r="200" fill="#fff6e3" opacity=".22"/>
      <rect y="520" width="${W}" height="480" fill="url(#oSea)"/><rect x="730" y="520" width="140" height="300" fill="url(#oRef)" filter="url(#sblur)"/>
      ${wave(560,"#7fbdc0",22,.8,8)}${wave(630,"#5fa9ae",16,.9,12)}${wave(720,"#4797a0",12,1,16)}
      <path d="M0 860 Q400 820 800 850 T1600 840 L1600 1000 L0 1000Z" fill="#f1dfc0"/><path class="fz-foam" d="M0 860 Q400 820 800 850 T1600 840" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>`,
      lg("oSky2",[[0,"#f2cdb9"],[.6,"#f8e4d3"],[1,"#d8ecec"]])+lg("oSea",[[0,"#9ccfd0"],[1,"#3f8f97"]])+lg("oRef",[[0,"#fff6e3",.7],[1,"#fff6e3",0]]))};
  Scenes.ocean.imm={dark:false};

  /* ---------- Forest ---------- */
  Scenes.forest.bg=function(){const R=rng(29);const pines=(base,h,c,n)=>{let s="";for(let i=0;i<n;i++){const x=i*(W+80)/n-40+R()*20,hh=h*(.65+R()*.6),w=hh*.38;s+=`<path d="M${x} ${base} L${x+w/2} ${base-hh} L${x+w} ${base}Z" fill="${c}"/>`}return s+`<rect y="${base-1}" width="${W}" height="${HH-base}" fill="${c}"/>`};
    let rays="";for(let i=0;i<5;i++){const x=200+i*130;rays+=`<polygon class="fz-ray" points="${x},0 ${x+70},0 ${x+520},${HH} ${x+300},${HH}" fill="url(#ray)" style="animation-delay:-${i*2}s"/>`}
    return svg(`<rect width="${W}" height="${HH}" fill="url(#fSky2)"/><circle cx="330" cy="170" r="70" fill="#fffbe9" opacity=".9"/>${rays}
      ${pines(560,210,"#c3cfbc",30)}<g class="fz-fog xl"><ellipse cx="500" cy="570" rx="700" ry="50" fill="#fff" opacity=".5" filter="url(#bblur)"/></g>
      ${pines(690,260,"#9db299",26)}<g class="fz-fog rev xl"><ellipse cx="1100" cy="700" rx="760" ry="56" fill="#fff" opacity=".42" filter="url(#bblur)"/></g>
      ${pines(840,330,"#738f72",22)}${pines(990,420,"#4b6450",17)}`,
      lg("fSky2",[[0,"#f4f2e2"],[1,"#d3dfcd"]])+lg("ray",[[0,"#fffbe6",.35],[1,"#fffbe6",0]]))};
  Scenes.forest.imm={dark:false};

  /* ---------- Cozy ---------- */
  Scenes.cozy.bg=function(){const R=rng(3);let snow="";for(let i=0;i<60;i++)snow+=`<circle class="fz-snow" cx="${150+R()*400}" cy="${-20}" r="${1.5+R()*2.5}" fill="#fff" opacity="${.5+R()*.4}" style="animation-duration:${8+R()*8}s;animation-delay:-${R()*16}s"/>`;
    return svg(`<rect width="${W}" height="${HH}" fill="url(#cWall)"/>
      <g><rect x="140" y="120" width="420" height="520" rx="16" fill="url(#cWin)"/><clipPath id="cwc"><rect x="140" y="120" width="420" height="520" rx="16"/></clipPath><g clip-path="url(#cwc)">${snow}<circle cx="460" cy="230" r="40" fill="#f3efd9" opacity=".85"/></g>
        <rect x="140" y="120" width="420" height="520" rx="16" fill="none" stroke="#3e2a1f" stroke-width="18"/><line x1="350" y1="120" x2="350" y2="640" stroke="#3e2a1f" stroke-width="12"/><line x1="140" y1="380" x2="560" y2="380" stroke="#3e2a1f" stroke-width="12"/></g>
      <rect x="0" y="830" width="${W}" height="170" fill="url(#cTable)"/><rect x="0" y="830" width="${W}" height="6" fill="#6a4630"/>
      ${Candle.svg(1160,836,470,120)}
      <g><rect x="1340" y="720" width="150" height="118" rx="20" fill="#c87a58"/><path d="M1490 745 q50 4 46 42 q-4 34 -46 34" stroke="#c87a58" stroke-width="18" fill="none"/>
        <path class="fz-steam" d="M1380 700 q-20 -34 0 -64 q20 -30 0 -64" stroke="#f6e6d6" stroke-width="6" fill="none" opacity=".5" stroke-linecap="round"/>
        <path class="fz-steam d2" d="M1430 700 q-20 -34 0 -64 q20 -30 0 -64" stroke="#f6e6d6" stroke-width="6" fill="none" opacity=".5" stroke-linecap="round"/></g>`,
      lg("cWall",[[0,"#2a1b14"],[1,"#3b271c"]])+lg("cWin",[[0,"#16223f"],[1,"#2c3a63"]])+lg("cTable",[[0,"#4a2f20"],[1,"#2a1a12"]])+Candle.defs)};
  Scenes.cozy.imm=DARK;Scenes.cozy.update=(r,p,ctx)=>Candle.update(r,ctx.raw,ctx);Scenes.cozy.bgUpdate=Scenes.cozy.update;

  /* ---------- Matcha ---------- */
  Scenes.matcha.imm={dark:false};

  // order: put Alpine second in pickers
  const order=["matcha","alpine","sunrise","rain","night","ocean","forest","cozy"];const copy={...Scenes};order.forEach(k=>{delete Scenes[k];Scenes[k]=copy[k]});
})();
