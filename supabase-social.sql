-- Logbook update 2: goals & quick logs sync, friends, reactions, communities, study together.
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.
-- (Run supabase-setup.sql first if this is a brand-new project.)

-- ── Synced personal settings: goals, daily/weekly targets, quick logs, privacy ──
alter table public.profiles add column if not exists prefs jsonb not null default '{}';

-- ── Friends ────────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  requester  uuid not null default auth.uid() references auth.users on delete cascade,
  addressee  uuid not null references auth.users on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- ── Reactions on friends' logs ─────────────────────────────────────────────
create table if not exists public.reactions (
  log_id     uuid not null references public.logs on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  emoji      text not null check (emoji in ('👏','🔥','💪','❤️','🎉')),
  created_at timestamptz not null default now(),
  primary key (log_id, user_id)
);

-- ── Live status (what you're doing right now in Focus) ──────────────────────
create table if not exists public.presence (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  state      text not null default 'idle' check (state in ('idle','focus','paused','break')),
  subject    text check (length(subject) <= 60),
  type       text check (length(type) <= 40),
  ends_at    timestamptz,
  total_min  int,
  room       text check (length(room) <= 12),
  updated_at timestamptz not null default now()
);

alter table public.friendships enable row level security;
alter table public.reactions   enable row level security;
alter table public.presence    enable row level security;

drop policy if exists "friendships read" on public.friendships;
create policy "friendships read" on public.friendships for select to authenticated
  using (requester = auth.uid() or addressee = auth.uid());
-- writes to friendships and reactions go through the functions below

drop policy if exists "reactions read" on public.reactions;
create policy "reactions read" on public.reactions for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.logs l where l.id = reactions.log_id and l.user_id = auth.uid()));

drop policy if exists "presence own" on public.presence;
create policy "presence own" on public.presence for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select                         on public.friendships to authenticated;
grant select                         on public.reactions   to authenticated;
grant select, insert, update, delete on public.presence    to authenticated;
grant update (prefs)                 on public.profiles    to authenticated;

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships
                 where status = 'accepted'
                   and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;
revoke all on function public.is_friend(uuid, uuid) from public, anon;
grant execute on function public.is_friend(uuid, uuid) to authenticated;

-- Send a request by username. If they already asked you, this accepts it.
create or replace function public.friend_request(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare them uuid;
begin
  select id into them from public.profiles where username = lower(trim(both '@ ' from p_username));
  if them is null then return 'not_found'; end if;
  if them = auth.uid() then return 'self'; end if;
  if exists (select 1 from public.friendships where requester = them and addressee = auth.uid()) then
    update public.friendships set status = 'accepted' where requester = them and addressee = auth.uid();
    return 'accepted';
  end if;
  insert into public.friendships (requester, addressee) values (auth.uid(), them) on conflict do nothing;
  return (select status from public.friendships where requester = auth.uid() and addressee = them);
end $$;

-- Accept (p_accept = true) or decline/cancel/remove (false) a friendship with someone.
create or replace function public.friend_respond(p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted' where requester = p_user and addressee = auth.uid();
  else
    delete from public.friendships
     where (requester = p_user and addressee = auth.uid()) or (requester = auth.uid() and addressee = p_user);
  end if;
end $$;

-- Friends + requests, with today's and this week's minutes, streak and live status.
-- p_today is the caller's local date (so midnight matches your time zone).
create or replace function public.friends_overview(p_today date)
returns table (id uuid, username text, status text, today_min int, week_min int, top_subject text,
               streak int, state text, subject text, type text, ends_at timestamptz, total_min int, room text)
language sql stable security definer set search_path = public as $$
  with f as (
    select case when requester = auth.uid() then addressee else requester end as fid,
           case when status = 'accepted' then 'friend'
                when requester = auth.uid() then 'outgoing' else 'incoming' end as st
    from public.friendships where auth.uid() in (requester, addressee)
  )
  select f.fid, p.username, f.st,
    case when f.st = 'friend' then (select coalesce(sum(minutes),0)::int from public.logs where user_id = f.fid and d = p_today) end,
    case when f.st = 'friend' then (select coalesce(sum(minutes),0)::int from public.logs where user_id = f.fid and d between p_today - 6 and p_today) end,
    case when f.st = 'friend' then (select subject from public.logs where user_id = f.fid and d between p_today - 6 and p_today
                                     group by subject order by sum(minutes) desc limit 1) end,
    case when f.st = 'friend' then (
      with days as (select distinct d from public.logs where user_id = f.fid and d <= p_today),
           g as (select d, d - (row_number() over (order by d))::int as grp from days)
      select count(*)::int from g
       where grp = (select grp from g where d in (p_today, p_today - 1) order by d desc limit 1)) end,
    case when f.st = 'friend' and pr.updated_at > now() - interval '3 minutes' then pr.state end,
    case when f.st = 'friend' and pr.updated_at > now() - interval '3 minutes' then pr.subject end,
    case when f.st = 'friend' and pr.updated_at > now() - interval '3 minutes' then pr.type end,
    case when f.st = 'friend' and pr.updated_at > now() - interval '3 minutes' then pr.ends_at end,
    case when f.st = 'friend' and pr.updated_at > now() - interval '3 minutes' then pr.total_min end,
    case when f.st = 'friend' and pr.updated_at > now() - interval '3 minutes' then pr.room end
  from f join public.profiles p on p.id = f.fid
  left join public.presence pr on pr.user_id = f.fid
  order by (f.st = 'incoming') desc, p.username;
$$;

-- Friends' recent logs. Descriptions only if that friend allows it (Setup → Friends & privacy).
create or replace function public.friend_feed(p_days int default 14)
returns table (log_id uuid, user_id uuid, username text, d date, subject text, type text, minutes int,
               activity text, src text, created_at timestamptz, reactions jsonb, mine text)
language sql stable security definer set search_path = public as $$
  with fr as (
    select case when requester = auth.uid() then addressee else requester end as fid
    from public.friendships where status = 'accepted' and auth.uid() in (requester, addressee)
  )
  select l.id, l.user_id, p.username, l.d, l.subject, l.type, l.minutes,
         case when p.prefs->'social'->>'details' = 'true' then l.activity else '' end,
         l.src, l.created_at,
         coalesce((select jsonb_object_agg(x.emoji, x.n) from
                    (select emoji, count(*) n from public.reactions r where r.log_id = l.id group by emoji) x), '{}'::jsonb),
         (select emoji from public.reactions r where r.log_id = l.id and r.user_id = auth.uid())
  from public.logs l join fr on fr.fid = l.user_id join public.profiles p on p.id = l.user_id
  where l.d >= current_date - greatest(1, least(coalesce(p_days, 14), 60))
  order by l.d desc, l.created_at desc
  limit 200;
$$;

-- React to a friend's log (null emoji removes your reaction).
create or replace function public.react(p_log uuid, p_emoji text)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.logs where id = p_log;
  if owner is null or not public.is_friend(owner, auth.uid()) then raise exception 'not allowed'; end if;
  if p_emoji is null then
    delete from public.reactions where log_id = p_log and user_id = auth.uid();
  else
    insert into public.reactions (log_id, user_id, emoji) values (p_log, auth.uid(), p_emoji)
    on conflict (log_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end $$;

-- Reactions friends left on your logs recently.
create or replace function public.reactions_to_me(p_days int default 14)
returns table (username text, emoji text, created_at timestamptz, subject text, type text, minutes int, d date)
language sql stable security definer set search_path = public as $$
  select p.username, r.emoji, r.created_at, l.subject, l.type, l.minutes, l.d
  from public.reactions r join public.logs l on l.id = r.log_id join public.profiles p on p.id = r.user_id
  where l.user_id = auth.uid() and r.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 14), 60)))
  order by r.created_at desc limit 50;
$$;

-- ── Communities: only people who opted in (Setup → Friends & privacy) ───────
create or replace function public.community_boards(p_today date)
returns table (subject text, members int, week_min int)
language sql stable security definer set search_path = public as $$
  select l.subject, count(distinct l.user_id)::int,
         coalesce(sum(l.minutes) filter (where l.d between p_today - 6 and p_today), 0)::int
  from public.logs l join public.profiles p on p.id = l.user_id
  where p.prefs->'social'->>'community' = 'true' and l.d between p_today - 29 and p_today
  group by l.subject
  order by 2 desc, 3 desc
  limit 60;
$$;

create or replace function public.community(p_subject text, p_days int, p_today date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare n int := greatest(1, least(coalesce(p_days, 7), 365)); res jsonb;
begin
  with m as (
    select l.user_id, p.username, sum(l.minutes)::int as minutes
    from public.logs l join public.profiles p on p.id = l.user_id
    where l.subject = p_subject and l.d between p_today - (n - 1) and p_today
      and p.prefs->'social'->>'community' = 'true'
    group by l.user_id, p.username
  ), r as (
    select *, rank() over (order by minutes desc) as rk from m
  )
  select jsonb_build_object(
    'members',   (select count(*) from m),
    'total_min', (select coalesce(sum(minutes), 0) from m),
    'median_min',(select coalesce(percentile_cont(0.5) within group (order by minutes), 0) from m),
    'top',       (select coalesce(jsonb_agg(jsonb_build_object('username', username, 'minutes', minutes, 'rank', rk,
                                                               'me', user_id = auth.uid()) order by rk, username), '[]'::jsonb)
                  from (select * from r order by rk limit 20) t),
    'me',        (select jsonb_build_object('minutes', minutes, 'rank', rk) from r where user_id = auth.uid()),
    'by_type',   (select coalesce(jsonb_object_agg(type, minutes), '{}'::jsonb) from (
                    select l.type, sum(l.minutes)::int minutes
                    from public.logs l join public.profiles p on p.id = l.user_id
                    where l.subject = p_subject and l.d between p_today - (n - 1) and p_today
                      and p.prefs->'social'->>'community' = 'true'
                    group by l.type) bt),
    'now',       (select count(*) from public.presence pr join public.profiles p on p.id = pr.user_id
                  where pr.subject = p_subject and pr.state = 'focus' and pr.updated_at > now() - interval '3 minutes'
                    and p.prefs->'social'->>'community' = 'true')
  ) into res;
  return res;
end $$;

revoke all on function public.friend_request(text)          from public, anon;
revoke all on function public.friend_respond(uuid, boolean) from public, anon;
revoke all on function public.friends_overview(date)        from public, anon;
revoke all on function public.friend_feed(int)              from public, anon;
revoke all on function public.react(uuid, text)             from public, anon;
revoke all on function public.reactions_to_me(int)          from public, anon;
revoke all on function public.community_boards(date)        from public, anon;
revoke all on function public.community(text, int, date)    from public, anon;
grant execute on function public.friend_request(text)          to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friends_overview(date)        to authenticated;
grant execute on function public.friend_feed(int)              to authenticated;
grant execute on function public.react(uuid, text)             to authenticated;
grant execute on function public.reactions_to_me(int)          to authenticated;
grant execute on function public.community_boards(date)        to authenticated;
grant execute on function public.community(text, int, date)    to authenticated;
