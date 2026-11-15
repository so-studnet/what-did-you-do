-- 超過中の定期通知のテスト。時刻は at_time で固定する。
\set ON_ERROR_STOP on

insert into auth.users values ('00000000-0000-0000-0000-00000000000a');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/a', 'k', 'a');
-- 3:00 開始・予定30分 → 3:30 が予定時刻
insert into public.activities (id, title, started_at, planned_min) values ('meal', '食事', '2026-11-15T03:00:00Z', 30);
-- 予定なしの古い作業（実行中）は対象外
insert into public.activities (id, title, started_at) values ('free', '予定なし', '2026-11-15T00:00:00Z');
insert into public.templates (id, title, planned_min) values ('t1', '読書', null);

reset role;
set role service_role;
do $$
declare r record;
begin
  -- 予定時刻ちょうど〜15分未満は送らない（予定時刻の通知は別の関数が送る）
  assert (select count(*) from public.claim_overrun_push_notifications('2026-11-15T03:30:00Z')) = 0, '予定時刻ちょうどは送らない';
  assert (select count(*) from public.claim_overrun_push_notifications('2026-11-15T03:44:59Z')) = 0, '15分未満は送らない';
  -- 15分超過で1回目
  select * into r from public.claim_overrun_push_notifications('2026-11-15T03:45:10Z');
  assert r.activity_id = 'meal' and r.slot_at = '2026-11-15T03:45:00Z' and r.due_at = '2026-11-15T03:30:00Z', '15分超過で1回目';
  assert (select count(*) from public.claim_overrun_push_notifications('2026-11-15T03:59:00Z')) = 0, '同じ区切りでは1回だけ';
  -- 夜中も送る（時間帯の制限なし）。4時間後
  assert (select slot_at from public.claim_overrun_push_notifications('2026-11-15T07:31:00Z')) = '2026-11-15T07:30:00Z', '4時間後も送る';
end $$;

-- 予定を延ばす（7:31 から あと15分 = 予定時刻 7:46）と、新しい予定時刻 + 15分まで送らない
reset role;
update public.activities set planned_min = 286 where id = 'meal';
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_overrun_push_notifications('2026-11-15T07:50:00Z')) = 0, '延長後は新しい予定時刻まで送らない';
  assert (select count(*) from public.claim_overrun_push_notifications('2026-11-15T08:00:00Z')) = 0, '新しい予定時刻から15分未満は送らない';
  assert (select slot_at from public.claim_overrun_push_notifications('2026-11-15T08:01:00Z')) = '2026-11-15T08:01:00Z', '新しい予定時刻 + 15分で送る';
end $$;

-- 設定でオフ、間隔の変更
reset role;
set role authenticated;
insert into public.user_settings (overrun_reminder_enabled) values (false);
reset role;
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_overrun_push_notifications('2026-11-15T09:00:00Z')) = 0, 'オフなら送らない';
end $$;
reset role;
update public.user_settings set overrun_reminder_enabled = true, overrun_interval_min = 60;
set role service_role;
do $$ begin
  -- 予定時刻は 7:46。60分間隔なら 8:46、9:46 …
  assert (select count(*) from public.claim_overrun_push_notifications('2026-11-15T08:45:00Z')) = 0, '60分間隔: 59分超過ではまだ';
  assert (select slot_at from public.claim_overrun_push_notifications('2026-11-15T08:46:30Z')) = '2026-11-15T08:46:00Z', '60分間隔: 1区切り目';
  assert (select slot_at from public.claim_overrun_push_notifications('2026-11-15T09:46:00Z')) = '2026-11-15T09:46:00Z', '60分間隔: 2区切り目';
end $$;

-- 終了すると送らない
reset role;
update public.activities set ended_at = '2026-11-15T10:00:00Z' where id = 'meal';
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_overrun_push_notifications('2026-11-15T12:00:00Z')) = 0, '終了したら送らない';
end $$;

-- アプリからは呼べない
reset role;
set role authenticated;
do $$ begin
  begin
    perform public.claim_overrun_push_notifications();
    raise exception 'FAIL: アプリから呼べてしまった';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'overrun tests passed' as result;
