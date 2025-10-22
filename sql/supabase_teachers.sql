-- =========================================
-- teachers：重新建立（for array category 版本）
-- =========================================

-- 1) 建表
create table if not exists public.teachers (
  id           bigint generated always as identity primary key,
  name         text not null,
  category     text,  -- 主要類別（從課程推算）
  summary      text,
  description  text,
  cover_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2) updated_at 觸發器
drop trigger if exists trg_teachers_set_updated on public.teachers;
create trigger trg_teachers_set_updated
before update on public.teachers
for each row execute function public.set_updated_at();

-- 3) 索引
create index if not exists teachers_name_idx     on public.teachers (name);
create index if not exists teachers_category_idx on public.teachers (category);

-- 4) 啟用 RLS
alter table public.teachers enable row level security;

-- ---------- 5) Policies ----------
drop policy if exists "Public can read teachers"            on public.teachers;
drop policy if exists "Admins/service can insert teacher"   on public.teachers;
drop policy if exists "Admins/service can update teacher"   on public.teachers;
drop policy if exists "Admins/service can delete teacher"   on public.teachers;

-- 公開可讀（前端展示）
create policy "Public can read teachers"
on public.teachers
for select
to anon, authenticated
using ( true );

-- 僅 Admins 或 service_role 可新增/修改/刪除
create policy "Admins/service can insert teacher"
on public.teachers
for insert
to authenticated
with check (
  public.is_service_role()
  or exists (select 1 from public.admins a where a.user_id = auth.uid())
);

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

create policy "Admins/service can delete teacher"
on public.teachers
for delete
to authenticated
using (
  public.is_service_role()
  or exists (select 1 from public.admins a where a.user_id = auth.uid())
);

-- =========================================
-- 6) 回填資料：從 courses（category 為 text[]）自動推算
-- =========================================

with teacher_source as (
  -- 所有出現在課程裡的教師名稱
  select distinct c.teacher as name
  from public.courses c
  where c.teacher is not null and c.teacher <> ''
),
teacher_category as (
  -- 用課程的 category 陣列統計教師主要類別
  select ts.name,
         (
           select cat
           from (
             select unnest(c2.category) as cat
             from public.courses c2
             where c2.teacher = ts.name
             and array_length(c2.category,1) > 0
           ) cats
           group by cat
           order by count(*) desc
           limit 1
         ) as main_category
  from teacher_source ts
)
insert into public.teachers (name, category, summary, description, cover_url)
select distinct
  ts.name,
  tc.main_category,
  null::text as summary,
  null::text as description,
  null::text as cover_url
from teacher_source ts
left join teacher_category tc on tc.name = ts.name
where not exists (
  select 1 from public.teachers t
  where t.name = ts.name
);

-- =========================================
-- ✅ 測試查詢
-- select * from public.teachers order by id;
