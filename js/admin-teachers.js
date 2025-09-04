// js/admin-teachers.js
// 師資專區（管理用）—— 依賴：全域 window.sb、以及 admin-teachers.html 的 DOM 結構
(function () {
  // ------- 基礎防呆：等 sb 存在、等守門通過 -------
  function waitForSB(cb, tries = 60) {
    if (window.sb) return cb();
    if (tries <= 0) return console.error('[teachers] sb not ready');
    setTimeout(() => waitForSB(cb, tries - 1), 100);
  }

  function startWhenGuardOK(start) {
    // 還在守門中 → 等事件；否則直接啟動
    if (document.documentElement.getAttribute('data-guard') === 'checking') {
      document.addEventListener('admin:guard-ok', start, { once: true });
    } else {
      start();
    }
  }

  // ------- 主程式 -------
  function main() {
    const sb = window.sb;

    // DOM
    const listBox      = document.getElementById('teacher-list');
    const btnRefresh   = document.getElementById('teacher-refresh');
    const btnNew       = document.getElementById('teacher-new');
    const form         = document.getElementById('teacher-form');
    const fId          = document.getElementById('t-id');
    const fSlug        = document.getElementById('t-slug');
    const fName        = document.getElementById('t-name');
    const fRole        = document.getElementById('t-role');
    const fAvatar      = document.getElementById('t-avatar');
    const fSpecs       = document.getElementById('t-specialties');
    const fBio         = document.getElementById('t-bio');
    const btnDelete    = document.getElementById('teacher-delete');

    if (!listBox || !form) {
      console.warn('[teachers] required DOM not found, abort.');
      return;
    }

    // 你資料表的欄位假設：
    // teachers: id (serial/int), slug (text unique), name (text), role (text),
    // avatar_url (text), specialties (text), bio (text), created_at (timestamptz)
    // 若你的欄位不同，請對照下面 select / payload 調整。

    // === 工具 ===
    function fillForm(t) {
      fId.value    = t?.id ?? '';
      fSlug.value  = t?.slug ?? '';
      fName.value  = t?.name ?? '';
      fRole.value  = t?.role ?? '';
      fAvatar.value= t?.avatar_url ?? '';
      fSpecs.value = t?.specialties ?? '';
      fBio.value   = t?.bio ?? '';
      btnDelete.disabled = !(t && t.id);
    }

    function clearForm() { fillForm(null); }

    // === 讀取清單 ===
    async function refreshList() {
      listBox.innerHTML = '<p class="muted">讀取中…</p>';
      const { data, error } = await sb
        .from('teachers')
        .select('id, slug, name, role, avatar_url, specialties, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[teachers] list error:', error);
        listBox.innerHTML = `<p class="muted">載入失敗：${error.message || error}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        listBox.innerHTML = `<p class="muted">目前尚無老師資料。</p>`;
        return;
      }

      listBox.innerHTML = data.map(t => `
        <div class="item" data-id="${t.id}">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <img src="${t.avatar_url ? t.avatar_url : 'https://picsum.photos/seed/'+encodeURIComponent(t.slug||t.id)+'/64/64'}"
                 alt="${t.name || ''}" width="40" height="40"
                 style="border-radius:50%;object-fit:cover;flex:0 0 auto;">
            <div style="min-width:0;">
              <div class="title" style="font-weight:600;">${t.name || '（未命名）'}</div>
              <div class="meta" style="display:flex;gap:8px;flex-wrap:wrap;">
                <span class="badge">slug：${t.slug || '—'}</span>
                <span class="badge">${t.role || '角色未填'}</span>
                <span class="muted">${new Date(t.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div><button class="btn" data-act="edit">編輯</button></div>
        </div>
      `).join('');

      // 綁定「編輯」
      listBox.querySelectorAll('[data-act="edit"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = Number(e.currentTarget.closest('.item').dataset.id);
          const { data: one, error: e1 } = await sb
            .from('teachers').select('*').eq('id', id).maybeSingle();
          if (e1) { alert('讀取失敗：' + (e1.message || e1)); return; }
          fillForm(one);
          // 捲到表單更方便編輯
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    // === 儲存（新增/更新） ===
    async function saveTeacher(e) {
      e?.preventDefault();
      const id = Number(fId.value || 0);
      const payload = {
        slug:        (fSlug.value || '').trim(),
        name:        (fName.value || '').trim(),
        role:        (fRole.value || '').trim() || null,
        avatar_url:  (fAvatar.value || '').trim() || null,
        specialties: (fSpecs.value || '').trim() || null,
        bio:         (fBio.value || '').trim() || null,
      };

      if (!payload.slug) { alert('請填寫識別 slug（例：fanfan, xd）'); return; }
      if (!payload.name) { alert('請填寫姓名'); return; }

      try {
        if (id) {
          const { error } = await sb.from('teachers').update(payload).eq('id', id);
          if (error) throw error;
          alert('老師資料已更新');
        } else {
          const { error } = await sb.from('teachers').insert([payload]);
          if (error) throw error;
          alert('老師資料已建立');
        }
        await refreshList();
      } catch (err) {
        console.error('[teachers] save error:', err);
        alert('儲存失敗：' + (err?.message || err));
      }
    }

    // === 刪除 ===
    async function deleteTeacher() {
      const id = Number(fId.value || 0);
      if (!id) return alert('請先從左側清單選取要刪除的老師');
      if (!confirm('確定要刪除這位老師嗎？此動作不可復原。')) return;
      const { error } = await sb.from('teachers').delete().eq('id', id);
      if (error) return alert('刪除失敗：' + (error.message || error));
      alert('已刪除');
      clearForm();
      await refreshList();
    }

    // 綁定事件
    btnRefresh?.addEventListener('click', refreshList);
    btnNew?.addEventListener('click', clearForm);
    form?.addEventListener('submit', saveTeacher);
    btnDelete?.addEventListener('click', deleteTeacher);

    // 進入頁面先載一次清單
    refreshList();
  }

  // 啟動：先等 sb，再等守門
  waitForSB(() => startWhenGuardOK(main));
})();

