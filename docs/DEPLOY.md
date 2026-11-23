# Running Logbook (and going public)

Logbook is a static site (GitHub Pages) talking to one Supabase project. There's no server of its own.

## 1. Supabase project

1. Create a project at supabase.com (pick an EU region if your users are in Europe).
2. **SQL Editor → New query**, run these files **in this order** (each is safe to run again):
   1. `supabase-setup.sql` — profiles, logs, sharing, timers, tracker tokens
   2. `supabase-social.sql` — synced settings, friends, reactions, live status, communities
   3. `supabase-update-3.sql` — Focus sessions & points sync, account deletion
   4. `supabase-update-4.sql` — resources, scores, blocking, limits, error reports, private rooms
   5. `supabase-update-5.sql` — Anki deck statistics, Spotify tracker
   6. `supabase-update-6.sql` — trackers show your own subjects and activity types
   7. `supabase-update-7.sql` — saved words, clans with shared goals and kudos, friends saving streaks
3. **Project Settings → API keys**: copy the *publishable* key into `config.js`. Never put the secret / `service_role` key in the site.
4. **Authentication → URL Configuration**: Site URL = your site address (e.g. `https://limabrenodias.github.io/logbook/`), and add the same address to Redirect URLs.

## 2. Before letting strangers sign up

- **Email (Authentication → Emails → SMTP Settings):** Supabase's built-in email is only for testing and sends very few emails per hour. Connect a real provider (Resend, Brevo, Postmark, Amazon SES…), otherwise sign-up confirmations and password resets stop arriving.
- **CAPTCHA (Authentication → Attack Protection):** turn on Cloudflare Turnstile, create a Turnstile site at dash.cloudflare.com, put the **secret** in Supabase and the **site key** in `config.js → turnstileSiteKey`. The sign-in form shows the check automatically.
- **Passwords (Authentication → Policies / Attack Protection):** minimum length 8+, and turn on leaked-password protection if your plan has it.
- **Realtime (Project Settings → Realtime):** after running update 4, turn **off** "Allow public access" so study rooms are private (members only). The app falls back to open rooms if this isn't set yet.
- **Legal pages:** fill in the placeholders in `privacy.html` and `terms.html` (name, contact, Supabase region) and `config.js → contactEmail`, and have them checked.
- **Backups:** the free plan doesn't include point-in-time recovery. Consider a paid plan before you have users who depend on it, or export regularly.
- **Free plan pausing:** free projects can be paused after a period of inactivity; a paid plan avoids that.

## 3. Hosting

GitHub Pages serves the repository root. Every script and stylesheet is loaded with `?v=YYYYMMDDHHMM`; bump that number in `index.html` when you change them so browsers fetch the new files. `sw.js` (offline support) picks the new files up automatically.

A custom domain: add a `CNAME` file and set it under the repo's **Settings → Pages**, then update the Site URL in Supabase and the CSP in `index.html` if you load anything from new places.

## 4. Watching it

- **Errors:** Table Editor → `client_errors` (message, page, browser, app version). Nobody can read it from the app.
- **Database size and usage:** Supabase → Reports.
- **Abuse:** friend requests are limited to 30 a day per person; blocked people can't find or contact the person who blocked them. Reserved usernames (admin, support, …) are refused.

## 5. Trackers

- **Browser tracker (Brave/Chrome/Edge):** `extension/logbook-tracker.zip` — watching, listening, reading and writing in the languages you study. Load unpacked in developer mode for now; for public use, publish it on the Chrome Web Store (one-time developer fee) and change the Supabase URL/key in `extension/tracker/background.js` if you fork the project.
- **Anki:** `extension/logbook-anki.ankiaddon` (Tools → Add-ons → Install from file). For public use, upload it to ankiweb.net/shared/addons. The Supabase URL/key are in `extension/anki/logbook_anki/core.py`.
- Both send to the `ingest` function with a token the user creates in Setup → Connections.

## 6. Tests

`tests/` runs the whole app in a browser against an in-memory stand-in for Supabase, and the SQL files against a real Postgres. GitHub runs them on every push (`.github/workflows/tests.yml`). Locally:

```
pip install playwright && playwright install chromium
python tests/run_app_tests.py
```
