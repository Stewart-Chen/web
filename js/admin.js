// admin.js —— 管理頁專用邏輯
// 使用在 admin.html 裡建立好的全域 client：window.sb
(() => {
  const sb = window.sb;
  let currentUser = null;

// --- Auth UI 同步：讓抬頭按鈕正確顯示登入/登出 ---
let currentUser = null; // 後面 admin 功能也會用到

const headerLogin  = document.getElementById('login-link');   // 共用抬頭的登入按鈕
const headerLogout = document.getElementById('logout-link');  // 共用抬頭的登出按鈕
const mobileLogin  = document.getElementById('mobile-login-link');  // 如果你有放到手機抽屜
const mobileLogout = document.getElementById('mobile-logout-link');

function renderAuthUI(user){
  const loggedIn = !!user;
  headerLogin?.classList.toggle('hidden',  loggedIn);
  headerLogout?.classList.toggle('hidden', !loggedIn);
  mobileLogin?.classList.toggle('hidden',  loggedIn);
  mobileLogout?.classList.toggle('hidden', !loggedIn);
}

sb.auth.onAuthStateChange((_evt, session) => {
  currentUser = session?.user || null;
  renderAuthUI(currentUser);
});

// 初始載入時跑一次
sb.auth.getUser().then(({ data }) => {
  currentUser = data?.user ?? null;
  renderAuthUI(currentUser);
});

// （可選）處理登出按鈕點擊
headerLogout?.addEventListener('click', async (e) => {
  e.preventDefault();
  await sb.auth.signOut();
  // 依需求可導回首頁或留在本頁：
  // location.replace('index.html');
});
mobileLogout?.addEventListener('click', async (e) => {
  e.preventDefault();
  await sb.auth.signOut();
  // location.replace('index.html');
});

  
  // 取得目前使用者（部分動作要用）
  async function ensureUser() {
    if (currentUser) return currentUser;
    const { data } = await sb.auth.getUser();
    currentUser = data?.user ?? null;
    return currentUser;
  }

  // 是否為管理者
  async function isAdmin() {
    const user = await ensureUser();
    if (!user) return false;
    const { data, error } = await sb
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    return !!data && !error;
  }

  // ===== 課程清單 =====
  async function adminRefresh() {
    const wrap = document.getElementById('admin-courses');
    if (!wrap) return;

    const { data, error } = await sb
      .from('courses')
      .select('id,title,teacher,published,deleted_at,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      wrap.innerHTML = `<p class="muted">載入失敗：${error?.message || error}</p>`;
      return;
    }

    wrap.innerHTML = (data || []).map(c => `
      <div class="item" data-id="${c.id}">
        <div>
          <div class="title">${c.title}</div>
          <div class="meta">
            <span class="badge">老師：${c.teacher || '—'}</span>
            <span class="badge">${c.published ? '已發佈' : '未發佈'}</span>
            ${c.deleted_at ? '<span class="badge">已刪除</span>' : ''}
            <span class="muted">${new Date(c.created_at).toLocaleString()}</span>
          </div>
        </div>
        <div><button class="btn" data-act="edit">編輯</button></div>
      </div>
    `).join('');

    wrap.querySelectorAll('[data-act="edit"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.closest('.item').dataset.id);
        const { data: one } = await sb.from('courses').select('*').eq('id', id).maybeSingle();
        adminFillCourseForm(one);
        await adminLoadLessons(one?.id);
      });
    });
  }

  // ===== 表單填入 =====
  function adminFillCourseForm(c) {
    document.getElementById('ac-id').value        = c?.id ?? '';
    document.getElementById('ac-title').value     = c?.title ?? '';
    document.getElementById('ac-summary').value   = c?.summary ?? '';
    document.getElementById('ac-desc').value      = c?.description ?? '';
    document.getElementById('ac-cover').value     = c?.cover_url ?? '';
    document.getElementById('ac-teacher').value   = c?.teacher ?? '';
    document.getElementById('ac-published').checked = !!c?.published;

    const sd = document.getElementById('admin-soft-delete');
    const hd = document.getElementById('admin-hard-delete');
    if (sd) sd.disabled = !c?.id;
    if (hd) hd.disabled = !c?.id;
  }

  // ===== 單元清單 =====
  async function adminLoadLessons(courseId) {
    const box = document.getElementById('admin-lessons');
    if (!courseId) { box.innerHTML = '<p class="muted">先選擇或建立課程。</p>'; return; }

    const { data, error } = await sb
      .from('lessons')
      .select('id,order_no,title,content')
      .eq('course_id', courseId)
      .order('order_no');

    if (error) { box.innerHTML = `<p class="muted">讀取失敗：${error.message}</p>`; return; }

    box.innerHTML = (data || []).map(l => `
      <div class="item" data-lid="${l.id}">
        <div><strong>${l.order_no}.</strong> ${l.title}</div>
        <div><button class="btn" data-act="edit-lesson">編輯</button></div>
      </div>
    `).join('');

    box.querySelectorAll('[data-act="edit-lesson"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const wrap = e.currentTarget.closest('.item');
        const lid = Number(wrap.dataset.lid);
        sb.from('lessons').select('*').eq('id', lid).maybeSingle().then(({ data }) => {
          document.getElementById('al-id').value    = lid;
          document.getElementById('al-order').value = data?.order_no ?? 1;
          document.getElementById('al-title').value = data?.title ?? '';
          document.getElementById('al-content').value = data?.content ?? '';
        });
      });
    });
  }

  // ===== 課程儲存 =====
  async function saveCourseFromForm() {
    if (!await isAdmin()) { alert('只有管理者可以操作'); return; }

    const payload = {
      title:       document.getElementById('ac-title').value.trim(),
      summary:     document.getElementById('ac-summary').value.trim() || null,
      description: document.getElementById('ac-desc').value.trim() || null,
      cover_url:   document.getElementById('ac-cover').value.trim() || null,
      teacher:     document.getElementById('ac-teacher').value,
      published:   document.getElementById('ac-published').checked,
    };
    const id = Number(document.getElementById('ac-id').value || 0);

    if (!payload.title)   { alert('請填寫標題'); return; }
    if (!payload.teacher) { alert('請選擇授課老師'); return; }

    try {
      if (id) {
        const { error } = await sb.from('courses').update(payload).eq('id', id);
        if (error) throw error;
        alert('課程已更新');
      } else {
        const { error } = await sb.from('courses').insert([payload]);
        if (error) throw error;
        alert('課程已建立');
      }
      await adminRefresh();
    } catch (err) {
      console.error('saveCourse error:', err);
      alert('儲存失敗：' + (err?.message || err));
    }
  }

  // ===== 單元儲存 =====
  async function saveLessonFromForm() {
    if (!await isAdmin()) { alert('只有管理者可以操作'); return; }

    const courseId = Number(document.getElementById('ac-id').value || 0);
    if (!courseId) { alert('請先選擇或建立課程'); return; }

    const payload = {
      course_id: courseId,
      order_no:  Number(document.getElementById('al-order').value || 1),
      title:     document.getElementById('al-title').value.trim(),
      content:   document.getElementById('al-content').value.trim() || null,
    };
    const id = Number(document.getElementById('al-id').value || 0);

    if (!payload.title) { alert('請填寫單元標題'); return; }
    if (payload.order_no <= 0) { alert('順序需為正整數'); return; }

    try {
      if (id) {
        const { error } = await sb.from('lessons').update(payload).eq('id', id);
        if (error) throw error;
        alert('單元已更新');
      } else {
        const { error } = await sb.from('lessons').insert([payload]);
        if (error) throw error;
        alert('單元已新增');
      }
      document.getElementById('al-id').value = '';
      await adminLoadLessons(courseId);
    } catch (err) {
      console.error('saveLesson error:', err);
      alert('儲存單元失敗：' + (err?.message || err));
    }
  }

  // ===== 刪除動作 =====
  document.getElementById('admin-soft-delete')?.addEventListener('click', async () => {
    if (!await isAdmin()) return alert('只有管理者可以操作');
    const id = Number(document.getElementById('ac-id').value || 0);
    if (!id) return;
    if (!confirm('移到回收（可復原）？')) return;
    const { error } = await sb.from('courses')
      .update({ deleted_at: new Date().toISOString(), published: false }).eq('id', id);
    if (error) return alert('刪除失敗：' + error.message);
    alert('已移到回收'); await adminRefresh();
  });

  document.getElementById('admin-hard-delete')?.addEventListener('click', async () => {
    if (!await isAdmin()) return alert('只有管理者可以操作');
    const id = Number(document.getElementById('ac-id').value || 0);
    if (!id) return;
    if (!confirm('⚠ 永久刪除課程與所有單元，確定？')) return;
    const { error } = await sb.from('courses').delete().eq('id', id);
    if (error) return alert('刪除失敗：' + error.message);
    alert('已永久刪除'); await adminRefresh();
  });

  document.getElementById('admin-lesson-delete')?.addEventListener('click', async () => {
    if (!await isAdmin()) return alert('只有管理者可以操作');
    const courseId = Number(document.getElementById('ac-id').value || 0);
    const lessonId = Number(document.getElementById('al-id').value || 0);
    if (!courseId) return alert('請先選擇或建立課程');
    if (!lessonId) return alert('請先在清單中點「編輯」選取要刪除的單元');
    if (!confirm('確定要刪除這個單元？此動作不可復原。')) return;

    const { error } = await sb.from('lessons').delete().eq('id', lessonId);
    if (error) return alert('刪除失敗：' + error.message);

    alert('已刪除單元');
    document.getElementById('al-id').value = '';
    await adminLoadLessons(courseId);
  });

  // ===== 表單提交 =====
  document.getElementById('admin-course-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); e.stopPropagation(); await saveCourseFromForm();
  });
  document.getElementById('admin-lesson-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); e.stopPropagation(); await saveLessonFromForm();
  });

  // ===== 其他 UI =====
  document.getElementById('admin-refresh')?.addEventListener('click', adminRefresh);
  document.getElementById('admin-new-course')?.addEventListener('click', () => {
    adminFillCourseForm(null);
    const ls = document.getElementById('admin-lessons');
    if (ls) ls.innerHTML = '<p class="muted">尚無單元。</p>';
  });

  // 進入頁面 → 先刷新一次列表
  window.addEventListener('DOMContentLoaded', adminRefresh);
})();

