-- =========================================
-- teachers init.sql  （可重複執行）
-- - 建立 teachers 表（以 code 為主鍵，接軌 courses.teacher）
-- - 從 courses.teacher 自動回填
-- - 加上 FK 約束到 courses.teacher
-- - 啟用 RLS + Policies（公開可讀；admins/service_role 可管理）
-- - 索引 + updated_at 觸發器
-- =========================================

-- 0) 共用：updated_at 觸發器函式（若尚未定義）
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 0-1) 共用：判斷是否為 service role（Supabase 用）
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

-- 1) 表：teachers（以 code 對應 courses.teacher）
create table if not exists public.teachers (
  code        text primary key,                  -- 與 courses.teacher 對應的代碼
  name        text not null,                     -- 顯示名稱
  title       text,                              -- 抬頭/專長（例：園藝治療師）
  bio         text,                              -- 簡介
  avatar_url  text,                              -- 大頭貼
  tags        text[] default '{}'::text[],       -- 標籤（例：{'園藝','藝術治療'}）
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 1-1) updated_at 觸發器
drop trigger if exists trg_teachers_set_updated on public.teachers;
create trigger trg_teachers_set_updated
before update on public.teachers
for each row execute function public.set_updated_at();

-- 2) 索引
create index if not exists teachers_name_idx on public.teachers (name);
create index if not exists teachers_tags_gin on public.teachers using gin (tags);

-- 3) 啟用 RLS
alter table public.teachers enable row level security;

-- 3-1) Policies
-- 公開可讀（前端要展示師資）
drop policy if exists "Public can read teachers" on public.teachers;
create policy "Public can read teachers"
on public.teachers
for select
to anon, authenticated
using ( true );

-- 僅 admins 或 service_role 可新增/修改/刪除
-- 需要有 public.admins (user_id uuid PK)；你的 init 已建立此表
drop policy if exists "Admins/service can insert teacher" on public.teachers;
create policy "Admins/service can insert teacher"
on public.teachers
for insert
to authenticated
with check (
  public.is_service_role()
  or exists (select 1 from public.admins a where a.user_id = auth.uid())
);

drop policy if exists "Admins/service can update teacher" on public.teachers;
create policy "Admins/service can update teacher"
on public.teachers
for update
to authenticated
using (
  public.is_service_role()
  or exists (select 1 from public.admins a where a.user_id = auth.uid())
)
with check (
  public.is_service_role()
  or exists (select 1 from public.admins a where a.user_id = auth.uid())
);

drop policy if exists "Admins/service can delete teacher" on public.teachers;
create policy "Admins/service can delete teacher"
on public.teachers
for delete
to authenticated
using (
  public.is_service_role()
  or exists (select 1 from public.admins a where a.user_id = auth.uid())
);

-- 4) 從 courses.teacher 自動回填（僅新增不存在者）
--    你現有的 courses.teacher 目前有 check ('fanfan','xd')
insert into public.teachers (code, name, title)
select distinct
  c.teacher as code,
  case c.teacher
    when 'fanfan' then '芳芳'
    when 'xd'     then '小D'
    else c.teacher
  end as name,
  case c.teacher
    when 'fanfan' then '園藝治療師'
    when 'xd'     then '藝術治療師'
    else null
  end as title
from public.courses c
where c.teacher is not null
on conflict (code) do nothing;

-- 5) 為 courses.teacher 加上 FK → teachers(code)
--    注意：Postgres 不支援 "add constraint if not exists"；用 DO 檢查後再加
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_teacher_fk'
      and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses
      add constraint courses_teacher_fk
      foreign key (teacher)
      references public.teachers(code)
      on update cascade
      on delete restrict;
  end if;
end
$$;

-- ===（可選）如需移除舊的 teacher check constraint，請手動在 UI 刪除，或在此補精確名稱 drop constraint <name>;

-- 6) 小測試（可選）：查看匯入結果
-- select * from public.teachers order by code;

