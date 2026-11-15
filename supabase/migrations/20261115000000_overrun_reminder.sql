-- What did you do: 予定時間を過ぎた作業への定期的な通知（終了し忘れの防止）
--
-- 予定時間に達したときの通知（claim_due_push_notifications）のあと、
-- 終了するまで一定間隔ごとに「終了し忘れていませんか？」と通知する。
-- 終了し忘れに気づくことを優先し、通知する時間帯（夜間）の制限はかけない。

alter table public.user_settings
  add column overrun_reminder_enabled boolean not null default true,
  add column overrun_interval_min integer not null default 15
    check (overrun_interval_min between 5 and 240);

-- 予定時間が必須になったので、予定なしのテンプレートは仮に15分にする（利用者が後で直す）
update public.templates set planned_min = 15 where planned_min is null;

/*
 * 超過中の作業の定期通知を取り出し、送信済みとして記録する
 * （push_deliveries に 'overrun:<作業ID>' と区切りの時刻で記録）。
 * - 区切り = 予定時刻 + 間隔 × k（k ≥ 1。k = 0 の予定時刻ちょうどは claim_due_push_notifications が送る）
 * - 予定時間を延ばすと予定時刻が変わり、新しい予定時刻までは送らない
 * - at_time はテスト用（通常は now()）
 */
create function public.claim_overrun_push_notifications(at_time timestamptz default now())
returns table (
  activity_id  text,
  title        text,
  started_at   timestamptz,
  planned_min  integer,
  due_at       timestamptz,
  slot_at      timestamptz,
  endpoint     text,
  p256dh       text,
  auth         text,
  time_zone    text
)
language sql
security definer
set search_path = ''
as $$
  with running as (
    select a.id, a.user_id, a.title, a.started_at, a.planned_min,
           a.started_at + make_interval(mins => a.planned_min) as due_at,
           coalesce(us.overrun_interval_min, 15) as interval_min
    from public.activities a
    left join public.user_settings us on us.user_id = a.user_id
    where a.ended_at is null
      and a.planned_min is not null
      and coalesce(us.overrun_reminder_enabled, true)
      and a.started_at + make_interval(mins => a.planned_min) <= at_time
  ),
  eligible as (
    select r.*,
           r.due_at + make_interval(
             mins => r.interval_min * floor(extract(epoch from (at_time - r.due_at)) / 60 / r.interval_min)::int
           ) as slot_at
    from running r
    where extract(epoch from (at_time - r.due_at)) / 60 >= r.interval_min
  ),
  claimed as (
    insert into public.push_deliveries (activity_id, due_at)
    select 'overrun:' || e.id, e.slot_at from eligible e
    on conflict do nothing
    returning activity_id, due_at
  )
  select e.id, e.title, e.started_at, e.planned_min, e.due_at, e.slot_at,
         s.endpoint, s.p256dh, s.auth, s.time_zone
  from claimed c
  join eligible e on c.activity_id = 'overrun:' || e.id and c.due_at = e.slot_at
  join public.push_subscriptions s on s.user_id = e.user_id;
$$;

revoke all on function public.claim_overrun_push_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_overrun_push_notifications(timestamptz) to service_role;
