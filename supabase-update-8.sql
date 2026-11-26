-- Logbook update 8: lets the Anki add-on replace its own logs for the days it re-sends
-- (so changing how a deck or subdeck is logged doesn't leave old copies behind).
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.
create or replace function public.ingest_prune(p_token text, p_src text, p_from date, p_keep text[])
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid; n int;
begin
  select user_id into uid from public.ingest_tokens where token = p_token;
  if uid is null then raise exception 'invalid token' using errcode = '28000'; end if;
  if p_src not in ('anki') then raise exception 'not allowed for this source'; end if;
  if p_from < current_date - 400 then raise exception 'too far back'; end if;
  delete from public.logs where user_id = uid and src = p_src and d >= p_from
    and ext_id is not null and not (ext_id = any (coalesce(p_keep, '{}')));
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.ingest_prune(text, text, date, text[]) from public;
grant execute on function public.ingest_prune(text, text, date, text[]) to anon, authenticated;
