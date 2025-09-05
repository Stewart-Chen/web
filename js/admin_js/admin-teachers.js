// js/admin-teachers.js
// 師資專區（管理用）—— 依賴：全域 window.sb、以及 admin-teachers.html 的 DOM 結構
(function () {
  // ------- 等 sb 及守門通過 -------
  function waitForSB(cb, tries = 60) {
    if (window.sb) return cb();
    if (tries <= 0) return console.error('[teachers] sb not ready');
    setTimeout(() => waitForSB(cb, tries - 1), 100);
  }
  function startWhenGuardOK(start) {
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
    const listBox    = document.getElementById('teacher-list');
    const btnRefresh = document.getElementById('teacher-refresh');
    const btnNew     = document.getElementById('teacher-new');
    const form       = document.getElementById('teacher-form');

    // 表單欄位（沿用你的 html id）
    // 注意：原本的 t-id 可以不需要了（後端用 code 當 key），保留不使用也 OK
    const fCode  = document.getElementById('t-slug');       // ＝ DB 的 code
    const fName  = document.getElementById('t-name');       // ＝ DB 的 name
    const fTitle = document.getElementById('t-role');       // ＝ DB 的 title
    const fAvt   = document.getElementById('t-avatar');     // ＝ DB 的 avatar_url
    const fSpecs = document.getElementById('t-specialties');// UI 為逗號字串 → DB 是 text[] (tags)
    const fBio   = document.getElementById('t-bio');        // ＝ DB 的 bio
    const btnDel = document.getElementById('teacher-delete');

    // 工具：逗號字串 ↔ 陣列
    const toTags = (s) =>
      (s || '')
        .split(/[,，]/)
        .map(x => x.trim())
        .filter(Boolean);
    const tagsToText = (arr) =>
      (Array.isArray(arr) ? arr : [])
        .join(', ');

    function fillForm(t){
      fCode.value  = t?.code || '';
      fName.value  = t?.name || '';
      fTitle.value = t?.title || '';
      fAvt.value   = t?.avatar_url || '';
      fSpecs.value = tagsToText(t?.tags);
      fBio.value   = t?.bio || '';
      btnDel.disabled = !(t && t.code);
    }
    function clearForm(){ fillForm(null); }

    // 讀取清單
    async function refreshList() {
      listBox.innerHTML = '<p class="muted">讀取中…</p>';
      const { data, error } = await sb
        .from('teachers')
        .select('code, name, title, avatar_url, tags, created_at')
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
        <div class="item" data-code="${t.code}">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <img src="${t.avatar_url ? t.avatar_url : 'https://picsum.photos/seed/'+encodeURIComponent(t.code)+'/64/64'}"
                 alt="${t.name || ''}" width="40" height="40"
                 style="border-radius:50%;object-fit:cover;flex:0 0 auto;">
            <div style="min-width:0;">
              <div class="title" style="font-weight:600;">${t.name || '（未命名）'}</div>
              <div class="meta" style="display:flex;gap:8px;flex-wrap:wrap;">
                <span class="badge">code：${t.code}</span>
                <span class="badge">${t.title || '頭銜未填'}</span>
                <span class="muted">${new Date(t.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div><button class="btn" data-act="edit">編輯</button></div>
        </div>
      `).join('');

      listBox.querySelectorAll('[data-act="edit"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const code = e.currentTarget.closest('.item').dataset.code;
          const { data: one, error: e1 } = await sb
            .from('teachers').select('*').eq('code', code).maybeSingle();
          if (e1) { alert('讀取失敗：' + (e1.message || e1)); return; }
          fillForm(one);
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    // 儲存（新增/更新）
    async function saveTeacher(e){
      e?.preventDefault();
      const code = (fCode.value || '').trim();
      const payload = {
        code,
        name:       (fName.value || '').trim(),
        title:      (fTitle.value || '').trim() || null,
        avatar_url: (fAvt.value || '').trim() || null,
        bio:        (fBio.value || '').trim() || null,
        tags:       toTags(fSpecs.value),
      };
      if (!payload.code){ return alert('請填寫識別 code（例：fanfan, xd）'); }
      if (!payload.name){ return alert('請填寫姓名'); }

      try {
        // 使用 upsert 以 code 為衝突鍵（如果你的專案啟用 PostgREST 的 upsert）
        const { error } = await sb.from('teachers')
          .upsert(payload, { onConflict: 'code' });
        if (error) throw error;
        alert('老師資料已儲存');
        await refreshList();
      } catch (err) {
        console.error('[teachers] save error:', err);
        alert('儲存失敗：' + (err?.message || err));
      }
    }

    // 刪除
    async function deleteTeacher(){
      const code = (fCode.value || '').trim();
      if (!code) return alert('請先在清單選取或輸入欲刪除的 code');
      if (!confirm(`確定要刪除老師（${code}）嗎？此動作不可復原。`)) return;
      const { error } = await sb.from('teachers').delete().eq('code', code);
      if (error) return alert('刪除失敗：' + (error.message || error));
      alert('已刪除');
      clearForm();
      await refreshList();
    }

    // 綁定
    btnRefresh?.addEventListener('click', refreshList);
    btnNew?.addEventListener('click', clearForm);
    form?.addEventListener('submit', saveTeacher);
    btnDel?.addEventListener('click', deleteTeacher);

    // 進入頁面先載一次
    refreshList();
  }

  waitForSB(() => startWhenGuardOK(main));
})();
