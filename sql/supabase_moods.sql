-- =========================================
-- moods：每日情緒紀錄
-- =========================================

create table if not exists public.moods (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete set null,
  course_id     bigint references public.courses(id) on delete set null,

  mood_date     date not null default (current_date),           -- 記錄日期（方便查「今天」）
  mood          smallint check (mood between 1 and 5),          -- 1~5
  energy        text check (energy in ('low','mid','high')),
  stress        text check (stress in ('low','mid','high')),
  tags          text[] default '{}'::text[],                    -- 影響面向（可複選）
  activities    text[] default '{}'::text[],                    -- 活動（可複選）
  note          text,                                           -- 備註（選填）

  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 觸發器：自動更新 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_moods_set_updated on public.moods;
create trigger trg_moods_set_updated
before update on public.moods
for each row execute function public.set_updated_at();

-- 索引
create index if not exists moods_user_idx      on public.moods(user_id);
create index if not exists moods_course_idx    on public.moods(course_id);
create index if not exists moods_date_idx      on public.moods(mood_date);

-- 啟用 RLS
alter table public.moods enable row level security;

-- 輔助：是否為 service role
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

-- Policies
drop policy if exists "Read own moods or service role" on public.moods;
create policy "Read own moods or service role"
on public.moods
for select
using ( public.is_service_role() or auth.uid() = user_id );

drop policy if exists "Insert own mood or service role" on public.moods;
create policy "Insert own mood or service role"
on public.moods
for insert
with check ( public.is_service_role() or auth.uid() = user_id );

drop policy if exists "Update own mood or service role" on public.moods;
create policy "Update own mood or service role"
on public.moods
for update
using ( public.is_service_role() or auth.uid() = user_id )
with check ( public.is_service_role() or auth.uid() = user_id );

drop policy if exists "Delete by service role only" on public.moods;
create policy "Delete by service role only"
on public.moods
for delete
using ( public.is_service_role() );

