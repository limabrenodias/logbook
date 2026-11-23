# Spotify tracker — one-time setup (about 15 minutes)

Every minute, Supabase asks Spotify what you're playing, so this counts listening on your phone, computer or in the car without anything installed.
Time only counts while an episode is really playing. Each minute counts the smaller of two numbers: the clock time that passed and how far the episode moved. So pausing, skipping ahead or listening at 2× never inflate the total. An item is logged once it reaches 2 minutes, and the log keeps growing as you listen.

**Your Spotify passwords and tokens never reach the website.** They are stored in a table the app can't read, and only the function on Supabase uses them.

## 1. Create a Spotify app
1. Go to <https://developer.spotify.com/dashboard> → **Create app**.
2. Fill it in:
   - Name: `Logbook`.
   - Redirect URI: `https://bhbvnjcyubwrnebgewmj.supabase.co/functions/v1/spotify/callback`
   - Tick **Web API**, then save.
3. Open **Settings** and copy the **Client ID** and **Client secret**.
4. New Spotify apps start in *development mode*, which only works for people you add. Go to **User Management** and add the Spotify email of everyone who will connect (you, Aleksandra). Opening it to the public later needs Spotify's approval ("extended quota").

## 2. Run the database update
In Supabase, open **SQL Editor**, paste all of `supabase-update-5.sql`, then click **Run**. This also adds the Anki statistics table. Skip this step if you already ran it.

## 3. Deploy the function
1. In Supabase, open **Edge Functions** → **Deploy a new function** → **Via editor**.
2. Name it exactly `spotify`.
3. Paste the whole content of `supabase/functions/spotify/index.ts` from the repo.
4. Deploy it.
5. Open the function's **Details** and turn **Verify JWT** OFF. The function checks sign-ins itself, and Spotify's redirect has no Supabase token.

## 4. Add the secrets
In **Edge Functions** → **Secrets**, add:

| Name | Value |
|---|---|
| `SPOTIFY_CLIENT_ID` | from step 1 |
| `SPOTIFY_CLIENT_SECRET` | from step 1 |
| `CRON_SECRET` | any long random text you make up, e.g. 40 random letters |
| `APP_URL` | `https://limabrenodias.github.io/logbook/` |

`SUPABASE_URL` and the service key are already built in. Don't add them, and never paste your secret key anywhere else.

## 5. Turn on the every-minute check
In **SQL Editor**, run the block below. Replace `YOUR-CRON-SECRET` with your `CRON_SECRET` value from step 4:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('spotify-poll', '* * * * *', $cron$
  select net.http_post(
    url := 'https://bhbvnjcyubwrnebgewmj.supabase.co/functions/v1/spotify/poll',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','YOUR-CRON-SECRET'),
    body := '{}'::jsonb, timeout_milliseconds := 25000);
$cron$);
```

To stop it later: `select cron.unschedule('spotify-poll');`

## 6. Connect
1. In Logbook, open **Setup** → **Spotify** → **Connect Spotify** and approve the access.
2. Play a podcast. Within a minute or two it shows up under "Shows you listened to".
3. Episodes in a language you ticked are logged automatically, as Listening.
4. For a show with the wrong or missing language, pick its language once in the list, or choose **Never log**. Minutes already listened that day are logged straight away.
5. Music is off by default. Turn it on if you want to count songs, then give a language to the artists you want counted.

## If something's wrong
- The Spotify card shows the last error.
- **403** means the person isn't added under User Management (step 1).
- **Nothing happens:** check **Edge Functions** → `spotify` → **Logs**, and check that the cron job runs: `select * from cron.job_run_details order by start_time desc limit 5;`
