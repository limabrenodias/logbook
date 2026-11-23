-- Logbook update 6: lets your trackers (Anki add-on…) show YOUR subjects and activity types,
-- instead of a fixed list. Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.

create or replace function public.token_lists(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid; p record; subs text[]; typs text[];
  base text[] := array['Listening','Speaking','Writing','Reading','Grammar','Vocabulary','Pronunciation','Mixed'];
begin
  select user_id into uid from public.ingest_tokens where token = p_token;
  if uid is null then raise exception 'invalid token' using errcode = '28000'; end if;
  select * into p from public.profiles where id = uid;
  -- subjects: the ones you pinned, then the ones you've logged (most recent first)
  select array(select s from (
           select s, 0 as k, ord as o from unnest(coalesce(p.subjects, '{}')) with ordinality as t(s, ord)
           union all
           select subject, 1, -extract(epoch from max(d))::bigint from public.logs where user_id = uid group by subject
         ) x group by s order by min(k), min(o) limit 80)
    into subs;
  -- types: the standard ones you haven't hidden, your own, then any others you've used
  select array(select t from (
           select t, 0 as k, ord as o from unnest(base) with ordinality as b(t, ord)
             where not (t = any (array(select jsonb_array_elements_text(coalesce(p.prefs->'hiddenTypes', '[]'::jsonb)))))
           union all
           select t, 1, ord from unnest(coalesce(p.types, '{}')) with ordinality as c(t, ord)
           union all
           select type, 2, -count(*) from public.logs where user_id = uid group by type
         ) y group by t order by min(k), min(o) limit 60)
    into typs;
  return jsonb_build_object('username', p.username, 'subjects', to_jsonb(subs), 'types', to_jsonb(typs));
end $$;
revoke all on function public.token_lists(text) from public;
grant execute on function public.token_lists(text) to anon, authenticated;
