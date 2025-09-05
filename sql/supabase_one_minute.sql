-- =========================================
-- one_minute：心聚 1 分鐘（課前 / 課後 / 72h）
-- =========================================

create table if not exists public.one_minute (
  id               bigserial primary key,
  user_id          uuid   references auth.users(id) on delete set null,
  course_id        bigint references public.courses(id) on delete set null,
  session_id       bigint,                                  -- 建議對應你的場次表（若有）

  -- 三種時間點：pre / post / 72h
  timepoint        text not null check (timepoint in ('pre','post','72h')),

  -- 心聚四指標（1~5）
  stability        smallint check (stability between 1 and 5),
  recovery         smallint check (recovery between 1 and 5),
  connectedness    smallint check (connectedness between 1 and 5),
  focus            smallint check (focus between 1 and 5),

  -- 輔助題（課後/72h 才會填）
  nps              smallint check (nps between 0 and 10),    -- 0~10
  one_line         text,                                     -- 一句話收穫
  next_actions     text[] default '{}'::text[],              -- 課後的行動意向（post）
  actions_done     text[] default '{}'::text[],              -- 72h 的行動完成（72h）
  adoption_scope   text[] default '{}'::text[],              -- 帶到：個人/家人/同事/社團（post）

  instrument_version text default 'v1',                      -- 量表版本（治理）
  submitted_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 觸發器：自動更新 updated_at（若你專案已存在可略過）
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_one_minute_set_updated on public.one_minute;
create trigger trg_one_minute_set_updated
before update on public.one_minute
for each row execute function public.set_updated_at();

-- 索引
create index if not exists one_minute_user_idx     on public.one_minute(user_id);
create index if not exists one_minute_course_idx   on public.one_minute(course_id);
create index if not exists one_minute_session_idx  on public.one_minute(session_id);
create index if not exists one_minute_tp_idx       on public.one_minute(timepoint);
create index if not exists one_minute_submitted_at on public.one_minute(submitted_at);

-- 啟用 RLS
alter table public.one_minute enable row level security;

-- （若你專案已經有 is_service_role() 就不用重建）
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb ->> 'role' = 'service_role'
$$;

-- Policies（與 moods 相同概念）
drop policy if exists "Read own records or service role" on public.one_minute;
create policy "Read own records or service role"
on public.one_minute
for select
using ( public.is_service_role() or auth.uid() = user_id );

drop policy if exists "Insert own record or service role" on public.one_minute;
create policy "Insert own record or service role"
on public.one_minute
for insert
with check ( public.is_service_role() or auth.uid() = user_id );

drop policy if exists "Update own record or service role" on public.one_minute;
create policy "Update own record or service role"
on public.one_minute
for update
using ( public.is_service_role() or auth.uid() = user_id )
with check ( public.is_service_role() or auth.uid() = user_id );

drop policy if exists "Delete by service role only" on public.one_minute;
create policy "Delete by service role only"
on public.one_minute
for delete
using ( public.is_service_role() );
