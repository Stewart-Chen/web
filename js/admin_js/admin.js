// admin.js —— 管理頁專用邏輯（不碰 Header 的登入/登出顯示）
// 使用在 admin.html 裡建立好的全域 client：window.sb
(() => {
  const sb = window.sb;
  let currentUser = null;

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

    // === GALLERY HELPERS ===
  const GALLERY_BUCKET = 'course-gallery';

  function safeName(name='img'){
    const ext = (name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
    const base = name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]+/gi,'-').slice(0,40) || 'img';
    return `${base}-${Date.now()}.${ext}`;
  }

  async function uploadFilesToGallery(courseId, fileList){
    if (!courseId) throw new Error('請先建立課程再上傳圖片');
    const files = Array.from(fileList || []);
    if (!files.length) return [];

    const storage = sb.storage.from(GALLERY_BUCKET);
    const results = [];

    for (const f of files){
      const path = `${courseId}/${safeName(f.name)}`;
      const { error } = await storage.upload(path, f, { upsert: false, cacheControl: '3600' });
      if (error) throw error;
      results.push(path);
    }
    return results; // 回傳的是「storage 路徑陣列」
  }

  async function getPublicUrls(paths=[]){
    if (!paths.length) return [];
    const storage = sb.storage.from(GALLERY_BUCKET);
    return paths.map(p => storage.getPublicUrl(p).data.publicUrl).filter(Boolean);
  }

  async function loadCourseGallery(courseId){
    const { data, error } = await sb.from('courses').select('gallery').eq('id', courseId).maybeSingle();
    if (error) throw error;
    return Array.isArray(data?.gallery) ? data.gallery : [];
  }

  async function saveCourseGallery(courseId, paths){
    // 覆寫 courses.gallery
    const { error } = await sb.from('courses').update({ gallery: paths }).eq('id', courseId);
    if (error) throw error;
  }

  async function removeOneFromGallery(courseId, path){
    const list = await loadCourseGallery(courseId);
    const next = list.filter(p => p !== path);
    await saveCourseGallery(courseId, next);
    // 同步刪 Storage 檔案（非必要，可視權限決定）
    try {
      await sb.storage.from(GALLERY_BUCKET).remove([path]);
    } catch {}
    return next;
  }

  async function renderGalleryPreview(courseId){
    const box = document.getElementById('ac-gallery');
    if (!box || !courseId) return;
    const paths = await loadCourseGallery(courseId);
    const urls  = await getPublicUrls(paths);

    box.innerHTML = urls.map((url, i) => {
      const path = paths[i];
      const filename = path.split('/').pop();
      return `
        <figure class="thumb">
          <img class="pic" src="${url}" alt="${filename}">
          <figcaption title="${filename}">${filename}</figcaption>
          <button type="button" class="btn-del" data-del="${path}">刪除</button>
        </figure>
      `;
    }).join('');

    // 綁刪除
    box.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const path = e.currentTarget.getAttribute('data-del');
        if (!confirm('刪除此圖片？')) return;
        try{
          const next = await removeOneFromGallery(courseId, path);
          await renderGalleryPreview(courseId);
          alert('已刪除');
        }catch(err){
          console.error(err);
          alert('刪除失敗：' + (err?.message || err));
        }
      });
    });
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
        adminRenderGallerySection(one);     // ← 新增：渲染 gallery 預覽
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
    //document.getElementById('ac-cover').value     = c?.cover_url ?? '';
    document.getElementById('ac-teacher').value   = c?.teacher ?? '';
    document.getElementById('ac-published').checked = !!c?.published;

    const sd = document.getElementById('admin-soft-delete');
    const hd = document.getElementById('admin-hard-delete');
    if (sd) sd.disabled = !c?.id;
    if (hd) hd.disabled = !c?.id;
  }

  // 呼叫預覽（在 adminFillCourseForm 執行完後執行）
  function adminRenderGallerySection(c){
    const id = Number(c?.id || document.getElementById('ac-id')?.value || 0);
    if (id) renderGalleryPreview(id);
    else {
      const box = document.getElementById('ac-gallery');
      if (box) box.innerHTML = '<p class="muted">尚未建立課程，請先填資料按「儲存」建立後再上傳圖片。</p>';
    }
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
        const { data, error } = await sb.from('courses').insert([payload]).select('id').maybeSingle();
        if (error) throw error;
        // 取新 id 並放回表單
        const newId = data?.id;
        document.getElementById('ac-id').value = newId || '';
        alert('課程已建立');
      }
      await adminRefresh();
      // 新增：更新右側 gallery 預覽
      const cid = Number(document.getElementById('ac-id').value || 0);
      if (cid) adminRenderGallerySection({ id: cid });
      
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
    const box = document.getElementById('ac-gallery');
    if (box) box.innerHTML = '<p class="muted">尚未建立課程，請先儲存後再上傳圖片。</p>';
  });


  // === Gallery 上傳/刷新 ===
  const uploadBtn = document.getElementById('ac-upload-btn');
  const refreshBtn = document.getElementById('ac-refresh-gallery');
  const fileInput = document.getElementById('ac-gallery-files');
  const selectBtn  = document.getElementById('ac-select-files');
  
  selectBtn?.addEventListener('click', async () => {
    // 先試 HTTPS 專用 API（需使用者手勢）
    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [{ description: 'Images', accept: { 'image/*': ['.png','.jpg','.jpeg','.webp','.gif'] } }]
        });
        // 轉成 FileList：用 DataTransfer 塞進 input（方便沿用你的上傳流程）
        const dt = new DataTransfer();
        for (const h of handles) {
          const f = await h.getFile();
          dt.items.add(f);
        }
        fileInput.files = dt.files;
        // 這裡你可以順手觸發預覽或上傳按鈕的 enabled 狀態
        return;
      } catch (err) {
        // 使用者取消或被策略擋，落回傳統 input
        // console.debug('FS Access fallback:', err);
      }
    }
  
    // 退回傳統 input：確保在使用者手勢內直接呼叫
    fileInput.click();
  });
  
  uploadBtn?.addEventListener('click', async () => {
    const files = fileInput?.files;
    if (!files || !files.length) return alert('請先選擇要上傳的圖片');
    // 這裡接上原本的上傳流程
  });


  uploadBtn?.addEventListener('click', async ()=>{
    if (!await isAdmin()) return alert('只有管理者可以操作');
    const courseId = Number(document.getElementById('ac-id').value || 0);
    if (!courseId) return alert('請先「儲存」建立課程後再上傳圖片');
    const files = fileInput?.files;
    if (!files || !files.length) return alert('請先選擇要上傳的圖片');

    try{
      const paths = await uploadFilesToGallery(courseId, files);
      const old   = await loadCourseGallery(courseId);
      const next  = Array.from(new Set([ ...old, ...paths ])); // 合併去重
      await saveCourseGallery(courseId, next);
      await renderGalleryPreview(courseId);
      fileInput.value = '';
      alert('上傳完成');
    }catch(err){
      console.error(err);
      alert('上傳失敗：' + (err?.message || err));
    }
  });

  refreshBtn?.addEventListener('click', async ()=>{
    const courseId = Number(document.getElementById('ac-id').value || 0);
    if (!courseId) return;
    await renderGalleryPreview(courseId);
  });

  
  // 進入頁面 → 先刷新一次列表
  window.addEventListener('DOMContentLoaded', adminRefresh);
})();
