/* Logbook sound engine — synthesized in the browser, no audio files.
   Stereo throughout (decorrelated left/right noise), a shared convolution reverb for space,
   offline-rendered textures (rain patter, fire crackle) built from thousands of individual events,
   and soft, reverberant signals for the end of a session. */
"use strict";
const Sound=(()=>{
  let ctx=null,master=null,revIn=null,amb=null,ambName="silence",loops=[],vol=.6;
  const bufs={};
  const AMBIENTS=[["silence","Silence"],["rain","Rain"],["river","Gentle stream"],["ocean","Ocean waves"],["forest","Forest & birds"],["night","Night crickets"],["fire","Crackling fire"],["brown","Brown noise"],["pink","Pink noise"],["white","Soft white noise"]];
  const BELLS=[["bell","Soft bell"],["bowl","Singing bowl"],["chimes","Wind chimes"],["kalimba","Kalimba"],["wood","Wood block"],["none","No sound"]];
  const R=Math.random;

  function ensure(){
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ctx=new AC();
      master=ctx.createGain();master.gain.value=vol;
      const warm=ctx.createBiquadFilter();warm.type="highshelf";warm.frequency.value=7000;warm.gain.value=-4;   // tame harsh highs
      const comp=ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=12;comp.ratio.value=2.5;comp.attack.value=.01;comp.release.value=.3;
      master.connect(warm);warm.connect(comp);comp.connect(ctx.destination);
      // reverb: generated stereo impulse response (≈3 s, darkening tail)
      const conv=ctx.createConvolver();conv.buffer=impulse(3.2);revIn=ctx.createGain();revIn.gain.value=1;
      const revOut=ctx.createGain();revOut.gain.value=.55;revIn.connect(conv);conv.connect(revOut);revOut.connect(master)}
    if(ctx.state==="suspended")ctx.resume();
    return ctx;
  }
  function impulse(sec){const sr=ctx.sampleRate,n=Math.floor(sr*sec),b=ctx.createBuffer(2,n,sr);
    for(let c=0;c<2;c++){const d=b.getChannelData(c);let lp=0;for(let i=0;i<n;i++){const t=i/n;const k=.35+t*.6;lp=lp*k+(R()*2-1)*(1-k);d[i]=lp*Math.pow(1-t,2.6)*(i<sr*.012?i/(sr*.012):1)}}
    return b}
  function noise(kind){
    if(bufs[kind])return bufs[kind];
    const sr=ctx.sampleRate,n=sr*8,b=ctx.createBuffer(2,n,sr);
    for(let c=0;c<2;c++){const d=b.getChannelData(c);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
      for(let i=0;i<n;i++){const w=R()*2-1;
        if(kind==="white")d[i]=w*.3;
        else if(kind==="pink"){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.085;b6=w*.115926}
        else{last=(last+.02*w)/1.02;d[i]=last*3.2}}
      const f=Math.floor(sr*.08);for(let i=0;i<f;i++){const t=i/f;d[n-f+i]=d[n-f+i]*(1-t)+d[i]*t}}
    return bufs[kind]=b}
  // seamless textures made of many short events (index wraps, so the loop has no seam)
  function texture(key,sec,count,make){
    if(bufs[key])return bufs[key];
    const sr=ctx.sampleRate,n=Math.floor(sr*sec),b=ctx.createBuffer(2,n,sr);
    for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let k=0;k<count;k++)make(d,n,sr,Math.floor(R()*n));
      let pk=0;for(let i=0;i<n;i++)pk=Math.max(pk,Math.abs(d[i]));if(pk>0)for(let i=0;i<n;i++)d[i]=d[i]/pk*.9}
    return bufs[key]=b}
  const patter=()=>texture("patter",7,7*420,(d,n,sr,t0)=>{               // raindrops: tiny damped resonances
    const f=1300+Math.pow(R(),1.6)*4800,dec=sr*(.0015+R()*.009),a=.05+Math.pow(R(),3)*.95,L=Math.floor(dec*6),w=2*Math.PI*f/sr;
    for(let i=0;i<L;i++){const e=Math.exp(-i/dec)*(i<6?i/6:1);d[(t0+i)%n]+=a*e*(Math.sin(w*i)*.7+(R()*2-1)*.3*Math.exp(-i/(dec*.25)))}});
  const crackle=()=>texture("crackle",9,9*60,(d,n,sr,t0)=>{               // fire: clustered short snaps
    const burst=1+Math.floor(Math.pow(R(),2)*6);
    for(let j=0;j<burst;j++){const s=t0+Math.floor(R()*sr*.06),dec=sr*(.0004+R()*.0025),a=.1+Math.pow(R(),2.5)*.9,L=Math.floor(dec*8);let prev=0;
      for(let i=0;i<L;i++){const w=R()*2-1;const v=(w-prev)*.5;prev=w;d[(s+i)%n]+=a*v*Math.exp(-i/dec)}}});
  function src(buf,rate){const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;if(rate)s.playbackRate.value=rate;s.start(0,R()*buf.duration);return s}
  function filt(type,f,q){const x=ctx.createBiquadFilter();x.type=type;x.frequency.value=f;if(q!=null)x.Q.value=q;return x}
  function gain(v){const g=ctx.createGain();g.gain.value=v;return g}
  function pan(v){if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=v;return p}return gain(1)}
  function chain(...n){for(let i=0;i<n.length-1;i++)n[i].connect(n[i+1]);return n[n.length-1]}
  function every(minMs,maxMs,fn){let alive=true;const tick=()=>{if(!alive)return;try{fn()}catch(e){}setTimeout(tick,minMs+R()*(maxMs-minMs))};setTimeout(tick,minMs*R());loops.push(()=>alive=false)}
  function send(node,dry,wet,out){if(dry)chain(node,gain(dry),out);if(wet)chain(node,gain(wet),revIn)}
  function drift(param,lo,hi,minMs,maxMs,tau){every(minMs,maxMs,()=>param.setTargetAtTime(lo+R()*(hi-lo),ctx.currentTime,tau))}

  /* ---------- birds, crickets, drips ---------- */
  function tone(out,f0,f1,t,dur,peak,p,wet,type){const o=ctx.createOscillator(),g=gain(0),pn=pan(p);o.type=type||"sine";
    o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+Math.min(.02,dur*.25));g.gain.setTargetAtTime(0,t+dur*.6,dur*.25);
    chain(o,g,pn);send(pn,1,wet,out);o.start(t);o.stop(t+dur+.3)}
  function bird(out){const t=ctx.currentTime+.05,p=R()*1.6-.8,g=.012+R()*.025,sp=Math.floor(R()*4);
    if(sp===0){const n=6+Math.floor(R()*6);let f=4200+R()*800;for(let i=0;i<n;i++){tone(out,f,f*1.08,t+i*.075,.06,g,p,.5);f*=.965}}            // descending trill
    else if(sp===1){tone(out,3300,3350,t,.24,g,p,.6);tone(out,2700,2650,t+.34,.3,g*.9,p,.6)}                                                // two-note whistle
    else if(sp===2){for(let i=0;i<3;i++)tone(out,2600+R()*300,3600+R()*400,t+i*.16,.09,g,p,.45)}                                       // rising chirps
    else{const o=ctx.createOscillator(),m=ctx.createOscillator(),md=gain(280),gg=gain(0),pn=pan(p);o.frequency.value=3100;m.frequency.value=34;    // warble
      chain(m,md,o.frequency);gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(g,t+.04);gg.gain.setTargetAtTime(0,t+.35,.08);chain(o,gg,pn);send(pn,1,.55,out);o.start(t);m.start(t);o.stop(t+.8);m.stop(t+.8)}}
  function cricket(out,f,p,g){every(650,1250,()=>{const t=ctx.currentTime+.02;const pulses=3+Math.floor(R()*2);
    for(let i=0;i<pulses;i++){const o=ctx.createOscillator(),gg=gain(0),bp=filt("bandpass",f,8),pn=pan(p);o.type="triangle";o.frequency.value=f*(1+R()*.01);
      const s=t+i*.032;gg.gain.setValueAtTime(0,s);gg.gain.linearRampToValueAtTime(g,s+.006);gg.gain.linearRampToValueAtTime(0,s+.022);chain(o,bp,gg,pn);send(pn,1,.35,out);o.start(s);o.stop(s+.04)}})}

  /* ---------- ambient builds ---------- */
  function build(name,out){
    if(name==="white"){chain(src(noise("white")),filt("lowpass",8000,.5),filt("highpass",120),gain(.5),out);return}
    if(name==="pink"){chain(src(noise("pink")),filt("lowpass",6000,.5),gain(.6),out);return}
    if(name==="brown"){chain(src(noise("brown")),filt("lowpass",900,.5),gain(.75),out);return}
    if(name==="rain"){
      chain(src(noise("pink")),filt("highpass",500),filt("lowpass",4800,.6),gain(.16),out);          // hiss of distant rain
      chain(src(noise("brown")),filt("lowpass",170),gain(.32),out);                                   // low body
      chain(src(patter()),filt("highpass",700),filt("lowpass",7500,.5),gain(.55),out);              // near patter
      chain(src(patter(),.82),filt("lowpass",2600,.5),gain(.3),out);                                // farther patter
      every(1800,5200,()=>{const t=ctx.currentTime;tone(out,900+R()*700,500+R()*200,t,.08,.04,R()*1.4-.7,.7)}); // gutter drips
      return}
    if(name==="ocean"){
      chain(src(noise("brown")),filt("lowpass",220),gain(.28),out);                                  // constant low swell
      [-.55,.55].forEach((side,k)=>{const lp=filt("lowpass",500,.6),g=gain(.05),pn=pan(side),hiss=gain(0);
        chain(src(noise("brown")),lp);chain(src(noise("pink")),filt("lowpass",1400),gain(.5),lp);chain(lp,g,pn,out);
        chain(src(noise("pink")),filt("highpass",1800),filt("lowpass",7000),hiss,pn);
        let alive=true;const wave=()=>{if(!alive)return;const t=ctx.currentTime,d=7+R()*5,peak=.55+R()*.35,up=d*(.38+R()*.1);
          g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(peak,t+up);g.gain.setTargetAtTime(.04,t+up,d*.18);
          lp.frequency.cancelScheduledValues(t);lp.frequency.setValueAtTime(lp.frequency.value,t);lp.frequency.linearRampToValueAtTime(1600,t+up);lp.frequency.setTargetAtTime(380,t+up,d*.2);
          hiss.gain.cancelScheduledValues(t);hiss.gain.setValueAtTime(0,t+up*.85);hiss.gain.linearRampToValueAtTime(.12*peak,t+up+.4);hiss.gain.setTargetAtTime(0,t+up+.6,d*.15);
          setTimeout(wave,d*1000)};setTimeout(wave,k*3500+R()*1500);loops.push(()=>alive=false)});
      return}
    if(name==="fire"){
      const bed=gain(.5);chain(src(noise("brown")),filt("lowpass",320),bed,out);drift(bed.gain,.32,.6,250,700,.15);   // flickering roar
      chain(src(crackle()),filt("highpass",900),filt("lowpass",9000),gain(.5),out);
      chain(src(crackle(),.71),filt("bandpass",2200,.8),gain(.28),out);
      every(2500,7000,()=>{const t=ctx.currentTime;const s=ctx.createBufferSource();s.buffer=noise("white");const g=gain(0),hp=filt("highpass",1500),pn=pan(R()*1.2-.6);
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.35,t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+.05);chain(s,hp,g,pn);send(pn,1,.4,out);s.start(t,R()*7);s.stop(t+.1)});
      return}
    if(name==="forest"){
      const wl=filt("bandpass",600,.45),wg=gain(.55);chain(src(noise("pink")),wl,wg,out);chain(src(noise("brown")),filt("lowpass",300),gain(.25),out);drift(wl.frequency,350,950,2500,6000,1.5);drift(wg.gain,.3,.75,3000,7000,1.8);
      const rg=gain(0);chain(src(noise("pink")),filt("highpass",2800),filt("lowpass",9000),rg,out);drift(rg.gain,.02,.16,2000,6000,1);   // leaves
      every(2500,8000,()=>bird(out));return}
    if(name==="night"){
      chain(src(noise("brown")),filt("lowpass",240),gain(.22),out);const wg=gain(.05);chain(src(noise("pink")),filt("bandpass",420,.6),wg,out);drift(wg.gain,.02,.08,4000,9000,2);
      cricket(out,4600,-.5,.022);cricket(out,4950,.45,.016);cricket(out,4300,.1,.009);return}
    if(name==="river"){
      chain(src(noise("pink")),filt("bandpass",520,.7),gain(.32),out);chain(src(noise("brown")),filt("lowpass",380),gain(.3),out);
      [[700,-.4],[1250,.35],[2100,-.15],[3400,.5]].forEach(([f,p])=>{const g=gain(.05);chain(src(noise("pink")),filt("bandpass",f,2.2),g,pan(p),out);drift(g.gain,.01,.2,50,150,.03)});  // babble
      every(150,700,()=>{const t=ctx.currentTime;const f=280+R()*400;tone(out,f,f*(2+R()),t,.035+R()*.03,.025,R()*1.4-.7,.35)});                                                        // bubbles
      return}
  }
  function setAmbient(name){
    ambName=name;if(!ensure())return;const t=ctx.currentTime;
    if(amb){const old=amb;old.gain.cancelScheduledValues(t);old.gain.setValueAtTime(old.gain.value,t);old.gain.linearRampToValueAtTime(0,t+1.5);setTimeout(()=>{try{old.disconnect()}catch(e){}},1700)}
    loops.forEach(f=>f());loops=[];amb=null;
    if(name==="silence")return;
    amb=gain(0);amb.connect(master);build(name,amb);amb.gain.linearRampToValueAtTime(1,t+2.5);
  }
  function stopAmbient(){const n=ambName;setAmbient("silence");ambName=n}
  function setVolume(v){vol=v;if(master)master.gain.setTargetAtTime(v,ctx.currentTime,.05)}

  /* ---------- end-of-session signals ---------- */
  function strike(freq,partials,at,peak,o={}){
    const t=ctx.currentTime+(at||0),pn=pan(o.pan||0);send(pn,1,o.wet==null?.5:o.wet,master);
    partials.forEach(([mul,amp,decay,beat])=>{[0,beat||0].forEach((dt,k)=>{if(k&&!dt)return;
      const osc=ctx.createOscillator(),g=gain(0);osc.type="sine";osc.frequency.value=freq*mul+dt;chain(osc,g,pn);
      const a=amp*(peak||.2)*(dt?.55:1),att=o.attack||.006;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+att);g.gain.exponentialRampToValueAtTime(.0001,t+decay);osc.start(t);osc.stop(t+decay+.1)})});
  }
  function play(name){
    if(name==="none"||!ensure())return;
    if(name==="bell"){const P=[[1,1,5,.7],[2,.38,3.4,1.1],[2.76,.22,2.4],[4.07,.1,1.7],[5.4,.06,1.2]];
      strike(659.25,P,0,.17,{attack:.008,wet:.6});strike(523.25,P,1.7,.13,{attack:.008,wet:.65})}
    else if(name==="bowl"){strike(196,[[1,1,10,.6],[2.71,.5,8,.9],[5.2,.2,5],[8.4,.06,2.6]],0,.24,{attack:.06,wet:.55})}
    else if(name==="chimes"){const notes=[1046.5,1174.7,1318.5,1568,1760,2093];const n=5+Math.floor(R()*3);
      for(let i=0;i<n;i++)strike(notes[Math.floor(R()*notes.length)],[[1,1,3.4],[2.76,.28,1.8],[5.4,.1,.9]],i*(.18+R()*.28),.09,{pan:R()*1.4-.7,wet:.7})}
    else if(name==="kalimba"){[523.25,659.25,783.99,1046.5].forEach((f,i)=>strike(f,[[1,1,1.8],[3,.07,.6],[6.3,.04,.3]],i*.19,.15,{attack:.003,pan:(i-1.5)*.25,wet:.4}))}
    else if(name==="wood"){[0,.36,.72].forEach((a,i)=>strike(820-i*40,[[1,1,.16],[2.4,.4,.08],[3.9,.18,.05]],a,.24,{attack:.001,wet:.25}))}
  }
  return{AMBIENTS,BELLS,ensure,setAmbient,stopAmbient,setVolume,play,get ambient(){return ambName},get ready(){return !!ctx},get _ctx(){return ctx}};
})();
