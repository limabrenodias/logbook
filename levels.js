/* Levels: an estimated CEFR level per language and per core skill, from your logged hours.
   - Hours from every source count (trackers and what you add yourself), like "outside hours" on Dreaming Spanish.
   - How many hours a level takes depends on the languages you already know: Portuguese → French is much
     shorter than English → Polish. The base ladder is for a "close" language (US FSI category I) and is
     multiplied by the distance from the nearest language you speak well. These are estimates, so a passed
     exam or mock in Logs → Scores (e.g. "DALF C1", 50%+) confirms a level and wins over the estimate.
   - Core skills: listening, reading, speaking, writing. Grammar, vocabulary and other study time helps all four.
     Pronunciation can be added as an extra skill (Progress → Languages → Skills). */
"use strict";
const Levels=(()=>{
  const CEFR=["A1","A2","B1","B2","C1","C2"];
  const BASE=[60,170,380,620,920,1250];            // hours to reach each level for a close language
  const SKILLS=[["Listening",.35],["Reading",.25],["Speaking",.2],["Writing",.2]];
  const PRON=["Pronunciation",.1];
  const GENERAL_SHARE=.25;                          // study time that isn't one skill counts a quarter toward each skill
  // US Foreign Service Institute categories (for English speakers): 1 = closest
  const FSI={Spanish:1,French:1,Italian:1,Portuguese:1,Dutch:1,Swedish:1,Norwegian:1,Danish:1,Romanian:1,Catalan:1,Esperanto:.6,
    German:1.3,Indonesian:1.3,Malay:1.3,Swahili:1.3,Latin:1.3,English:1.3,
    Polish:1.6,Russian:1.6,Ukrainian:1.6,Czech:1.6,Slovak:1.6,Hungarian:1.6,Bulgarian:1.6,Croatian:1.6,Serbian:1.6,Slovenian:1.6,Greek:1.6,
    Turkish:1.6,Finnish:1.6,Estonian:1.6,Lithuanian:1.6,Latvian:1.6,Icelandic:1.6,Hebrew:1.6,Persian:1.6,Hindi:1.6,Urdu:1.6,Bengali:1.6,
    Punjabi:1.6,Tamil:1.6,Vietnamese:1.6,Thai:1.6,Tagalog:1.6,Irish:1.6,Welsh:1.6,Basque:1.6,
    Arabic:3,Japanese:3,Korean:3,"Mandarin Chinese":3,Cantonese:3};
  const FAMILY={Spanish:"romance",Portuguese:"romance",French:"romance",Italian:"romance",Catalan:"romance",Romanian:"romance",Latin:"romance",
    English:"germanic",German:"germanic",Dutch:"germanic",Swedish:"germanic",Norwegian:"germanic",Danish:"germanic",Icelandic:"germanic",
    Polish:"slavic",Czech:"slavic",Slovak:"slavic",Russian:"slavic",Ukrainian:"slavic",Bulgarian:"slavic",Croatian:"slavic",Serbian:"slavic",Slovenian:"slavic",
    Lithuanian:"baltic",Latvian:"baltic",Finnish:"finnic",Estonian:"finnic",Irish:"celtic",Welsh:"celtic",Arabic:"semitic",Hebrew:"semitic",
    Hindi:"indic",Urdu:"indic",Bengali:"indic",Punjabi:"indic","Mandarin Chinese":"sinitic",Cantonese:"sinitic",Indonesian:"malay",Malay:"malay"};
  const SUB={Polish:"wslav",Czech:"wslav",Slovak:"wslav",Russian:"eslav",Ukrainian:"eslav",Croatian:"sslav",Serbian:"sslav",Slovenian:"sslav",Bulgarian:"sslav",
    Swedish:"nordic",Norwegian:"nordic",Danish:"nordic",Icelandic:"nordic",Spanish:"iberian",Portuguese:"iberian",Catalan:"iberian",Hindi:"hindustani",Urdu:"hindustani"};
  const VERY_CLOSE=[["Spanish","Portuguese"],["Spanish","Catalan"],["Czech","Slovak"],["Serbian","Croatian"],["Hindi","Urdu"],["Indonesian","Malay"],
    ["Norwegian","Danish"],["Norwegian","Swedish"],["Danish","Swedish"],["Russian","Ukrainian"],["Mandarin Chinese","Cantonese"]];
  const LEVEL_RANK={A1:0,A2:1,B1:2,B2:3,C1:4,C2:5};

  function pairFactor(known,target){
    if(known===target)return 0;
    if(known==="English")return FSI[target]||1.6;             // FSI's numbers are measured for English speakers
    if(VERY_CLOSE.some(([a,b])=>(a===known&&b===target)||(b===known&&a===target)))return .4;
    if(SUB[known]&&SUB[known]===SUB[target])return .55;
    if(FAMILY[known]&&FAMILY[known]===FAMILY[target])return .7;
    if((known==="Japanese"&&target==="Korean")||(known==="Korean"&&target==="Japanese"))return 1.8;
    if(FAMILY[known]==="sinitic"&&target==="Japanese")return 2;
    return FSI[target]||1.6;
  }
  function profile(){const p=(Prefs.get().levels)||{};return {native:Array.isArray(p.native)?p.native:[],speaks:Array.isArray(p.speaks)?p.speaks:[],start:p.start||{},pron:!!p.pron}}
  // how far a language is from what you know; returns {f, from}
  function distance(target){
    const P=profile();const known=[...P.native.map(l=>({lang:l,level:"C2"})),...P.speaks];
    let best={f:FSI[target]||1.6,from:null};
    for(const k of known){if(k.lang===target)continue;const r=LEVEL_RANK[k.level]??0;if(r<2)continue;
      let f=pairFactor(k.lang,target);if(r===2)f=(f+best.f)/2;            // knowing it at B1 helps half as much
      if(f<best.f)best={f,from:k.lang}}
    const strong=known.filter(k=>(LEVEL_RANK[k.level]??0)>=3).length;            // experienced learners go a bit faster
    const exp=Math.max(.85,1-.05*Math.max(0,strong-1));
    return {f:Math.max(.3,best.f*exp),from:best.from,exp};
  }
  const ladder=lang=>{const f=distance(lang).f;return BASE.map(h=>Math.round(h*f))};
  function levelAt(h,lad){let i=-1;for(let k=0;k<lad.length;k++)if(h>=lad[k])i=k;
    const lo=i<0?0:lad[i],hi=i+1<lad.length?lad[i+1]:null;return {i,name:i<0?"Pre-A1":CEFR[i],next:i+1<CEFR.length?CEFR[i+1]:null,need:hi==null?0:hi-h,p:hi==null?1:(h-lo)/(hi-lo)}}

  // passed exams or mocks in Scores that name a CEFR level → confirmed level per skill
  const PART={Listening:/(compr[ée]hension\s+(de\s+l'?)?oral|listen|écoute|ecoute|h[öo]ren|ascolto|audio|słuchanie|sluchanie)/i,
    Reading:/(compr[ée]hension\s+(des\s+)?[ée]crit|reading|lecture|lesen|lettura|czytanie)/i,
    Writing:/(production\s+[ée]crite|writing|[ée]crit\b|schreiben|scrittura|pisanie)/i,
    Speaking:/(production\s+orale|speaking|oral\b|sprechen|parlato|mówienie|mowienie)/i};
  function confirmed(lang){
    const out={overall:-1,skills:{},by:null};const list=(typeof Lib!=="undefined"&&Lib.scores)||[];
    for(const s of list){if(s.subject&&s.subject!==lang)continue;const m=/\b([ABC][12])\b/.exec(s.exam||"");if(!m)continue;
      if(!s.subject&&!new RegExp(lang.split(" ")[0],"i").test(s.exam)&&!/dalf|delf|dele|goethe|cils|celi|toefl|ielts|cambridge|testdaf|celpe|plida|tcf|tef|egzamin|certyfikat/i.test(s.exam))continue;
      const L=LEVEL_RANK[m[1]];const ok=s.total!=null&&s.max_total?+s.total/ +s.max_total>=.5:false;
      if(ok&&L>out.overall){out.overall=L;out.by=s}
      for(const pt of s.parts||[]){if(pt.score===""||pt.score==null||!pt.max)continue;
        for(const [k,re] of Object.entries(PART))if(re.test(pt.name||"")&&+pt.score/ +pt.max>=.5&&L>(out.skills[k]??-1))out.skills[k]=L}}
    return out;
  }

  // everything about one language
  function forLang(lang){
    const L=all().logs.filter(l=>l.s===lang);const P=profile();const lad=ladder(lang);
    const startI=P.start[lang]!=null?LEVEL_RANK[P.start[lang]]:-1;const offset=startI>=0?lad[startI]:0;
    let tot=0,auto=0;const bySkill={};const core=SKILLS.map(s=>s[0]).concat(P.pron?[PRON[0]]:[]);
    for(const l of L){tot+=l.m;if(isAuto(l))auto+=l.m;bySkill[l.t]=(bySkill[l.t]||0)+l.m}
    const general=Object.entries(bySkill).filter(([k])=>!core.includes(k)).reduce((a,[,v])=>a+v,0);
    const conf=confirmed(lang);
    const hours=tot/60,overall=levelAt(hours+offset,lad);
    if(conf.overall>overall.i){const c=levelAt(lad[conf.overall],lad);Object.assign(overall,c,{confirmed:true})}
    const skills=(P.pron?[...SKILLS,PRON]:SKILLS).map(([name,share])=>{
      const own=(bySkill[name]||0)/60,eff=own+general/60*GENERAL_SHARE;const sl=lad.map(h=>h*share);
      const lv=levelAt(eff+offset*share,sl);const ci=conf.skills[name]??(conf.overall>=0?conf.overall-1:-1);
      if(ci>lv.i)Object.assign(lv,levelAt(sl[ci],sl),{confirmed:true});
      return {name,share,own,eff,lv,ladder:sl}});
    // pace over the last 30 days → when you reach the next level
    const cut=ymd(addDays(new Date(),-29));const pace=L.filter(l=>l.d>=cut).reduce((a,l)=>a+l.m,0)/60/30; // hours per day
    const eta=overall.need>0&&pace>0?Math.ceil(overall.need/pace):null;
    return {lang,hours,auto:auto/60,manual:(tot-auto)/60,offset,start:startI>=0?CEFR[startI]:null,ladder:lad,overall,skills,dist:distance(lang),conf,pace,eta,logs:L.length};
  }
  // which subjects are languages you study (with at least an hour logged, or pinned)
  function studied(){const s=all().subjMin||{};const pinned=(settings().subjects||[]);
    return Object.keys(s).filter(x=>LANGS.includes(x)&&(s[x]>=60||pinned.includes(x))).sort((a,b)=>s[b]-s[a])}

  /* "You can…" — short statements in our own words, based on the CEFR levels */
  const CAN={
    overall:["Handle everyday basics: greetings, simple questions about yourself, ordering, prices.",
      "Get through routine situations: shopping, directions, short chats about family, work and plans.",
      "Manage most travel situations and talk about experiences, opinions and plans with some help.",
      "Follow and join conversations with native speakers on most topics without much strain on either side.",
      "Use the language flexibly for work and study, express ideas fluently, understand implied meaning.",
      "Understand virtually everything and express yourself precisely, with fine shades of meaning."],
    Listening:["Catch slow, clear speech about very familiar things: names, numbers, simple instructions.",
      "Understand short, clear announcements and the main point of everyday talk about familiar topics.",
      "Follow the main points of clear speech on familiar topics, and simple radio or TV at a normal pace.",
      "Follow longer talks, news and most films in standard accent, including fairly complex arguments.",
      "Understand long, loosely structured speech, most films and podcasts without much effort.",
      "Understand any spoken language, live or recorded, even fast native speech and strong accents."],
    Reading:["Read simple signs, names and very short notes.",
      "Read short simple texts: ads, menus, timetables, simple personal messages.",
      "Understand everyday texts and personal letters describing events, feelings and wishes.",
      "Read articles and reports on current topics where writers take a position, and modern fiction.",
      "Read long, complex factual and literary texts and appreciate style; specialised texts with a dictionary.",
      "Read almost any text with ease, including abstract, technical and literary writing."],
    Speaking:["Ask and answer simple questions about yourself, slowly and with help.",
      "Take part in short exchanges on familiar topics and describe your family, studies or work simply.",
      "Handle most travel situations, tell a story, and give short reasons for your opinions.",
      "Talk with native speakers with reasonable fluency, explain a viewpoint and weigh up options.",
      "Speak fluently and spontaneously at work and socially, without obviously searching for words.",
      "Take part in any conversation effortlessly, with idioms and precise nuance."],
    Writing:["Fill in forms and write a short postcard or simple notes.",
      "Write short, simple messages and a very simple personal letter.",
      "Write simple connected text on familiar topics and letters describing experiences.",
      "Write clear, detailed texts and essays, giving reasons for or against a point of view.",
      "Write well-structured texts on complex subjects, choosing a style suited to the reader.",
      "Write complex letters, reports and articles smoothly, in an appropriate and effective style."]
  };
  const can=(skill,i)=>i<0?"Just getting started — every hour counts.":((CAN[skill]||CAN.overall)[i]||"");

  /* hour ladder for subjects that aren't languages */
  const HL=[[0,"Novice"],[10,"Beginner"],[25,"Apprentice"],[50,"Practitioner"],[100,"Skilled"],[250,"Proficient"],[500,"Advanced"],[1000,"Expert"],[2500,"Master"],[5000,"Grandmaster"]];
  function hourLevel(h){let i=0;for(let k=0;k<HL.length;k++)if(h>=HL[k][0])i=k;const nx=HL[i+1];return {i,name:HL[i][1],next:nx?nx[1]:null,need:nx?nx[0]-h:0,p:nx?(h-HL[i][0])/(nx[0]-HL[i][0]):1}}

  return {fsi:l=>FSI[l]||1.6,CEFR,LEVEL_RANK,forLang,studied,profile,distance,ladder,can,hourLevel,confirmed,levelAt,SKILLS};
})();
