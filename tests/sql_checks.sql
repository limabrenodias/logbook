-- Security checks: every block raises an exception if a rule is broken.
\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c');
insert into profiles(id,username) values ('00000000-0000-0000-0000-00000000000a','alice'),('00000000-0000-0000-0000-00000000000b','bob'),('00000000-0000-0000-0000-00000000000c','carol');
do $$begin begin update profiles set username='admin' where username='carol'; raise exception 'reserved username accepted'; exception when check_violation then null; end; end$$;
set role authenticated;
set request.uid='00000000-0000-0000-0000-00000000000a';
insert into logs(d,subject,type,minutes,activity) values (current_date,'French','Reading',30,'private note');
insert into resources(title) values ('Book');
insert into scores(d,exam,total) values (current_date,'Mock',50);
insert into focus_sessions(id,day,data) values ('x',current_date,'{}');
set request.uid='00000000-0000-0000-0000-00000000000b';
do $$begin
  if (select count(*) from logs) <> 0 then raise exception 'B can read A''s logs'; end if;
  if (select count(*) from resources) <> 0 then raise exception 'B can read A''s resources'; end if;
  if (select count(*) from scores) <> 0 then raise exception 'B can read A''s scores'; end if;
  if (select count(*) from focus_sessions) <> 0 then raise exception 'B can read A''s focus sessions'; end if;
  begin insert into logs(user_id,d,subject,type,minutes) values ('00000000-0000-0000-0000-00000000000a',current_date,'X','Y',5); raise exception 'B wrote a log for A'; exception when insufficient_privilege then null; end;
  begin insert into friendships(requester,addressee,status) values ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000a','accepted'); raise exception 'direct friendship insert allowed'; exception when insufficient_privilege then null; end;
end$$;
select friend_request('alice');
set request.uid='00000000-0000-0000-0000-00000000000a';
select friend_request('bob');
do $$begin
  if (select count(*) from friend_feed(14)) <> 0 then raise exception 'feed should be empty (bob has no logs)'; end if;
  if (select activity from friend_feed(14) limit 1) is not null then null; end if;
end$$;
set request.uid='00000000-0000-0000-0000-00000000000b';
do $$begin if (select status from friends_overview(current_date) limit 1) <> 'friend' then raise exception 'friendship not accepted'; end if;
  if exists (select 1 from friend_feed(14) where activity <> '') then raise exception 'descriptions shown without permission'; end if; end$$;
set request.uid='00000000-0000-0000-0000-00000000000a';
select block_user('00000000-0000-0000-0000-00000000000b');
set request.uid='00000000-0000-0000-0000-00000000000b';
do $$begin if friend_request('alice') <> 'not_found' then raise exception 'blocked user can still send requests'; end if; end$$;
do $$begin begin perform * from client_errors; raise exception 'users can read error reports'; exception when insufficient_privilege then null; end; end$$;
reset role;
do $$declare tk text; j jsonb; begin
  update profiles set subjects='{Medicine}', types='{Anatomy}', prefs=prefs||'{"hiddenTypes":["Speaking"]}' where id='00000000-0000-0000-0000-00000000000a';
  insert into ingest_tokens(user_id,name) values('00000000-0000-0000-0000-00000000000a','t') returning token into tk;
  j := token_lists(tk);
  if j->'subjects'->>0 <> 'Medicine' then raise exception 'pinned subject should come first: %', j; end if;
  if not (j->'types') ? 'Anatomy' then raise exception 'custom type missing: %', j; end if;
  if (j->'types') ? 'Speaking' then raise exception 'hidden type shown: %', j; end if;
  begin perform token_lists('nope'); raise exception 'bad token accepted'; exception when sqlstate '28000' then null; end;
end$$;
set role authenticated;
-- update 7: clans, kudos, words, streak saves
set request.uid='00000000-0000-0000-0000-00000000000a';
do $$declare cid uuid; code text; j jsonb; begin
  cid := clan_create('Les Polyglottes','POLY','Study club','',600,2400);
  select c.code into code from clans c where c.id = cid;
  perform set_config('lb.code', code, false); perform set_config('lb.clan', cid::text, false);
end$$;
set request.uid='00000000-0000-0000-0000-00000000000b';
do $$begin
  begin perform clan_join(current_setting('lb.code')); raise exception 'blocked user joined the clan'; exception when raise_exception then
    if sqlerrm <> 'No clan with that code' then raise; end if; end;
  if (select count(*) from clans) <> 0 then raise exception 'non-member can read clans'; end if;
end$$;
set request.uid='00000000-0000-0000-0000-00000000000c';
do $$declare j jsonb; begin
  perform clan_join(current_setting('lb.code'));
  insert into logs(d,subject,type,minutes) values (current_date,'Polish','Speaking',60);
  perform clan_kudos_give(current_setting('lb.clan')::uuid,'00000000-0000-0000-0000-00000000000a',current_date);
  perform clan_kudos_give(current_setting('lb.clan')::uuid,'00000000-0000-0000-0000-00000000000a',current_date);
  if (select week_min from my_clans(current_date)) <> 90 then raise exception 'clan week total wrong: %', (select week_min from my_clans(current_date)); end if;
  j := clan_detail(current_setting('lb.clan')::uuid, current_date);
  if jsonb_array_length(j->'members') <> 2 or (j->'members'->0->>'week')::int <> 60 then raise exception 'clan members wrong: %', j->'members'; end if;
  if jsonb_array_length(j->'weeks') <> 12 or jsonb_array_length(j->'months') <> 6 then raise exception 'history size wrong'; end if;
  if (j->>'owner')::boolean then raise exception 'member shown as owner'; end if;
  begin perform clan_update(current_setting('lb.clan')::uuid,'X','XX','','',1,1); raise exception 'member changed the clan'; exception when raise_exception then
    if sqlerrm not like 'Only the clan owner%' then raise; end if; end;
  begin perform clan_kudos_give(current_setting('lb.clan')::uuid,'00000000-0000-0000-0000-00000000000c',current_date); raise exception 'kudos to yourself'; exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if; end;
end$$;
set request.uid='00000000-0000-0000-0000-00000000000a';
do $$declare j jsonb; begin
  j := clan_detail(current_setting('lb.clan')::uuid, current_date);
  if not (j->>'owner')::boolean then raise exception 'owner not recognised'; end if;
  if ((select m from jsonb_array_elements(j->'members') m where m->>'username'='alice')->>'kudos_week')::int <> 1 then raise exception 'kudos not counted once'; end if;
  if (my_social_rewards(current_date)->>'kudos')::int <> 1 then raise exception 'kudos reward count wrong'; end if;
  perform clan_leave(current_setting('lb.clan')::uuid);
end$$;
set request.uid='00000000-0000-0000-0000-00000000000c';
do $$begin if (select role from my_clans(current_date)) <> 'owner' then raise exception 'ownership not passed on'; end if;
  perform clan_leave(current_setting('lb.clan')::uuid); end$$;
reset role;
do $$begin if exists (select 1 from clans) then raise exception 'empty clan not deleted'; end if; end$$;
do $$declare tk text; n int; begin
  insert into ingest_tokens(user_id,name) values('00000000-0000-0000-0000-00000000000a','w') returning token into tk;
  n := ingest_words(tk, '[{"lang":"French","word":"Épanouir ","sentence":"Il faut s''épanouir.","source":"Le Monde","url":"https://lemonde.fr"},{"lang":"French","word":"épanouir"},{"lang":"","word":"x"}]');
  if n <> 2 then raise exception 'ingest count %', n; end if;
  if (select seen from words where word='épanouir') <> 2 or (select sentence from words where word='épanouir') <> 'Il faut s''épanouir.' then raise exception 'word merge wrong'; end if;
  if (select count(*) from token_words(tk)) <> 1 then raise exception 'token_words wrong'; end if;
  perform words_mark_anki(tk, array(select id from words));
  if (select count(*) from token_words(tk)) <> 0 or (select status from words limit 1) <> 'learning' then raise exception 'mark anki wrong'; end if;
  begin perform ingest_words('nope','[]'); raise exception 'bad token accepted'; exception when sqlstate '28000' then null; end;
  insert into logs(user_id,d,subject,type,minutes) values ('00000000-0000-0000-0000-00000000000a',current_date-2,'French','Reading',20);
end$$;
set role authenticated;
set request.uid='00000000-0000-0000-0000-00000000000b';
do $$begin if (select count(*) from words) <> 0 then raise exception 'B can read A''s words'; end if; end$$;
set request.uid='00000000-0000-0000-0000-00000000000c';
select friend_request('alice');
set request.uid='00000000-0000-0000-0000-00000000000a';
select friend_request('carol');
set request.uid='00000000-0000-0000-0000-00000000000c';
do $$begin
  if not exists (select 1 from friends_to_save(current_date) where username='alice' and can_save) then raise exception 'alice should be savable'; end if;
  perform streak_save('00000000-0000-0000-0000-00000000000a', current_date-1);
  if exists (select 1 from friends_to_save(current_date) where username='alice') then raise exception 'saved friend still listed'; end if;
  begin perform streak_save('00000000-0000-0000-0000-00000000000a', current_date-3); raise exception 'second save in a month allowed'; exception when raise_exception then
    if sqlerrm not like 'You already saved%' then raise; end if; end;
end$$;
set request.uid='00000000-0000-0000-0000-00000000000a';
do $$begin if (select count(*) from streak_saves) <> 1 then raise exception 'alice cannot see her save'; end if; end$$;
set request.uid='00000000-0000-0000-0000-00000000000a';
select delete_my_account();
reset role;
do $$begin if exists (select 1 from logs where user_id='00000000-0000-0000-0000-00000000000a') then raise exception 'account deletion left logs behind'; end if; end$$;
