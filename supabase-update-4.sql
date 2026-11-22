-- Logbook update 4: resources library, exam & practice scores, blocking, abuse limits,
-- reserved usernames, error reports, and private study rooms.
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.

-- ── Resources (books, podcasts, series, courses…) ──────────────────────────
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null check (length(title) between 1 and 120),
  kind        text not null default 'book' check (kind in ('book','podcast','series','course','video','app','other')),
  subject     text check (length(subject) <= 60),
  unit        text not null default 'pages' check (length(unit) between 1 and 20),
  total       int  check (total is null or total between 1 and 100000),
  progress    int  not null default 0 check (progress between 0 and 100000),
  status      text not null default 'active' check (status in ('active','paused','done','dropped')),
  url         text check (length(url) <= 500),
  notes       text check (length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  finished_at date
);
create index if not exists resources_user on public.resources (user_id, status);
alter table public.logs add column if not exists resource_id uuid references public.resources on delete set null;
create index if not exists logs_resource on public.logs (resource_id) where resource_id is not null;

-- ── Exam & practice scores ────────────────────────────────────────────────
create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  d          date not null,
  exam       text not null check (length(exam) between 1 and 60),
  subject    text check (length(subject) <= 60),
  parts      jsonb not null default '[]' check (jsonb_typeof(parts) = 'array' and pg_column_size(parts) < 8000),
  total      numeric check (total is null or total between 0 and 100000),
  max_total  numeric check (max_total is null or max_total between 0 and 100000),
  notes      text check (length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists scores_user on public.scores (user_id, d desc);

alter table public.resources enable row level security;
alter table public.scores    enable row level security;
-- your own rows, and read-only for people you share your logbook with
drop policy if exists "resources own" on public.resources;
create policy "resources own" on public.resources for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "resources shared read" on public.resources;
create policy "resources shared read" on public.resources for select to authenticated
  using (exists (select 1 from public.shares s where s.owner = resources.user_id and s.viewer = auth.uid()));
drop policy if exists "scores own" on public.scores;
create policy "scores own" on public.scores for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "scores shared read" on public.scores;
create policy "scores shared read" on public.scores for select to authenticated
  using (exists (select 1 from public.shares s where s.owner = scores.user_id and s.viewer = auth.uid()));
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert, update, delete on public.scores    to authenticated;

-- ── Blocking ───────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker    uuid not null default auth.uid() references auth.users on delete cascade,
  blocked    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "blocks own" on public.blocks;
create policy "blocks own" on public.blocks for all to authenticated using (blocker = auth.uid()) with check (blocker = auth.uid());
grant select, insert, delete on public.blocks to authenticated;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;
revoke all on function public.is_blocked(uuid, uuid) from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- Block someone: ends any friendship or request, and they can't send new ones.
create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  insert into public.blocks (blocker, blocked) values (auth.uid(), p_user) on conflict do nothing;
  delete from public.friendships where (requester = p_user and addressee = auth.uid()) or (requester = auth.uid() and addressee = p_user);
  delete from public.shares where (owner = p_user and viewer = auth.uid()) or (owner = auth.uid() and viewer = p_user);
end $$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- Friend requests: blocked people look like they don't exist; at most 30 requests a day.
create or replace function public.friend_request(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare them uuid;
begin
  select id into them from public.profiles where username = lower(trim(both '@ ' from p_username));
  if them is null or public.is_blocked(them, auth.uid()) then return 'not_found'; end if;
  if them = auth.uid() then return 'self'; end if;
  if exists (select 1 from public.friendships where requester = them and addressee = auth.uid()) then
    update public.friendships set status = 'accepted' where requester = them and addressee = auth.uid();
    return 'accepted';
  end if;
  if (select count(*) from public.friendships where requester = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    return 'rate_limited';
  end if;
  insert into public.friendships (requester, addressee) values (auth.uid(), them) on conflict do nothing;
  return (select status from public.friendships where requester = auth.uid() and addressee = them);
end $$;

-- ── Reserved usernames ─────────────────────────────────────────────────────
create or replace function public.check_username()
returns trigger language plpgsql as $$
begin
  if new.username in ('admin','administrator','root','support','help','logbook','system','moderator','mod','staff',
                      'official','security','api','www','mail','null','undefined','anonymous','team','owner') then
    raise exception 'That username is reserved' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists profiles_username_check on public.profiles;
create trigger profiles_username_check before insert or update of username on public.profiles
  for each row execute function public.check_username();

-- ── Size limits so one account can't fill the database ──────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_prefs_size') then
    alter table public.profiles add constraint profiles_prefs_size check (pg_column_size(prefs) < 250000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_sessions_size') then
    alter table public.focus_sessions add constraint focus_sessions_size check (pg_column_size(data) < 8000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'focus_awards_size') then
    alter table public.focus_awards add constraint focus_awards_size check (pg_column_size(data) < 2000) not valid;
  end if;
end $$;

-- ── Error reports from the app (helps fix bugs once other people use it) ─────
create table if not exists public.client_errors (
  id      bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users on delete set null,
  at      timestamptz not null default now(),
  msg     text check (length(msg) <= 500),
  stack   text check (length(stack) <= 4000),
  url     text check (length(url) <= 300),
  ua      text check (length(ua) <= 300),
  v       text check (length(v) <= 40)
);
alter table public.client_errors enable row level security;
drop policy if exists "errors insert" on public.client_errors;
create policy "errors insert" on public.client_errors for insert to authenticated with check (user_id = auth.uid());
grant insert on public.client_errors to authenticated;
-- (nobody can read them through the app; you read them in the Supabase dashboard)

-- ── Private study rooms (only members can listen or send) ───────────────────
create table if not exists public.room_members (
  code      text not null check (code ~ '^[A-Z0-9]{4,8}$'),
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.room_members enable row level security;
drop policy if exists "room_members own" on public.room_members;
create policy "room_members own" on public.room_members for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.room_members to authenticated;

create or replace function public.join_room(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.room_members (code, user_id) values (upper(p_code), auth.uid()) on conflict do nothing;
  delete from public.room_members where user_id = auth.uid() and joined_at < now() - interval '30 days';
end $$;
revoke all on function public.join_room(text) from public, anon;
grant execute on function public.join_room(text) to authenticated;

do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "lb rooms listen" on realtime.messages';
    execute 'create policy "lb rooms listen" on realtime.messages for select to authenticated using (
      exists (select 1 from public.room_members m where m.user_id = auth.uid() and ''lb-room-'' || m.code = realtime.topic()))';
    execute 'drop policy if exists "lb rooms send" on realtime.messages';
    execute 'create policy "lb rooms send" on realtime.messages for insert to authenticated with check (
      exists (select 1 from public.room_members m where m.user_id = auth.uid() and ''lb-room-'' || m.code = realtime.topic()))';
  end if;
end $$;

-- Names of the people in a room you're in (so the app shows real usernames, never ones a member typed)
create or replace function public.room_names(p_code text)
returns table (user_id uuid, username text) language sql stable security definer set search_path = public as $$
  select m.user_id, p.username from public.room_members m join public.profiles p on p.id = m.user_id
  where m.code = upper(p_code) and exists (select 1 from public.room_members x where x.code = upper(p_code) and x.user_id = auth.uid());
$$;
revoke all on function public.room_names(text) from public, anon;
grant execute on function public.room_names(text) to authenticated;

-- People you've blocked, with their usernames
create or replace function public.blocked_list()
returns table (id uuid, username text) language sql stable security definer set search_path = public as $$
  select b.blocked, p.username from public.blocks b join public.profiles p on p.id = b.blocked where b.blocker = auth.uid() order by p.username;
$$;
revoke all on function public.blocked_list() from public, anon;
grant execute on function public.blocked_list() to authenticated;
