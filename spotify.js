/* Setup → Spotify: connect your account, pick languages, and choose a language for shows. The counting
   itself runs on Supabase every minute (supabase/functions/spotify), so it works for your phone too. */
"use strict";
const Spotify=(()=>{
  let st=null,loading=false,missing=false;
  const sp=()=>({langs:defaultLangs(),music:false,shows:{},...(Prefs.mine().spotify||{})});
  function defaultLangs(){const s=all().subjMin||{};return Object.keys(s).filter(x=>LANGS.includes(x)).sort((a,b)=>s[b]-s[a]).slice(0,3)}
  async function load(){if(loading||!sb)return;loading=true;try{const {data,error}=await sb.rpc("spotify_status");
    if(error){missing=/function|schema cache/i.test(error.message||"");st={connected:false}}else st=data;if(route()==="manage")render()}finally{loading=false}}
  async function save(patch){const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;await Prefs.set({spotify:{...sp(),...patch,tz}},true);render()}
  async function connect(){
    const {data,error}=await sb.functions.invoke("spotify/auth-url",{method:"POST",body:{}});
    if(error||!data||!data.url){toast((data&&data.error)||"The Spotify connection isn't set up yet — see docs/SPOTIFY.md",7000);return}
    await save({});location.href=data.url;
  }
  function card(){
    if(readOnly())return "";if(st===null){load();return ""}
    const s=sp();const seen=Object.entries(st.seen||{}).sort((a,b)=>(b[1].last||"").localeCompare(a[1].last||""));const now=st.now&&st.now.cur;
    const shows=seen.filter(([,x])=>x.kind==="show"),artists=seen.filter(([,x])=>x.kind==="artist");
    const sel=(k,x)=>{const r=s.shows[k]||{};return `<select data-spshow="${esc(k)}"><option value="">${x.lang&&LANG_BY_CODE[x.lang]?"Automatic ("+LANG_BY_CODE[x.lang]+")":"Automatic"}</option>${LANGS.map(l=>`<option ${r.lang===l?"selected":""}>${l}</option>`).join("")}<option value="ignore" ${r.lang==="ignore"?"selected":""}>Never log</option></select>`};
    return `<div class="card" id="spotifyCard"><h2>Spotify</h2>
     ${missing?`<p class="sub">Needs database update 5 and the Spotify function — see <b>docs/SPOTIFY.md</b> in the repo (about 15 minutes, once).</p>`:
      !st.connected?`<p class="sub">Counts the podcasts you listen to on any device — phone, computer, car — while they're really playing. Episodes in a language you study are logged automatically.</p><button class="btn" data-sp="connect">Connect Spotify</button>`:
      `<p class="sub">Connected${st.name?" as <b>"+esc(st.name)+"</b>":""}${st.last_poll?` · last checked ${esc(new Date(st.last_poll).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}))}`:" · waiting for the first check"}.</p>
       ${st.error?`<div class="g-warn">${esc(st.error)}</div>`:""}
       <div class="field"><label>Log episodes in</label><div class="chips">${LANGS.slice(0,14).map(l=>`<button class="qchip tpl ${s.langs.includes(l)?"on":""}" data-splang="${l}">${l}</button>`).join("")}</div></div>
       <label class="gchk"><input type="checkbox" data-spmusic ${s.music?"checked":""}> Also count music, for artists you give a language below</label>
       ${shows.length?`<h3 class="qs-h" style="margin-top:12px">Shows you listened to</h3>${shows.map(([k,x])=>`<div class="sp-row"><span>${esc(x.name||"?")}</span>${sel(k,x)}</div>`).join("")}`:`<p class="muted" style="font-size:13px">Play a podcast on Spotify — it shows up here within a minute or two.</p>`}
       ${s.music&&artists.length?`<h3 class="qs-h" style="margin-top:12px">Artists</h3>${artists.slice(0,15).map(([k,x])=>`<div class="sp-row"><span>${esc(x.name||"?")}</span>${sel(k,x)}</div>`).join("")}`:""}
       <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="linkb" data-sp="disconnect" style="color:var(--danger)">Disconnect</button></div>`}</div>`;
  }
  const LANG_BY_CODE={fr:"French",pl:"Polish",de:"German",es:"Spanish",en:"English",pt:"Portuguese",it:"Italian",nl:"Dutch",ru:"Russian",uk:"Ukrainian",cs:"Czech",sv:"Swedish",ja:"Japanese",ko:"Korean",zh:"Chinese",ar:"Arabic",tr:"Turkish",el:"Greek"};
  document.addEventListener("click",async e=>{
    const b=e.target.closest("[data-sp],[data-splang]");if(!b)return;
    if(b.dataset.splang){const l=b.dataset.splang;const L=sp().langs;save({langs:L.includes(l)?L.filter(x=>x!==l):[...L,l]});return}
    if(b.dataset.sp==="connect")connect();
    else if(b.dataset.sp==="disconnect"){if(!b.classList.contains("confirm")){b.classList.add("confirm");b.textContent="Disconnect Spotify?";return}
      await sb.rpc("spotify_disconnect");st=null;render();toast("Spotify disconnected")}
  });
  document.addEventListener("change",e=>{
    if(e.target.dataset.spshow){const k=e.target.dataset.spshow;const shows={...sp().shows};if(e.target.value)shows[k]={lang:e.target.value};else delete shows[k];save({shows})}
    else if(e.target.hasAttribute&&e.target.hasAttribute("data-spmusic"))save({music:e.target.checked});
  });
  function launch(){const p=new URLSearchParams(location.search);const v=p.get("spotify");if(!v)return;p.delete("spotify");history.replaceState(null,"",location.pathname+(p.toString()?"?"+p:"")+location.hash);
    toast(v==="connected"?"Spotify connected 🎧 — podcasts in your languages are now counted":v==="cancelled"?"Spotify connection cancelled":"That link expired — try connecting again",6000);location.hash="#manage"}
  return {card,launch,reset(){st=null}};
})();
