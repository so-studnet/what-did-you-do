-- 空き時間の通知のテスト。時刻は at_time で固定する（日本時間 = UTC+9）。
\set ON_ERROR_STOP on

insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.push_subscriptions (endpoint, p256dh, auth, time_zone)
  values ('https://push.example/a', 'k', 'a', 'Asia/Tokyo');
-- 日本時間 10:00〜10:30 に作業
insert into public.activities (id, title, started_at, ended_at)
  values ('a1', '洗濯', '2026-11-05T01:00:00Z', '2026-11-05T01:30:00Z');

-- 設定の行がなければ既定値（オン・15分・8〜23時）
reset role;
set role service_role;
do $$
declare r record;
begin
  -- 終了から14分（10:44）: まだ
  assert (select count(*) from public.claim_idle_push_notifications('2026-11-05T01:44:00Z')) = 0, '15分たつまでは送らない';
  -- 終了から15分（10:45）: 1回目
  select * into r from public.claim_idle_push_notifications('2026-11-05T01:45:30Z');
  assert r.slot_at = '2026-11-05T01:45:00Z' and r.last_title = '洗濯', '15分で1回目（区切りの時刻）';
  -- 同じ区切りの間は送らない
  assert (select count(*) from public.claim_idle_push_notifications('2026-11-05T01:59:00Z')) = 0, '同じ区切りでは1回だけ';
  -- 30分（11:00）: 2回目
  assert (select slot_at from public.claim_idle_push_notifications('2026-11-05T02:00:10Z')) = '2026-11-05T02:00:00Z', '30分で2回目';
end $$;

-- 実行中の作業があれば送らない
reset role;
insert into public.activities (id, user_id, title, started_at)
  values ('run', '00000000-0000-0000-0000-00000000000a', '開発', '2026-11-05T02:05:00Z');
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_idle_push_notifications('2026-11-05T02:15:00Z')) = 0, '実行中があれば送らない';
end $$;
reset role;
update public.activities set ended_at = '2026-11-05T02:10:00Z' where id = 'run';

-- 通知時間帯の外（日本時間 23:30）は送らない
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_idle_push_notifications('2026-11-05T14:30:00Z')) = 0, '23時以降は送らない';
end $$;

-- 翌朝は、時間帯の始まり（8:00）から数える。8:15 に1回目、前日の作業の情報も返す
do $$
declare r record;
begin
  assert (select count(*) from public.claim_idle_push_notifications('2026-11-05T23:10:00Z')) = 0, '翌朝8:10はまだ';
  select * into r from public.claim_idle_push_notifications('2026-11-05T23:15:00Z');
  assert r.base_at = '2026-11-05T23:00:00Z' and r.slot_at = '2026-11-05T23:15:00Z' and r.last_title = '開発',
    '翌朝は8:00から数えて8:15に1回目';
end $$;

-- 設定でオフにすると送らない。間隔と時間帯も設定に従う
reset role;
set role authenticated;
insert into public.user_settings (idle_reminder_enabled) values (false);
reset role;
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_idle_push_notifications('2026-11-06T00:00:00Z')) = 0, 'オフなら送らない';
end $$;
reset role;
update public.user_settings set idle_reminder_enabled = true, idle_interval_min = 60, active_start_hour = 9, active_end_hour = 18;
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_idle_push_notifications('2026-11-06T00:30:00Z')) = 0, '9時から60分たっていない（9:30）';
  assert (select slot_at from public.claim_idle_push_notifications('2026-11-06T01:00:00Z')) = '2026-11-06T01:00:00Z', '10:00 に送る（60分間隔）';
  assert (select count(*) from public.claim_idle_push_notifications('2026-11-06T09:30:00Z')) = 0, '18時以降は送らない';
end $$;

-- 権限: アプリからは呼べない。他人の設定は見えない。時間帯が逆の設定は入らない
reset role;
set role authenticated;
do $$ begin
  begin
    perform public.claim_idle_push_notifications();
    raise exception 'FAIL: アプリから呼べてしまった';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.user_settings set active_start_hour = 20, active_end_hour = 8;
    raise exception 'FAIL: 始まりが終わりより後の設定が入ってしまった';
  exception when check_violation then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.user_settings) = 0, 'B から A の設定は見えない';
end $$;

reset role;
select 'idle tests passed' as result;
