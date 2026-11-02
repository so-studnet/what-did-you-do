-- What did you do: 初期スキーマ
-- Supabase の SQL Editor に貼り付けて実行するか、Supabase CLI の `supabase db push` で適用する。
--
-- ID はアプリ側で生成する文字列（UUID）。タグは配列で持つ（集計はアプリ側で行うため）。
-- すべての行は user_id で持ち主を表し、RLS で本人の行だけを読み書きできるようにする。

create table public.tags (
  id          text primary key check (char_length(id) between 1 and 64),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  parent_id   text,
  color       text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.activities (
  id           text primary key check (char_length(id) between 1 and 64),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 100),
  started_at   timestamptz not null,
  ended_at     timestamptz,
  planned_min  integer check (planned_min between 1 and 1440),
  tag_ids      text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint activities_end_after_start check (ended_at is null or ended_at >= started_at)
);

create table public.templates (
  id           text primary key check (char_length(id) between 1 and 64),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 100),
  planned_min  integer check (planned_min between 1 and 1440),
  tag_ids      text[] not null default '{}',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index activities_user_started_idx on public.activities (user_id, started_at);
create index activities_running_idx on public.activities (user_id) where ended_at is null;
create index tags_user_idx on public.tags (user_id);
create index templates_user_idx on public.templates (user_id, sort_order);

-- updated_at を自動更新する
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tags_updated_at before update on public.tags
  for each row execute function public.set_updated_at();
create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();
create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

-- Row Level Security: ログインしている本人の行だけ
alter table public.tags enable row level security;
alter table public.activities enable row level security;
alter table public.templates enable row level security;

create policy "own tags" on public.tags for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own activities" on public.activities for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own templates" on public.templates for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 別の端末での変更を受け取れるように Realtime に登録する
alter publication supabase_realtime add table public.tags, public.activities, public.templates;
