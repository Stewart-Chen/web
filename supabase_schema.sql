-- ==========================================
-- 園藝與藝術治療課程平台：完整初始化腳本 (可重複執行)
-- ==========================================

-- ========== 1) Tables ==========
create table if not exists public.courses (
  id          bigint generated always as identity primary key,
  title       text not null,
  summary     text,
  description text,
  cover_url   text,
  teacher     text check (teacher in ('fanfan','xd')) default null, -- 兩位老師：汎汎 / 小D
  published   boolean default false,
  created_at  timestamptz default now()
);

create table if not exists public.lessons (
  id         bigint generated always as identity primary key,
  course_id  bigint not null references public.courses(id) on delete cascade,
  order_no   int not null default 1,
  title      text not null,
  content    text,
  created_at timestamptz default now()
);

create table if not exists public.enrollments (
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   bigint not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  primary key (user_id, course_id)
);

create table if not exists public.progress (
  user_id   uuid not null references auth.users(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  done_at   timestamptz default now(),
  primary key (user_id, lesson_id)
);

-- 若早期版本沒有 teacher 欄位：補上（避免報錯）
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'teacher'
  ) then
    alter table public.courses add column teacher text;
    -- 加上允許的值檢查
    alter table public.courses
      add constraint courses_teacher_check
      check (teacher in ('fanfan','xd'));
  end if;
end$$;

-- ========== 2) Indexes & Constraints ==========
-- 參照鍵與常用查詢索引
create index if not exists idx_courses_created_at     on public.courses(created_at);
create index if not exists idx_courses_teacher        on public.courses(teacher);
create index if not exists idx_lessons_course_id      on public.lessons(course_id);
create index if not exists idx_lessons_order_no       on public.lessons(order_no);
create index if not exists idx_enrollments_user_id    on public.enrollments(user_id);
create index if not exists idx_enrollments_course_id  on public.enrollments(course_id);
create index if not exists idx_progress_user_id       on public.progress(user_id);
create index if not exists idx_progress_lesson_id     on public.progress(lesson_id);

-- 單一課程內的單元順序唯一、且必須 > 0
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lessons_unique_order_per_course'
  ) then
    alter table public.lessons
      add constraint lessons_unique_order_per_course
      unique (course_id, order_no);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lessons_order_no_positive'
  ) then
    alter table public.lessons
      add constraint lessons_order_no_positive
      check (order_no > 0);
  end if;
end$$;

-- ========== 3) Enable RLS ==========
alter table public.courses     enable row level security;
alter table public.lessons     enable row level security;
alter table public.enrollments enable row level security;
alter table public.progress    enable row level security;

-- ========== 4) Policies（可重跑：先清除同名 policy） ==========
drop policy if exists "read published courses"            on public.courses;
drop policy if exists "read lessons of published courses" on public.lessons;

drop policy if exists "enroll self"                       on public.enrollments;
drop policy if exists "read own enrollments"              on public.enrollments;
drop policy if exists "delete own enrollments"            on public.enrollments;

drop policy if exists "upsert own progress"               on public.progress;
drop policy if exists "read own progress"                 on public.progress;
drop policy if exists "update own progress"               on public.progress;
drop policy if exists "delete own progress"               on public.progress;

-- 課程：任何人可讀「已發佈」
create policy "read published courses" on public.courses
for select using (published = true);

-- 單元：任何人可讀屬於「已發佈課程」的單元
create policy "read lessons of published courses" on public.lessons
for select using (
  exists (
    select 1 from public.courses c
    where c.id = lessons.course_id and c.published = true
  )
);

-- 報名：登入者可管理自己的報名
create policy "enroll self" on public.enrollments
for insert with check (auth.uid() = user_id);

create policy "read own enrollments" on public.enrollments
for select using (auth.uid() = user_id);

create policy "delete own enrollments" on public.enrollments
for delete using (auth.uid() = user_id);

-- 進度：登入者可管理自己的進度
create policy "upsert own progress" on public.progress
for insert with check (auth.uid() = user_id);

create policy "read own progress" on public.progress
for select using (auth.uid() = user_id);

create policy "update own progress" on public.progress
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own progress" on public.progress
for delete using (auth.uid() = user_id);

-- ========== 5) Seed Data：兩位老師 + 兩門課 + 單元 ==========
-- 課程（避免重複：以 title 檢查）
insert into public.courses (title, summary, description, teacher, published)
select '室內植物照護術（汎汎）',
       '用日常植物建立穩定的自我照顧',
       '學會選擇、照護與觀察室內植物，建立可持續的綠色照護流程。',
       'fanfan',
       true
where not exists (select 1 from public.courses where title = '室內植物照護術（汎汎）');

insert into public.courses (title, summary, description, teacher, published)
select '情緒色彩創作（小D）',
       '用色彩與自然素材練習情緒表達',
       '以簡單可複製的創作練習梳理情緒，建立安全與支持的表達空間。',
       'xd',
       true
where not exists (select 1 from public.courses where title = '情緒色彩創作（小D）');

-- 依標題取得課程 id（每次執行都會是同一筆）
-- 單元：以 (course_id, order_no) 避免重複
insert into public.lessons (course_id, order_no, title, content)
select c.id, 1, '植物與你：基礎觀察', '從觀察開始建立連結。'
from public.courses c
where c.title = '室內植物照護術（汎汪）' -- 若你複製過舊版本有 typo，先嘗試這行
  and not exists (
    select 1 from public.lessons l where l.course_id = c.id and l.order_no = 1
  );

-- 更嚴謹：若你確定標題無誤，請改用正確標題（建議保留兩段都跑，第一段若無該標題自然不會插入）
insert into public.lessons (course_id, order_no, title, content)
select c.id, 1, '植物與你：基礎觀察', '從觀察開始建立連結。'
from public.courses c
where c.title = '室內植物照護術（汎汎）'
  and not exists (
    select 1 from public.lessons l where l.course_id = c.id and l.order_no = 1
  );

insert into public.lessons (course_id, order_no, title, content)
select c.id, 2, '澆水與光照', '找到屬於你的照護節奏。'
from public.courses c
where c.title = '室內植物照護術（汎汪）'
  and not exists (
    select 1 from public.lessons l where l.course_id = c.id and l.order_no = 2
  );

insert into public.lessons (course_id, order_no, title, content)
select c.id, 2, '澆水與光照', '找到屬於你的照護節奏。'
from public.courses c
where c.title = '室內植物照護術（汎汎）'
  and not exists (
    select 1 from public.lessons l where l.course_id = c.id and l.order_no = 2
  );

insert into public.lessons (course_id, order_no, title, content)
select c.id, 1, '安全感畫布', '用呼吸與色塊建立安全邊界。'
from public.courses c
where c.title = '情緒色彩創作（小D）'
  and not exists (
    select 1 from public.lessons l where l.course_id = c.id and l.order_no = 1
  );

insert into public.lessons (course_id, order_no, title, content)
select c.id, 2, '顏色日記', '用顏色紀錄情緒的流動。'
from public.courses c
where c.title = '情緒色彩創作（小D）'
  and not exists (
    select 1 from public.lessons l where l.course_id = c.id and l.order_no = 2
  );

-- ========== 6) 快速檢查（需要時自行執行） ==========
-- select id, title, teacher, published from public.courses order by id;
-- select c.title as course, l.order_no, l.title as lesson from public.lessons l join public.courses c on c.id = l.course_id order by c.id, l.order_no;
