-- 1) 看還有哪些課程在用 xd
select id, title from public.courses where teacher = 'xd';

-- 2) 先把課程的 teacher 清掉（或改到其他老師代碼）
update public.courses
set teacher = null          -- 或改成 'fanfan' / 其它代碼
where teacher = 'xd';

-- 3) 確認沒有任何課程還在引用
select count(*) from public.courses where teacher = 'xd';

-- 4) 刪除師資 xd
delete from public.teachers where code = 'xd';

