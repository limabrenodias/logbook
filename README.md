# Logbook

Personal study-time tracker (languages, aviation, programming…) with Supabase backend.

- `index.html` — the app (GitHub Pages)
- `supabase-setup.sql` — database setup (run in Supabase SQL Editor)
- `supabase-social.sql` — update 2: synced goals/quick logs, friends, reactions, communities, live status (run once after the setup file)
- Study together rooms use Supabase Realtime (Broadcast + Presence on public channels) — nothing to set up if Realtime is on.
- `supabase-update-3.sql` — update 3: Focus sessions and points saved to your account, and account deletion (run once)
- `sw.js` — offline support; the app also keeps a copy of your logbook and an outbox of unsent changes on each device
- `supabase-update-4.sql` — update 4: resources, scores, blocking, abuse limits, error reports, private study rooms (run once)
- `supabase-update-5.sql` — Anki deck statistics, Spotify · `supabase-update-6.sql` — trackers use your own subjects · `supabase-update-7.sql` — saved words, clans, kudos, friends saving streaks
- `config.js` — Supabase address/key, CAPTCHA site key, version, contact email
- `extension/logbook-anki.ankiaddon` — Anki add-on (time per deck, deck statistics, saved words → cards); `extension/logbook-tracker.zip` — browser language tracker (watching, listening, reading, writing; Alt+click saves a word)
- App modules: `levels.js` (CEFR estimates), `rewards.js` (coins, milestones, challenges, streaks), `progress.js`, `recap.js`, `words.js` (+ `data/freq`, CC BY-SA 4.0), `clans.js`, `ui.css` (design layer)
- `supabase/functions/spotify` — Spotify podcast tracker (runs on Supabase every minute; setup in `docs/SPOTIFY.md`)
- `docs/DEPLOY.md` — how to run your own copy and the checklist before going public
- `tests/` — end-to-end tests (`python tests/run_app_tests.py`) and SQL security checks (`tests/sql_test.sh`); GitHub runs both on every push
