"""Screenshots of every page (light + dark, desktop + phone) for design review: python tests/shots.py [routes…]"""
import os, sys
sys.argv = sys.argv[:1] + sys.argv[1:]
import run_app_tests as T
from playwright.sync_api import sync_playwright
OUT = os.path.join(T.HERE, "shots"); os.makedirs(OUT, exist_ok=True)
ROUTES = sys.argv[1:] or ["home", "insights", "progress", "stats", "logs", "friends", "manage", "focus"]
with sync_playwright() as p:
    kw = {"args": ["--no-sandbox"]}
    if os.environ.get("CHROME"): kw["executable_path"] = os.environ["CHROME"]
    b = p.chromium.launch(**kw)
    for name, vp, theme in [("desk", {"width": 1440, "height": 900}, "night"), ("desklight", {"width": 1440, "height": 900}, "daylight"), ("phone", {"width": 390, "height": 844}, "night")]:
        ctx = b.new_context(viewport=vp, device_scale_factor=1 if name != "phone" else 2)
        ctx.route("**/supabase.min.js", lambda r: r.fulfill(path=os.path.join(T.HERE, "sbmock.js"), content_type="application/javascript"))
        ctx.route("https://commons.wikimedia.org/**", lambda r: r.fulfill(path=os.path.join(T.HERE, "painting.jpg"), content_type="image/jpeg"))
        ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(T.URL); pg.wait_for_timeout(500)
        if name == "desk": pg.screenshot(path=f"{OUT}/{name}-landing.png")
        pg.fill("#email", "t@example.com"); pg.fill("#pw", "password1"); pg.click("[data-act=signup]"); pg.wait_for_timeout(400)
        pg.fill("#uname", "tester"); pg.click("#userForm button"); pg.wait_for_timeout(600)
        pg.evaluate(T.SEED); pg.evaluate(f"localStorage.setItem('lb-theme','{theme}')"); pg.reload(); pg.wait_for_timeout(1300)
        for r in ROUTES:
            pg.evaluate(f"location.hash='#{r}'"); pg.wait_for_timeout(900)
            pg.screenshot(path=f"{OUT}/{name}-{r}.png", full_page=(name != "phone" and r != "focus"))
        if errs: print(name, "ERRORS:", errs[:3])
        ctx.close()
print("saved to", OUT)
