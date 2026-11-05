-- What did you do: 何も作業していない時間の通知（空き時間のリマインド）
--
-- 実行中の作業が1つもないとき、最後の作業が終わってから（その日の通知時間帯の
-- 始まりより前なら、時間帯の始まりから）一定間隔ごとに通知する。
-- 送信は既存の pg_cron → /api/push/dispatch の流れに相乗りする。

create table public.user_settings (
  user_id                uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  idle_reminder_enabled  boolean not null default true,
  idle_interval_min      integer not null default 15 check (idle_interval_min between 5 and 240),
  active_start_hour      smallint not null default 8 check (active_start_hour between 0 and 23),
  active_end_hour        smallint not null default 23 check (active_end_hour between 1 and 24),
  time_zone              text not null default 'Asia/Tokyo',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint user_settings_active_hours check (active_start_hour < active_end_hour)
);

create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
create policy "own settings" on public.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

/*
 * 空き時間の通知を取り出し、送信済みとして記録する（push_deliveries に 'idle:<ユーザーID>' で記録）。
 * - 設定の行がないユーザーは既定値（オン・15分・8〜23時）で扱う
 * - 数え始め = 最後に終わった作業の終了時刻と、今日の通知時間帯の始まりの遅いほう
 * - 今が通知時間帯の外なら送らない
 * - at_time はテスト用（通常は now()）
 */
create function public.claim_idle_push_notifications(at_time timestamptz default now())
returns table (
  user_id        uuid,
  slot_at        timestamptz,
  base_at        timestamptz,
  last_title     text,
  last_ended_at  timestamptz,
  endpoint       text,
  p256dh         text,
  auth           text,
  time_zone      text
)
language sql
security definer
set search_path = ''
as $$
  with cfg as (
    select u.user_id,
           coalesce(us.idle_reminder_enabled, true) as enabled,
           coalesce(us.idle_interval_min, 15) as interval_min,
           coalesce(us.active_start_hour, 8) as start_h,
           coalesce(us.active_end_hour, 23) as end_h,
           coalesce(
             us.time_zone,
             (select ps.time_zone from public.push_subscriptions ps
               where ps.user_id = u.user_id order by ps.updated_at desc limit 1),
             'Asia/Tokyo'
           ) as tz
    from (select distinct s.user_id from public.push_subscriptions s) u
    left join public.user_settings us on us.user_id = u.user_id
  ),
  win as (
    select c.*,
           (date_trunc('day', at_time at time zone c.tz) + make_interval(hours => c.start_h)) at time zone c.tz as window_start,
           (date_trunc('day', at_time at time zone c.tz) + make_interval(hours => c.end_h)) at time zone c.tz as window_end
    from cfg c
    where c.enabled
      and not exists (
        select 1 from public.activities r where r.user_id = c.user_id and r.ended_at is null
      )
  ),
  base as (
    select w.*, last.title as last_title, last.ended_at as last_ended_at,
           greatest(coalesce(last.ended_at, w.window_start), w.window_start) as base_at
    from win w
    left join lateral (
      select a.title, a.ended_at from public.activities a
      where a.user_id = w.user_id and a.ended_at is not null and a.ended_at <= at_time
      order by a.ended_at desc limit 1
    ) last on true
    where at_time >= w.window_start and at_time < w.window_end
  ),
  slots as (
    select b.*,
           floor(extract(epoch from (at_time - b.base_at)) / 60 / b.interval_min)::int as k
    from base b
  ),
  eligible as (
    select s.*, s.base_at + make_interval(mins => s.interval_min * s.k) as slot_at
    from slots s
    where s.k >= 1
  ),
  claimed as (
    insert into public.push_deliveries (activity_id, due_at)
    select 'idle:' || e.user_id::text, e.slot_at from eligible e
    on conflict do nothing
    returning activity_id, due_at
  )
  select e.user_id, e.slot_at, e.base_at, e.last_title, e.last_ended_at,
         s.endpoint, s.p256dh, s.auth, e.tz
  from claimed c
  join eligible e on c.activity_id = 'idle:' || e.user_id::text and c.due_at = e.slot_at
  join public.push_subscriptions s on s.user_id = e.user_id;
$$;

revoke all on function public.claim_idle_push_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_idle_push_notifications(timestamptz) to service_role;
