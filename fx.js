/* Canvas weather effects for immersive backdrops (rain). Pauses when the tab is hidden. */
"use strict";
const Fx=(()=>{
  let raf=0,cv=null,ctx=null,drops=[],kind=null,dpr=1;
  function resize(){if(!cv)return;dpr=Math.min(2,window.devicePixelRatio||1);cv.width=cv.clientWidth*dpr;cv.height=cv.clientHeight*dpr;const n=Math.round(cv.clientWidth*cv.clientHeight/6500);drops=Array.from({length:n},mk)}
  function mk(){return{x:Math.random()*cv.width*1.2,y:Math.random()*cv.height,l:(12+Math.random()*26)*dpr,v:(16+Math.random()*18)*dpr,o:.12+Math.random()*.32,w:(.7+Math.random()*.9)*dpr}}
  function loop(){if(document.hidden){raf=requestAnimationFrame(loop);return}
    ctx.clearRect(0,0,cv.width,cv.height);ctx.strokeStyle="#d6e6fa";ctx.lineCap="round";
    for(const d of drops){ctx.globalAlpha=d.o;ctx.lineWidth=d.w;ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-d.l*.16,d.y+d.l);ctx.stroke();d.y+=d.v;d.x-=d.v*.16;if(d.y>cv.height){d.y=-40*dpr;d.x=Math.random()*cv.width*1.2}}
    raf=requestAnimationFrame(loop)}
  function start(k,canvas){stop();if(!k||!canvas||matchMedia("(prefers-reduced-motion: reduce)").matches)return;kind=k;cv=canvas;ctx=cv.getContext("2d");resize();addEventListener("resize",resize);loop()}
  function stop(){cancelAnimationFrame(raf);raf=0;removeEventListener("resize",resize);if(ctx&&cv)ctx.clearRect(0,0,cv.width,cv.height);cv=null;ctx=null;kind=null}
  return{start,stop};
})();
