/* In-browser stand-in for Supabase used by the tests: tables live in localStorage, auth in sessionStorage,
   realtime over BroadcastChannel. Set localStorage 'mock-offline' to '1' to simulate no connection. */
(()=>{
const EMPTY='{"profiles":[],"logs":[],"timers":[],"shares":[],"ingest_tokens":[],"users":[],"friendships":[],"reactions":[],"presence":[],"focus_sessions":[],"focus_awards":[],"resources":[],"scores":[],"client_errors":[],"blocks":[],"room_members":[]}';
let DB;const ld=()=>{DB=JSON.parse(localStorage.getItem('mockdb')||EMPTY);for(const k of Object.keys(JSON.parse(EMPTY)))DB[k]=DB[k]||[]};ld();
const save=()=>localStorage.setItem('mockdb',JSON.stringify(DB));
let session=JSON.parse(sessionStorage.getItem('mocksess')||'null');const subs=[];
const uuid=()=>crypto.randomUUID();const uidf=()=>session&&session.user.id;
const NOPRESENCE=localStorage.getItem('mock-nosql')==='1';
class Q{constructor(t){this.t=t;this.f=[];this.op='select';this.ord=[];}
 select(){this.ret=true;return this}
 eq(c,v){this.f.push(r=>r[c]===v);return this} in(c,v){this.f.push(r=>v.includes(r[c]));return this}
 limit(n){this.lim=n;return this}
 order(c,o){this.ord.push([c,o&&o.ascending===false?-1:1]);return this} range(a,b){this.rg=[a,b];return this}
 maybeSingle(){this.one='maybe';return this} single(){this.one='single';return this}
 insert(rows){this.op='insert';this.rows=Array.isArray(rows)?rows:[rows];return this}
 update(p){this.op='update';this.patch=p;return this} upsert(r){this.op='upsert';this.rows=[r];return this} delete(){this.op='delete';return this}
 then(res,rej){try{res(this.run())}catch(e){rej(e)}}
 run(){ld();if(localStorage.getItem('mock-offline')==='1')return{data:null,error:{message:'TypeError: Failed to fetch',details:'',hint:'',code:''}};if(NOPRESENCE&&(this.t==='presence'||(this.op==='update'&&this.patch&&'prefs' in this.patch)))return{data:null,error:{code:'42P01',message:'relation does not exist'}};
  const T=DB[this.t];const uid=uidf();let out;
  if(this.op==='insert'){const pk=this.t==='logs'?(r=>r.id):this.t==='focus_sessions'?(r=>uidf()+'|'+r.id):this.t==='focus_awards'?(r=>uidf()+'|'+r.t):null;
   if(pk){const have=new Set(T.map(x=>this.t==='logs'?x.id:x.user_id+'|'+(x.id??x.t)));if(this.rows.some(r=>r.id&&have.has(pk(r))||(this.t!=='logs'&&have.has(pk(r)))))return{data:null,error:{code:'23505',message:'duplicate key'}}}
   out=this.rows.map(r=>{const x={...r};if(this.t==='logs'){x.id=x.id||uuid();x.user_id=uid;x.created_at=x.created_at||new Date().toISOString()}if(['focus_sessions','focus_awards','resources','scores','client_errors','blocks'].includes(this.t)){x.user_id=x.user_id||uid;if(this.t!=='focus_sessions'&&this.t!=='focus_awards'&&this.t!=='client_errors'&&this.t!=='blocks')x.id=x.id||uuid()}if(this.t==='ingest_tokens'){x.token=uuid().replace(/-/g,'');x.created_at=new Date().toISOString()}
     if(this.t==='shares'&&T.some(s=>s.owner===x.owner&&s.viewer===x.viewer))throw 0;T.push(x);return x});save();}
  else if(this.op==='upsert'){const r=this.rows[0];const key=(this.t==='timers'||this.t==='presence')?'user_id':'id';
     if(this.t==='profiles'&&T.some(p=>p.username===r.username&&p.id!==r.id)){return{data:null,error:{code:'23505',message:'dup'}}}
     if(this.t==='profiles'&&['admin','administrator','root','support','help','logbook','system','moderator','mod','staff','official','security','api','www','mail','null','undefined','anonymous','team','owner'].includes(r.username))return{data:null,error:{code:'23514',message:'That username is reserved'}};
     const i=T.findIndex(x=>x[key]===r[key]);if(i>=0)T[i]={...T[i],...r};else T.push(this.t==='profiles'?{subjects:[],types:[],prefs:{},...r}:{...r});save();out=[r]}
  else if(this.op==='update'){out=T.filter(r=>this.f.every(f=>f(r)));out.forEach(r=>Object.assign(r,this.patch));save()}
  else if(this.op==='delete'){out=T.filter(r=>this.f.every(f=>f(r)));const keep=T.filter(r=>!this.f.every(f=>f(r)));DB[this.t]=keep;save()}
  else{out=T.filter(r=>this.f.every(f=>f(r)));
     if(this.t==='logs')out=out.filter(r=>r.user_id===uid||DB.shares.some(s=>s.owner===r.user_id&&s.viewer===uid));
     if(this.t==='shares')out=out.filter(s=>s.owner===uid||s.viewer===uid);if(['focus_sessions','focus_awards','resources','scores'].includes(this.t))out=out.filter(r=>r.user_id===uid||DB.shares.some(s=>s.owner===r.user_id&&s.viewer===uid));
     for(const [c,o] of [...this.ord].reverse())out=[...out].sort((a,b)=>(a[c]>b[c]?1:a[c]<b[c]?-1:0)*o);
     if(this.rg)out=out.slice(this.rg[0],this.rg[1]+1);if(this.lim)out=out.slice(0,this.lim);}
  if(this.one)return{data:out[0]||null,error:null};return{data:out,error:null};}}
const auth={async getSession(){if(localStorage.getItem('mock-offline')==='1')return{data:{session:null}};return{data:{session}}},async getUser(){return{data:{user:session?{id:session.user.id,email:session.user.email}:null}}},async refreshSession(){return{data:{session}}},onAuthStateChange(cb){subs.push(cb);return{data:{subscription:{unsubscribe(){}}}}},
 async signUp({email,password}){ld();const u={id:uuid(),email,password};DB.users.push(u);save();session={user:{id:u.id,email}};sessionStorage.setItem('mocksess',JSON.stringify(session));localStorage.setItem('sb-mock-auth-token',JSON.stringify({user:session.user}));subs.forEach(f=>f('SIGNED_IN',session));return{data:{session},error:null}},
 async signInWithPassword({email,password}){ld();const u=DB.users.find(x=>x.email===email&&x.password===password);if(!u)return{error:{message:'Invalid login credentials'}};session={user:{id:u.id,email}};sessionStorage.setItem('mocksess',JSON.stringify(session));localStorage.setItem('sb-mock-auth-token',JSON.stringify({user:session.user}));subs.forEach(f=>f('SIGNED_IN',session));return{data:{session},error:null}},
 async signOut(){session=null;sessionStorage.removeItem('mocksess');subs.forEach(f=>f('SIGNED_OUT',null));return{error:null}},
 async resetPasswordForEmail(){return{error:null}},async updateUser(){return{error:null}}};
/* ---- social RPCs (mirror supabase-social.sql) ---- */
const P=id=>DB.profiles.find(p=>p.id===id)||{};
const isF=(a,b)=>DB.friendships.some(f=>f.status==='accepted'&&((f.requester===a&&f.addressee===b)||(f.requester===b&&f.addressee===a)));
const fresh=p=>p&&Date.now()-Date.parse(p.updated_at)<180000;
const addD=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const RPC={
 delete_my_account(){const me=uidf();for(const t of ['logs','profiles','friendships','presence','focus_sessions','focus_awards','ingest_tokens'])DB[t]=DB[t].filter(r=>![r.user_id,r.id,r.requester,r.addressee].includes(me));DB.users=DB.users.filter(u=>u.id!==me);save();return null},
 find_user:a=>(DB.profiles.find(p=>p.username===a.p_username)||{}).id||null,
 friend_request(a){const me=uidf();const u=a.p_username.replace(/^@/,'').trim().toLowerCase();const t=DB.profiles.find(p=>p.username===u);if(!t)return 'not_found';if(t.id===me)return 'self';
   const rev=DB.friendships.find(f=>f.requester===t.id&&f.addressee===me);if(rev){rev.status='accepted';save();return 'accepted'}
   let f=DB.friendships.find(f=>f.requester===me&&f.addressee===t.id);if(!f){f={requester:me,addressee:t.id,status:'pending'};DB.friendships.push(f);save()}return f.status},
 friend_respond(a){const me=uidf();if(a.p_accept){DB.friendships.filter(f=>f.requester===a.p_user&&f.addressee===me).forEach(f=>f.status='accepted')}else DB.friendships=DB.friendships.filter(f=>!((f.requester===a.p_user&&f.addressee===me)||(f.requester===me&&f.addressee===a.p_user)));save();return null},
 friends_overview(a){const me=uidf();const t=a.p_today;return DB.friendships.filter(f=>f.requester===me||f.addressee===me).map(f=>{const id=f.requester===me?f.addressee:f.requester;const st=f.status==='accepted'?'friend':f.requester===me?'outgoing':'incoming';
   const L=DB.logs.filter(l=>l.user_id===id);const pr=DB.presence.find(p=>p.user_id===id);const ok=st==='friend';const live=ok&&fresh(pr);
   const wk=L.filter(l=>l.d>=addD(t,-6)&&l.d<=t);const bys={};wk.forEach(l=>bys[l.subject]=(bys[l.subject]||0)+l.minutes);
   const days=new Set(L.map(l=>l.d));let d=days.has(t)?t:addD(t,-1),n=0;while(days.has(d)){n++;d=addD(d,-1)}
   return {id,username:P(id).username,status:st,today_min:ok?L.filter(l=>l.d===t).reduce((x,l)=>x+l.minutes,0):null,week_min:ok?wk.reduce((x,l)=>x+l.minutes,0):null,top_subject:ok?Object.keys(bys).sort((x,y)=>bys[y]-bys[x])[0]||null:null,streak:ok?n:null,
     state:live?pr.state:null,subject:live?pr.subject:null,type:live?pr.type:null,ends_at:live?pr.ends_at:null,total_min:live?pr.total_min:null,room:live?pr.room:null}})},
 friend_feed(a){const me=uidf();return DB.logs.filter(l=>l.user_id!==me&&isF(l.user_id,me)).sort((x,y)=>x.d<y.d?1:x.d>y.d?-1:(x.created_at<y.created_at?1:-1)).slice(0,200).map(l=>{const rs={};DB.reactions.filter(r=>r.log_id===l.id).forEach(r=>rs[r.emoji]=(rs[r.emoji]||0)+1);
   return {log_id:l.id,user_id:l.user_id,username:P(l.user_id).username,d:l.d,subject:l.subject,type:l.type,minutes:l.minutes,activity:((P(l.user_id).prefs||{}).social||{}).details?l.activity:'',src:l.src||'manual',created_at:l.created_at,reactions:rs,mine:(DB.reactions.find(r=>r.log_id===l.id&&r.user_id===me)||{}).emoji||null}})},
 react(a){const me=uidf();const l=DB.logs.find(x=>x.id===a.p_log);if(!l||!isF(l.user_id,me))throw {message:'not allowed'};DB.reactions=DB.reactions.filter(r=>!(r.log_id===a.p_log&&r.user_id===me));if(a.p_emoji)DB.reactions.push({log_id:a.p_log,user_id:me,emoji:a.p_emoji,created_at:new Date().toISOString()});save();return null},
 reactions_to_me(a){const me=uidf();return DB.reactions.map(r=>({r,l:DB.logs.find(x=>x.id===r.log_id)})).filter(x=>x.l&&x.l.user_id===me).map(({r,l})=>({username:P(r.user_id).username,emoji:r.emoji,created_at:r.created_at,subject:l.subject,type:l.type,minutes:l.minutes,d:l.d}))},
 community_boards(a){const t=a.p_today;const opt=id=>((P(id).prefs||{}).social||{}).community;const m={};DB.logs.filter(l=>opt(l.user_id)&&l.d>=addD(t,-29)&&l.d<=t).forEach(l=>{const e=m[l.subject]||(m[l.subject]={subject:l.subject,u:new Set(),week_min:0});e.u.add(l.user_id);if(l.d>=addD(t,-6))e.week_min+=l.minutes});return Object.values(m).map(e=>({subject:e.subject,members:e.u.size,week_min:e.week_min})).sort((x,y)=>y.members-x.members)},
 community(a){const me=uidf();const t=a.p_today;const opt=id=>((P(id).prefs||{}).social||{}).community;const L=DB.logs.filter(l=>l.subject===a.p_subject&&opt(l.user_id)&&l.d>=addD(t,-(a.p_days-1))&&l.d<=t);
   const m={},bt={};L.forEach(l=>{m[l.user_id]=(m[l.user_id]||0)+l.minutes;bt[l.type]=(bt[l.type]||0)+l.minutes});const arr=Object.entries(m).map(([id,minutes])=>({id,username:P(id).username,minutes})).sort((x,y)=>y.minutes-x.minutes);
   arr.forEach((r,i)=>r.rank=i&&arr[i-1].minutes===r.minutes?arr[i-1].rank:i+1);const v=arr.map(r=>r.minutes).sort((x,y)=>x-y);const med=v.length?(v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2):0;const mine=arr.find(r=>r.id===me);
   return {members:arr.length,total_min:v.reduce((x,y)=>x+y,0),median_min:med,top:arr.slice(0,20).map(r=>({username:r.username,minutes:r.minutes,rank:r.rank,me:r.id===me})),me:mine?{minutes:mine.minutes,rank:mine.rank}:null,by_type:bt,now:DB.presence.filter(p=>p.subject===a.p_subject&&p.state==='focus'&&fresh(p)&&opt(p.user_id)).length}}
};
async function rpc(n,a){ld();if(NOPRESENCE&&n!=='find_user')return{data:null,error:{code:'PGRST202',message:'Could not find the function'}};if(!RPC[n])return{data:null,error:{message:'?'}};try{return{data:RPC[n](a||{}),error:null}}catch(e){return{data:null,error:e}}}
/* ---- realtime: presence + broadcast over BroadcastChannel (same browser) ---- */
function channel(name,opts){const key=(opts&&opts.config&&opts.config.presence&&opts.config.presence.key)||uuid();const bc=new BroadcastChannel('rt-'+name);const H={presence:[],broadcast:{}};let state={},mine=null;
 const sync=()=>H.presence.forEach(cb=>cb());
 bc.onmessage=({data:m})=>{if(m.k==='p'){state[m.key]=[m.meta];sync()}else if(m.k==='leave'){delete state[m.key];sync()}else if(m.k==='hello'){if(mine)bc.postMessage({k:'p',key,meta:mine})}else if(m.k==='b'){(H.broadcast[m.event]||[]).forEach(cb=>cb({event:m.event,payload:m.payload}))}};
 const ch={on(type,filter,cb){if(type==='presence')H.presence.push(cb);else (H.broadcast[filter.event]=H.broadcast[filter.event]||[]).push(cb);return ch},
  subscribe(cb){setTimeout(()=>{bc.postMessage({k:'hello'});cb&&cb('SUBSCRIBED')},50);return ch},
  async track(meta){mine={...meta,presence_ref:uuid()};state[key]=[mine];bc.postMessage({k:'p',key,meta:mine});sync();return 'ok'},
  presenceState(){return JSON.parse(JSON.stringify(state))},
  async send(m){bc.postMessage({k:'b',event:m.event,payload:m.payload});return 'ok'},
  _close(){bc.postMessage({k:'leave',key});bc.close()}};
 window.__channels=(window.__channels||[]);window.__channels.push(ch);return ch}
window.supabase={createClient:()=>({auth,from:t=>new Q(t),rpc,channel,removeChannel(ch){ch._close();return Promise.resolve('ok')}})};
})();
