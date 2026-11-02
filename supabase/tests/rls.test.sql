-- RLS と制約のテスト。失敗すると例外で止まる。
\set ON_ERROR_STOP on
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- ユーザーA としてデータを作る
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.tags (id, name, parent_id, color) values ('t1', '仕事', null, '#2563eb');
insert into public.activities (id, title, started_at, ended_at, planned_min, tag_ids)
  values ('a1', '開発', '2026-11-02T09:00Z', '2026-11-02T10:00Z', 30, '{t1}');
insert into public.templates (id, title, planned_min, tag_ids, sort_order) values ('p1', '読書', 30, '{}', 0);

do $$ begin
  assert (select count(*) from public.activities) = 1, 'A は自分の記録を読める';
  assert (select user_id from public.activities where id = 'a1') = '00000000-0000-0000-0000-00000000000a', 'user_id は自動で入る';
end $$;

-- 他人の user_id では書き込めない
do $$ begin
  begin
    insert into public.activities (id, user_id, title, started_at) values ('x', '00000000-0000-0000-0000-00000000000b', 'x', now());
    raise exception 'FAIL: 他人の user_id で書き込めてしまった';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 終了時刻が開始より前は拒否
do $$ begin
  begin
    insert into public.activities (id, title, started_at, ended_at) values ('bad', 'x', '2026-11-02T10:00Z', '2026-11-02T09:00Z');
    raise exception 'FAIL: 終了が開始より前でも入ってしまった';
  exception when check_violation then null;
  end;
end $$;

-- updated_at が更新される
do $$ declare before timestamptz; begin
  select updated_at into before from public.activities where id = 'a1';
  perform pg_sleep(0.01);
  update public.activities set title = '開発2' where id = 'a1';
  assert (select updated_at from public.activities where id = 'a1') > before, 'updated_at が更新される';
end $$;

-- ユーザーB からは A のデータが見えず、更新・削除もできない
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.activities) = 0, 'B から A の記録は見えない';
  assert (select count(*) from public.tags) = 0, 'B から A のタグは見えない';
  assert (select count(*) from public.templates) = 0, 'B から A のテンプレートは見えない';
end $$;
update public.activities set title = '乗っ取り' where id = 'a1';
delete from public.tags where id = 't1';

-- 未ログイン（anon）は何も見えない
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from public.activities) = 0, '未ログインでは見えない';
end $$;

-- A に戻ると、B の更新・削除は効いていない
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert (select title from public.activities where id = 'a1') = '開発2', 'B の更新は効かない';
  assert (select count(*) from public.tags) = 1, 'B の削除は効かない';
end $$;

reset role;
select 'RLS tests passed' as result;
