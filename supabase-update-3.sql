-- Logbook update 3: Focus sessions and points saved to your account, account deletion,
-- and the tracker link (ext_id) readable so Undo can restore auto-tracked logs exactly.
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.

-- ── Focus sessions (the day timeline) ──────────────────────────────────────
create table if not exists public.focus_sessions (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null check (length(id) <= 40),
  day        date not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists focus_sessions_day on public.focus_sessions (user_id, day desc);

-- ── Focus points awards (one row per award; your total is their sum) ─────────
create table if not exists public.focus_awards (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  t       bigint not null,
  data    jsonb not null,
  primary key (user_id, t)
);

alter table public.focus_sessions enable row level security;
alter table public.focus_awards   enable row level security;

drop policy if exists "focus_sessions own" on public.focus_sessions;
create policy "focus_sessions own" on public.focus_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "focus_awards own" on public.focus_awards;
create policy "focus_awards own" on public.focus_awards for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.focus_sessions to authenticated;
grant select, insert, update, delete on public.focus_awards   to authenticated;

-- ── Delete my account (and, through the cascades, every row that belongs to it) ──
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
