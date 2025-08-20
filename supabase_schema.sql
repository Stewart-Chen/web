-- ==========================================
-- 園藝與藝術治療課程平台：初始化（可重複執行）
-- ==========================================

-- ========== 0) admins ==========
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins self read" on public.admins;
create policy "admins self read" on public.admins
for select
to anon, authenticated
using (auth.uid() = user_id);

-- ========== 1) Tables ==========
create table if not exists public.courses (
  id          bigint generated always as identity primary key,
  title       text not null,
  summary     text,
  description text,
  cover_url   text,
  teacher     text check (teacher in ('fanfan','xd')),
  published   boolean not null default false,
  deleted_at  timestamptz,                        -- 供軟刪除
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id         bigint generated always as identity primary key,
  course_id  bigint not null references public.courses(id) on delete cascade,
  order_no   int not null default 1,
  title      text not null,
  content    text,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   bigint not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table if not exists public.progress (
  user_id   uuid not null references auth.users(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  done_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- 既有資料庫補欄位（避免重建）
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='courses' and column_name='deleted_at'
  ) then
    alter table public.courses add column deleted_at timestamptz;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='courses' and column_name='published'
      and is_nullable='YES'
  ) then
    alter table public.courses alter column published set not null;
  end if;
end$$;

-- ========== 2) Indexes & Constraints ==========
create index if not exists idx_courses_created_at      on public.courses(created_at);
create index if not exists idx_courses_teacher         on public.courses(teacher);
create index if not exists idx_courses_pub_notdeleted  on public.courses(published, deleted_at);
create index if not exists idx_lessons_course_id       on public.lessons(course_id);
create index if not exists idx_lessons_order_no        on public.lessons(order_no);
create index if not exists idx_enrollments_user_id     on public.enrollments(user_id);
create index if not exists idx_enrollments_course_id   on public.enrollments(course_id);
create index if not exists idx_progress_user_id        on public.progress(user_id);
create index if not exists idx_progress_lesson_id      on public.progress(lesson_id);

-- 同課程內的單元排序唯一 & > 0（只建一次）
do $$
begin
  if not exists (select 1 from pg_constraint where conname='lessons_unique_order_per_course') then
    alter table public.lessons add constraint lessons_unique_order_per_course unique (course_id, order_no);
  end if;
  if not exists (select 1 from pg_constraint where conname='lessons_order_no_positive') then
    alter table public.lessons add constraint lessons_order_no_positive check (order_no > 0);
  end if;
end$$;

-- ========== 3) Enable RLS ==========
alter table public.courses     enable row level security;
alter table public.lessons     enable row level security;
alter table public.enrollments enable row level security;
alter table public.progress    enable row level security;

-- ========== 4) Policies（先刪同名，方便重跑） ==========
drop policy if exists "read published courses"            on public.courses;
drop policy if exists "read lessons of published courses" on public.lessons;

drop policy if exists "enroll self"                       on public.enrollments;
drop policy if exists "read own enrollments"              on public.enrollments;
drop policy if exists "delete own enrollments"            on public.enrollments;

drop policy if exists "upsert own progress"               on public.progress;
drop policy if exists "read own progress"                 on public.progress;
drop policy if exists "update own progress"               on public.progress;
drop policy if exists "delete own progress"               on public.progress;

-- Courses：任何人可讀「已發佈且未軟刪」
create policy "read published courses" on public.courses
for select
to anon, authenticated
using (published = true and deleted_at is null);

-- Lessons：任何人可讀屬於「已發佈且未軟刪」課程的單元
create policy "read lessons of published courses" on public.lessons
for select
to anon, authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = public.lessons.course_id
      and c.published = true
      and c.deleted_at is null
  )
);

-- Enrollments：登入者管理自己的報名
create policy "enroll self" on public.enrollments
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "read own enrollments" on public.enrollments
for select
to authenticated
using (auth.uid() = user_id);

create policy "delete own enrollments" on public.enrollments
for delete
to authenticated
using (auth.uid() = user_id);

-- Progress：登入者管理自己的進度
create policy "upsert own progress" on public.progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "read own progress" on public.progress
for select
to authenticated
using (auth.uid() = user_id);

create policy "update own progress" on public.progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete own progress" on public.progress
for delete
to authenticated
using (auth.uid() = user_id);

-- ========== 5) Seed Data ==========
-- --- fanfan ---
insert into public.courses (title, summary, description, cover_url, teacher, published)
select '室內植物照護術（汎汎）',
       '用日常植物建立穩定的自我照顧',
       '學會選擇、照護與觀察室內植物，建立可持續的綠色照護流程。',
       'https://picsum.photos/seed/indoor-plants/640/360',
       'fanfan', true
where not exists (select 1 from public.courses where title='室內植物照護術（汎汪）' or title='室內植物照護術（汎汎）');

insert into public.courses (title, summary, description, cover_url, teacher, published)
select '正念與園藝冥想（汎汎）',
       '結合正念與園藝，透過呼吸與照護建立日常療癒儀式。',
       '以簡單的園藝任務搭配正念引導，培養專注與穩定感。',
       'https://picsum.photos/seed/mindfulness-garden/640/360',
       'fanfan', true
where not exists (select 1 from public.courses where title in ('正念與園藝冥想（汎汪）','正念與園藝冥想（汎汪）','正念與園藝冥想（汎汎）'));

insert into public.courses (title, summary, description, cover_url, teacher, published)
select '治療性花園設計（汎汎）',
       '在照護場域中打造支持身心的綠色空間。',
       '面向長照/社福場域，介紹設計原則與實作案例。',
       'https://picsum.photos/seed/therapeutic-design/640/360',
       'fanfan', true
where not exists (select 1 from public.courses where title in ('治療性花園設計（汎汪）','治療性花園設計（汎汎）'));

-- 修正舊 typo
update public.courses set title='治療性花園設計（汎汪）' where false; -- 佔位，避免誤改
update public.courses set title='治療性花園設計（汎汎）' where title='治療性花園設計（汎汪）';

-- fanfan lessons
insert into public.lessons (course_id, order_no, title, content)
select id, 1, '植物與你：基礎觀察', '從觀察開始建立連結。'
from public.courses c
where c.title='室內植物照護術（汎汪）' or c.title='室內植物照護術（汎汪）'; -- 若有舊資料可改為對應
-- 上面兩行如有疑慮，改成：
-- where c.title='室內植物照護術（汎汪）' or c.title='室內植物照護術（汎汪）';

-- --- xd ---
insert into public.courses (title, summary, description, cover_url, teacher, published)
select '情緒色彩創作（小D）',
       '用色彩表達情緒，探索自我內在狀態。',
       '透過基礎色彩學與自由創作，建立安全的情緒表達空間。',
       'https://picsum.photos/seed/color-emotion/640/360',
       'xd', true
where not exists (select 1 from public.courses where title='情緒色彩創作（小D）');

insert into public.courses (title, summary, description, cover_url, teacher, published)
select '水彩與正念表達（小D）',
       '以水彩作畫練習專注，結合正念進行情緒照護。',
       '水彩技巧 + 正念實作，幫助舒緩壓力並提升覺察力。',
       'https://picsum.photos/seed/watercolor-mindfulness/640/360',
       'xd', true
where not exists (select 1 from public.courses where title='水彩與正念表達（小D）');

insert into public.courses (title, summary, description, cover_url, teacher, published)
select '油畫的療癒表達（小D）',
       '用油畫筆觸探索深層情緒，適合進階創作學員。',
       '藉由油畫的層次與厚度，在創作中釋放與整合情緒。',
       'https://picsum.photos/seed/oilpainting-healing/640/360',
       'xd', true
where not exists (select 1 from public.courses where title='油畫的療癒表達（小D）');

-- （如需完整 lessons 種子，可依原稿追加，並在 where not exists 中比對該課程+order_no）
