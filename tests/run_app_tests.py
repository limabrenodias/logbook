"""End-to-end tests for Logbook.

Runs the real app in Chromium against tests/sbmock.js (an in-browser stand-in for Supabase).
Usage:  python tests/run_app_tests.py            (exit code 1 if anything fails)
Env:    CHROME=/path/to/chrome to use a specific browser; SHOTS=1 to save screenshots in tests/out/
"""
import functools, http.server, json, os, sys, threading, traceback
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8799"))
URL = f"http://localhost:{PORT}/index.html"
SHOTS = os.environ.get("SHOTS") == "1"
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("  ok   " if cond else "  FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))

SEED = """(()=>{const DB=JSON.parse(localStorage.getItem('mockdb'));const id=n=>DB.profiles.find(p=>p.username===n).id;
 const A=id('tester');let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 const day=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const T=['Listening','Reading','Writing','Vocabulary','Grammar','Speaking','Mixed'];
 for(let n=400;n>=1;n--){if(rnd()<.2)continue;const k=1+Math.floor(rnd()*3);for(let j=0;j<k;j++){const t=T[Math.floor(rnd()*T.length)];
   DB.logs.push({id:crypto.randomUUID(),user_id:A,d:day(n),subject:rnd()<.75?'French':'Polish',type:t,minutes:10+Math.floor(rnd()*70),activity:t==='Vocabulary'?'Anki':'Podcast',src:'manual',created_at:new Date(Date.now()-n*864e5+j*1000).toISOString()})}}
 for(let n=60;n>=1;n--)if(rnd()<.3)DB.logs.push({id:crypto.randomUUID(),user_id:A,d:day(n),subject:'Aviation',type:'Reading',minutes:45,activity:'ATPL',src:'manual',created_at:new Date(Date.now()-n*864e5).toISOString()});
 localStorage.setItem('mockdb',JSON.stringify(DB));
 const tl=[];for(let n=30;n>=0;n--){if(rnd()<.4)continue;const d=new Date();d.setDate(d.getDate()-n);d.setHours(9,Math.floor(rnd()*50),0,0);const s=d.getTime();tl.push({id:String(s),day:day(n),segs:[[s,s+25*60000]],s:'French',t:'Reading',a:'',min:25,full:true,pts:30})}
 localStorage.setItem('lb-timeline',JSON.stringify(tl));})()"""

def db(pg, expr):
    return pg.evaluate("(()=>{const DB=JSON.parse(localStorage.getItem('mockdb'));return " + expr + "})()")

def shot(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(HERE, "out", name + ".png"), full_page=False)

def main():
    with sync_playwright() as p:
        kw = {"args": ["--no-sandbox"]}
        if os.environ.get("CHROME"): kw["executable_path"] = os.environ["CHROME"]
        b = p.chromium.launch(**kw)
        ctx = b.new_context(viewport={"width": 1366, "height": 900}, accept_downloads=True)
        ctx.route("**/supabase.min.js", lambda r: r.fulfill(path=os.path.join(HERE, "sbmock.js"), content_type="application/javascript"))
        ctx.route("https://commons.wikimedia.org/**", lambda r: r.fulfill(path=os.path.join(HERE, "painting.jpg"), content_type="image/jpeg"))
        ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        ctx.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        print("Sign up")
        pg.goto(URL); pg.wait_for_timeout(600)
        check("landing page shows sign-in and features", pg.query_selector("#authForm") and pg.query_selector(".land-f"))
        pg.fill("#email", "t@example.com"); pg.fill("#pw", "password1"); pg.click("[data-act=signup]"); pg.wait_for_timeout(400)
        pg.fill("#uname", "admin"); pg.click("#userForm button"); pg.wait_for_timeout(400)
        pg.fill("#uname", "tester"); pg.click("#userForm button"); pg.wait_for_timeout(700)
        check("signed in", pg.evaluate("phase") == "app")
        pg.evaluate(SEED); pg.reload(); pg.wait_for_timeout(1200)
        me = pg.evaluate("me"); n0 = pg.evaluate("all().logs.length")
        check("seeded logs load", n0 > 300, n0)
        mine = lambda: db(pg, "DB.logs.filter(l=>l.user_id==='" + me + "').length")

        print("Every page renders")
        for r in ["insights", "home", "focus", "friends", "stats", "logs", "manage"]:
            pg.evaluate(f"location.hash='#{r}'"); pg.wait_for_timeout(500)
            check(f"#{r} renders", len(pg.evaluate("document.getElementById('view').innerText")) > 20)
        pg.evaluate("location.hash='#home'"); pg.wait_for_timeout(300)

        print("Add, edit, undo, delete")
        pg.keyboard.press("n"); pg.wait_for_timeout(200); pg.fill("#fA", "Test podcast"); pg.fill("#fM", "33"); pg.click("[data-act=saveManual]"); pg.wait_for_timeout(500)
        lid = pg.evaluate("(all().logs.find(l=>l.a==='Test podcast')||{}).i")
        check("new log saved to server", db(pg, f"DB.logs.some(l=>l.id==='{lid}'&&l.minutes===33)"))
        pg.evaluate("location.hash='#logs'"); pg.wait_for_timeout(300)
        pg.click(f'[data-edit="{lid}"]'); pg.fill("#fM", "45"); pg.click("[data-act=saveManual]"); pg.wait_for_timeout(400)
        pg.keyboard.press("Control+z"); pg.wait_for_timeout(500)
        check("Ctrl+Z undoes the edit", db(pg, f"DB.logs.find(l=>l.id==='{lid}').minutes") == 33)
        pg.click(f'[data-del="{lid}"]'); pg.click(f'[data-del="{lid}"]'); pg.wait_for_timeout(400)
        check("delete reaches server", not db(pg, f"DB.logs.some(l=>l.id==='{lid}')"))
        pg.click("#toastA button"); pg.wait_for_timeout(500)
        check("undo restores the same log", db(pg, f"DB.logs.some(l=>l.id==='{lid}')"))

        print("Offline")
        pg.evaluate("localStorage.setItem('mock-offline','1')")
        pg.keyboard.press("n"); pg.wait_for_timeout(200); pg.fill("#fA", "Offline log"); pg.click("[data-act=saveManual]"); pg.wait_for_timeout(400)
        check("offline change waits in the outbox", pg.evaluate("Net.pending") == 1 and pg.query_selector("#netPill"))
        pg.evaluate("localStorage.setItem('sb-mock-auth-token',JSON.stringify({user:{id:me}}))")
        ctx.add_init_script("Object.defineProperty(Navigator.prototype,'onLine',{get:()=>localStorage.getItem('mock-offline')!=='1'})")
        pg.reload(); pg.wait_for_timeout(2500)
        check("opens offline from the saved copy", pg.evaluate("phase") == "app" and pg.evaluate("all().logs.some(l=>l.a==='Offline log')"))
        pg.evaluate("localStorage.setItem('mock-offline','0');dispatchEvent(new Event('online'))"); pg.wait_for_timeout(2500)
        check("outbox sends when back online", db(pg, "DB.logs.some(l=>l.activity==='Offline log')") and pg.evaluate("Net.pending") == 0)
        check("no duplicates after reconnecting", db(pg, "DB.logs.filter(l=>l.activity==='Offline log').length") == 1)

        print("Select many + delete a subject")
        pg.evaluate("location.hash='#logs'"); pg.wait_for_timeout(300); pg.click("[data-act=selMode]")
        ids = pg.evaluate("all().logs.slice(0,3).map(l=>l.i)")
        for i in ids: pg.click(f'label.selrow:has([data-selid="{i}"])'); pg.wait_for_timeout(80)
        pg.select_option("#selType", "Speaking"); pg.wait_for_timeout(400)
        check("bulk change", db(pg, "DB.logs.filter(l=>%s.includes(l.id)).every(l=>l.type==='Speaking')" % json.dumps(ids)))
        pg.click("#toastA button"); pg.wait_for_timeout(400); pg.click("[data-act=selMode]")
        pg.evaluate("location.hash='#manage'"); pg.wait_for_timeout(400)
        pg.click("[data-delkind=subject][data-delname=Aviation]"); pg.select_option("#delTo", "French"); pg.click("[data-act=delGo]"); pg.wait_for_timeout(400)
        check("subject deleted, logs moved", db(pg, "DB.logs.filter(l=>l.subject==='Aviation').length") == 0)
        pg.keyboard.press("Control+z"); pg.wait_for_timeout(500)
        check("undo brings the subject back", db(pg, "DB.logs.filter(l=>l.subject==='Aviation').length") > 0)

        print("Resources")
        pg.evaluate("location.hash='#logs'"); pg.wait_for_timeout(300); pg.click("[data-logtab=res]"); pg.wait_for_timeout(200)
        pg.click("[data-resnew]"); pg.fill("#rT", "L'Étranger"); pg.fill("#rN", "159"); pg.fill("#rP", "10"); pg.click("[data-ressave]"); pg.wait_for_timeout(400)
        rid = db(pg, "(DB.resources[0]||{}).id")
        check("resource saved", rid and db(pg, "DB.resources[0].total") == 159)
        pg.click(f'[data-reslog="{rid}"]'); pg.wait_for_timeout(300)
        check("log form preselects the resource", pg.evaluate("$('#fR').value") == rid)
        pg.fill("#fRP", "60"); pg.fill("#fM", "50"); pg.click("[data-act=saveManual]"); pg.wait_for_timeout(500)
        check("log linked to the resource", db(pg, f"DB.logs.some(l=>l.resource_id==='{rid}'&&l.minutes===50)"))
        check("progress updated from the log", db(pg, f"DB.resources.find(r=>r.id==='{rid}').progress") == 60)
        pg.evaluate("location.hash='#logs';ui.logTab='res';render()"); pg.wait_for_timeout(300); shot(pg, "resources")
        check("card shows hours and ETA", "0.8 h" in pg.inner_text(".res") and "to finish" in pg.inner_text(".res"))

        print("Scores")
        pg.click("[data-logtab=scores]"); pg.wait_for_timeout(200)
        for d, sc in [("2026-10-01", [15, 14, 12, 16]), ("2026-11-15", [18, 17, 13, 19])]:
            pg.click("[data-scnew]"); pg.wait_for_timeout(150); pg.fill("#scE", "Practice exam"); pg.fill("#scD", d)
            while len(pg.query_selector_all(".sc-part")) < 4: pg.click("[data-scadd]")
            rows = pg.query_selector_all(".sc-part")
            for row, (nm, v) in zip(rows, zip(["Listening", "Reading", "Writing", "Speaking"], sc)):
                row.query_selector(".spn").fill(nm); row.query_selector(".sps").fill(str(v)); row.query_selector(".spm").fill("25")
            pg.click("[data-scsave]"); pg.wait_for_timeout(400)
        check("scores saved with totals", db(pg, "DB.scores.map(s=>s.total).sort().join()") == "57,67")
        check("chart and weakest section shown", pg.query_selector("#scChart svg") and "Weakest right now" in pg.inner_text("#view"))
        shot(pg, "scores")

        print("Goals, reports, year in review")
        pg.evaluate("location.hash='#home'"); pg.wait_for_timeout(300); pg.click("[data-g=newGoal]"); pg.wait_for_timeout(200)
        pg.fill("#gName", "Writing push"); pg.fill('[data-gh="Writing"]', "40"); pg.click("[data-g=saveGoal]"); pg.wait_for_timeout(400)
        check("goal saved", pg.evaluate("Goals.list().length") == 1)
        pg.evaluate("location.hash='#insights'"); pg.wait_for_timeout(500)
        check("weekly report card", pg.query_selector(".wr"))
        pg.click("[data-rcopen=year]"); pg.wait_for_timeout(500); shot(pg, "year")
        check("year in review", pg.query_selector(".rc-hero") and pg.query_selector("#rcChart svg"))
        pg.click("[data-insback]")
        pg.evaluate("(()=>{const DB=JSON.parse(localStorage.getItem('mockdb'));const d=n=>{const x=new Date();x.setDate(x.getDate()-n);return x.toISOString().slice(0,10)};"
                    "for(const n of [40,20,0])DB.anki_stats.push({user_id:me,d:d(n),deck:'Français',subject:'French',data:{mature:3000+(40-n)*5,young:400,new:900,learning:20,retention:0.9,retention_n:300,due_tomorrow:150,reviews_7d:900}});localStorage.setItem('mockdb',JSON.stringify(DB))})()")
        pg.evaluate("AnkiStats.reset();render()"); pg.wait_for_timeout(600)
        check("Anki statistics card", "3,200" in pg.inner_text("#view") or "3200" in pg.inner_text("#view"))
        pg.evaluate("location.hash='#manage'"); pg.wait_for_timeout(500)
        check("Spotify card offers to connect", pg.query_selector("[data-sp=connect]"))
        pg.evaluate("(()=>{const DB=JSON.parse(localStorage.getItem('mockdb'));const t=new Date().toISOString().slice(0,10);"
                    "DB.logs.push({id:crypto.randomUUID(),user_id:me,d:t,subject:'French',type:'Vocabulary',minutes:17,activity:'Anki · Français',src:'anki',ext_id:t+'|1',created_at:new Date().toISOString()});localStorage.setItem('mockdb',JSON.stringify(DB))})()")
        pg.evaluate("location.hash='#logs'"); pg.reload(); pg.wait_for_timeout(1500)
        check("source chips on logs", pg.query_selector(".srcchip.auto") and pg.query_selector(".srcchip.man"))
        pg.select_option("#logSrc", "auto"); pg.wait_for_timeout(300)
        check("Automatic filter shows only automatic logs", pg.query_selector(".srcchip.auto") and not pg.query_selector(".srcchip.man"))
        pg.select_option("#logSrc", "manual"); pg.wait_for_timeout(300)
        check("Added-by-me filter hides automatic logs", not pg.query_selector(".srcchip.auto") and pg.query_selector(".srcchip.man"))
        pg.screenshot(path="/tmp/logs_src.png")
        pg.select_option("#logSrc", "src:Anki"); pg.wait_for_timeout(300)
        check("Single-source filter", "Anki" in pg.inner_text("#view") and not pg.query_selector(".srcchip.man"))
        pg.select_option("#logSrc", "All"); pg.wait_for_timeout(200)

        print("Focus sync")
        pg.evaluate("FocusSync.run()"); pg.wait_for_timeout(1200)
        n_tl = pg.evaluate("JSON.parse(localStorage.getItem('lb-timeline')).length")
        check("Focus sessions uploaded", db(pg, "DB.focus_sessions.length") == n_tl, f"{n_tl}")
        pg.evaluate("localStorage.removeItem('lb-timeline')"); pg.reload(); pg.wait_for_timeout(2500)
        check("Focus sessions come back on a 'new device'", pg.evaluate("JSON.parse(localStorage.getItem('lb-timeline')||'[]').length") == n_tl)

        print("Keyboard + export")
        pg.keyboard.press("Control+k"); pg.wait_for_timeout(150); pg.keyboard.type("stats"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
        check("command box navigates", pg.evaluate("location.hash") == "#stats")
        pg.evaluate("location.hash='#manage'"); pg.wait_for_timeout(400)
        with pg.expect_download() as d: pg.click("[data-bk=logs]")
        csv = open(d.value.path(), encoding="utf-8-sig").read()
        check("CSV export has every log", csv.count("\n") >= pg.evaluate("all().logs.length"))

        print("Progress, coins and streaks")
        pg.evaluate("location.hash='#progress'"); pg.wait_for_timeout(700)
        txt = pg.inner_text("#view")
        check("Progress shows languages with a level", "French" in txt and pg.query_selector(".lvl-badge"))
        check("Progress shows weekly challenges and milestones", pg.query_selector(".chal .ch") and pg.query_selector(".ms"))
        bal = pg.evaluate("Rewards.balance()")
        check("coins are earned from history", bal > 0, bal)
        check("coin chip in the navigation", pg.query_selector("#sidenav .coin-chip"))
        pg.click("[data-pg=profile]"); pg.wait_for_timeout(200)
        pg.select_option("#pfNatAdd", "Portuguese"); pg.wait_for_timeout(100)
        pg.click("[data-pg=pfsave]"); pg.wait_for_timeout(500)
        check("native language shortens the French ladder", pg.evaluate("Levels.ladder('French')[3]") < 620 and "fewer hours" in pg.evaluate("document.getElementById('view').textContent"), pg.evaluate("Levels.ladder('French')"))
        pg.click("[data-pg=streakset]"); pg.wait_for_timeout(200); pg.fill("#ssMin", "10"); pg.click("[data-pg=ssave]"); pg.wait_for_timeout(400)
        check("streak minimum saved", pg.evaluate("Prefs.get().streakMin") == 10 and pg.evaluate("streakInfo().min") == 10)
        b0 = pg.evaluate("Rewards.balance()"); f0 = pg.evaluate("streakInfo().freezes")
        if f0 < 3:
            pg.click("[data-pg=freeze]"); pg.wait_for_timeout(500)
            check("buying a freeze spends 100 coins", pg.evaluate("Rewards.balance()") == b0 - 100 and pg.evaluate("streakInfo().freezes") == f0 + 1)
        # make-up day: miss yesterday, study twice the goal today
        pg.evaluate("""(()=>{const DB=JSON.parse(localStorage.getItem('mockdb'));const d=n=>{const x=new Date();x.setDate(x.getDate()-n);return x.toISOString().slice(0,10)};
          DB.logs=DB.logs.filter(l=>!(l.user_id===me&&(l.d===d(1)||l.d===d(0))));for(const n of [2,3,4])DB.logs.push({id:crypto.randomUUID(),user_id:me,d:d(n),subject:'French',type:'Reading',minutes:40,activity:'x',src:'manual',created_at:new Date().toISOString()});
          localStorage.setItem('mockdb',JSON.stringify(DB))})()""")
        pg.evaluate("Prefs.set({freezes:false,rest:[]},true)"); pg.reload(); pg.wait_for_timeout(1200)
        si = pg.evaluate("(()=>{const s=streakInfo();return {cur:s.cur,makeup:!!s.makeup,rep:!!s.repairable}})()")
        check("a missed day offers a make-up day and a repair", si["makeup"] and si["rep"] and si["cur"] == 0, si)
        pg.evaluate("location.hash='#progress'"); pg.wait_for_timeout(600)
        check("rescue banner on Progress", pg.query_selector("[data-pg=repair]"))
        pg.evaluate("""(()=>{const DB=JSON.parse(localStorage.getItem('mockdb'));DB.logs.push({id:crypto.randomUUID(),user_id:me,d:today(),subject:'French',type:'Reading',minutes:120,activity:'x',src:'manual',created_at:new Date().toISOString()});localStorage.setItem('mockdb',JSON.stringify(DB))})()""")
        pg.reload(); pg.wait_for_timeout(1200)
        check("make-up day saves the streak", pg.evaluate("streakInfo().cur") >= 4, pg.evaluate("streakInfo().cur"))

        print("Recaps")
        pg.evaluate("location.hash='#insights'"); pg.wait_for_timeout(400)
        pg.click("[data-rcopen=month]"); pg.wait_for_timeout(600)
        check("monthly recap renders", "This month you studied" in pg.inner_text("#view") and pg.query_selector("#rcChart svg"))
        pg.click("[data-rck=year]"); pg.wait_for_timeout(400)
        check("yearly recap renders", "This year you studied" in pg.inner_text("#view") or "Nothing logged" in pg.inner_text("#view"))
        pg.click("[data-rck=week]"); pg.wait_for_timeout(400)
        with pg.expect_download() as d: pg.click("[data-rcshare]")
        check("recap picture is a PNG", open(d.value.path(), "rb").read(8) == b"\x89PNG\r\n\x1a\n")

        print("Words")
        pg.evaluate("location.hash='#logs'"); pg.wait_for_timeout(300); pg.click("[data-logtab=words]"); pg.wait_for_timeout(600)
        check("Words tab explains Alt+click", "Alt" in pg.inner_text("#view"))
        pg.click("[data-w=add]"); pg.wait_for_timeout(200); pg.fill("#waW", "Épanouir"); pg.select_option("#waL", "French"); pg.fill("#waS", "Il faut s'épanouir dans la vie."); pg.click("[data-w=save]"); pg.wait_for_timeout(900)
        check("word saved to server", db(pg, "DB.words.some(w=>w.word==='épanouir'&&w.user_id==='" + me + "')"))
        check("word shows its sentence and an estimated level", pg.query_selector(".wcard mark") and pg.query_selector(".wcard .chip-l"))
        pg.click("[data-wcycle]"); pg.wait_for_timeout(400)
        check("word status changes", db(pg, "DB.words.find(w=>w.word==='épanouir').status") == "learning")
        check("common word gets an early level", pg.evaluate("Words.level({lang:'French',word:'maison'}).lv") in ("A1", "A2"))

        print("Clans")
        pg.evaluate("location.hash='#friends'"); pg.wait_for_timeout(400); pg.click("[data-soctab=clans]"); pg.wait_for_timeout(500)
        pg.click("[data-cl=new]"); pg.wait_for_timeout(200); pg.fill("#ceName", "Les Polyglottes"); pg.fill("#ceTag", "poly"); pg.fill("#ceW", "5"); pg.click("[data-cl=create]"); pg.wait_for_timeout(900)
        txt = pg.inner_text("#view")
        check("clan created and opened", "Les Polyglottes" in txt and "POLY" in txt and pg.query_selector("code.invite"))
        check("clan counts this week's minutes", pg.query_selector(".mem") and pg.query_selector(".wkbars .wkb"))
        pg.click("[data-cl=back]"); pg.wait_for_timeout(600)
        check("clan listed with goal bars", pg.query_selector(".clan-card .bar"))

        print("Phone layout")
        pg.set_viewport_size({"width": 390, "height": 844})
        for r in ["home", "progress", "logs", "insights", "friends", "manage"]:
            pg.evaluate(f"location.hash='#{r}'"); pg.wait_for_timeout(300)
            check(f"#{r} fits a phone", not pg.evaluate("document.documentElement.scrollWidth>innerWidth"))
        pg.click("[data-act=more]"); pg.wait_for_timeout(300)
        check("phone More sheet lists the other pages", pg.query_selector(".more-grid a[href='#stats']"))
        pg.click(".more-grid a[href='#stats']"); pg.wait_for_timeout(400)
        check("More sheet navigates and closes", pg.evaluate("location.hash") == "#stats" and not pg.evaluate("document.getElementById('scrim').classList.contains('open')"))
        pg.set_viewport_size({"width": 1366, "height": 900})

        print("Account")
        pg.evaluate("location.hash='#manage'"); pg.wait_for_timeout(300)
        pg.click("[data-act=delAccount]"); pg.fill("#delConfirm", "tester"); pg.click("[data-act=delAccount2]"); pg.wait_for_timeout(800)
        check("account deletion removes data and signs out", pg.evaluate("phase") == "auth" and mine() == 0)

        check("no Content-Security-Policy violations", not pg.evaluate("window.__csp"), pg.evaluate("window.__csp"))
        check("no JavaScript errors", not errs, errs[:3])
        b.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
    return 1 if failed else 0

if __name__ == "__main__":
    try: sys.exit(main())
    except Exception:
        traceback.print_exc(); sys.exit(1)
