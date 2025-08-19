-- Supabase schema for 園藝治療課程平台 MVP
-- 注意：建立後請在每個表啟用 RLS，並設定以下政策。

create table if not exists public.courses (
  id bigint generated always as identity primary key,
  title text not null,
  summary text,
  description text,
  cover_url text,
  published boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.lessons (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  order_no int not null default 1,
  title text not null,
  content text,
  created_at timestamptz default now()
);

create table if not exists public.enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id bigint not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  primary key (user_id, course_id)
);

create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  done_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

-- 啟用 RLS
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.progress enable row level security;

-- 讀課程：任何人可讀「已發佈」
create policy "read published courses" on public.courses
for select using (published = true);

-- 讀單元：任何人可讀隸屬於已發佈課程的單元
create policy "read lessons of published courses" on public.lessons
for select using (
  exists (select 1 from public.courses c where c.id = lessons.course_id and c.published = true)
);

-- 報名：登入者可建立/讀取/刪除自己報名
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

