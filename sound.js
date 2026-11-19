/* Logbook sound engine — every sound is synthesized in the browser (no audio files).
   Ambient: rain, brown/pink/white noise, ocean, fire, forest, night.
   Signals: soft bell, singing bowl, wind chimes, kalimba, wood block — all gentle. */
"use strict";
const Sound=(()=>{
  let ctx=null,master=null,amb=null,ambName="silence",loops=[],vol=0.6;
  const bufs={};
  const AMBIENTS=[["silence","Silence"],["rain","Rain on the window"],["brown","Brown noise"],["pink","Pink noise"],["white","White noise"],["ocean","Ocean waves"],["fire","Crackling fire"],["forest","Forest breeze"],["night","Night crickets"]];
  const BELLS=[["bell","Soft bell"],["bowl","Singing bowl"],["chimes","Wind chimes"],["kalimba","Kalimba"],["wood","Wood block"],["none","No sound"]];

  function ensure(){
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ctx=new AC();master=ctx.createGain();master.gain.value=vol;
      const comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=3;master.connect(comp);comp.connect(ctx.destination)}
    if(ctx.state==="suspended")ctx.resume();
    return ctx;
  }
  function noise(kind){
    if(bufs[kind])return bufs[kind];
    const n=ctx.sampleRate*6,b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
    for(let i=0;i<n;i++){const w=Math.random()*2-1;
      if(kind==="white")d[i]=w*.35;
      else if(kind==="pink"){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.09;b6=w*.115926}
      else{last=(last+.02*w)/1.02;d[i]=last*3.2}}
    // crossfade loop seam
    const f=Math.floor(ctx.sampleRate*.05);for(let i=0;i<f;i++){const t=i/f;d[n-f+i]=d[n-f+i]*(1-t)+d[i]*t}
    return bufs[kind]=b;
  }
  function src(kind){const s=ctx.createBufferSource();s.buffer=noise(kind);s.loop=true;s.loopStart=.05;s.start(0,Math.random()*5);return s}
  function filt(type,f,q){const x=ctx.createBiquadFilter();x.type=type;x.frequency.value=f;if(q)x.Q.value=q;return x}
  function gain(v){const g=ctx.createGain();g.gain.value=v;return g}
  function chain(...n){for(let i=0;i<n.length-1;i++)n[i].connect(n[i+1]);return n[n.length-1]}
  function every(minMs,maxMs,fn){let alive=true;const tick=()=>{if(!alive)return;try{fn()}catch(e){}setTimeout(tick,minMs+Math.random()*(maxMs-minMs))};setTimeout(tick,minMs*Math.random());loops.push(()=>alive=false)}
  function burst(dest,dur,peak,f,type,q){const s=ctx.createBufferSource();s.buffer=noise("white");const g=gain(0);const fl=filt(type||"bandpass",f,q||1.5);chain(s,fl,g,dest);const t=ctx.currentTime;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.start(t,Math.random()*5);s.stop(t+dur+.05)}

  function build(name,out){
    if(name==="white"||name==="pink"||name==="brown"){chain(src(name),filt("lowpass",name==="white"?9000:4000),gain(name==="brown"?.55:.4),out);return}
    if(name==="rain"){
      chain(src("pink"),filt("highpass",450),filt("lowpass",6500),gain(.42),out);
      chain(src("brown"),filt("lowpass",380),gain(.28),out);
      every(25,140,()=>burst(out,.03+Math.random()*.04,.03+Math.random()*.09,2200+Math.random()*4500,"bandpass",2.5));
      every(900,2600,()=>burst(out,.12,.05,900+Math.random()*500,"bandpass",4)); // gutter drips
      return}
    if(name==="ocean"){
      const g=gain(.15),lp=filt("lowpass",700);chain(src("brown"),lp,g,out);chain(src("pink"),filt("lowpass",1600),gain(.12),g);
      const wave=()=>{const t=ctx.currentTime,d=6+Math.random()*5;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);
        g.gain.linearRampToValueAtTime(.75+Math.random()*.25,t+d*.42);g.gain.linearRampToValueAtTime(.12,t+d);
        lp.frequency.cancelScheduledValues(t);lp.frequency.setValueAtTime(lp.frequency.value,t);lp.frequency.linearRampToValueAtTime(1500,t+d*.45);lp.frequency.linearRampToValueAtTime(500,t+d);return d};
      let alive=true;const loop=()=>{if(!alive)return;const d=wave();setTimeout(loop,d*1000)};loop();loops.push(()=>alive=false);return}
    if(name==="fire"){
      chain(src("brown"),filt("lowpass",420),gain(.5),out);
      every(30,320,()=>burst(out,.006+Math.random()*.012,.05+Math.random()*.22,1800+Math.random()*3500,"highpass",.7));
      every(1500,5000,()=>{for(let i=0;i<3+Math.random()*4;i++)setTimeout(()=>burst(out,.01,.12+Math.random()*.2,2500,"highpass",.7),i*(20+Math.random()*60))});
      return}
    if(name==="forest"){
      const wg=gain(.3);chain(src("pink"),filt("bandpass",700,.4),wg,out);
      const lfo=ctx.createOscillator(),ld=gain(.18);lfo.frequency.value=.06;chain(lfo,ld,wg.gain);lfo.start();
      every(2500,8000,()=>{const n=2+Math.floor(Math.random()*3),base=2600+Math.random()*1400;for(let i=0;i<n;i++){const t=ctx.currentTime+i*(.11+Math.random()*.05);const o=ctx.createOscillator(),g=gain(0);o.type="sine";chain(o,g,out);
        o.frequency.setValueAtTime(base,t);o.frequency.exponentialRampToValueAtTime(base*(1.25+Math.random()*.3),t+.07);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.025,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.11);o.start(t);o.stop(t+.13)}});
      return}
    if(name==="night"){
      chain(src("brown"),filt("lowpass",300),gain(.22),out);
      [[4400,-.5],[5100,.6]].forEach(([f,p])=>{const pan=ctx.createStereoPanner?ctx.createStereoPanner():gain(1);if(pan.pan)pan.pan.value=p;pan.connect(out);
        every(800,1900,()=>{const pulses=3+Math.floor(Math.random()*2);for(let i=0;i<pulses;i++){const t=ctx.currentTime+i*.055;const o=ctx.createOscillator(),g=gain(0);o.frequency.value=f+Math.random()*80;chain(o,g,pan);
          g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.012,t+.008);g.gain.linearRampToValueAtTime(0,t+.035);o.start(t);o.stop(t+.05)}})});
      return}
  }
  function setAmbient(name){
    ambName=name;if(!ensure())return;
    const t=ctx.currentTime;
    if(amb){const old=amb;old.gain.cancelScheduledValues(t);old.gain.setValueAtTime(old.gain.value,t);old.gain.linearRampToValueAtTime(0,t+1.2);setTimeout(()=>{try{old.disconnect()}catch(e){}},1400)}
    loops.forEach(f=>f());loops=[];amb=null;
    if(name==="silence")return;
    amb=gain(0);amb.connect(master);build(name,amb);amb.gain.linearRampToValueAtTime(1,t+2);
  }
  function stopAmbient(){const n=ambName;setAmbient("silence");ambName=n}
  function setVolume(v){vol=v;if(master)master.gain.setTargetAtTime(v,ctx.currentTime,.05)}

  function strike(freq,partials,at,peak){
    const t=ctx.currentTime+(at||0);
    partials.forEach(([mul,amp,decay,detune])=>{[0,detune||0].forEach((dt,k)=>{if(k&&!dt)return;const o=ctx.createOscillator(),g=gain(0);o.type="sine";o.frequency.value=freq*mul+dt;chain(o,g,master);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp*(peak||.22)*(dt?.6:1),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+decay);o.start(t);o.stop(t+decay+.1)})});
  }
  function play(name){
    if(name==="none"||!ensure())return;
    if(name==="bell"){const P=[[1,1,3.2,1.2],[2.01,.35,2.2],[3.02,.18,1.6],[4.24,.1,1.1]];strike(784,P,0);strike(784,P,1.5,.17)}
    else if(name==="bowl"){strike(220,[[1,1,7.5,.9],[2.76,.45,5.5,1.4],[5.4,.18,3.5],[8.93,.06,2]],0,.26)}
    else if(name==="chimes"){const notes=[1046.5,1174.7,1318.5,1568,1760,2093];for(let i=0;i<6;i++)strike(notes[Math.floor(Math.random()*notes.length)],[[1,1,2.6],[2.76,.22,1.4]],i*(.16+Math.random()*.22),.11)}
    else if(name==="kalimba"){[523.25,659.25,783.99,1046.5].forEach((f,i)=>strike(f,[[1,1,1.4],[3,.08,.5],[5.9,.05,.25]],i*.17,.16))}
    else if(name==="wood"){[0,.32,.64].forEach(a=>strike(720,[[1,1,.18],[2.6,.3,.08]],a,.28))}
  }
  return{AMBIENTS,BELLS,ensure,setAmbient,stopAmbient,setVolume,play,get ambient(){return ambName},get ready(){return !!ctx}};
})();
