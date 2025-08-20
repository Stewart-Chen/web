// ====== CONFIG ======
// 1) 填入你的 Supabase 專案 URL 與匿名金鑰（安全：僅擁有者權限受 RLS 限制）
const SUPABASE_URL = "https://ilhmywiktdqilmaisbyp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaG15d2lrdGRxaWxtYWlzYnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NTczODcsImV4cCI6MjA3MTIzMzM4N30.qCpu7NhwaEkmyFJmg9MB6MrkcqmPiywGV2c_U3U9h4c";

// 2) 建立 Supabase 用戶端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== 共用工具 ======
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function qs(name){ return new URLSearchParams(location.search).get(name); }
function formatDate(iso){ return new Date(iso).toLocaleDateString(); }

// ====== Auth UI ======
const loginLink = document.getElementById('login-link');
const logoutLink = document.getElementById('logout-link');
const authModal = document.getElementById('auth-modal');

if (loginLink) loginLink.addEventListener('click', (e)=>{ e.preventDefault(); authModal?.showModal(); });
if (logoutLink) logoutLink.addEventListener('click', async (e)=>{ e.preventDefault(); await supabase.auth.signOut(); location.reload(); });

if (authModal) {
  const email = document.getElementById('auth-email');
  const passwd = document.getElementById('auth-password');
  document.getElementById('btn-signin')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: passwd.value });
    if (error) { console.error(error); return; }
    authModal.close(); location.reload();
  });
  document.getElementById('btn-signup')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email: email.value, password: passwd.value });
    if (error) { console.error(error); return; }
    alert('已寄出驗證郵件（如有設定）。登入後即可使用。');
    authModal.close(); location.reload();
  });
}

// 目前使用者 + 登入狀態管理
let currentUser = null;
function showAuthModal(){
  if (authModal && !authModal.open) authModal.showModal();
}
function requireAuthOrOpenModal(e){
  if (!currentUser){
    if (e) e.preventDefault();
    showAuthModal();
    return false;
  }
  return true;
}

// ====== 首頁：載入課程 ======
async function loadCourses(){
  const list = document.getElementById('courses-list') || document.getElementById('courses');
  const empty = document.getElementById('courses-empty');
  if (!list) return;

  const { data, error } = await supabase
    .from('courses')
    .select('id,title,summary,cover_url,created_at')
    .eq('published', true)
    .is('deleted_at', null)               // 只顯示未軟刪
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  if (!data || data.length === 0){
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  list.innerHTML = data.map(c => `
    <article class="card">
      <img src="${c.cover_url || 'https://picsum.photos/seed/'+c.id+'/640/360'}" alt="封面" style="width:100%; height:160px; object-fit:cover; border-radius:8px" />
      <h4>${c.title}</h4>
      <p class="muted">${c.summary ?? ''}</p>
      <a class="btn" href="course.html?id=${c.id}">查看課程</a>
    </article>
  `).join('');
}

// ====== 課程頁：載入課程 + 單元 + 報名 ======
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

  // (A) 課程資訊：公開可讀（published=true）
  let { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', idNum)
    .eq('published', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) { console.error(error); return; }
  if (!course) {
    if (titleEl) titleEl.textContent = '找不到課程或尚未發佈';
    return;
  }
  titleEl.textContent = course.title;
  if (descEl) descEl.textContent = course.description ?? course.summary ?? '';

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
      <li>
        <button class="btn" data-lesson="${ls.id}">${ls.order_no}. ${ls.title}</button>
      </li>
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

  // 調整 UI 與點擊行為
  if (enrolled) {
    enrollBtn?.classList.add('hidden');
    enrolledBadge?.classList.remove('hidden');
  } else if (enrollBtn){
    enrollBtn.title = currentUser ? '' : '請先登入';
    enrollBtn.addEventListener('click', async (e)=>{
      if (!requireAuthOrOpenModal(e)) return;
      const { error: insErr } = await supabase
        .from('enrollments')
        .insert({ course_id: idNum, user_id: currentUser.id });
      if (insErr){ console.error(insErr); return; }
      enrollBtn.classList.add('hidden');
      enrolledBadge?.classList.remove('hidden');
      loadProgress(lessons || []);
    });
  }

  // (D) 點單元：完成標記
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
    if (!currentUser){
      if (progressEl) progressEl.innerHTML = '<span class="muted">登入後可記錄進度。</span>';
      return;
    }
    const ids = (lessonList || []).map(l => l.id);
    if (!ids.length){
      if (progressEl) progressEl.innerHTML = '<span class="muted">尚無單元。</span>';
      return;
    }
    const { data: prog, error: pErr } = await supabase
      .from('progress')
      .select('lesson_id, done_at')
      .eq('user_id', currentUser.id)
      .in('lesson_id', ids);
    if (pErr) { console.error(pErr); return; }
    const doneSet = new Set((prog||[]).map(p=>p.lesson_id));
    const total = ids.length;
    const done = doneSet.size;
    if (progressEl) progressEl.innerHTML = `完成 ${done} / ${total} 單元`;
  }
  loadProgress(lessons || []);
}

// 頁面初始化
function initPage(){
  if (document.getElementById('courses') || document.getElementById('courses-list')) loadCourses();
  if (document.getElementById('course-info')) loadCourse();
}

// ====== 個人化推薦（修正版：點「查看課程」連到 DB 的數字 id） ======
const COURSES = [
  { id:'intro-garden',       title:'園藝治療入門',       level:'初階',   audience:['student','office','retired','teacher'], tags:['園藝入門','身心紓壓'], gender: 'all' },
  { id:'indoor-plants',      title:'室內植物照護術',     level:'初階',   audience:['office','student','retired'],           tags:['室內植物','綠化空間'], gender: 'all' },
  { id:'succulents-art',     title:'多肉與小景設計',     level:'初/中階', audience:['student','office','other'],            tags:['多肉','手作'], gender: 'all' },
  { id:'mindfulness-garden', title:'正念與園藝冥想',     level:'中階',   audience:['teacher','healthcare','office'],        tags:['正念','身心健康'], gender: 'all' },
  { id:'therapeutic-design', title:'治療性花園設計',     level:'進階',   audience:['healthcare','teacher'],                tags:['照護','設計','長照'], gender: 'all' },
  { id:'kids-horti',         title:'親子自然感官探索',   level:'親子',   audience:['teacher','other'],                     tags:['親子','教育','感官'], gender:'all' },
];

// 將標題做一致化（去掉全形括號註記、可選前綴、空白、轉小寫）
function normalizeTitle(s){
  if (!s) return '';
  return s
    .replace(/（.*?）/g, '')         // 去掉（汎汎）
    .replace(/^[^：:]*[：:]\s*/, '') // 去掉「照護場域：」這類前綴
    .replace(/\s+/g, '')
    .toLowerCase();
}
function parseInterests(value){
  return (value || '').split(/[,，]/).map(s=>s.trim()).filter(Boolean);
}
function scoreCourse(course, {age, gender, interests, profession}){
  let score = 0;
  if (course.audience.includes(profession)) score += 3;
  const hit = interests.filter(k => course.tags.some(t => t.includes(k)));
  score += hit.length * 2;
  if (age <= 16 && course.id === 'kids-horti') score += 2;
  if (age >= 55 && (course.id === 'mindfulness-garden' || course.id==='indoor-plants')) score += 1;
  return score;
}

// 快取已發佈課程（避免每次打 API）
let _publishedCourses = null;
async function getPublishedCourses(){
  if (_publishedCourses) return _publishedCourses;
  const { data, error } = await supabase
    .from('courses')
    .select('id,title,summary,cover_url')
    .eq('published', true)
    .is('deleted_at', null);
  if (error) { console.error(error); return []; }
  _publishedCourses = data || [];
  return _publishedCourses;
}

function renderRecommendations(list, dbMap){
  const box = document.getElementById('rec-results');
  if (!box) return;
  if (!list.length){
    box.innerHTML = `<p class="muted">沒有找到合適的推薦，試試不同的興趣關鍵字（如：室內植物、正念、多肉、親子）。</p>`;
    return;
  }
  box.innerHTML = list.map(c => {
    const match = dbMap.get(normalizeTitle(c.title)); // 用標題對 DB 課程
    const href  = match ? `course.html?id=${match.id}` : null;
    const cover = match?.cover_url || `https://picsum.photos/seed/${normalizeTitle(c.title)}/640/360`;
    return `
      <article class="course-card">
        <img src="${cover}" alt="${c.title}" style="width:100%;height:140px;object-fit:cover;border-radius:8px" />
        <h3>${c.title}</h3>
        <div class="course-meta">
          <span class="badge">${c.level}</span>
          ${c.tags.map(t=>`<span class="badge">${t}</span>`).join('')}
        </div>
        <div class="cta">
          ${href
            ? `<a href="${href}" class="btn primary">查看課程</a>`
            : `<button class="btn" disabled title="尚未上架">即將上架</button>`}
        </div>
      </article>
    `;
  }).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rec-form');
  if (form){
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const age = parseInt(document.getElementById('age').value || '0', 10);
      const gender = document.getElementById('gender').value || 'nonbinary';
      const interests = parseInterests(document.getElementById('interests').value);
      const profession = document.getElementById('profession').value || 'other';

      const ranked = COURSES
        .map(c => ({...c, _score: scoreCourse(c, {age, gender, interests, profession})}))
        .filter(c => c._score > 0)
        .sort((a,b) => b._score - a._score)
        .slice(0, 6);

      const published = await getPublishedCourses();
      const dbMap = new Map(published.map(pc => [ normalizeTitle(pc.title), pc ]));
      renderRecommendations(ranked, dbMap);
    });
  }
});

// ====== 老師與精選課程 ======
const TEACHERS = {
  fanfan: {
    name: '汎汎',
    role: '園藝治療老師',
    picks: [
      { id:'indoor-plants',       title:'室內植物照護術',     level:'初階', tags:['室內植物','綠化空間'] },
      { id:'mindfulness-garden',  title:'正念與園藝冥想',     level:'中階', tags:['正念','身心健康'] },
      { id:'therapeutic-design',  title:'治療性花園設計',     level:'進階', tags:['照護','設計','長照'] },
    ],
  },
  xd: {
    name: '小D',
    role: '藝術治療老師',
    picks: [
      { id:'color-emotion',           title:'情緒色彩創作',       level:'初階', tags:['色彩','情緒表達','藝術'] },
      { id:'watercolor-mindfulness',  title:'水彩與正念表達',     level:'中階', tags:['水彩','正念','藝術療癒'] },
      { id:'oilpainting-healing',     title:'油畫的療癒表達',     level:'進階', tags:['油畫','深層情緒','藝術治療'] },
    ],
  },
};

async function renderTeacherPicks(key){
  const wrap = document.getElementById('teacher-picks');
  const titleEl = document.getElementById('teacher-picks-title');
  if (!wrap || !titleEl) return;

  const teacher = TEACHERS[key] || null;
  if (!teacher){
    titleEl.textContent = '📚 老師精選課程';
    wrap.innerHTML = `<p class="muted">點選上方「看某位老師的課程」或直接瀏覽下方課程列表。</p>`;
    return;
  }

  titleEl.textContent = `📚 ${teacher.name} 的精選課程`;

  const { data: courses, error } = await supabase
    .from('courses')
    .select('id,title,summary,teacher,cover_url')
    .eq('published', true)
    .is('deleted_at', null)
    .eq('teacher', key);

  if (error){ console.error('load teacher picks error:', error); }

  const mapByTitle = new Map((courses || []).map(c => [ normalizeTitle(c.title), c ]));

  wrap.innerHTML = teacher.picks.map(pick => {
    const match = mapByTitle.get(normalizeTitle(pick.title));
    const href  = match ? `course.html?id=${match.id}` : null;
    const cover = match?.cover_url || `https://picsum.photos/seed/${normalizeTitle(pick.title)}/640/360`;

    return `
      <article class="course-card">
        <img src="${cover}" alt="${pick.title}" style="width:100%;height:140px;object-fit:cover;border-radius:8px" />
        <h3>${pick.title}</h3>
        <div class="course-meta">
          <span class="badge">${pick.level}</span>
          ${pick.tags.map(t=>`<span class="badge">${t}</span>`).join('')}
        </div>
        <div class="cta">
          ${href ? `<a href="${href}" class="btn primary">查看課程</a>` : `<button class="btn" disabled title="尚未上架">即將上架</button>`}
        </div>
      </article>
    `;
  }).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const teacherKey = params.get('teacher'); // fanfan / xd
  renderTeacherPicks(teacherKey);
});

// ========== Admin Panel ==========

// 1) 判斷是否為管理者（查 admins 表）
async function isAdmin() {
  if (!currentUser) return false;
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  return !!data && !error;
}

// 2) 觸發方式：Ctrl+Shift+A、標題點 5 次、或 ?admin=1
(function adminTriggers(){
  const dlg = document.getElementById('admin-panel');
  if (!dlg) return;

  async function openIfAdmin() {
    if (!currentUser) { showAuthModal(); return; }
    if (!(await isAdmin())) { alert('需要管理者權限'); return; }
    dlg.showModal();
    await adminRefresh();
  }

  // 鍵盤
  window.addEventListener('keydown', (e)=>{
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault(); openIfAdmin();
    }
  });
  // 連點標題
  const headerTitle = document.querySelector('.site-header h1, .site-header a.plain');
  let clickCount = 0, timer = null;
  headerTitle?.addEventListener('click', ()=>{
    clickCount++; clearTimeout(timer);
    timer = setTimeout(()=>{ clickCount = 0; }, 600);
    if (clickCount >= 5) { clickCount = 0; openIfAdmin(); }
  });
  // ?admin=1
  if (new URLSearchParams(location.search).get('admin') === '1') {
    openIfAdmin();
  }
})();

// 3) UI 綁定：載入課程清單、填表、單元清單
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
      <div>
        <button class="btn" data-act="edit">編輯</button>
      </div>
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

  const sd = $('#admin-soft-delete');
  const hd = $('#admin-hard-delete');
  if (sd) sd.disabled = !c?.id;
  if (hd) hd.disabled = !c?.id;
}

async function adminLoadLessons(courseId){
  const box = document.getElementById('admin-lessons');
  if (!courseId) { box.innerHTML = '<p class="muted">先選擇或建立課程。</p>'; return; }
  const { data, error } = await supabase
    .from('lessons')
    .select('id,order_no,title,content')
    .eq('course_id', courseId)
    .order('order_no');
  if (error) { box.innerHTML = `<p class="muted">讀取失敗：${error.message}</p>`; return; }

  box.innerHTML = (data||[]).map(l => `
    <div class="item" data-lid="${l.id}">
      <div><strong>${l.order_no}.</strong> ${l.title}</div>
      <div>
        <button class="btn" data-act="edit-lesson">編輯</button>
      </div>
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

// 4) 事件：刷新 / 新增課程 / 儲存 / 刪除
document.getElementById('admin-refresh')?.addEventListener('click', adminRefresh);

document.getElementById('admin-new-course')?.addEventListener('click', ()=>{
  adminFillCourseForm(null);
  const ls = document.getElementById('admin-lessons');
  if (ls) ls.innerHTML = '<p class="muted">尚無單元。</p>';
});

document.getElementById('admin-course-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
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

  if (id) {
    const { error } = await supabase.from('courses').update(payload).eq('id', id);
    if (error) return alert('更新失敗：' + error.message);
    alert('課程已更新');
  } else {
    const { error } = await supabase.from('courses').insert([payload]);
    if (error) return alert('建立失敗：' + error.message);
    alert('課程已建立');
  }
  await adminRefresh();
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

// 5) 單元新增/更新/刪除
document.getElementById('admin-lesson-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!await isAdmin()) return alert('只有管理者可以操作');

  const courseId = Number($('#ac-id').value || 0);
  if (!courseId) return alert('請先選擇或建立課程');

  const payload = {
    course_id: courseId,
    order_no:  Number($('#al-order').value || 1),
    title:     $('#al-title').value.trim(),
    content:   $('#al-content').value.trim() || null,
  };
  const id = Number($('#al-id').value || 0);

  if (id) {
    const { error } = await supabase.from('lessons').update(payload).eq('id', id);
    if (error) return alert('更新單元失敗：' + error.message);
    alert('單元已更新');
  } else {
    const { error } = await supabase.from('lessons').insert([payload]);
    if (error) return alert('新增單元失敗：' + error.message);
    alert('單元已新增');
  }
  $('#al-id').value = '';
  await adminLoadLessons(courseId);
});

document.getElementById('admin-lesson-delete')?.addEventListener('click', async ()=>{
  if (!await isAdmin()) return alert('只有管理者可以操作');
  const lid = Number($('#al-id').value || 0);
  const cid = Number($('#ac-id').value || 0);
  if (!lid) return alert('請先點選要刪除的單元（於列表選擇「編輯」）');
  if (!confirm('刪除這個單元？')) return;
  const { error } = await supabase.from('lessons').delete().eq('id', lid);
  if (error) return alert('刪除單元失敗：' + error.message);
  $('#al-id').value = '';
  await adminLoadLessons(cid);
});

// ====== Admin 連結顯示控制 ======
async function updateAdminLink(){
  const adminLink = document.getElementById('admin-link');
  if (!adminLink) return;

  if (!currentUser) { // 未登入 → 隱藏
    adminLink.classList.add('hidden');
    return;
  }

  const ok = await isAdmin(); // 查 admins 表
  adminLink.classList.toggle('hidden', !ok);

  if (ok && !adminLink.dataset.bound) {
    adminLink.addEventListener('click', async (e) => {
      e.preventDefault();
      document.getElementById('admin-panel').showModal();
      await adminRefresh();
    });
    adminLink.dataset.bound = '1'; // 避免重綁
  }
}

// ====== Auth 初始化：一次且只在這裡處理 ======
supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  $('#login-link')?.classList.toggle('hidden', !!currentUser);
  $('#logout-link')?.classList.toggle('hidden', !currentUser);
  updateAdminLink();           // 狀態改變時更新「課程管理」
});

supabase.auth.getUser().then(({ data }) => {
  currentUser = data?.user ?? null;
  if (currentUser) {
    loginLink?.classList.add('hidden');
    logoutLink?.classList.remove('hidden');
  }
  updateAdminLink();           // 首次載入也更新
  initPage();                  // 啟動頁面
});
