/* Coins, milestones, weekly challenges and the extra streaks.
   Coins are worked out from your logs (like the streak), so every device shows the same balance:
     focus coins (the old focus points) + milestones + weekly challenges + clan goals + kudos − what you spent.
   Spending (repairs, freezes) is saved in your preferences. Clan leaderboards use minutes, never coins. */
"use strict";
const Rewards=(()=>{
  let saves=new Set(),social=null,loadedFor=null,loading=false;
  const W={Speaking:1.5,Writing:1.4,Reading:1.1,Listening:1};
  const tierCoins=(base,growth,t)=>Math.round(base*Math.pow(growth,t)/5)*5;
  const HOURS=[1,5,10,25,50,100,250,500,750,1000,1500,2000,3000,5000];
  const SKILL_H=[1,5,10,25,50,100,250,500,1000];
  const STREAK=[3,7,14,30,60,100,180,365,500,730,1000];
  const DAYS=[10,30,50,100,200,365,500,750,1000];
  const LEVEL_C=[50,100,200,350,550,800];

  async function load(force){
    if(!sb||!me||viewing!==me||loading||(loadedFor===me&&!force))return;loading=true;
    try{const [a,b]=await Promise.all([sb.from("streak_saves").select("d").eq("user_id",me),sb.rpc("my_social_rewards",{p_today:today()})]);
      if(!a.error)saves=new Set((a.data||[]).map(x=>x.d));if(!b.error)social=b.data;loadedFor=me;if(typeof render==="function"&&phase==="app")render()}
    catch(_){}finally{loading=false}
  }
  function reset(){saves=new Set();social=null;loadedFor=null}

  // cumulative minutes by day for a filter, to find the day each milestone was reached
  function crossing(logs,targets){const by={};for(const l of logs)by[l.d]=(by[l.d]||0)+l.m;let acc=0;const out={};const T=[...targets].sort((a,b)=>a-b);let i=0;
    for(const d of Object.keys(by).sort()){acc+=by[d];while(i<T.length&&acc>=T[i]){out[T[i]]=d;i++}}return {out,acc}}

  function milestones(){
    const L=all().logs;const list=[];const add=(m)=>list.push(m);
    const bySubj={};for(const l of L)(bySubj[l.s]||(bySubj[l.s]=[])).push(l);
    for(const [s,ls] of Object.entries(bySubj)){
      const {out,acc}=crossing(ls,HOURS.map(h=>h*60));
      HOURS.forEach((h,t)=>add({group:"Hours",key:`h|${s}|${h}`,title:`${h} h of ${s}`,coins:tierCoins(10,1.45,t),d:out[h*60]||null,done:!!out[h*60],cur:acc/60,target:h,subject:s}));
      if(LANGS.includes(s))for(const k of Object.keys(W)){const sl=ls.filter(l=>l.t===k);if(!sl.length)continue;
        const r=crossing(sl,SKILL_H.map(h=>h*60));
        SKILL_H.forEach((h,t)=>add({group:"Skills",key:`k|${s}|${k}|${h}`,title:`${h} h of ${k.toLowerCase()} in ${s}`,coins:tierCoins(8*W[k],1.45,t),d:r.out[h*60]||null,done:!!r.out[h*60],cur:r.acc/60,target:h,subject:s}))}
    }
    const si=streakInfo();
    STREAK.forEach((n,t)=>add({group:"Streak",key:`s|${n}`,title:`${n}-day streak`,coins:tierCoins(15,1.5,t),d:si.reached[n]||null,done:si.best>=n,cur:si.best,target:n}));
    const days=[...new Set(L.map(l=>l.d))].sort();
    DAYS.forEach((n,t)=>add({group:"Days",key:`d|${n}`,title:`${n} days studied`,coins:tierCoins(20,1.4,t),d:days[n-1]||null,done:days.length>=n,cur:days.length,target:n}));
    if(typeof Levels!=="undefined")for(const lang of Levels.studied()){const x=Levels.forLang(lang);
      Levels.CEFR.forEach((c,i)=>{const done=x.overall.i>=i;add({group:"Levels",key:`l|${lang}|${c}`,title:`${lang} ${c} (estimated)`,coins:LEVEL_C[i],d:null,done,cur:x.overall.i+1,target:i+1,subject:lang})})}
    return list;
  }

  /* ---------- weekly challenges: three per week, sized to how much you usually do ---------- */
  function seeded(str){let h=2166136261;for(const ch of str){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%10000)/10000}}
  const r15=m=>Math.max(15,Math.round(m/15)*15);
  function challenges(ws){
    ws=ws||ymd(weekStart(new Date()));const we=ymd(addDays(parseD(ws),6));const L=all().logs;
    const from=ymd(addDays(parseD(ws),-28));const hist=L.filter(l=>l.d>=from&&l.d<ws);const week=L.filter(l=>l.d>=ws&&l.d<=we);
    const avgMin=hist.reduce((a,l)=>a+l.m,0)/4;const avgDays=new Set(hist.map(l=>l.d)).size/4;
    const langMin={};for(const l of hist)if(LANGS.includes(l.s))langMin[l.s]=(langMin[l.s]||0)+l.m;
    const lang=Object.keys(langMin).sort((a,b)=>langMin[b]-langMin[a])[0]||(typeof focus==="function"?focus():"French");
    const rnd=seeded(ws+"|"+(me||""));const out=[];
    const tot=r15(Math.max(90,avgMin*1.15));
    out.push({id:"time",title:`Study ${dur(tot)} this week`,target:tot,cur:week.reduce((a,l)=>a+l.m,0),unit:"min",coins:Math.round(40*Math.min(2.5,Math.max(1,avgMin?tot/avgMin*1.2:1)))});
    const pool=[];
    const dT=Math.min(7,Math.max(3,Math.round(avgDays)+1));
    pool.push({id:"days",title:`Study on ${dT} different days`,target:dT,cur:new Set(week.map(l=>l.d)).size,unit:"days",coins:30+10*Math.max(0,dT-Math.round(avgDays))});
    const sk=["Speaking","Writing","Reading","Listening"].map(k=>[k,hist.filter(l=>l.s===lang&&l.t===k).reduce((a,l)=>a+l.m,0)/4]).sort((a,b)=>a[1]-b[1]);
    const pick=sk[Math.floor(rnd()*2)];const skT=r15(Math.max(30,pick[1]*1.3+20));
    pool.push({id:"skill",title:`${pick[0]} in ${lang}: ${dur(skT)}`,target:skT,cur:week.filter(l=>l.s===lang&&l.t===pick[0]).reduce((a,l)=>a+l.m,0),unit:"min",coins:Math.round(45*(W[pick[0]]||1))});
    pool.push({id:"variety",title:"Practise 4 different activity types",target:4,cur:new Set(week.filter(l=>LANGS.includes(l.s)||true).map(l=>l.t)).size,unit:"types",coins:35});
    pool.push({id:"long",title:"One session of an hour or more",target:1,cur:week.some(l=>l.m>=60)?1:0,unit:"",coins:30});
    while(out.length<3&&pool.length){out.push(pool.splice(Math.floor(rnd()*pool.length),1)[0])}
    out.forEach(c=>{c.done=c.cur>=c.target;c.p=Math.min(1,c.cur/c.target)});
    const all3=out.every(c=>c.done);
    return {ws,we,list:out,bonus:{coins:50,done:all3},earned:out.filter(c=>c.done).reduce((a,c)=>a+c.coins,0)+(all3?50:0)};
  }
  // finished weeks since you started (up to a year back)
  function pastChallenges(){const L=all().logs;if(!L.length)return [];const first=L[L.length-1].d;const out=[];
    let ws=weekStart(new Date());for(let i=0;i<52;i++){ws=addDays(ws,-7);const k=ymd(ws);if(ymd(addDays(ws,6))<first)break;const c=challenges(k);if(c.earned)out.push(c)}return out}

  function spent(){return ((Prefs.get().coins||{}).spent)||[]}
  let memo=null;
  function ledger(){
    const c0=all();const pf=Prefs.get();const fp=typeof Points!=="undefined"?Points.summary().total:0;
    const key=JSON.stringify([pf.coins,pf.levels,pf.repairs,pf.freezeBuys,pf.streakMin,pf.rest,today(),fp,!!social,typeof Lib!=="undefined"&&Lib.scores?Lib.scores.length:0]);
    if(memo&&memo.c===c0&&memo.key===key&&memo.s===social)return memo.v;
    const v=ledger0();memo={c:c0,key,s:social,v};return v;
  }
  function ledger0(){
    const ms=milestones().filter(m=>m.done);const ch=pastChallenges();const cur=challenges();
    const focusPts=typeof Points!=="undefined"?Points.summary().total:0;
    const periods=(social&&social.periods)||[];
    const clan=periods.filter(p=>p.total>=p.goal&&p.mine>0).map(p=>({title:`${p.name}: ${p.kind==="week"?"weekly":"monthly"} goal`,coins:p.kind==="week"?60:200,d:p.start}));
    const kudos=(social&&+social.kudos)||0;
    const earned=ms.reduce((a,m)=>a+m.coins,0)+ch.reduce((a,c)=>a+c.earned,0)+cur.earned+clan.reduce((a,c)=>a+c.coins,0)+kudos*5+focusPts;
    const out=spent().reduce((a,x)=>a+(+x.cost||0),0);
    return {balance:Math.max(0,earned-out),earned,spent:out,parts:{milestones:ms.reduce((a,m)=>a+m.coins,0),challenges:ch.reduce((a,c)=>a+c.earned,0)+cur.earned,clans:clan.reduce((a,c)=>a+c.coins,0),kudos:kudos*5,focus:focusPts},clan};
  }
  const balance=()=>ledger().balance;

  async function spend(kind,cost,extra){const b=balance();if(b<cost){toast(`You need ${cost} coins — you have ${b}`);return false}
    const {patch,...info}=extra||{};const c=Prefs.mine().coins||{};
    await Prefs.set({coins:{...c,spent:[...(c.spent||[]),{kind,cost,at:new Date().toISOString(),...info}]},...(patch||{})});return true}
  async function repair(){const si=streakInfo();const r=si.repairable;if(!r)return;
    const p=Prefs.mine();if(await spend("repair",r.cost,{d:r.d,patch:{repairs:[...(p.repairs||[]),r.d]}}))actionToast(`Streak repaired — ${r.before+1+(si.todayDone?1:0)} days and counting 🔥`)}
  async function buyFreeze(){const si=streakInfo();if(si.freezes>=3)return toast("You already hold 3 freezes");
    const p=Prefs.mine();if(await spend("freeze",100,{patch:{freezeBuys:[...(p.freezeBuys||[]),today()]}}))toast("Freeze added ❄️")}

  /* ---------- the extra streaks ---------- */
  function weekly(){const p=Prefs.get();const need=Math.max(1,Math.min(7,+p.weekDays||5));const c=cons();const map=byDate();
    const req=Math.max(1,Math.min(need,7-c.rest.length));let cur=0,best=0;const L=all().logs;if(!L.length)return {cur:0,best:0,need:req,thisWeek:0};
    let ws=weekStart(parseD(L[L.length-1].d));const nowWs=ymd(weekStart(new Date()));let thisWeek=0;
    while(ymd(ws)<=nowWs){let n=0;for(let i=0;i<7;i++){const k=ymd(addDays(ws,i));if(map[k])n++}
      if(ymd(ws)===nowWs){thisWeek=n;if(n>=req){cur++;best=Math.max(best,cur)}}
      else if(n>=req){cur++;best=Math.max(best,cur)}else cur=0;
      ws=addDays(ws,7)}
    return {cur,best,need:req,thisWeek}}
  function perSubject(){const days={};for(const l of all().logs)(days[l.s]||(days[l.s]=new Set())).add(l.d);const t=today(),y=ymd(addDays(new Date(),-1));
    return Object.entries(days).map(([s,set])=>{let n=0;let d=set.has(t)?new Date():addDays(new Date(),-1);while(set.has(ymd(d))){n++;d=addDays(d,-1)}return {s,cur:n,today:set.has(t),alive:set.has(t)||set.has(y)}})
      .filter(x=>x.cur>0).sort((a,b)=>b.cur-a.cur)}

  return {load,reset,milestones,challenges,ledger,balance,repair,buyFreeze,weekly,perSubject,saves:()=>saves,savesKey:()=>[...saves].join(),get social(){return social}};
})();
