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
alter table public.enrollments add column if not exists fullname text;
alter table public.enrollments add column if not exists phone    text;
alter table public.enrollments add column if not exists line_id  text;

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
select '室內植物照護術',
       '用日常植物建立穩定的自我照顧',
       '學會選擇、照護與觀察室內植物，建立可持續的綠色照護流程。',
       'https://picsum.photos/seed/indoor-plants/640/360',
       'fanfan', true
where not exists (select 1 from public.courses where title='室內植物照護術');

insert into public.courses (title, summary, description, cover_url, teacher, published)
select '正念與園藝冥想',
       '結合正念與園藝，透過呼吸與照護建立日常療癒儀式。',
       '以簡單的園藝任務搭配正念引導，培養專注與穩定感。',
       'https://picsum.photos/seed/mindfulness-garden/640/360',
       'fanfan', true
where not exists (select 1 from public.courses where title in ('正念與園藝冥想'));

insert into public.courses (title, summary, description, cover_url, teacher, published)
select '治療性花園設計',
       '在照護場域中打造支持身心的綠色空間。',
       '面向長照/社福場域，介紹設計原則與實作案例。',
       'https://picsum.photos/seed/therapeutic-design/640/360',
       'fanfan', true
where not exists (select 1 from public.courses where title in ('治療性花園設計'));

-- fanfan lessons
insert into public.lessons (course_id, order_no, title, content)
select id, 1, '植物與你：基礎觀察', '從觀察開始建立連結。'
from public.courses c
where c.title='室內植物照護術';

-- --- xd ---
insert into public.courses (title, summary, description, cover_url, teacher, published)
select '情緒色彩創作',
       '用色彩表達情緒，探索自我內在狀態。',
       '透過基礎色彩學與自由創作，建立安全的情緒表達空間。',
       'https://picsum.photos/seed/color-emotion/640/360',
       'xd', true
where not exists (select 1 from public.courses where title='情緒色彩創作');

insert into public.courses (title, summary, description, cover_url, teacher, published)
select '水彩與正念表達',
       '以水彩作畫練習專注，結合正念進行情緒照護。',
       '水彩技巧 + 正念實作，幫助舒緩壓力並提升覺察力。',
       'https://picsum.photos/seed/watercolor-mindfulness/640/360',
       'xd', true
where not exists (select 1 from public.courses where title='水彩與正念表達');

insert into public.courses (title, summary, description, cover_url, teacher, published)
select '油畫的療癒表達',
       '用油畫筆觸探索深層情緒，適合進階創作學員。',
       '藉由油畫的層次與厚度，在創作中釋放與整合情緒。',
       'https://picsum.photos/seed/oilpainting-healing/640/360',
       'xd', true
where not exists (select 1 from public.courses where title='油畫的療癒表達');

-- 為每門課隨機新增 0~5 個「不同的」 lessons（可重複執行；不重複同名；order_no 承接）
WITH per_course AS (
  SELECT
    c.id   AS course_id,
    c.title AS course_title,
    COALESCE((SELECT MAX(order_no) FROM public.lessons WHERE course_id = c.id), 0) AS base_order
  FROM public.courses c
),
catalog AS (
  -- 依課程對應候選 lessons（標題＋內容）
  SELECT * FROM (VALUES
    -- 室內植物照護術
    ('室內植物照護術','光照與水分管理','掌握光照方向與澆水頻率，建立穩定節奏。'),
    ('室內植物照護術','盆器與介質選擇','認識介質特性與通氣、保水的平衡。'),
    ('室內植物照護術','換盆與修剪實作','評估根系、修剪重點與換盆步驟。'),
    ('室內植物照護術','常見病蟲害處理','以預防為主，觀察症狀與對應處理。'),
    ('室內植物照護術','室內綠植佈置','用動線與採光規劃舒適的綠意角落。'),

    -- 正念與園藝冥想
    ('正念與園藝冥想','呼吸與身體掃描','用呼吸連結此時此刻，穩定身心。'),
    ('正念與園藝冥想','正念澆水練習','在澆水過程中培養覺察與節奏感。'),
    ('正念與園藝冥想','五感覺察與自然','以視聽嗅味觸探索植物帶來的回應。'),
    ('正念與園藝冥想','步行冥想與園藝','結合步行冥想與簡易照護任務。'),
    ('正念與園藝冥想','建立日常療癒儀式','設計可持續的小步驟養成。'),

    -- 治療性花園設計
    ('治療性花園設計','使用者需求盤點','理解服務對象的功能與情緒需求。'),
    ('治療性花園設計','感官與動線規劃','以五感與易達性設計友善路徑。'),
    ('治療性花園設計','植栽選擇與配置','依場域條件與療癒目標配置植物。'),
    ('治療性花園設計','無障礙與安全設計','降低風險、提升使用安全與獨立性。'),
    ('治療性花園設計','維運與成效評估','制定維護流程並追蹤使用回饋。'),

    -- 情緒色彩創作
    ('情緒色彩創作','顏色與情緒連結','建立個人色彩與情緒對照表。'),
    ('情緒色彩創作','色票與情緒日記','以色票紀錄每日情緒變化。'),
    ('情緒色彩創作','形狀與構圖表達','用形狀、留白與重複建立表達。'),
    ('情緒色彩創作','限色創作練習','限制顏色提升專注與主題性。'),
    ('情緒色彩創作','分享與回饋','在安全框架中練習表達與傾聽。'),

    -- 水彩與正念表達
    ('水彩與正念表達','水彩基本筆觸','掌握筆壓與速度的細節。'),
    ('水彩與正念表達','漸層與疊色','體會顏料水分與層次關係。'),
    ('水彩與正念表達','濕畫法與乾畫法','透過兩種技法表達情緒質地。'),
    ('水彩與正念表達','正念寫生','以專注的步調觀察與描繪。'),
    ('水彩與正念表達','個人主題創作','整合所學完成一幅個人作品。'),

    -- 油畫的療癒表達
    ('油畫的療癒表達','材料與安全','了解媒材、溶劑與安全注意。'),
    ('油畫的療癒表達','厚塗與肌理','以肌理呈現能量與情緒。'),
    ('油畫的療癒表達','色層與罩染','以多層色彩建構深度。'),
    ('油畫的療癒表達','情緒主題構思','將情緒轉化為可視化主題。'),
    ('油畫的療癒表達','作品分享與回饋','以同儕回饋促進整合與成長。')
  ) AS t(course_title, lesson_title, lesson_content)
),
picked AS (
  -- 針對每門課，從候選清單中隨機抓 0~5 個，且排除已存在同名的 lessons
  SELECT pc.course_id,
         pc.base_order,
         cat.lesson_title,
         cat.lesson_content
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
  -- 依每門課各自編連續 order_no（承接 base_order 之後）
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


