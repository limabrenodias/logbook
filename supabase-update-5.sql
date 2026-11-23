-- Logbook update 5: Anki deck statistics and the Spotify tracker.
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.

-- ── Anki statistics (sent by the Anki add-on once a day per deck) ───────────
create table if not exists public.anki_stats (
  user_id uuid not null references auth.users on delete cascade,
  d       date not null,
  deck    text not null check (length(deck) <= 200),
  subject text check (length(subject) <= 60),
  data    jsonb not null check (pg_column_size(data) < 4000),
  primary key (user_id, d, deck)
);
alter table public.anki_stats enable row level security;
drop policy if exists "anki_stats own" on public.anki_stats;
create policy "anki_stats own" on public.anki_stats for select to authenticated using (user_id = auth.uid());
drop policy if exists "anki_stats shared read" on public.anki_stats;
create policy "anki_stats shared read" on public.anki_stats for select to authenticated
  using (exists (select 1 from public.shares s where s.owner = anki_stats.user_id and s.viewer = auth.uid()));
grant select on public.anki_stats to authenticated;

create or replace function public.ingest_stats(p_token text, p_stats jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid; n int;
begin
  select user_id into uid from public.ingest_tokens where token = p_token;
  if uid is null then raise exception 'invalid token' using errcode = '28000'; end if;
  if jsonb_typeof(p_stats) <> 'array' or jsonb_array_length(p_stats) > 100 then
    raise exception 'p_stats must be an array of at most 100 decks';
  end if;
  insert into public.anki_stats (user_id, d, deck, subject, data)
  select uid, (s->>'date')::date, left(s->>'deck', 200), left(s->>'subject', 60), coalesce(s->'data', '{}'::jsonb)
  from jsonb_array_elements(p_stats) s where s->>'deck' is not null and s->>'date' is not null
  on conflict (user_id, d, deck) do update set subject = excluded.subject, data = excluded.data;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.ingest_stats(text, jsonb) from public;
grant execute on function public.ingest_stats(text, jsonb) to anon, authenticated;

-- ── Spotify tracker ────────────────────────────────────────────────────────
-- Tokens live here and are only ever read by the Edge Function (service role): no policy lets the app read them.
create table if not exists public.spotify_links (
  user_id       uuid primary key references auth.users on delete cascade,
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz,
  spotify_name  text,
  connected_at  timestamptz not null default now(),
  last_poll     timestamptz,
  last_error    text,
  state         jsonb not null default '{}'::jsonb,   -- what's playing now (being counted)
  seen          jsonb not null default '{}'::jsonb    -- shows heard recently, so the app can offer language choices
);
alter table public.spotify_links enable row level security;
create table if not exists public.spotify_states (
  state      text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.spotify_states enable row level security;

-- What the app may know: connected or not, when it last checked, and the shows it saw.
create or replace function public.spotify_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('connected', true, 'name', spotify_name, 'since', connected_at,
                     'last_poll', last_poll, 'error', last_error, 'seen', seen, 'now', state)
                   from public.spotify_links where user_id = auth.uid()), jsonb_build_object('connected', false));
$$;
create or replace function public.spotify_disconnect()
returns void language sql security definer set search_path = public as $$
  delete from public.spotify_links where user_id = auth.uid();
$$;
revoke all on function public.spotify_status() from public, anon;
revoke all on function public.spotify_disconnect() from public, anon;
grant execute on function public.spotify_status() to authenticated;
grant execute on function public.spotify_disconnect() to authenticated;

-- ── Run the Spotify check every minute ─────────────────────────────────────
-- AFTER you've deployed the "spotify" Edge Function (see docs/SPOTIFY.md), run this block once,
-- replacing YOUR-CRON-SECRET with the same value you saved as the CRON_SECRET secret:
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   select cron.schedule('spotify-poll', '* * * * *', $cron$
--     select net.http_post(
--       url := 'https://bhbvnjcyubwrnebgewmj.supabase.co/functions/v1/spotify/poll',
--       headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','YOUR-CRON-SECRET'),
--       body := '{}'::jsonb, timeout_milliseconds := 25000);
--   $cron$);
--
-- To stop it later:  select cron.unschedule('spotify-poll');
