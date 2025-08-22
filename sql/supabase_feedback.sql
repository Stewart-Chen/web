-- =========================================
-- feedback：課後滿意度（初始化）
-- - 可重複執行（IF NOT EXISTS）
-- - 參照 auth.users / public.courses
-- - 僅擁有者可讀寫；Service Role 自動通行
-- =========================================

-- 1) 資料表
create table if not exists public.feedback (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete set null,
  course_id     bigint references public.courses(id) on delete set null,

  overall       smallint check (overall between 1 and 5),
  clarity       smallint check (clarity between 1 and 5),
  usefulness    smallint check (usefulness between 1 and 5),

  pace          text check (pace in ('slow','just','fast')),      -- 上課節奏
  recommend     text check (recommend in ('yes','maybe','no')),   -- 是否推薦
  participants  text[] default '{}'::text[],                      -- 參與方式（多選）
  comment       text,                                             -- 留言（選填）

  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2) 觸發器：自動更新 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_feedback_set_updated on public.feedback;
create trigger trg_feedback_set_updated
before update on public.feedback
for each row execute function public.set_updated_at();

-- 3) 索引
create index if not exists feedback_user_idx      on public.feedback(user_id);
create index if not exists feedback_course_idx    on public.feedback(course_id);
create index if not exists feedback_submitted_idx on public.feedback(submitted_at);

-- 4) 開啟 RLS
alter table public.feedback enable row level security;

-- 5) 小工具：判斷是否為 Service Role（Server/Edge 用）
--    注意：client 端永遠不會帶 service_role；僅後端金鑰會。
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

-- 6) Policies
-- 6-1 讀取：擁有者可讀；Service Role 全讀
drop policy if exists "Read own feedback or service role" on public.feedback;
create policy "Read own feedback or service role"
on public.feedback
for select
using (
  public.is_service_role()
  or auth.uid() = user_id
);

-- 6-2 新增：必須登入，且只能寫入自己的 user_id；Service Role 可代寫
drop policy if exists "Insert own feedback or service role" on public.feedback;
create policy "Insert own feedback or service role"
on public.feedback
for insert
with check (
  public.is_service_role()
  or auth.uid() = user_id
);

-- 6-3 更新：擁有者可改；Service Role 可改
drop policy if exists "Update own feedback or service role" on public.feedback;
create policy "Update own feedback or service role"
on public.feedback
for update
using (
  public.is_service_role()
  or auth.uid() = user_id
)
with check (
  public.is_service_role()
  or auth.uid() = user_id
);

-- 6-4 刪除：預設僅 Service Role（避免學生誤刪）
drop policy if exists "Delete by service role only" on public.feedback;
create policy "Delete by service role only"
on public.feedback
for delete
using ( public.is_service_role() );

-- 7)（可選）授權：遵循 Supabase 預設，RLS 主導；不額外 GRANT。
--    anon/authenticated 仍可連進 schema，但若不符合 policy 就無法操作。

-- 8)（可選）基本檢查：至少一條 policy 生效
-- select * from pg_policies where schemaname='public' and tablename='feedback';
