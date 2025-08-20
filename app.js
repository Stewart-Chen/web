// ====== CONFIG ======
// 1) 填入你的 Supabase 專案 URL 與匿名金鑰（安全：僅擁有者權限受 RLS 限制）
const SUPABASE_URL = "https://YOUR-PROJECT-ref.supabase.co"; // ← 改成你的
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY"; // ← 改成你的

// 2) 建立 Supabase 用戶端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== 共用工具 ======
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function qs(name){ return new URLSearchParams(location.search).get(name); }
function formatDate(iso){ return new Date(iso).toLocaleDateString(); }

// Auth UI
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
    await supabase.auth.signInWithPassword({ email: email.value, password: passwd.value });
    authModal.close(); location.reload();
  });
  document.getElementById('btn-signup').addEventListener('click', async (e)=>{
    e.preventDefault();
    await supabase.auth.signUp({ email: email.value, password: passwd.value });
    alert('已寄出驗證郵件（如有設定）。登入後即可使用。');
    authModal.close(); location.reload();
  });
}

// 目前使用者
let currentUser = null;
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
  const list = document.getElementById('courses');
  if (!list) return;
  const { data, error } = await supabase
    .from('courses')
    .select('id,title,summary,cover_url,created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  if (!data || data.length === 0){ 
    document.getElementById('courses-empty').classList.remove('hidden');
    return;
  }
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

  // 課程資訊
  let { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error(error); return; }
  titleEl.textContent = course.title;
  descEl.textContent = course.description ?? course.summary ?? '';

  // 報名狀態
  let enrolled = false;
  if (currentUser){
    const { data: en, error: enErr } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', id)
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (!enErr && en) enrolled = true;
  }
  if (enrolled) {
    enrollBtn.classList.add('hidden');
    enrolledBadge.classList.remove('hidden');
  } else {
    enrollBtn.addEventListener('click', async ()=>{
      if (!currentUser){ alert('請先登入'); return; }
      const { error: insErr } = await supabase.from('enrollments').insert({ course_id: id, user_id: currentUser.id });
      if (insErr){ alert('報名失敗：' + insErr.message); return; }
      enrollBtn.classList.add('hidden');
      enrolledBadge.classList.remove('hidden');
      loadProgress();
    });
  }

  // 單元列表
  const { data: lessons, error: lsErr } = await supabase
    .from('lessons')
    .select('id, title, content, order_no')
    .eq('course_id', id)
    .order('order_no');
  if (lsErr) { console.error(lsErr); return; }
  if (!lessons || lessons.length === 0){ lessonsEmpty.classList.remove('hidden'); }
  else {
    lessonsEl.innerHTML = lessons.map(ls => `
      <li>
        <button class="btn" data-lesson="${ls.id}">${ls.order_no}. ${ls.title}</button>
      </li>
    `).join('');
    lessonsEl.addEventListener('click', async (e)=>{
      const btn = e.target.closest('button[data-lesson]');
      if (!btn) return;
      if (!currentUser){ alert('請先登入'); return; }
      if (!enrolled){ alert('請先報名本課程'); return; }
      const lesson = lessons.find(x => String(x.id) === btn.dataset.lesson);
      $('#lesson-title').textContent = lesson.title;
      $('#lesson-content').innerHTML = lesson.content ? lesson.content.replace(/\n/g,'<br>') : '<p>此單元尚未提供內容。</p>';
      modal.showModal();
      $('#mark-done').onclick = async ()=>{
        await supabase.from('progress').upsert({ user_id: currentUser.id, lesson_id: lesson.id, done_at: new Date().toISOString() });
        await loadProgress();
        modal.close();
      };
    });
  }

  async function loadProgress(){
    if (!currentUser){ progressEl.innerHTML = '<span class="muted">登入後可記錄進度。</span>'; return; }
    const { data: prog, error: pErr } = await supabase
      .from('progress')
      .select('lesson_id')
      .in('lesson_id', (lessons||[]).map(l=>l.id));
    if (pErr) { console.error(pErr); return; }
    const doneSet = new Set((prog||[]).map(p=>p.lesson_id));
    const total = lessons?.length || 0;
    const done = [...doneSet].length;
    progressEl.innerHTML = total ? `完成 ${done} / ${total} 單元` : '<span class="muted">尚無單元。</span>';
  }
  loadProgress();
}

// 頁面初始化
function initPage(){
  if (document.getElementById('courses')) loadCourses();
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
  return (value || '')
    .split(/[,，]/).map(s=>s.trim()).filter(Boolean);
}

function scoreCourse(course, {age, gender, interests, profession}){
  let score = 0;
  // 職業匹配
  if (course.audience.includes(profession)) score += 3;
  // 興趣匹配：每命中一個 +2
  const hit = interests.filter(k => course.tags.some(t => t.includes(k)));
  score += hit.length * 2;
  // 年齡導向（簡單示意）
  if (age <= 16 && course.id === 'kids-horti') score += 2;
  if (age >= 55 && (course.id === 'mindfulness-garden' || course.id==='indoor-plants')) score += 1;
  // 性別目前不加權（保留欄位）
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
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const age = parseInt(document.getElementById('age').value || '0', 10);
    const gender = document.getElementById('gender').value || 'nonbinary';
    const interests = parseInterests(document.getElementById('interests').value);
    const profession = document.getElementById('profession').value || 'other';
    // 打分排序
    const ranked = COURSES
      .map(c => ({...c, _score: scoreCourse(c, {age, gender, interests, profession})}))
      .filter(c => c._score > 0)
      .sort((a,b) => b._score - a._score)
      .slice(0, 6);
    renderRecommendations(ranked);
  });
});
