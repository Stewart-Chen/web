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
  document.getElementById('btn-signin').addEventListener('click', async (e)=>{
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: passwd.value });
    if (error) { console.error(error); return; }
    authModal.close(); location.reload();
  });
  document.getElementById('btn-signup').addEventListener('click', async (e)=>{
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

// 監聽登入狀態變化，切換導覽列
supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  $('#login-link')?.classList.toggle('hidden', !!currentUser);
  $('#logout-link')?.classList.toggle('hidden', !currentUser);
});

// 首次抓使用者再啟動頁面
supabase.auth.getUser().then(({ data })=>{
  currentUser = data?.user ?? null;
  if (currentUser) {
    loginLink?.classList.add('hidden');
    logoutLink?.classList.remove('hidden');
  }
  initPage();
});

// ====== 首頁：載入課程 ======
async function loadCourses(){
  // 同時支援新版(#courses-list) 與 舊版(#courses)
  const list = document.getElementById('courses-list') || document.getElementById('courses');
  const empty = document.getElementById('courses-empty');
  if (!list) return;

  const { data, error } = await supabase
    .from('courses')
    .select('id,title,summary,cover_url,created_at')
    .eq('published', true)
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
  const id = qs('id');
  const titleEl = document.getElementById('course-title');
  const descEl = document.getElementById('course-desc');
  const lessonsEl = document.getElementById('lessons');
  const lessonsEmpty = document.getElementById('lessons-empty');
  const enrollBtn = document.getElementById('enroll-btn');
  const enrolledBadge = document.getElementById('enrolled-badge');
  const progressEl = document.getElementById('progress');
  const modal = document.getElementById('lesson-modal');

  if (!id) return;

  // (A) 課程資訊：公開可讀（published=true）
  let { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle();

  if (error) { console.error(error); return; }
  if (!course) { 
    if (titleEl) titleEl.textContent = '找不到課程或尚未發佈';
    return;
  }
  titleEl.textContent = course.title;
  descEl.textContent = course.description ?? course.summary ?? '';

  // (B) 單元列表：公開可讀（隸屬已發佈課程）
  const { data: lessons, error: lsErr } = await supabase
    .from('lessons')
    .select('id, title, content, order_no')
    .eq('course_id', id)
    .order('order_no');
  if (lsErr) { console.error(lsErr); return; }
  if (!lessons || lessons.length === 0){
    lessonsEmpty?.classList.remove('hidden');
  } else {
    lessonsEl.innerHTML = lessons.map(ls => `
      <li>
        <button class="btn" data-lesson="${ls.id}">${ls.order_no}. ${ls.title}</button>
      </li>
    `).join('');
  }

  // (C) 報名狀態：只有登入才查 enrollments，但按鈕永遠可點（未登入就彈出對話框）
let enrolled = false;
if (currentUser){
  const { data: en, error: enErr } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('course_id', id)
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (!enErr && en) enrolled = true;
}

// 調整 UI 與點擊行為
if (enrolled) {
  enrollBtn?.classList.add('hidden');
  enrolledBadge?.classList.remove('hidden');
} else if (enrollBtn){
  // ✨ 不要設 disabled，讓它可以被點擊
  enrollBtn.title = currentUser ? '' : '請先登入';
  enrollBtn.addEventListener('click', async (e)=>{
    // 未登入 → 打開登入對話框就好
    if (!requireAuthOrOpenModal(e)) return;

    // 已登入 → 送出報名
    const { error: insErr } = await supabase
      .from('enrollments')
      .insert({ course_id: Number(id), user_id: currentUser.id });

    if (insErr){ console.error(insErr); return; }
    enrollBtn.classList.add('hidden');
    enrolledBadge?.classList.remove('hidden');
    // 重新計算進度
    loadProgress(lessons || []);
  });
}


  // (D) 點單元：需已登入且已報名才可「標記完成」
  lessonsEl?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-lesson]');
    if (!btn) return;

    if (!currentUser){ requireAuthOrOpenModal(e); return; }
    if (!enrolled){
      // 已登入但未報名 → 引導先報名
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

  // (E) 進度：只有登入才查 progress
  async function loadProgress(lessonList){
    if (!currentUser){
      progressEl.innerHTML = '<span class="muted">登入後可記錄進度。</span>';
      return;
    }
    const ids = (lessonList || []).map(l => l.id);
    if (!ids.length){
      progressEl.innerHTML = '<span class="muted">尚無單元。</span>';
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
    progressEl.innerHTML = `完成 ${done} / ${total} 單元`;
  }
  loadProgress(lessons || []);
}

// 頁面初始化
function initPage(){
  if (document.getElementById('courses') || document.getElementById('courses-list')) loadCourses();
  if (document.getElementById('course-info')) loadCourse();
}

// ====== 個人化推薦（純前端範例） ======
const COURSES = [
  { id:'intro-garden', title:'園藝治療入門', level:'初階', audience:['student','office','retired','teacher'], tags:['園藝入門','身心紓壓'], gender: 'all' },
  { id:'indoor-plants', title:'室內植物照護術', level:'初階', audience:['office','student','retired'], tags:['室內植物','綠化空間'], gender: 'all' },
  { id:'succulents-art', title:'多肉與小景設計', level:'初/中階', audience:['student','office','other'], tags:['多肉','手作'], gender: 'all' },
  { id:'mindfulness-garden', title:'正念與園藝冥想', level:'中階', audience:['teacher','healthcare','office'], tags:['正念','身心健康'], gender: 'all' },
  { id:'therapeutic-design', title:'照護場域：治療性花園設計', level:'進階', audience:['healthcare','teacher'], tags:['照護','設計','長照'], gender: 'all' },
  { id:'kids-horti', title:'親子自然感官探索', level:'親子', audience:['teacher','other'], tags:['親子','教育','感官'], gender:'all' },
];

function parseInterests(value){
  return (value || '').split(/[,，]/).map(s=>s.trim()).filter(Boolean);
}

function scoreCourse(course, {age, gender, interests, profession}){
  let score = 0;
  if (course.audience.includes(profession)) score += 3;   // 職業匹配
  const hit = interests.filter(k => course.tags.some(t => t.includes(k)));
  score += hit.length * 2;                                // 興趣匹配
  if (age <= 16 && course.id === 'kids-horti') score += 2;
  if (age >= 55 && (course.id === 'mindfulness-garden' || course.id==='indoor-plants')) score += 1;
  return score;
}

function renderRecommendations(list){
  const box = document.getElementById('rec-results');
  if (!box) return;
  if (!list.length){
    box.innerHTML = `<p class="muted">沒有找到合適的推薦，試試不同的興趣關鍵字（如：室內植物、正念、多肉、親子）。</p>`;
    return;
  }
  box.innerHTML = list.map(c => `
    <article class="course-card">
      <h3>${c.title}</h3>
      <div class="course-meta">
        <span class="badge">${c.level}</span>
        ${c.tags.map(t=>`<span class="badge">${t}</span>`).join('')}
      </div>
      <div class="cta">
        <a href="course.html?id=${c.id}" class="primary-link">查看課程</a>
      </div>
    </article>
  `).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rec-form');
  if (form){
    form.addEventListener('submit', (e) => {
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
      renderRecommendations(ranked);
    });
  }
});

// ====== 老師與精選課程（前端輕量設定） ======
const TEACHERS = {
  fanfan: {
    name: '汎汎',
    role: '園藝治療老師',
    picks: [
      { id:'indoor-plants',  title:'室內植物照護術', level:'初階', tags:['室內植物','綠化空間'] },
      { id:'mindfulness-garden', title:'正念與園藝冥想', level:'中階', tags:['正念','身心健康'] },
      { id:'therapeutic-design', title:'照護場域：治療性花園設計', level:'進階', tags:['照護','設計','長照'] },
    ],
  },
  xd: {
    name: '小D',
    role: '藝術治療老師',
    picks: [
      { id:'succulents-art', title:'多肉與小景設計', level:'初/中階', tags:['多肉','手作'] },
      { id:'mindfulness-garden', title:'正念與園藝冥想', level:'中階', tags:['正念','身心健康'] },
      { id:'intro-garden', title:'園藝治療入門', level:'初階', tags:['園藝入門','身心紓壓'] },
    ],
  },
};

function renderTeacherPicks(key){
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
  wrap.innerHTML = teacher.picks.map(c => `
    <article class="course-card">
      <h3>${c.title}</h3>
      <div class="course-meta">
        <span class="badge">${c.level}</span>
        ${c.tags.map(t=>`<span class="badge">${t}</span>`).join('')}
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
  renderTeacherPicks(teacherKey);
});

// 在 course.html 顯示老師資訊（從 URL ?teacher 或依課程 id 推斷）
function showCourseTeacher(){
  const box = document.getElementById('teacher-box-content');
  if (!box) return;
  const params = new URLSearchParams(location.search);
  let key = params.get('teacher');

  // 若沒有帶 teacher，可依課程 id 做最簡映射（必要時自行維護）
  const id = params.get('id'); // 如 indoor-plants, succulents-art, ...
  if (!key && id){
    const map = {
      'indoor-plants':'fanfan',
      'therapeutic-design':'fanfan',
      'mindfulness-garden':'fanfan',
      'succulents-art':'xd',
      'intro-garden':'xd',
    };
    key = map[id];
  }

  const t = TEACHERS[key];
  box.textContent = t ? `${t.name}｜${t.role}` : '—';
}
window.addEventListener('DOMContentLoaded', showCourseTeacher);
