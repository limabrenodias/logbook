# Logbook

Personal study-time tracker (languages, aviation, programming…) with Supabase backend.

- `index.html` — the app (GitHub Pages)
- `supabase-setup.sql` — database setup (run in Supabase SQL Editor)
- `supabase-social.sql` — update 2: synced goals/quick logs, friends, reactions, communities, live status (run once after the setup file)
- Study together rooms use Supabase Realtime (Broadcast + Presence on public channels) — nothing to set up if Realtime is on.
- `supabase-update-3.sql` — update 3: Focus sessions and points saved to your account, and account deletion (run once)
- `sw.js` — offline support; the app also keeps a copy of your logbook and an outbox of unsent changes on each device
- `supabase-update-4.sql` — update 4: resources, scores, blocking, abuse limits, error reports, private study rooms (run once)
- `config.js` — Supabase address/key, CAPTCHA site key, version, contact email
- `extension/logbook-anki.ankiaddon` — Anki add-on (time per deck); `extension/logbook-youtube.zip` — YouTube tracker
- `docs/DEPLOY.md` — how to run your own copy and the checklist before going public
- `tests/` — end-to-end tests (`python tests/run_app_tests.py`) and SQL security checks (`tests/sql_test.sh`); GitHub runs both on every push
