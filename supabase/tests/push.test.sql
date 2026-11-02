-- Web Push 用のテーブルと関数のテスト。失敗すると例外で止まる。
\set ON_ERROR_STOP on

insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- ユーザーA: 作業と通知の宛先を登録する
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.activities (id, title, started_at, planned_min) values
  ('due',      '洗濯', now() - interval '31 minutes', 30),  -- 1分前に予定時間
  ('future',   '読書', now() - interval '5 minutes', 30),   -- まだ
  ('free',     '開発', now() - interval '3 hours', null),   -- 予定なし
  ('stale',    '放置', now() - interval '2 days', 30);      -- 古すぎる
insert into public.activities (id, title, started_at, ended_at, planned_min) values
  ('ended', '終了済み', now() - interval '2 hours', now() - interval '1 hour', 30);
insert into public.push_subscriptions (endpoint, p256dh, auth, time_zone) values
  ('https://push.example/a-phone', 'k1', 'a1', 'Asia/Tokyo'),
  ('https://push.example/a-pc', 'k2', 'a2', 'Asia/Tokyo');

-- アプリからは送信の関数を呼べず、送信記録も読めない
do $$ begin
  begin
    perform public.claim_due_push_notifications();
    raise exception 'FAIL: アプリから送信の関数を呼べてしまった';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_push_subscription('https://push.example/a-phone');
    raise exception 'FAIL: アプリから宛先削除の関数を呼べてしまった';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.push_deliveries) = 0, 'アプリからは送信記録が見えない';
end $$;

-- ユーザーB からは A の宛先が見えない
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 0, 'B から A の宛先は見えない';
end $$;
delete from public.push_subscriptions;

-- サーバー（service_role）として送るべき通知を取り出す
reset role;
set role service_role;
create temp table first_claim as select * from public.claim_due_push_notifications();
do $$ begin
  assert (select count(*) from first_claim) = 2, '予定時間に達した作業1件 × 宛先2つ';
  assert (select count(distinct activity_id) from first_claim) = 1 and (select min(activity_id) from first_claim) = 'due',
    '対象は「due」だけ（未到達・予定なし・終了済み・古すぎるものは除く）';
  assert (select count(*) from public.claim_due_push_notifications()) = 0, '2回目は同じ通知を返さない';
end $$;

-- 予定時間を延ばすと、新しい予定時刻で改めて対象になる
reset role;
update public.activities set planned_min = 20 where id = 'due';
set role service_role;
do $$ begin
  assert (select count(*) from public.claim_due_push_notifications()) = 2, '予定を変えると改めて通知する';
end $$;

-- 無効になった宛先を消せる
select public.delete_push_subscription('https://push.example/a-phone');
do $$ begin
  assert (select count(*) from public.push_subscriptions) = 1, '宛先を1つ消した';
end $$;

reset role;
select 'push tests passed' as result;
