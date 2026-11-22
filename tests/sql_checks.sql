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
set request.uid='00000000-0000-0000-0000-00000000000a';
select delete_my_account();
reset role;
do $$begin if exists (select 1 from logs where user_id='00000000-0000-0000-0000-00000000000a') then raise exception 'account deletion left logs behind'; end if; end$$;
