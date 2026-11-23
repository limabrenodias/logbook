-- Logbook update 7: saved words, clans with shared goals and kudos, and friends saving your streak.
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.

-- ── Saved words (Alt+click a word with the browser tracker, or add them in Logs → Words) ──────────
create table if not exists public.words (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  lang       text not null check (char_length(lang) between 1 and 40),
  word       text not null check (char_length(word) between 1 and 80),
  sentence   text not null default '' check (char_length(sentence) <= 500),
  source     text not null default '' check (char_length(source) <= 200),
  url        text not null default '' check (char_length(url) <= 500),
  status     text not null default 'new' check (status in ('new','learning','known')),
  seen       int  not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  anki_at    timestamptz,
  unique (user_id, lang, word)
);
alter table public.words enable row level security;
drop policy if exists "words own" on public.words;
create policy "words own" on public.words for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.words to authenticated;
create index if not exists words_user_created on public.words (user_id, created_at desc);

-- the tracker sends words with your token: [{"lang":"French","word":"épanouir","sentence":"…","source":"Le Monde","url":"https://…"}]
create or replace function public.ingest_words(p_token text, p_words jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid; w jsonb; n int := 0; total int;
begin
  select user_id into uid from public.ingest_tokens where token = p_token;
  if uid is null then raise exception 'invalid token' using errcode = '28000'; end if;
  if jsonb_typeof(p_words) <> 'array' or jsonb_array_length(p_words) > 100 then raise exception 'send 1–100 words at a time'; end if;
  select count(*) into total from public.words where user_id = uid;
  for w in select * from jsonb_array_elements(p_words) loop
    if coalesce(trim(w->>'word'), '') = '' or coalesce(trim(w->>'lang'), '') = '' then continue; end if;
    if total >= 20000 then exit; end if;
    insert into public.words (user_id, lang, word, sentence, source, url)
    values (uid, left(trim(w->>'lang'), 40), left(lower(trim(w->>'word')), 80), left(coalesce(w->>'sentence', ''), 500),
            left(coalesce(w->>'source', ''), 200), left(coalesce(w->>'url', ''), 500))
    on conflict (user_id, lang, word) do update
      set seen = public.words.seen + 1, updated_at = now(),
          sentence = case when excluded.sentence <> '' then excluded.sentence else public.words.sentence end,
          source   = case when excluded.sentence <> '' then excluded.source   else public.words.source end,
          url      = case when excluded.sentence <> '' then excluded.url      else public.words.url end;
    n := n + 1; total := total + 1;
  end loop;
  return n;
end $$;
revoke all on function public.ingest_words(text, jsonb) from public;
grant execute on function public.ingest_words(text, jsonb) to anon, authenticated;

-- the Anki add-on asks for words not yet in Anki, then marks the ones it added
create or replace function public.token_words(p_token text)
returns table (id uuid, lang text, word text, sentence text, source text, url text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare uid uuid;
begin
  select t.user_id into uid from public.ingest_tokens t where t.token = p_token;
  if uid is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return query select w.id, w.lang, w.word, w.sentence, w.source, w.url, w.created_at from public.words w
    where w.user_id = uid and w.anki_at is null and w.status <> 'known' order by w.created_at limit 500;
end $$;
revoke all on function public.token_words(text) from public;
grant execute on function public.token_words(text) to anon, authenticated;

create or replace function public.words_mark_anki(p_token text, p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid; n int;
begin
  select user_id into uid from public.ingest_tokens where token = p_token;
  if uid is null then raise exception 'invalid token' using errcode = '28000'; end if;
  update public.words set anki_at = now(), status = case when status = 'new' then 'learning' else status end
   where user_id = uid and id = any (p_ids[1:500]);
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.words_mark_anki(text, uuid[]) from public;
grant execute on function public.words_mark_anki(text, uuid[]) to anon, authenticated;

-- ── Clans: invite-only groups with weekly and monthly shared goals ─────────────────────────────────
create table if not exists public.clans (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 40),
  tag          text not null check (tag ~ '^[A-Z0-9]{2,5}$'),
  about        text not null default '' check (char_length(about) <= 200),
  subject      text check (subject is null or char_length(subject) between 1 and 60),
  code         text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  weekly_goal  int  not null default 600  check (weekly_goal between 0 and 100000),
  monthly_goal int  not null default 2400 check (monthly_goal between 0 and 400000),
  created_at   timestamptz not null default now()
);
create table if not exists public.clan_members (
  clan_id   uuid not null references public.clans on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);
create table if not exists public.clan_kudos (
  clan_id    uuid not null references public.clans on delete cascade,
  from_user  uuid not null references auth.users on delete cascade,
  to_user    uuid not null references auth.users on delete cascade,
  d          date not null,
  created_at timestamptz not null default now(),
  primary key (clan_id, from_user, to_user, d),
  check (from_user <> to_user)
);
alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_kudos enable row level security;

create or replace function public.in_clan(p_clan uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clan_members where clan_id = p_clan and user_id = p_user);
$$;
drop policy if exists "clans members read" on public.clans;
create policy "clans members read" on public.clans for select to authenticated using (public.in_clan(id, auth.uid()));
drop policy if exists "clan_members read" on public.clan_members;
create policy "clan_members read" on public.clan_members for select to authenticated using (public.in_clan(clan_id, auth.uid()));
drop policy if exists "clan_kudos read" on public.clan_kudos;
create policy "clan_kudos read" on public.clan_kudos for select to authenticated using (public.in_clan(clan_id, auth.uid()));
grant select on public.clans, public.clan_members, public.clan_kudos to authenticated;

create or replace function public.clan_code()
returns text language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 8);
$$;

-- someone always owns the clan: if the owner left or deleted their account, the longest-standing member takes over
create or replace function public.clan_fix_owner(p_clan uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.clan_members where clan_id = p_clan and role = 'owner') then
    update public.clan_members set role = 'owner'
     where clan_id = p_clan and user_id = (select user_id from public.clan_members where clan_id = p_clan order by joined_at limit 1);
  end if;
  if not exists (select 1 from public.clan_members where clan_id = p_clan) then delete from public.clans where id = p_clan; end if;
end $$;
revoke all on function public.clan_fix_owner(uuid) from public, anon, authenticated;

create or replace function public.clan_create(p_name text, p_tag text, p_about text, p_subject text, p_weekly int, p_monthly int)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; c text;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if (select count(*) from public.clan_members where user_id = auth.uid()) >= 5 then raise exception 'You can be in up to 5 clans'; end if;
  loop c := public.clan_code(); exit when not exists (select 1 from public.clans where code = c); end loop;
  insert into public.clans (name, tag, about, subject, code, weekly_goal, monthly_goal)
  values (trim(p_name), upper(trim(p_tag)), coalesce(trim(p_about), ''), nullif(trim(coalesce(p_subject, '')), ''), c,
          greatest(0, coalesce(p_weekly, 600)), greatest(0, coalesce(p_monthly, 2400)))
  returning id into cid;
  insert into public.clan_members (clan_id, user_id, role) values (cid, auth.uid(), 'owner');
  return cid;
end $$;

create or replace function public.clan_join(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cl public.clans; own uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into cl from public.clans where code = upper(trim(p_code));
  if cl.id is null then raise exception 'No clan with that code'; end if;
  if public.in_clan(cl.id, auth.uid()) then return cl.id; end if;
  if (select count(*) from public.clan_members where user_id = auth.uid()) >= 5 then raise exception 'You can be in up to 5 clans'; end if;
  if (select count(*) from public.clan_members where clan_id = cl.id) >= 30 then raise exception 'This clan is full (30 members)'; end if;
  select user_id into own from public.clan_members where clan_id = cl.id and role = 'owner';
  if own is not null and public.is_blocked(own, auth.uid()) then raise exception 'No clan with that code'; end if;
  insert into public.clan_members (clan_id, user_id) values (cl.id, auth.uid());
  return cl.id;
end $$;

create or replace function public.clan_leave(p_clan uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.clan_members where clan_id = p_clan and user_id = auth.uid();
  perform public.clan_fix_owner(p_clan);
end $$;

create or replace function public.clan_is_owner(p_clan uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clan_members where clan_id = p_clan and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.clan_update(p_clan uuid, p_name text, p_tag text, p_about text, p_subject text, p_weekly int, p_monthly int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.clan_is_owner(p_clan) then raise exception 'Only the clan owner can change this'; end if;
  update public.clans set name = trim(p_name), tag = upper(trim(p_tag)), about = coalesce(trim(p_about), ''),
         subject = nullif(trim(coalesce(p_subject, '')), ''), weekly_goal = greatest(0, p_weekly), monthly_goal = greatest(0, p_monthly)
   where id = p_clan;
end $$;

create or replace function public.clan_kick(p_clan uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.clan_is_owner(p_clan) or p_user = auth.uid() then raise exception 'Only the clan owner can remove members'; end if;
  delete from public.clan_members where clan_id = p_clan and user_id = p_user;
end $$;

create or replace function public.clan_new_code(p_clan uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.clan_is_owner(p_clan) then raise exception 'Only the clan owner can change the invite code'; end if;
  loop c := public.clan_code(); exit when not exists (select 1 from public.clans where code = c); end loop;
  update public.clans set code = c where id = p_clan; return c;
end $$;

-- minutes that count for a clan: all your logs, or only one subject if the clan picked one
create or replace function public.clan_minutes(p_clan uuid, p_user uuid, p_from date, p_to date)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(l.minutes), 0)::int from public.logs l, public.clans c
   where c.id = p_clan and l.user_id = p_user and l.d between p_from and p_to and (c.subject is null or l.subject = c.subject);
$$;
revoke all on function public.clan_minutes(uuid, uuid, date, date) from public, anon, authenticated;

-- your clans with this week's and this month's progress (p_today = your local date)
create or replace function public.my_clans(p_today date)
returns table (id uuid, name text, tag text, about text, subject text, code text, role text, members int,
               weekly_goal int, week_min int, monthly_goal int, month_min int)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.tag, c.about, c.subject, c.code, m.role,
         (select count(*)::int from public.clan_members x where x.clan_id = c.id),
         c.weekly_goal,
         (select coalesce(sum(public.clan_minutes(c.id, x.user_id, date_trunc('week', p_today)::date, p_today)), 0)::int from public.clan_members x where x.clan_id = c.id),
         c.monthly_goal,
         (select coalesce(sum(public.clan_minutes(c.id, x.user_id, date_trunc('month', p_today)::date, p_today)), 0)::int from public.clan_members x where x.clan_id = c.id)
  from public.clans c join public.clan_members m on m.clan_id = c.id and m.user_id = auth.uid()
  order by m.joined_at;
$$;

-- one clan in detail: members' minutes, kudos, and the last 12 weeks and 6 months against the goals
create or replace function public.clan_detail(p_clan uuid, p_today date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cl public.clans; ws date := date_trunc('week', p_today)::date; ms date := date_trunc('month', p_today)::date; out jsonb;
begin
  if not public.in_clan(p_clan, auth.uid()) then raise exception 'not a member'; end if;
  select * into cl from public.clans where id = p_clan;
  select jsonb_build_object(
    'id', cl.id, 'name', cl.name, 'tag', cl.tag, 'about', cl.about, 'subject', cl.subject, 'code', cl.code,
    'weekly_goal', cl.weekly_goal, 'monthly_goal', cl.monthly_goal, 'created_at', cl.created_at,
    'me', auth.uid(), 'owner', public.clan_is_owner(p_clan),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.user_id, 'username', p.username, 'role', m.role, 'joined_at', m.joined_at,
        'today', public.clan_minutes(p_clan, m.user_id, p_today, p_today),
        'week', public.clan_minutes(p_clan, m.user_id, ws, p_today),
        'month', public.clan_minutes(p_clan, m.user_id, ms, p_today),
        'kudos_week', (select count(*) from public.clan_kudos k where k.clan_id = p_clan and k.to_user = m.user_id and k.d >= ws),
        'kudos_from_me', exists (select 1 from public.clan_kudos k where k.clan_id = p_clan and k.to_user = m.user_id and k.from_user = auth.uid() and k.d = p_today)
      ) order by public.clan_minutes(p_clan, m.user_id, ws, p_today) desc), '[]'::jsonb)
      from public.clan_members m join public.profiles p on p.id = m.user_id where m.clan_id = p_clan),
    'weeks', (select jsonb_agg(jsonb_build_object('start', w,
        'total', (select coalesce(sum(public.clan_minutes(p_clan, m.user_id, w, w + 6)), 0) from public.clan_members m where m.clan_id = p_clan),
        'mine', public.clan_minutes(p_clan, auth.uid(), w, w + 6)) order by w)
      from generate_series(ws - 77, ws, interval '7 days') g(w0), lateral (select g.w0::date as w) x),
    'months', (select jsonb_agg(jsonb_build_object('start', mo,
        'total', (select coalesce(sum(public.clan_minutes(p_clan, m.user_id, mo, (mo + interval '1 month' - interval '1 day')::date)), 0) from public.clan_members m where m.clan_id = p_clan),
        'mine', public.clan_minutes(p_clan, auth.uid(), mo, (mo + interval '1 month' - interval '1 day')::date)) order by mo)
      from generate_series(ms - interval '5 months', ms, interval '1 month') g(m0), lateral (select g.m0::date as mo) x)
  ) into out;
  return out;
end $$;

-- kudos: one per person per day, inside a clan you share
create or replace function public.clan_kudos_give(p_clan uuid, p_to uuid, p_today date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_to = auth.uid() or not public.in_clan(p_clan, auth.uid()) or not public.in_clan(p_clan, p_to) then raise exception 'not allowed'; end if;
  if p_today not between current_date - 1 and current_date + 1 then raise exception 'bad date'; end if;
  insert into public.clan_kudos (clan_id, from_user, to_user, d) values (p_clan, auth.uid(), p_to, p_today) on conflict do nothing;
end $$;

-- what you earned together: finished weeks/months of your clans (for coins) and kudos you received
create or replace function public.my_social_rewards(p_today date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object('clan', c.id, 'name', c.name, 'kind', x.kind, 'start', x.s, 'goal', x.goal,
                                          'total', (select coalesce(sum(public.clan_minutes(c.id, m2.user_id, x.s, x.e)), 0) from public.clan_members m2 where m2.clan_id = c.id),
                                          'mine', public.clan_minutes(c.id, auth.uid(), x.s, x.e)))
      from public.clan_members m join public.clans c on c.id = m.clan_id,
      lateral (
        select 'week' kind, g::date s, (g::date + 6) e, c.weekly_goal goal
          from generate_series(date_trunc('week', p_today)::date - 182, date_trunc('week', p_today)::date - 7, interval '7 days') g
        union all
        select 'month', g::date, (g + interval '1 month' - interval '1 day')::date, c.monthly_goal
          from generate_series(date_trunc('month', p_today) - interval '12 months', date_trunc('month', p_today) - interval '1 month', interval '1 month') g
      ) x
      where m.user_id = auth.uid() and x.e >= m.joined_at::date and x.goal > 0), '[]'::jsonb),
    'kudos', (select count(*) from public.clan_kudos where to_user = auth.uid()));
$$;

-- ── A friend can save your streak (each person can save one streak per month) ───────────────────
create table if not exists public.streak_saves (
  user_id    uuid not null references auth.users on delete cascade,
  d          date not null,
  by_user    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, d)
);
alter table public.streak_saves enable row level security;
drop policy if exists "streak_saves read" on public.streak_saves;
create policy "streak_saves read" on public.streak_saves for select to authenticated using (user_id = auth.uid() or by_user = auth.uid());
grant select on public.streak_saves to authenticated;

-- friends who missed yesterday after studying the day before (so you can save their streak)
create or replace function public.friends_to_save(p_today date)
returns table (id uuid, username text, can_save boolean)
language sql stable security definer set search_path = public as $$
  with fr as (select case when requester = auth.uid() then addressee else requester end fid
                from public.friendships where status = 'accepted' and auth.uid() in (requester, addressee))
  select fr.fid, p.username,
         not exists (select 1 from public.streak_saves s where s.by_user = auth.uid() and s.created_at >= date_trunc('month', now()))
  from fr join public.profiles p on p.id = fr.fid
  where not exists (select 1 from public.logs l where l.user_id = fr.fid and l.d = p_today - 1)
    and exists (select 1 from public.logs l where l.user_id = fr.fid and l.d = p_today - 2)
    and not exists (select 1 from public.streak_saves s where s.user_id = fr.fid and s.d = p_today - 1);
$$;

create or replace function public.streak_save(p_friend uuid, p_day date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_friend(p_friend, auth.uid()) then raise exception 'not allowed'; end if;
  if p_day not between current_date - 3 and current_date then raise exception 'Only a day in the last 3 days can be saved'; end if;
  if exists (select 1 from public.streak_saves where by_user = auth.uid() and created_at >= date_trunc('month', now())) then
    raise exception 'You already saved a streak this month'; end if;
  if exists (select 1 from public.logs where user_id = p_friend and d = p_day) then raise exception 'They studied that day — nothing to save'; end if;
  insert into public.streak_saves (user_id, d, by_user) values (p_friend, p_day, auth.uid()) on conflict do nothing;
end $$;

do $$ declare f text; begin
  foreach f in array array['in_clan(uuid,uuid)','clan_create(text,text,text,text,int,int)','clan_join(text)','clan_leave(uuid)',
    'clan_is_owner(uuid)','clan_update(uuid,text,text,text,text,int,int)','clan_kick(uuid,uuid)','clan_new_code(uuid)','my_clans(date)',
    'clan_detail(uuid,date)','clan_kudos_give(uuid,uuid,date)','my_social_rewards(date)','friends_to_save(date)','streak_save(uuid,date)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.clan_code() from public, anon, authenticated;
