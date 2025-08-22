-- =========================================
-- 園藝與藝術治療課程平台：初始化（可重複執行）
-- 合併版 init.sql（含 courses.category）
-- =========================================

-- ---------- 0) 共用函式 ----------
-- 0-1) updated_at 觸發器函式（若尚未定義）
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 0-2) 判斷是否為 service role（Supabase 用）
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

-- ---------- 1) 管理者表 ----------
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

-- ---------- 2) 核心資料表 ----------
-- 2-1) teachers（以 code 為 PK，供 courses.teacher 參照）
create table if not exists public.teachers (
  code        text primary key,                  -- 與 courses.teacher 對應的代碼
  name        text not null,                     -- 顯示名稱
  title       text,                              -- 抬頭/專長（例：園藝治療師）
  bio         text,                              -- 簡介
  avatar_url  text,                              -- 大頭貼
  tags        text[] default '{}'::text[],       -- 標籤
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at 觸發器
drop trigger if exists trg_teachers_set_updated on public.teachers;
create trigger trg_teachers_set_updated
before update on public.teachers
for each row execute function public.set_updated_at();

-- 索引
create index if not exists teachers_name_idx on public.teachers (name);
create index if not exists teachers_tags_gin on public.teachers using gin (tags);

-- RLS：啟用
alter table public.teachers enable row level security;

-- RLS：公開可讀（前端要展示師資）
drop policy if exists "Public can read teachers" on public.teachers;
create policy "Public can read teachers"
on public.teachers
for select
to anon, authenticated
using ( true );

-- RLS：僅 admins 或 service_role 可新增/修改/刪除
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

-- 2-2) courses
-- 提示：若舊版 courses.teacher 有 CHECK，稍後會移除
create table if not exists public.courses (
  id          bigint generated always as identity primary key,
  title       text not null,
  summary     text,
  description text,
  cover_url   text,
  teacher     text,                             -- 之後由 FK 連到 teachers(code)
  category    text check (category in ('horti','art')),  -- 課程類別（園藝/藝術）
  published   boolean not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- 2-3) lessons
create table if not exists public.lessons (
  id         bigint generated always as identity primary key,
  course_id  bigint not null references public.courses(id) on delete cascade,
  order_no   int not null default 1,
  title      text not null,
  content    text,
  created_at timestamptz not null default now()
);

-- 2-4) enrollments
create table if not exists public.enrollments (
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   bigint not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  fullname    text,
  phone       text,
  line_id     text,
  primary key (user_id, course_id)
);

-- 2-5) progress
create table if not exists public.progress (
  user_id   uuid not null references auth.users(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  done_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ---------- 3) 既有資料庫修補 ----------
-- 3-1) 若舊版本有 CHECK (teacher in ('fanfan','xd'))，移除它
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.courses'::regclass
      and contype = 'c'
      and conname = 'courses_teacher_check'
  ) then
    alter table public.courses drop constraint courses_teacher_check;
  end if;
end
$$;

-- 3-2) 若缺少欄位/約束的修補（保持可重跑）
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
end
$$;

-- 3-3) 補上 category 欄位 / 檢查約束 / 回填（可重複執行）
alter table public.courses
  add column if not exists category text;  -- 先確保欄位存在

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.courses'::regclass
      and conname  = 'courses_category_check'
  ) then
    alter table public.courses
      add constraint courses_category_check
      check (category in ('horti','art'));
  end if;
end
$$;

-- 依 teacher 回填 category（僅填尚未設定者）
update public.courses
set category = case
  when teacher = 'fanfan' then 'horti'
  when teacher = 'xd'     then 'art'
  else category
end
where category is null;

-- ---------- 4) 先回填/種子 teachers，再建立 FK ----------
-- 4-1) 種子師資（避免 FK 失敗；與 courses 取用一致）
insert into public.teachers (code, name, title)
values
  ('fanfan','汎汎','園藝治療師'),
  ('xd','小D','藝術治療師')
on conflict (code) do nothing;

-- 4-2) 從既有 courses.teacher 自動回填（僅新增不存在者）
insert into public.teachers (code, name, title)
select distinct
  c.teacher as code,
  case c.teacher
    when 'fanfan' then '汎汎'
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
  and c.teacher <> ''
on conflict (code) do nothing;

-- 4-3) 為 courses.teacher 建立 FK → teachers(code)，若尚未建立
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
      on delete set null;  -- 刪師資時，課程的 teacher 設為 NULL
  end if;
end
$$;

-- ---------- 5) 索引與額外約束 ----------
create index if not exists idx_courses_created_at      on public.courses(created_at);
create index if not exists idx_courses_teacher         on public.courses(teacher);
create index if not exists idx_courses_category        on public.courses(category); -- 類別索引
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
end
$$;

-- ---------- 6) 啟用 RLS ----------
alter table public.courses     enable row level security;
alter table public.lessons     enable row level security;
alter table public.enrollments enable row level security;
alter table public.progress    enable row level security;

-- ---------- 7) Policies（先刪同名，方便重跑） ----------
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

-- ---------- 8) 種子課程/單元資料（可重複執行） ----------
-- --- fanfan（園藝） ---
insert into public.courses (title, summary, description, cover_url, teacher, category, published)
select '室內植物照護術',
       '用日常植物建立穩定的自我照顧',
       '學會選擇、照護與觀察室內植物，建立可持續的綠色照護流程。',
       'https://picsum.photos/seed/indoor-plants/640/360',
       'fanfan', 'horti', true
where not exists (select 1 from public.courses where title='室內植物照護術');

insert into public.courses (title, summary, description, cover_url, teacher, category, published)
select '正念與園藝冥想',
       '結合正念與園藝，透過呼吸與照護建立日常療癒儀式。',
       '以簡單的園藝任務搭配正念引導，培養專注與穩定感。',
       'https://picsum.photos/seed/mindfulness-garden/640/360',
       'fanfan', 'horti', true
where not exists (select 1 from public.courses where title='正念與園藝冥想');

insert into public.courses (title, summary, description, cover_url, teacher, category, published)
select '治療性花園設計',
       '在照護場域中打造支持身心的綠色空間。',
       '面向長照/社福場域，介紹設計原則與實作案例。',
       'https://picsum.photos/seed/therapeutic-design/640/360',
       'fanfan', 'horti', true
where not exists (select 1 from public.courses where title='治療性花園設計');

-- fanfan lessons（第一堂）
insert into public.lessons (course_id, order_no, title, content)
select id, 1, '植物與你：基礎觀察', '從觀察開始建立連結。'
from public.courses c
where c.title='室內植物照護術'
  and not exists (
    select 1 from public.lessons l
    where l.course_id = c.id and l.order_no = 1 and l.title = '植物與你：基礎觀察'
  );

-- --- xd（藝術） ---
insert into public.courses (title, summary, description, cover_url, teacher, category, published)
select '情緒色彩創作',
       '用色彩表達情緒，探索自我內在狀態。',
       '透過基礎色彩學與自由創作，建立安全的情緒表達空間。',
       'https://picsum.photos/seed/color-emotion/640/360',
       'xd', 'art', true
where not exists (select 1 from public.courses where title='情緒色彩創作');

insert into public.courses (title, summary, description, cover_url, teacher, category, published)
select '水彩與正念表達',
       '以水彩作畫練習專注，結合正念進行情緒照護。',
       '水彩技巧 + 正念實作，幫助舒緩壓力並提升覺察力。',
       'https://picsum.photos/seed/watercolor-mindfulness/640/360',
       'xd', 'art', true
where not exists (select 1 from public.courses where title='水彩與正念表達');

insert into public.courses (title, summary, description, cover_url, teacher, category, published)
select '油畫的療癒表達',
       '用油畫筆觸探索深層情緒，適合進階創作學員。',
       '藉由油畫的層次與厚度，在創作中釋放與整合情緒。',
       'https://picsum.photos/seed/oilpainting-healing/640/360',
       'xd', 'art', true
where not exists (select 1 from public.courses where title='油畫的療癒表達');

-- 為每門課隨機新增 0~5 個「不同的」 lessons（可重複執行；不重複同名；order_no 承接）
WITH per_course AS (
  SELECT
    c.id    AS course_id,
    c.title AS course_title,
    COALESCE((SELECT MAX(order_no) FROM public.lessons WHERE course_id = c.id), 0) AS base_order
  FROM public.courses c
),
catalog AS (
  SELECT * FROM (VALUES
    ('室內植物照護術','光照與水分管理','掌握光照方向與澆水頻率，建立穩定節奏。'),
    ('室內植物照護術','盆器與介質選擇','認識介質特性與通氣、保水的平衡。'),
    ('室內植物照護術','換盆與修剪實作','評估根系、修剪重點與換盆步驟。'),
    ('室內植物照護術','常見病蟲害處理','以預防為主，觀察症狀與對應處理。'),
    ('室內植物照護術','室內綠植佈置','用動線與採光規劃舒適的綠意角落。'),
    ('正念與園藝冥想','呼吸與身體掃描','用呼吸連結此時此刻，穩定身心。'),
    ('正念與園藝冥想','正念澆水練習','在澆水過程中培養覺察與節奏感。'),
    ('正念與園藝冥想','五感覺察與自然','以視聽嗅味觸探索植物帶來的回應。'),
    ('正念與園藝冥想','步行冥想與園藝','結合步行冥想與簡易照護任務。'),
    ('正念與園藝冥想','建立日常療癒儀式','設計可持續的小步驟養成。'),
    ('治療性花園設計','使用者需求盤點','理解服務對象的功能與情緒需求。'),
    ('治療性花園設計','感官與動線規劃','以五感與易達性設計友善路徑。'),
    ('治療性花園設計','植栽選擇與配置','依場域條件與療癒目標配置植物。'),
    ('治療性花園設計','無障礙與安全設計','降低風險、提升使用安全與獨立性。'),
    ('治療性花園設計','維運與成效評估','制定維護流程並追蹤使用回饋。'),
    ('情緒色彩創作','顏色與情緒連結','建立個人色彩與情緒對照表。'),
    ('情緒色彩創作','色票與情緒日記','以色票紀錄每日情緒變化。'),
    ('情緒色彩創作','形狀與構圖表達','用形狀、留白與重複建立表達。'),
    ('情緒色彩創作','限色創作練習','限制顏色提升專注與主題性。'),
    ('情緒色彩創作','分享與回饋','在安全框架中練習表達與傾聽。'),
    ('水彩與正念表達','水彩基本筆觸','掌握筆壓與速度的細節。'),
    ('水彩與正念表達','漸層與疊色','體會顏料水分與層次關係。'),
    ('水彩與正念表達','濕畫法與乾畫法','透過兩種技法表達情緒質地。'),
    ('水彩與正念表達','正念寫生','以專注的步調觀察與描繪。'),
    ('水彩與正念表達','個人主題創作','整合所學完成一幅個人作品。'),
    ('油畫的療癒表達','材料與安全','了解媒材、溶劑與安全注意。'),
    ('油畫的療癒表達','厚塗與肌理','以肌理呈現能量與情緒。'),
    ('油畫的療癒表達','色層與罩染','以多層色彩建構深度。'),
    ('油畫的療癒表達','情緒主題構思','將情緒轉化為可視化主題。'),
    ('油畫的療癒表達','作品分享與回饋','以同儕回饋促進整合與成長。')
  ) AS t(course_title, lesson_title, lesson_content)
),
picked AS (
  SELECT pc.course_id, pc.base_order, cat.lesson_title, cat.lesson_content
  FROM per_course pc
  JOIN LATERAL (
    SELECT c2.lesson_title, c2.lesson_content
    FROM catalog c2
    WHERE c2.course_title = pc.course_title
      AND NOT EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.course_id = pc.course_id
          AND l.title = c2.lesson_title
      )
    ORDER BY c2.lesson_title
    LIMIT 5
  ) AS cat ON TRUE
),
numbered AS (
  SELECT
    course_id,
    base_order + ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY random()) AS order_no,
    lesson_title,
    lesson_content
  FROM picked
)
INSERT INTO public.lessons (course_id, order_no, title, content)
SELECT course_id, order_no, lesson_title, lesson_content
FROM numbered;

-- ---------- 9) 小測試（可選） ----------
-- select * from public.teachers order by code;
-- select * from public.courses where published = true and deleted_at is null order by created_at desc;
