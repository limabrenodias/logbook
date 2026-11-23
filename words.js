/* Logs → Words: words you saved (Alt+click with the browser tracker, or added here), with the sentence and
   page they came from and an estimated CEFR level. The level comes from how common the word is in subtitles
   (data/freq, CC BY-SA 4.0): common words are early levels, rare ones later. It's a rough guide, best for
   European languages. The Logbook Anki add-on turns new words into cards. Needs database update 7. */
"use strict";
const Words=(()=>{
  let list=[],ok=null,loading=false,forUser=null;const freq={},freqLoading={};
  const CODE={English:"en",Spanish:"es",French:"fr",German:"de",Italian:"it",Portuguese:"pt",Polish:"pl",Dutch:"nl",Russian:"ru",Ukrainian:"uk",Czech:"cs",Slovak:"sk",
    Hungarian:"hu",Romanian:"ro",Bulgarian:"bg",Greek:"el",Turkish:"tr",Swedish:"sv",Norwegian:"no",Danish:"da",Finnish:"fi",Icelandic:"is",Croatian:"hr",Serbian:"sr",
    Slovenian:"sl",Lithuanian:"lt",Latvian:"lv",Estonian:"et",Catalan:"ca",Basque:"eu",Arabic:"ar",Hebrew:"he",Persian:"fa",Bengali:"bn",Korean:"ko",Vietnamese:"vi",
    Thai:"th",Indonesian:"id",Malay:"ms","Mandarin Chinese":"zh_cn"};
  const BANDS=[[600,"A1"],[1500,"A2"],[3000,"B1"],[6000,"B2"],[10000,"C1"]];
  async function load(force){
    if(!sb||!viewing||loading)return;if(forUser===viewing&&!force)return;loading=true;
    try{const {data,error}=await sb.from("words").select("id,lang,word,sentence,source,url,status,seen,created_at,anki_at").eq("user_id",viewing).order("created_at",{ascending:false}).limit(3000);
      if(error){ok=/relation|does not exist|schema cache/i.test(error.message||"")?false:ok;list=[]}else{ok=true;list=data||[]}forUser=viewing;
      [...new Set(list.map(w=>w.lang))].forEach(loadFreq);if(route()==="logs"&&ui.logTab==="words")render()}
    finally{loading=false}
  }
  function loadFreq(lang){const c=CODE[lang];if(!c||freq[lang]||freqLoading[lang])return;freqLoading[lang]=true;
    fetch(`data/freq/${c}.txt`).then(r=>r.ok?r.text():"").then(t=>{if(!t)return;const m=new Map();t.split("\n").forEach((w,i)=>{if(w&&!m.has(w))m.set(w,i+1)});freq[lang]=m;
      if(route()==="logs"&&ui.logTab==="words")render()}).catch(()=>{})}
  // estimated level: by rank in the frequency list (tries the word, then without an elided article like l', d', then the first part of a hyphenated word)
  function level(w){const m=freq[w.lang];if(!m)return null;const x=w.word.toLowerCase();
    const tries=[x,x.replace(/^[a-z]{1,2}['’]/,""),x.split(/[-’']/).pop(),x.replace(/s$/,"")];let r=null;for(const t of tries){if(m.has(t)){r=m.get(t);break}}
    if(r==null)return {lv:"C2",rank:null};for(const [lim,lv] of BANDS)if(r<=lim)return {lv,rank:r};return {lv:"C2",rank:r}}
  const LV_ORDER={A1:0,A2:1,B1:2,B2:3,C1:4,C2:5};
  function mark(sentence,word){const s=esc(sentence);if(!word)return s;const re=new RegExp("("+word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","i");return s.replace(re,"<mark>$1</mark>")}
  function dict(w){const host=(navigator.language||"en").split("-")[0];return `https://${host==="pt"||host==="fr"||host==="es"||host==="de"||host==="pl"||host==="it"?host:"en"}.wiktionary.org/wiki/${encodeURIComponent(w.word)}`}

  function view(){
    if(ok===false)return `<div class="card"><h2>One more step in Supabase</h2><p class="sub">Saved words need database update 7: open Supabase → SQL Editor → New query, paste <b>supabase-update-7.sql</b> and press Run.</p></div>`;
    if(ok===null){load();return `<div class="card">${typeof skeleton==="function"?skeleton():"Loading…"}</div>`}
    const F=ui.wf||(ui.wf={lang:"All",st:"All",lv:"All",q:""});const langs=[...new Set(list.map(w=>w.lang))].sort();
    const q=F.q.toLowerCase();
    const rows=list.map(w=>({w,L:level(w)})).filter(({w,L})=>(F.lang==="All"||w.lang===F.lang)&&(F.st==="All"||w.status===F.st)&&(F.lv==="All"||(L&&L.lv===F.lv))&&(!q||w.word.includes(q)||(w.sentence||"").toLowerCase().includes(q)));
    const counts={new:0,learning:0,known:0};list.forEach(w=>counts[w.status]++);
    const ro=readOnly();
    return `<div class="words-head">
        <div class="row">${[["All","All",list.length],["new","New",counts.new],["learning","Learning",counts.learning],["known","Known",counts.known]].map(([k,l,n])=>`<button class="fchip ${F.st===k?"on":""}" data-wst="${k}">${l} <span class="num">${n}</span></button>`).join("")}</div>
        <div class="row"><input type="search" id="wQ" placeholder="Search words and sentences" value="${esc(F.q)}" aria-label="Search words">
          <select id="wLang" aria-label="Language"><option value="All">All languages</option>${langs.map(l=>`<option ${l===F.lang?"selected":""}>${esc(l)}</option>`).join("")}</select>
          <select id="wLv" aria-label="Level"><option value="All">All levels</option>${Levels.CEFR.map(l=>`<option ${l===F.lv?"selected":""}>${l}</option>`).join("")}</select>
          ${ro?"":`<button class="btn sec" data-w="add">Add a word</button><button class="btn sec" data-w="csv" title="A file you can import into Anki or a spreadsheet">Export</button>`}</div></div>
      ${!list.length?`<div class="card empty-state"><div style="font-size:30px">🔤</div><p><b>Save words while you read and watch.</b></p><p class="sub" style="max-width:460px;margin:6px auto 0">With the Logbook browser tracker, hold <b>Alt</b> and click any word — on a page or in subtitles. It's saved here with its sentence, the page it came from and an estimated level. The Anki add-on turns new words into cards.</p></div>`:
      !rows.length?`<div class="card empty-state">No words match.</div>`:
      `<div class="wlist">${rows.slice(0,ui.wLimit||200).map(({w,L})=>`<div class="wcard" data-wid="${w.id}">
        <div class="w-top"><span class="w-word">${esc(w.word)}</span>${L?`<span class="chip-l lv-${L.lv}" title="${L.rank?`About the ${L.rank.toLocaleString()}th most common word`:"Not among the 15,000 most common words"}">${L.lv}</span>`:""}
          <span class="muted small">${esc(w.lang)}${w.seen>1?` · saved ${w.seen}×`:""}</span><span class="spacer"></span>
          ${w.anki_at?`<span class="tag" title="Added to Anki">Anki</span>`:""}
          ${ro?`<span class="st-${w.status} tag">${w.status}</span>`:`<button class="wst st-${w.status}" data-wcycle="${w.id}" title="Change status">${w.status==="new"?"New":w.status==="learning"?"Learning":"Known"}</button>`}
          <a class="ib" href="${esc(dict(w))}" target="_blank" rel="noopener" title="Look it up" aria-label="Look it up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg></a>
          ${ro?"":`<button class="ib" data-wdel="${w.id}" title="Delete" aria-label="Delete">${ICONS.del}</button>`}</div>
        ${w.sentence?`<p class="w-sent">${mark(w.sentence,w.word)}</p>`:""}
        <div class="w-src small muted">${w.url?`<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.source||new URL(w.url).hostname)}</a>`:esc(w.source||"Added by hand")} · ${esc(shortDate(w.created_at.slice(0,10)))}</div></div>`).join("")}</div>
       ${rows.length>(ui.wLimit||200)?`<button class="btn sec" data-w="more" style="margin-top:12px">Show more</button>`:""}`}
      <p class="muted small" style="margin-top:16px">Levels are estimated from how common each word is in film and TV subtitles (FrequencyWords, CC BY-SA 4.0) — a rough guide, not a dictionary's level.</p>`;
  }
  function addSheet(){const langs=Levels.studied();
    $("#modal").innerHTML=`<div class="row" style="margin-bottom:4px"><h2 style="font-size:19px">Add a word</h2><span class="spacer"></span><button class="ib" data-act="close" aria-label="Close" style="font-size:20px">×</button></div>
      <div class="two"><div class="field"><label>Word or phrase</label><input type="text" id="waW" maxlength="80" autofocus></div>
      <div class="field"><label>Language</label><select id="waL">${(langs.length?langs:LANGS).map(l=>`<option>${l}</option>`).join("")}</select></div></div>
      <div class="field"><label>Sentence <span class="muted" style="font-weight:400">— optional, where you met it</span></label><textarea id="waS" rows="2" maxlength="500"></textarea></div>
      <div class="field"><label>Source <span class="muted" style="font-weight:400">— optional</span></label><input type="text" id="waSrc" maxlength="200" placeholder="Book, podcast, conversation…"></div>
      <div class="row"><span class="spacer"></span><button class="btn" data-w="save">Save word</button></div>`;
    $("#scrim").classList.add("open");setTimeout(()=>$("#waW")&&$("#waW").focus(),50)}
  async function save(){const word=$("#waW").value.trim().toLowerCase().slice(0,80);if(!word)return toast("Type a word first");
    const row={lang:$("#waL").value,word,sentence:$("#waS").value.trim().slice(0,500),source:$("#waSrc").value.trim().slice(0,200)};
    const {data,error}=await sb.from("words").upsert(row,{onConflict:"user_id,lang,word"}).select().single();
    if(error)return fail(error,"Couldn't save the word");closeModal();list=[data,...list.filter(w=>w.id!==data.id)];loadFreq(row.lang);render();toast(`Saved “${word}”`)}
  async function setStatus(id,status){const w=list.find(x=>x.id===id);if(!w)return;const prev=w.status;w.status=status;render();
    const {error}=await sb.from("words").update({status,updated_at:new Date().toISOString()}).eq("id",id);if(error){w.status=prev;render();fail(error)}}
  async function del(id){const w=list.find(x=>x.id===id);if(!w)return;list=list.filter(x=>x!==w);render();
    const {error}=await sb.from("words").delete().eq("id",id);if(error){list.push(w);render();return fail(error)}
    actionToast(`Deleted “${w.word}”`,"Undo",async()=>{const {id:_,...rest}=w;const {data,error:e2}=await sb.from("words").insert({...rest}).select().single();if(!e2){list=[data,...list];render()}})}
  function csv(){const q=v=>/[",\n;]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':String(v);
    const rows=[["word","language","level","sentence","source","url","status","saved"],...list.map(w=>{const L=level(w);return [w.word,w.lang,L?L.lv:"",w.sentence||"",w.source||"",w.url||"",w.status,w.created_at.slice(0,10)]})];
    const blob=new Blob(["﻿"+rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="logbook-words.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}

  document.addEventListener("click",e=>{
    const s=e.target.closest("[data-wst]");if(s){ui.wf.st=s.dataset.wst;render();return}
    const c=e.target.closest("[data-wcycle]");if(c){const w=list.find(x=>x.id===c.dataset.wcycle);if(w)setStatus(w.id,w.status==="new"?"learning":w.status==="learning"?"known":"new");return}
    const d=e.target.closest("[data-wdel]");if(d){if(!d.classList.contains("confirm")){d.classList.add("confirm");d.textContent="Delete?";return}del(d.dataset.wdel);return}
    const b=e.target.closest("[data-w]");if(!b)return;const k=b.dataset.w;
    if(k==="add")addSheet();else if(k==="save")save();else if(k==="csv")csv();else if(k==="more"){ui.wLimit=(ui.wLimit||200)+300;render()}
  });
  let wq;document.addEventListener("input",e=>{if(e.target.id==="wQ"){ui.wf.q=e.target.value;clearTimeout(wq);wq=setTimeout(()=>{render();const i=$("#wQ");if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)}});
  document.addEventListener("change",e=>{if(e.target.id==="wLang"){ui.wf.lang=e.target.value;render()}else if(e.target.id==="wLv"){ui.wf.lv=e.target.value;render()}});
  return {view,load,reset(){list=[];ok=null;forUser=null},level,get list(){return list},get ok(){return ok}};
})();
