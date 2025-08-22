// ====== CONFIG ======
const SUPABASE_URL = "https://ilhmywiktdqilmaisbyp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaG15d2lrdGRxaWxtYWlzYnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NTczODcsImV4cCI6MjA3MTIzMzM4N30.qCpu7NhwaEkmyFJmg9MB6MrkcqmPiywGV2c_U3U9h4c";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== 小工具 ======
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function qs(name){ return new URLSearchParams(location.search).get(name); }

// ====== Auth UI ======
const loginLink = document.getElementById('login-link');
const logoutLink = document.getElementById('logout-link');
const authModal = document.getElementById('auth-modal');

if (loginLink) loginLink.addEventListener('click', (e)=>{ e.preventDefault(); authModal?.showModal(); });
if (logoutLink) logoutLink.addEventListener('click', async (e)=>{ e.preventDefault(); await supabase.auth.signOut(); location.reload(); });

if (authModal) {
  const email = document.getElementById('auth-email');
  const passwd = document.getElementById('auth-password');
// === 登入（失敗時 alert）===
document.getElementById('btn-signin')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value, password: passwd.value
  });
  if (error) {
    alert('登入失敗：' + (error.message || '發生未知錯誤'));
    console.error(error);
    return;
  }
  authModal.close(); 
  location.reload();
});

// === 註冊（失敗時 alert）===
document.getElementById('btn-signup')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  const { error } = await supabase.auth.signUp({
    email: email.value, password: passwd.value
  });
  if (error) {
    alert('註冊失敗：' + (error.message || '發生未知錯誤'));
    console.error(error);
    return;
  }
  alert('已寄出驗證郵件（如有設定）。登入後即可使用。');
  authModal.close(); 
  location.reload();
});
}

// 目前使用者
let currentUser = null;
function showAuthModal(){ if (authModal && !authModal.open) authModal.showModal(); }
function requireAuthOrOpenModal(e){
  if (!currentUser){ if (e) e.preventDefault(); showAuthModal(); return false; }
  return true;
}

// ====== 首頁：載入課程 ======
async function loadCourses(){
  const list = document.getElementById('courses-list') || document.getElementById('courses');
  const empty = document.getElementById('courses-empty');
  if (!list) return;

  const { data, error } = await supabase
    .from('courses')
    .select('id,title,summary,cover_url,created_at,category') // ✨ 把 category 撈回來
    .eq('published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  if (!data || data.length === 0){
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  list.innerHTML = data.map(c => `
    <article class="card course-card"
             data-category="${c.teacher === 'fanfan' ? 'horti' : c.teacher === 'xd' ? 'art' : ''}"
             data-teacher="${c.teacher || ''}">
      <img src="${c.cover_url || 'https://picsum.photos/seed/'+c.id+'/640/360'}" 
           alt="封面" 
           style="width:100%; height:160px; object-fit:cover; border-radius:8px" />
      <h4>${c.title}</h4>
      <p class="muted">${c.summary ?? ''}</p>
      <a class="btn" href="course.html?id=${c.id}">查看課程</a>
    </article>
  `).join('');
}

// ====== 課程頁 ======
async function loadCourse(){
  const idParam = qs('id');
  const idNum = Number(idParam);
  const titleEl = document.getElementById('course-title');
  const descEl = document.getElementById('course-desc');
  const lessonsEl = document.getElementById('lessons');
  const lessonsEmpty = document.getElementById('lessons-empty');
  const enrollBtn = document.getElementById('enroll-btn');
  const enrolledBadge = document.getElementById('enrolled-badge');
  const progressEl = document.getElementById('progress');
  const modal = document.getElementById('lesson-modal');

  if (!idParam || Number.isNaN(idNum)) {
    if (titleEl) titleEl.textContent = '找不到課程或尚未發佈';
    return;
  }

  // (A) 課程資訊
  let { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', idNum)
    .eq('published', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) { console.error(error); return; }
  if (!course) { if (titleEl) titleEl.textContent = '找不到課程或尚未發佈'; return; }
  if (titleEl) titleEl.textContent = course.title;
  if (descEl)  descEl.textContent  = course.description ?? course.summary ?? '';

  const teacherBox = document.getElementById('teacher-box-content');
  if (teacherBox) {
    const TEACHER_META = {
      fanfan: { name: '汎汎', role: '園藝治療老師' },
      xd:     { name: '小D', role: '藝術治療老師' }
    };
    const meta = TEACHER_META[course.teacher];
    teacherBox.textContent = meta ? `${meta.name}｜${meta.role}` : (course.teacher || '—');
  }

  // (B) 單元列表
  const { data: lessons, error: lsErr } = await supabase
    .from('lessons')
    .select('id, title, content, order_no')
    .eq('course_id', idNum)
    .order('order_no');
  if (lsErr) { console.error(lsErr); return; }
  if (!lessons || lessons.length === 0){
    lessonsEmpty?.classList.remove('hidden');
  } else if (lessonsEl){
    lessonsEl.innerHTML = lessons.map(ls => `
      <li><button class="btn" data-lesson="${ls.id}">${ls.title}</button></li>
    `).join('');
  }

  // (C) 報名狀態
  let enrolled = false;
  if (currentUser){
    const { data: en, error: enErr } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('course_id', idNum)
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (!enErr && en) enrolled = true;
  }
  if (enrolled) {
    enrollBtn?.classList.add('hidden');
    enrolledBadge?.classList.remove('hidden');
  } else if (enrollBtn){
    enrollBtn.title = currentUser ? '' : '請先登入';

enrollBtn.addEventListener('click', async (e)=>{
  if (!requireAuthOrOpenModal(e)) return;

  // 開啟 dialog
  const dlg = document.getElementById('enroll-dialog');
  if (!dlg) { alert('找不到報名視窗'); return; }
  dlg.showModal();

  // 綁一次 submit（避免重覆綁定）
  const form = document.getElementById('enroll-form');
  if (!form.dataset.bound) {
    form.addEventListener('submit', async (ev)=>{
      ev.preventDefault();

      const name = document.getElementById('enroll-name').value.trim();
      const phone = document.getElementById('enroll-phone').value.trim();
      const line  = document.getElementById('enroll-line').value.trim();

      // 基本驗證（可自行強化）
      if (!name)  { alert('請填寫姓名');  return; }
      if (!phone) { alert('請填寫電話');  return; }
      // 範例：簡單電話規則（10~15 位數字與符號）
      if (!/^[0-9+\-() ]{8,20}$/.test(phone)) { alert('電話格式看起來不正確'); return; }

      const { error: insErr } = await supabase
        .from('enrollments')
        .insert({
          course_id: idNum,
          user_id: currentUser.id,
          fullname: name,
          phone: phone,
          line_id: line || null
        });

      if (insErr){ console.error(insErr); alert('報名失敗：' + insErr.message); return; }

      alert('報名成功！');
      dlg.close();

      // UI 更新：隱藏報名鈕、顯示已報名徽章、解鎖單元
      enrollBtn.classList.add('hidden');
      enrolledBadge?.classList.remove('hidden');
      // 若你有 setLessonLock(true)，這裡也呼叫
      if (typeof setLessonLock === 'function') setLessonLock(true);

      loadProgress(lessons || []);
    });
    form.dataset.bound = '1';
  }
});

    
  }

  // (D) 點單元 → 完成標記
  lessonsEl?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-lesson]');
    if (!btn) return;

    if (!currentUser){ requireAuthOrOpenModal(e); return; }
    if (!enrolled){
      enrollBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      enrollBtn?.classList.add('pulse');
      setTimeout(()=> enrollBtn?.classList.remove('pulse'), 1200);
      return;
    }

    const lesson = (lessons || []).find(x => String(x.id) === btn.dataset.lesson);
    if (!lesson) return;

    $('#lesson-title').textContent = lesson.title;
    $('#lesson-content').innerHTML = lesson.content ? lesson.content.replace(/\n/g,'<br>') : '<p>此單元尚未提供內容。</p>';
    modal?.showModal();

    const markBtn = $('#mark-done');
    if (markBtn){
      markBtn.onclick = async ()=>{
        if (!requireAuthOrOpenModal()) return;
        const { error: upErr } = await supabase.from('progress').upsert({
          user_id: currentUser.id,
          lesson_id: lesson.id,
          done_at: new Date().toISOString()
        });
        if (upErr){ console.error(upErr); return; }
        await loadProgress(lessons || []);
        modal?.close();
      };
    }
  });

  // (E) 進度
  async function loadProgress(lessonList){
    if (!currentUser){ if (progressEl) progressEl.innerHTML = '<span class="muted">登入後可記錄進度。</span>'; return; }
    const ids = (lessonList || []).map(l => l.id);
    if (!ids.length){ if (progressEl) progressEl.innerHTML = '<span class="muted">尚無單元。</span>'; return; }
    const { data: prog, error: pErr } = await supabase
      .from('progress')
      .select('lesson_id, done_at')
      .eq('user_id', currentUser.id)
      .in('lesson_id', ids);
    if (pErr) { console.error(pErr); return; }
    const doneSet = new Set((prog||[]).map(p=>p.lesson_id));
    if (progressEl) progressEl.innerHTML = `完成 ${doneSet.size} / ${ids.length} 單元`;
  }
  loadProgress(lessons || []);
}

// ====== 頁面初始化 ======
function initPage(){
  if (document.getElementById('courses') || document.getElementById('courses-list')) loadCourses();
  if (document.getElementById('course-info')) loadCourse();
}

// ====== 個人化推薦（從資料庫挑） ======
function normalizeTitle(s){
  if (!s) return '';
  return s.replace(/（.*?）/g,'').replace(/^[^：:]*[：:]\s*/,'').replace(/\s+/g,'').toLowerCase();
}
function deriveMetaFromText(course){
  const text = `${course.title ?? ''} ${course.summary ?? ''} ${course.description ?? ''}`;
  const has = (kw)=>text.includes(kw);
  const tags = [
    ...(has('室內植物')?['室內植物']:[]),
    ...(has('多肉')?['多肉']:[]),
    ...(has('正念')||has('冥想')?['正念']:[]),
    ...(has('親子')||has('兒童')?['親子']:[]),
    ...(has('設計')?['設計']:[]),
    ...(has('長照')||has('照護')?['長照']:[]),
    ...(has('水彩')?['水彩']:[]),
    ...(has('油畫')?['油畫']:[]),
    ...(has('色彩')?['色彩']:[]),
    ...(has('藝術')?['藝術']:[]),
    ...(has('園藝')?['園藝']:[]),
  ];
  let level='一般';
  if (has('入門')||has('初階')) level='初階';
  else if (has('中階')) level='中階';
  else if (has('進階')) level='進階';
  else if (has('親子')) level='親子';
  return { tags, level };
}
function parseInterests(v){ return (v||'').split(/[,，]/).map(s=>s.trim()).filter(Boolean); }
function preferredTagsByProfession(p){
  switch(p){
    case 'student': return ['入門','室內植物','多肉','色彩','水彩'];
    case 'office': return ['室內植物','正念'];
    case 'teacher': return ['親子','教育','正念'];
    case 'healthcare': return ['長照','照護','治療性','設計'];
    case 'retired': return ['室內植物','正念'];
    default: return [];
  }
}
function scoreDbCourse(course, {age, gender, interests, profession}){
  const { tags, level } = deriveMetaFromText(course);
  const text = `${course.title ?? ''} ${course.summary ?? ''} ${course.description ?? ''}`;
  let score = 0;
  preferredTagsByProfession(profession).forEach(p=>{ if(tags.some(t=>t.includes(p))||text.includes(p)) score+=2; });
  interests.forEach(k=>{ if(tags.some(t=>t.includes(k))||text.includes(k)) score+=2; });
  if (age<=16 && (tags.includes('親子')||text.includes('親子'))) score+=2;
  if (age>=55 && (tags.includes('正念')||tags.includes('室內植物')||text.includes('正念')||text.includes('室內植物'))) score+=1;
  if (course.teacher==='fanfan' && (text.includes('室內植物')||text.includes('正念'))) score+=1;
  if (course.teacher==='xd' && (text.includes('色彩')||text.includes('水彩')||text.includes('油畫'))) score+=1;
  const levelBonus = { '一般':0,'初階':0.5,'中階':0.8,'進階':1,'親子':0.6 };
  score += levelBonus[level] ?? 0;
  return { score, tags, level };
}
function renderRecommendationsFromDb(list){
  const box = document.getElementById('rec-results');
  if (!box) return;
  if (!list.length){ box.innerHTML = `<p class="muted">沒有找到合適的推薦，試試不同的興趣關鍵字（如：室內植物、正念、多肉、親子）。</p>`; return; }
  box.innerHTML = list.map(c => `
    <article class="course-card">
      <img src="${c.cover_url || `https://picsum.photos/seed/${normalizeTitle(c.title)}/640/360`}" alt="${c.title}" style="width:100%;height:140px;object-fit:cover;border-radius:8px" />
      <h3>${c.title}</h3>
      <div class="course-meta">
        <span class="badge">${c._level || '一般'}</span>
        ${(c._tags || []).slice(0,4).map(t=>`<span class="badge">${t}</span>`).join('')}
      </div>
      <div class="cta">
        <a href="course.html?id=${c.id}" class="btn primary">查看課程</a>
      </div>
    </article>
  `).join('');
}
window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rec-form');
  if (!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const age = parseInt(document.getElementById('age').value || '0', 10);
    const gender = document.getElementById('gender').value || 'nonbinary';
    const interests = parseInterests(document.getElementById('interests').value);
    const profession = document.getElementById('profession').value || 'other';

    const { data: courses, error } = await supabase
      .from('courses')
      .select('id,title,summary,description,cover_url,teacher')
      .eq('published', true)
      .is('deleted_at', null);
    if (error){ console.error('load courses for recommend error:', error); renderRecommendationsFromDb([]); return; }

    const scored = (courses||[]).map(c => {
      const r = scoreDbCourse(c, {age, gender, interests, profession});
      return { ...c, _score: r.score, _tags: r.tags, _level: r.level };
    });
    const top = scored.filter(c=>c._score>0).sort((a,b)=>b._score-a._score).slice(0,6);
    renderRecommendationsFromDb(top);
  });
});

// ====== 老師精選（從資料庫） ======
const TEACHER_META = {
  fanfan: { name: '汎汎', role: '園藝治療老師' },
  xd:     { name: '小D', role: '藝術治療老師' },
};
async function renderTeacherPicksFromDb(teacherKey){
  const wrap = document.getElementById('teacher-picks');
  const titleEl = document.getElementById('teacher-picks-title');
  if (!wrap || !titleEl) return;

  const meta = TEACHER_META[teacherKey];
  if (!teacherKey || !meta){
    titleEl.textContent = '📚 老師精選課程';
    wrap.innerHTML = `<p class="muted">點選上方「看某位老師的課程」或直接瀏覽下方課程列表。</p>`;
    return;
  }
  titleEl.textContent = `📚 ${meta.name} 的精選課程`;

  const { data, error } = await supabase
    .from('courses')
    .select('id,title,summary,cover_url,teacher,created_at,description')
    .eq('published', true)
    .is('deleted_at', null)
    .eq('teacher', teacherKey)
    .order('created_at', { ascending: false });
    // .limit(3)

  if (error){ console.error('load teacher picks error:', error); wrap.innerHTML = `<p class="muted">載入失敗。</p>`; return; }
  if (!data || data.length===0){ wrap.innerHTML = `<p class="muted">這位老師目前尚無已發佈的課程。</p>`; return; }

  const enriched = data.map(c => {
    const { tags, level } = deriveMetaFromText(c);
    return { ...c, _tags: tags, _level: level };
  });

  wrap.innerHTML = enriched.map(c => `
    <article class="course-card">
      <img src="${c.cover_url || `https://picsum.photos/seed/${normalizeTitle(c.title)}/640/360`}" alt="${c.title}" style="width:100%;height:140px;object-fit:cover;border-radius:8px" />
      <h3>${c.title}</h3>
      <div class="course-meta">
        <span class="badge">${c._level || '一般'}</span>
        ${(c._tags || []).slice(0,4).map(t=>`<span class="badge">${t}</span>`).join('')}
      </div>
      <div class="cta">
        <a href="course.html?id=${c.id}" class="btn primary">查看課程</a>
      </div>
    </article>
  `).join('');
}
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const teacherKey = params.get('teacher'); // fanfan / xd
  renderTeacherPicksFromDb(teacherKey);
});

// ========== Admin Panel ==========

// 1) 判斷是否為管理者
async function isAdmin() {
  if (!currentUser) return false;
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  return !!data && !error;
}

// 2) 觸發方式
(function adminTriggers(){
  const dlg = document.getElementById('admin-panel');
  if (!dlg) return;

  async function openIfAdmin() {
    if (!currentUser) { showAuthModal(); return; }
    if (!(await isAdmin())) { alert('需要管理者權限'); return; }
    dlg.showModal();
    await adminRefresh();
  }

  window.addEventListener('keydown', (e)=>{
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault(); openIfAdmin();
    }
  });
  const headerTitle = document.querySelector('.site-header h1, .site-header a.plain');
  let clickCount = 0, timer = null;
  headerTitle?.addEventListener('click', ()=>{
    clickCount++; clearTimeout(timer);
    timer = setTimeout(()=>{ clickCount = 0; }, 600);
    if (clickCount >= 5) { clickCount = 0; openIfAdmin(); }
  });
  if (new URLSearchParams(location.search).get('admin') === '1') openIfAdmin();
})();

// 3) Admin 清單/表單
async function adminRefresh(){
  const wrap = document.getElementById('admin-courses');
  if (!wrap) return;
  const { data, error } = await supabase
    .from('courses')
    .select('id,title,teacher,published,deleted_at,created_at')
    .order('created_at', { ascending: false });
  if (error) { wrap.innerHTML = `<p class="muted">載入失敗：${error.message}</p>`; return; }

  wrap.innerHTML = (data||[]).map(c => `
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

  wrap.querySelectorAll('[data-act="edit"]').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const id = Number(e.currentTarget.closest('.item').dataset.id);
      const { data: one } = await supabase.from('courses').select('*').eq('id', id).maybeSingle();
      adminFillCourseForm(one);
      await adminLoadLessons(one?.id);
    });
  });
}
function adminFillCourseForm(c){
  $('#ac-id').value        = c?.id ?? '';
  $('#ac-title').value     = c?.title ?? '';
  $('#ac-summary').value   = c?.summary ?? '';
  $('#ac-desc').value      = c?.description ?? '';
  $('#ac-cover').value     = c?.cover_url ?? '';
  $('#ac-teacher').value   = c?.teacher ?? '';
  $('#ac-published').checked = !!c?.published;
  const sd = $('#admin-soft-delete'); const hd = $('#admin-hard-delete');
  if (sd) sd.disabled = !c?.id; if (hd) hd.disabled = !c?.id;
}
async function adminLoadLessons(courseId){
  const box = document.getElementById('admin-lessons');
  if (!courseId) { box.innerHTML = '<p class="muted">先選擇或建立課程。</p>'; return; }
  const { data, error } = await supabase
    .from('lessons').select('id,order_no,title,content').eq('course_id', courseId).order('order_no');
  if (error) { box.innerHTML = `<p class="muted">讀取失敗：${error.message}</p>`; return; }

  box.innerHTML = (data||[]).map(l => `
    <div class="item" data-lid="${l.id}">
      <div><strong>${l.order_no}.</strong> ${l.title}</div>
      <div><button class="btn" data-act="edit-lesson">編輯</button></div>
    </div>
  `).join('');

  box.querySelectorAll('[data-act="edit-lesson"]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const wrap = e.currentTarget.closest('.item');
      const lid = Number(wrap.dataset.lid);
      supabase.from('lessons').select('*').eq('id', lid).maybeSingle().then(({data})=>{
        $('#al-id').value    = lid;
        $('#al-order').value = data?.order_no ?? 1;
        $('#al-title').value = data?.title ?? '';
        $('#al-content').value = data?.content ?? '';
      });
    });
  });
}

// ====== Admin 儲存/刪除（含 dialog 巢狀表單修補） ======
async function saveCourseFromForm() {
  if (!await isAdmin()) { alert('只有管理者可以操作'); return; }

  const payload = {
    title:   $('#ac-title').value.trim(),
    summary: $('#ac-summary').value.trim() || null,
    description: $('#ac-desc').value.trim() || null,
    cover_url: $('#ac-cover').value.trim() || null,
    teacher: $('#ac-teacher').value,
    published: $('#ac-published').checked,
  };
  const id = Number($('#ac-id').value || 0);
  if (!payload.title) { alert('請填寫標題'); return; }
  if (!payload.teacher) { alert('請選擇授課老師'); return; }

  try {
    if (id) {
      const { error } = await supabase.from('courses').update(payload).eq('id', id);
      if (error) throw error;
      alert('課程已更新');
    } else {
      const { error } = await supabase.from('courses').insert([payload]);
      if (error) throw error;
      alert('課程已建立');
    }
    await adminRefresh();
  } catch (err) {
    console.error('saveCourse error:', err);
    alert('儲存失敗：' + (err?.message || err));
  }
}
async function saveLessonFromForm() {
  if (!await isAdmin()) { alert('只有管理者可以操作'); return; }

  const courseId = Number($('#ac-id').value || 0);
  if (!courseId) { alert('請先選擇或建立課程'); return; }

  const payload = {
    course_id: courseId,
    order_no:  Number($('#al-order').value || 1),
    title:     $('#al-title').value.trim(),
    content:   $('#al-content').value.trim() || null,
  };
  const id = Number($('#al-id').value || 0);
  if (!payload.title) { alert('請填寫單元標題'); return; }
  if (payload.order_no <= 0) { alert('順序需為正整數'); return; }

  try {
    if (id) {
      const { error } = await supabase.from('lessons').update(payload).eq('id', id);
      if (error) throw error;
      alert('單元已更新');
    } else {
      const { error } = await supabase.from('lessons').insert([payload]);
      if (error) throw error;
      alert('單元已新增');
    }
    $('#al-id').value = '';
    await adminLoadLessons(courseId);
  } catch (err) {
    console.error('saveLesson error:', err);
    alert('儲存單元失敗：' + (err?.message || err));
  }
}

// 保留 submit（未來若移除外層 form 也能用）
document.getElementById('admin-course-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault(); e.stopPropagation(); await saveCourseFromForm();
});
document.getElementById('admin-lesson-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault(); e.stopPropagation(); await saveLessonFromForm();
});

// 🔧 補 click 雙保險，避免被 <form method="dialog"> 吞掉
(function patchDialogNestedForms(){
  const saveBtn = document.querySelector('#admin-course-form button[type="submit"]');
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.addEventListener('click', async (e)=>{ e.preventDefault(); e.stopPropagation(); await saveCourseFromForm(); });
    saveBtn.dataset.bound = '1';
  }
  const saveLessonBtn = document.querySelector('#admin-lesson-form button[type="submit"]');
  if (saveLessonBtn && !saveLessonBtn.dataset.bound) {
    saveLessonBtn.addEventListener('click', async (e)=>{ e.preventDefault(); e.stopPropagation(); await saveLessonFromForm(); });
    saveLessonBtn.dataset.bound = '1';
  }
})();

// 其他 Admin 事件
document.getElementById('admin-refresh')?.addEventListener('click', adminRefresh);
document.getElementById('admin-new-course')?.addEventListener('click', ()=>{
  adminFillCourseForm(null);
  const ls = document.getElementById('admin-lessons');
  if (ls) ls.innerHTML = '<p class="muted">尚無單元。</p>';
});
document.getElementById('admin-soft-delete')?.addEventListener('click', async ()=>{
  if (!await isAdmin()) return alert('只有管理者可以操作');
  const id = Number($('#ac-id').value || 0);
  if (!id) return;
  if (!confirm('移到回收（可復原）？')) return;
  const { error } = await supabase.from('courses')
    .update({ deleted_at: new Date().toISOString(), published: false })
    .eq('id', id);
  if (error) return alert('刪除失敗：' + error.message);
  alert('已移到回收'); await adminRefresh();
});
document.getElementById('admin-hard-delete')?.addEventListener('click', async ()=>{
  if (!await isAdmin()) return alert('只有管理者可以操作');
  const id = Number($('#ac-id').value || 0);
  if (!id) return;
  if (!confirm('⚠ 永久刪除課程與所有單元，確定？')) return;
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) return alert('刪除失敗：' + error.message);
  alert('已永久刪除'); await adminRefresh();
});
// 刪除選取單元
document.getElementById('admin-lesson-delete')?.addEventListener('click', async ()=>{
  if (!await isAdmin()) return alert('只有管理者可以操作');

  const courseId = Number($('#ac-id').value || 0);
  const lessonId = Number($('#al-id').value || 0); // 由「編輯」時帶入的選取單元 id

  if (!courseId) return alert('請先選擇或建立課程');
  if (!lessonId) return alert('請先在清單中點「編輯」選取要刪除的單元');

  if (!confirm('確定要刪除這個單元？此動作不可復原。')) return;

  const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
  if (error) return alert('刪除失敗：' + error.message);

  alert('已刪除單元');
  $('#al-id').value = '';                 // 清掉選取的單元 id
  await adminLoadLessons(courseId);       // 重新載入單元清單
});

// ====== Admin 連結顯示控制 ======
async function updateAdminLink(){
  const adminLink = document.getElementById('admin-link');
  if (!adminLink) return;
  if (!currentUser) { adminLink.classList.add('hidden'); return; }
  const ok = await isAdmin();
  adminLink.classList.toggle('hidden', !ok);
  if (ok && !adminLink.dataset.bound) {
    adminLink.addEventListener('click', async (e) => {
      e.preventDefault();
      document.getElementById('admin-panel').showModal();
      await adminRefresh();
    });
    adminLink.dataset.bound = '1';
  }
}

// ====== Auth 初始化 ======
supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  $('#login-link')?.classList.toggle('hidden', !!currentUser);
  $('#logout-link')?.classList.toggle('hidden', !currentUser);
  updateAdminLink();
});
supabase.auth.getUser().then(({ data }) => {
  currentUser = data?.user ?? null;
  if (currentUser) { loginLink?.classList.add('hidden'); logoutLink?.classList.remove('hidden'); }
  updateAdminLink();
  initPage();
});
document.getElementById('tools-select')?.addEventListener('change', function(){
  if (this.value) {
    window.location.href = this.value; // 跳轉到對應頁面
  }
});
