-- Logbook database setup — paste into Supabase: SQL Editor → New query → Run.
-- Safe to run more than once.

-- ── Profiles: username + personal settings ────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  focus      text,
  subjects   text[] not null default '{}',
  types      text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ── Logs ──────────────────────────────────────────────────────────────────
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  d          date not null,
  subject    text not null check (length(subject) between 1 and 60),
  type       text not null check (length(type) between 1 and 40),
  minutes    int  not null check (minutes between 1 and 1440),
  activity   text not null default '' check (length(activity) <= 300),
  src        text not null default 'manual',   -- manual | stopwatch | timer | polylogger | anki | youtube | spotify …
  ext_id     text,                             -- set by trackers so re-sending updates instead of duplicating
  created_at timestamptz not null default now(),
  unique (user_id, src, ext_id)
);
create index if not exists logs_user_date on public.logs (user_id, d desc);

-- ── Running stopwatch / timer (one per person, synced across devices) ───────
create table if not exists public.timers (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Sharing: owner lets viewer read their logbook ──────────────────────────
create table if not exists public.shares (
  owner  uuid not null default auth.uid() references auth.users on delete cascade,
  viewer uuid not null references auth.users on delete cascade,
  primary key (owner, viewer),
  check (owner <> viewer)
);

-- ── Connection tokens for Anki / YouTube / Spotify trackers ───────────────
create table if not exists public.ingest_tokens (
  token      text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null default 'Tracker',
  created_at timestamptz not null default now()
);

-- ── Row-level security: everyone sees only their own data (+ what's shared) ─
alter table public.profiles      enable row level security;
alter table public.logs          enable row level security;
alter table public.timers        enable row level security;
alter table public.shares        enable row level security;
alter table public.ingest_tokens enable row level security;

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid()
         or exists (select 1 from public.shares s where s.owner = profiles.id and s.viewer = auth.uid())
         or exists (select 1 from public.shares s where s.viewer = profiles.id and s.owner = auth.uid()));
create policy "profiles insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "logs read"   on public.logs;
drop policy if exists "logs insert" on public.logs;
drop policy if exists "logs update" on public.logs;
drop policy if exists "logs delete" on public.logs;
create policy "logs read" on public.logs for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.shares s where s.owner = logs.user_id and s.viewer = auth.uid()));
create policy "logs insert" on public.logs for insert to authenticated with check (user_id = auth.uid());
create policy "logs update" on public.logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "logs delete" on public.logs for delete to authenticated using (user_id = auth.uid());

drop policy if exists "timers own" on public.timers;
create policy "timers own" on public.timers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "shares read"   on public.shares;
drop policy if exists "shares insert" on public.shares;
drop policy if exists "shares delete" on public.shares;
create policy "shares read"   on public.shares for select to authenticated using (owner = auth.uid() or viewer = auth.uid());
create policy "shares insert" on public.shares for insert to authenticated with check (owner = auth.uid());
create policy "shares delete" on public.shares for delete to authenticated using (owner = auth.uid() or viewer = auth.uid());

drop policy if exists "tokens own" on public.ingest_tokens;
create policy "tokens own" on public.ingest_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Look up a person by username (to share with them) ──────────────────────
create or replace function public.find_user(p_username text)
returns uuid language sql security definer set search_path = public stable as $$
  select id from public.profiles where username = lower(trim(p_username));
$$;
revoke all on function public.find_user(text) from public, anon;
grant execute on function public.find_user(text) to authenticated;

-- ── Trackers send sessions here with their connection token ────────────────
-- POST /rest/v1/rpc/ingest  {"p_token": "...", "p_entries": [{"date":"2026-11-19","subject":"French",
--   "type":"Vocabulary","minutes":23,"activity":"Anki · Français::C1","src":"anki","ext_id":"2026-11-19|123456"}]}
create or replace function public.ingest(p_token text, p_entries jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid; n int;
begin
  select user_id into uid from public.ingest_tokens where token = p_token;
  if uid is null then raise exception 'invalid token' using errcode = '28000'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 500 then
    raise exception 'p_entries must be an array of at most 500 entries';
  end if;
  insert into public.logs (user_id, d, subject, type, minutes, activity, src, ext_id)
  select uid,
         (e->>'date')::date,
         left(e->>'subject', 60),
         left(coalesce(nullif(e->>'type', ''), 'Mixed'), 40),
         greatest(1, least(1440, round((e->>'minutes')::numeric)::int)),
         left(coalesce(e->>'activity', ''), 300),
         left(coalesce(nullif(e->>'src', ''), 'auto'), 30),
         e->>'ext_id'
  from jsonb_array_elements(p_entries) e
  where e->>'subject' is not null and (e->>'minutes')::numeric >= 0.5
  on conflict (user_id, src, ext_id) do update
    set minutes = excluded.minutes, activity = excluded.activity,
        subject = excluded.subject, type = excluded.type, d = excluded.d;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.ingest(text, jsonb) from public;
grant execute on function public.ingest(text, jsonb) to anon, authenticated;
-- ── Table permissions for signed-in users (row-level security still decides WHICH rows) ──
grant usage on schema public to anon, authenticated;
grant select, insert, update         on public.profiles      to authenticated;
grant select, insert, update, delete on public.logs          to authenticated;
grant select, insert, update, delete on public.timers        to authenticated;
grant select, insert, delete         on public.shares        to authenticated;
grant select, insert, delete         on public.ingest_tokens to authenticated;
