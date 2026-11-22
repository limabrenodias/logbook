/* Painting scenes — public-domain impressionist works (painters died 1890–1926), loaded from
   Wikimedia Commons, with a local copy as fallback where we have one.
   "Living" touches added on top of each painting: water that ripples, grass and leaves in the wind,
   a shimmering night sky, rain, a sun that warms as the session goes on — and a slow zoom that
   follows the timer (in during focus, back out during breaks). */
"use strict";
(()=>{
  const CM=(f,w)=>"https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(f)+"?width="+(w||1920);
  const mask=(stops)=>stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join("");
  const below=y=>mask([[0,"#000"],[y,"#000"],[Math.min(1,y+.08),"#fff"],[1,"#fff"]]);
  const above=y=>mask([[0,"#fff"],[Math.max(0,y-.1),"#fff"],[y,"#000"],[1,"#000"]]);
  const all=()=>mask([[0,"#fff"],[1,"#fff"]]);
  const PAL=(bg,ink,muted,accent)=>({bg,card:"rgba(253,252,250,.74)",ink,muted,accent,chip:"rgba(255,255,255,.6)",line:"rgba(0,0,0,.07)"});

  const P={
    parasol:{name:"Woman with a Parasol",caption:"a breezy hilltop…",credit:"Claude Monet · Woman with a Parasol, 1875",ambient:"forest",bell:"chimes",breakBell:"kalimba",
      art:{file:"Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg",w:6001,h:7455,f:[.55,.38],local:"art/parasol.jpg"},
      live:{bf:[.016,.005],scale:9,mask:below(.74)},pal:PAL("linear-gradient(170deg,#eef3f8,#e3ecf4 60%,#eef0e6)","#2f4258","#7d8fa3","#5b83ad")},
    poplars:{name:"Poplars on the Epte",caption:"by the river…",credit:"Claude Monet · Poplars on the Epte, 1891",ambient:"river",bell:"bowl",breakBell:"chimes",
      art:{file:"Monet_Poplars_on_the_River_Epte.jpg",w:2589,h:3297,f:[.5,.5],local:"art/poplars.jpg"},
      live:{bf:[.004,.045],scale:12,mask:below(.56)},pal:PAL("linear-gradient(170deg,#eef1ea,#e6ece6 60%,#e9eef2)","#36443a","#84917f","#6f8d73")},
    lilies:{name:"Water Lilies",caption:"the lily pond…",credit:"Claude Monet · Water Lilies, 1906",ambient:"river",bell:"bowl",breakBell:"kalimba",
      art:{file:"Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg",w:2342,h:2250,f:[.5,.55]},
      live:{bf:[.006,.03],scale:9,mask:all()},pal:PAL("linear-gradient(170deg,#ecf0ef,#e3eae9 60%,#efe9ec)","#2e4446","#7f9796","#5d8d88")},
    harbour:{name:"Impression, Sunrise",caption:"morning in the harbour…",credit:"Claude Monet · Impression, Sunrise, 1872",ambient:"ocean",bell:"bowl",breakBell:"chimes",
      art:{file:"Monet_-_Impression,_Sunrise.jpg",w:5773,h:4478,f:[.42,.5]},sun:[.375,.45],
      live:{bf:[.005,.05],scale:9,mask:below(.5)},pal:PAL("linear-gradient(170deg,#e9eef2,#e2e8ee 60%,#efe7e2)","#33414f","#80909f","#b9805f")},
    wood:{name:"By the Edge of a Wood",caption:"painting in the woods…",credit:"John Singer Sargent · Claude Monet Painting by the Edge of a Wood, c. 1885",ambient:"forest",bell:"wood",breakBell:"kalimba",
      art:{file:"Sargent_MonetPainting.jpg",w:1536,h:1265,f:[.45,.55],local:"art/sargent.jpg"},
      live:{bf:[.02,.012],scale:7,mask:above(.45)},pal:PAL("linear-gradient(170deg,#efece4,#e8e4d8 60%,#e9ebe1)","#3d3a2e","#8b8572","#8a7d52")},
    paris:{name:"Paris Street; Rainy Day",caption:"a rainy day in Paris…",credit:"Gustave Caillebotte · Paris Street; Rainy Day, 1877",ambient:"rain",bell:"bowl",breakBell:"chimes",fx:"rain",rainArt:true,
      art:{file:"Gustave_Caillebotte_-_Paris_Street;_Rainy_Day_-_Google_Art_Project.jpg",w:5982,h:4531,f:[.5,.5]},
      live:{bf:[.008,.06],scale:5,mask:below(.72)},pal:PAL("linear-gradient(170deg,#eeeeec,#e6e6e3 60%,#e8e9ec)","#363a40","#868a90","#6f7a88")},
    starry:{name:"The Starry Night",caption:"under the swirling sky…",credit:"Vincent van Gogh · The Starry Night, 1889",ambient:"night",bell:"chimes",breakBell:"kalimba",
      art:{file:"Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",w:30000,h:23756,f:[.5,.4]},
      live:{bf:[.009,.009],scale:6,mask:above(.62)},pal:PAL("linear-gradient(170deg,#e9edf5,#e1e6f1 60%,#ebe9e3)","#2a3553","#7a85a3","#4f68a3")},
    seashore:{name:"Children at the Seashore",caption:"by the sea…",credit:"Joaquín Sorolla · Children at the Seashore",ambient:"ocean",bell:"bowl",breakBell:"chimes",
      art:{file:"Joaquin_Sorolla_Ninos_A_La_Orilla_Del_Mar.jpg",w:4096,h:3028,f:[.5,.5]},
      live:{bf:[.005,.04],scale:9,mask:all()},pal:PAL("linear-gradient(170deg,#eaf1f2,#e1ebee 60%,#efebe4)","#2f4c57","#7f9aa3","#4f8ca0")},
    stroll:{name:"Strolling along the Seashore",caption:"a walk along the shore…",credit:"Joaquín Sorolla · Strolling along the Seashore, 1909",ambient:"ocean",bell:"chimes",breakBell:"kalimba",
      art:{file:"Joaquín_Sorolla_y_Bastida_-_Strolling_along_the_Seashore_-_Google_Art_Project.jpg",w:2000,h:2050,f:[.5,.42]},
      live:{bf:[.012,.02],scale:6,mask:all()},pal:PAL("linear-gradient(170deg,#eef1f2,#e6edef 60%,#f1ede6)","#334650","#82969f","#5f8ea1")},
  };

  let uid=0;
  function svgFor(sc,mode){
    const A=sc.art_,VW=1000,VH=Math.round(1000*A.h/A.w),src=CM(A.file),id=(mode==="bg"?"pb":"pa")+(++uid);
    const living=Scenes._living!==false&&!(typeof reduceMotion==="function"?reduceMotion():matchMedia("(prefers-reduced-motion: reduce)").matches);
    const L=sc.live,sc_=mode==="bg"?1:.6;
    const img=(x="")=>`<image class="pt-img" href="${src}" ${A.local?`data-fallback="${A.local}"`:""} x="0" y="0" width="${VW}" height="${VH}" preserveAspectRatio="xMidYMid slice" ${x}/>`;
    let defs=`<filter id="${id}F" x="0" y="0" width="100%" height="100%"><feTurbulence class="lv-t" data-bx="${L.bf[0]}" data-by="${L.bf[1]}" type="fractalNoise" baseFrequency="${L.bf[0]} ${L.bf[1]}" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${L.scale*sc_}" xChannelSelector="R" yChannelSelector="G"/></filter>
      <linearGradient id="${id}G" x1="0" y1="0" x2="0" y2="1">${L.mask}</linearGradient><mask id="${id}M"><rect width="${VW}" height="${VH}" fill="url(#${id}G)"/></mask>`;
    let extra="";
    if(sc.sun){defs+=`<radialGradient id="${id}S"><stop offset="0" stop-color="#ffb070" stop-opacity=".85"/><stop offset=".4" stop-color="#ff9a5a" stop-opacity=".3"/><stop offset="1" stop-color="#ff9a5a" stop-opacity="0"/></radialGradient>`;
      extra+=`<circle class="pt-sun" cx="${sc.sun[0]*VW}" cy="${sc.sun[1]*VH}" r="${VW*.22}" fill="url(#${id}S)" style="mix-blend-mode:screen" opacity=".2"/>`}
    if(sc.rainArt&&mode==="art"){let r="";for(let i=0;i<40;i++){const x=Math.random()*VW*1.1;r+=`<line class="fz-fall pt-rain" x1="${x}" y1="-60" x2="${x-8}" y2="-10" stroke="#fff" stroke-width="2" opacity="${(.25+Math.random()*.3).toFixed(2)}" style="animation-duration:${(.7+Math.random()*.6).toFixed(2)}s;animation-delay:-${(Math.random()*2).toFixed(2)}s"/>`}extra+=r}
    const inner=`<g class="pt-kb" data-cx="${A.f[0]*VW}" data-cy="${A.f[1]*VH}">${img()}${living?`<g mask="url(#${id}M)">${img(`filter="url(#${id}F)"`)}</g>`:""}${extra}</g>`;
    if(mode==="bg"){
      // a tall painting on a wide screen (or the reverse) would be cropped to a sliver: show it whole,
      // at full height, over a soft blurred extension of its own colours — like a gallery wall
      const va=innerWidth/Math.max(1,innerHeight),pa=A.w/A.h,whole=pa<va*.72||pa>va*1.6;
      const main=`<svg class="fz-bgsvg pt-svg${whole?" pt-whole":""}" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid ${whole?"meet":"slice"}" aria-hidden="true"><defs>${defs}</defs>${inner}</svg>`;
      return whole?`<div class="pt-blur" style="background-image:url('${src}')${A.local?`,url('${A.local}')`:""}"></div>${main}`:main}
    return `<svg class="pt-svg pt-framed pt-fit" data-ar="${A.w/A.h}" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>${defs}</defs>${inner}</svg>`;
  }
  function update(root,p,ctx){
    root.querySelectorAll(".pt-sun").forEach(s=>s.setAttribute("opacity",(.15+.55*(ctx&&ctx.phase==="focus"?ctx.raw:0)).toFixed(3)));
  }
  const order=Object.keys(P);
  const old={...Scenes};Object.keys(Scenes).forEach(k=>delete Scenes[k]);
  order.forEach(k=>{const d=P[k];Scenes[k]={...d,art_:d.art,group:"Paintings",painting:true,light:true,imm:{dark:true},
    art(){return svgFor(this,"art")},bg(){return svgFor(this,"bg")},update,bgUpdate:update}});
  Object.keys(old).forEach(k=>{if(!Scenes[k])Scenes[k]={...old[k],group:"Illustrations"}});
  Scenes.preview=k=>{const s=Scenes[k];return s.painting?`background:url('${CM(s.art_.file,330)}') ${s.art_.f[0]*100}% ${s.art_.f[1]*100}%/cover, ${s.pal.bg}`:`background:${s.pal.bg}`};

  function fit(){document.querySelectorAll(".pt-fit").forEach(svg=>{const box=svg.parentElement;if(!box)return;const ar=+svg.dataset.ar||1;
    const bw=box.clientWidth,bh=box.clientHeight||bw/ar;let w=bw,h=w/ar;if(h>bh){h=bh;w=h*ar}svg.style.width=Math.floor(w)+"px";svg.style.height=Math.floor(h)+"px";
    const fx=box.querySelector(".pt-fx");if(fx){fx.style.width=svg.style.width;fx.style.height=svg.style.height}})}
  Scenes.fitPaintings=fit;addEventListener("resize",()=>requestAnimationFrame(fit));
  // gentle motion: drift the turbulence that ripples water / sways grass (≈8 fps keeps it light)
  setInterval(()=>{if(document.hidden)return;const ts=document.querySelectorAll(".lv-t");if(!ts.length)return;const t=performance.now()/1000;
    ts.forEach((n,i)=>{const bx=+n.dataset.bx,by=+n.dataset.by;n.setAttribute("baseFrequency",`${(bx*(1+.22*Math.sin(t*.42+i))).toFixed(5)} ${(by*(1+.16*Math.sin(t*.57+1.3+i))).toFixed(5)}`)})},125);
  // if Wikimedia can't be reached, use the local copy
  document.addEventListener("error",e=>{const t=e.target;if(t&&t.classList&&t.classList.contains("pt-img")&&t.dataset.fallback&&!t.dataset.fb){t.dataset.fb="1";t.setAttribute("href",t.dataset.fallback)}},true);
})();
