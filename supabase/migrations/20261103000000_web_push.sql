-- What did you do: Web Push（アプリを閉じていても予定時間の通知を届ける）
--
-- push_subscriptions : 端末ごとの通知の宛先。アプリ（本人）が登録・削除する
-- push_deliveries    : 送った通知の記録。同じ予定時刻に二重に送らないために使う（サーバー専用）
-- claim_due_push_notifications() : 送るべき通知を「送信済み」にしつつ取り出す（サーバー専用）

create table public.push_subscriptions (
  endpoint     text primary key check (char_length(endpoint) between 1 and 2048),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  time_zone    text not null default 'Asia/Tokyo',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.push_deliveries (
  activity_id  text not null,
  due_at       timestamptz not null,
  sent_at      timestamptz not null default now(),
  primary key (activity_id, due_at)
);

-- RLS を有効にしてポリシーを作らない = アプリ（anon / authenticated）からは読み書きできない
alter table public.push_deliveries enable row level security;

/*
 * 予定時間に達した実行中の作業を取り出し、送信済みとして記録する。
 * 同時に2回呼ばれても、同じ通知は片方にしか返らない（主キーの一意性で保証）。
 * 古すぎるもの（max_age より前に予定時刻を過ぎたもの）は送らない。
 */
create function public.claim_due_push_notifications(max_age interval default interval '12 hours')
returns table (
  activity_id  text,
  title        text,
  started_at   timestamptz,
  planned_min  integer,
  due_at       timestamptz,
  endpoint     text,
  p256dh       text,
  auth         text,
  time_zone    text
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select a.id, a.user_id, a.title, a.started_at, a.planned_min,
           a.started_at + make_interval(mins => a.planned_min) as due_at
    from public.activities a
    where a.ended_at is null
      and a.planned_min is not null
      and a.started_at + make_interval(mins => a.planned_min) <= now()
      and a.started_at + make_interval(mins => a.planned_min) > now() - max_age
  ),
  claimed as (
    insert into public.push_deliveries (activity_id, due_at)
    select id, due_at from due
    on conflict do nothing
    returning activity_id, due_at
  )
  select d.id, d.title, d.started_at, d.planned_min, d.due_at,
         s.endpoint, s.p256dh, s.auth, s.time_zone
  from claimed c
  join due d on d.id = c.activity_id and d.due_at = c.due_at
  join public.push_subscriptions s on s.user_id = d.user_id;
$$;

revoke all on function public.claim_due_push_notifications(interval) from public, anon, authenticated;
grant execute on function public.claim_due_push_notifications(interval) to service_role;

-- 宛先が無効になった（410 Gone など）ときにサーバーから消す
create function public.delete_push_subscription(target_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = target_endpoint;
$$;

revoke all on function public.delete_push_subscription(text) from public, anon, authenticated;
grant execute on function public.delete_push_subscription(text) to service_role;

-- 古い送信記録を消す（作業が消えても記録が残り続けないように）
create function public.prune_push_deliveries()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_deliveries where sent_at < now() - interval '30 days';
$$;

revoke all on function public.prune_push_deliveries() from public, anon, authenticated;
grant execute on function public.prune_push_deliveries() to service_role;
