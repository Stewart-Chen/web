// ====== CONFIG ======
const supabase = window.sb;

// ====== 小工具 ======
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function qs(name){ return new URLSearchParams(location.search).get(name); }

// ====== Auth UI（桌機＋手機） ======
const authModal = document.getElementById('auth-modal');

// 登入：開啟對話框
['#login-link', '#login-link-m'].forEach(sel => {
  const el = document.querySelector(sel);
  if (el) el.addEventListener('click', (e)=>{
    e.preventDefault();
    authModal?.showModal();
  });
});
// 登出：呼叫 supabase 後重新載入
['#logout-link', '#logout-link-m'].forEach(sel => {
  const el = document.querySelector(sel);
  if (el) el.addEventListener('click', async (e)=>{
    e.preventDefault();
    await supabase.auth.signOut();
    location.reload();
  });
});

if (authModal) {
  const email  = document.getElementById('auth-email');
  const passwd = document.getElementById('auth-password');

  // === 登入 ===
  document.getElementById('btn-signin')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value, password: passwd.value
    });
    if (error) { alert('登入失敗：' + (error.message || '發生未知錯誤')); console.error(error); return; }
    authModal.close();
    location.reload();
  });

  // === 註冊 ===
  document.getElementById('btn-signup')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
      email: email.value, password: passwd.value
    });
    if (error) { alert('註冊失敗：' + (error.message || '發生未知錯誤')); console.error(error); return; }
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
  const list  = document.getElementById('courses-list') || document.getElementById('courses');
  const empty = document.getElementById('courses-empty');
  if (!list) return;

  const { data, error } = await supabase
    .from('courses')
    .select('id,title,summary,cover_url,created_at,teacher,category')
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
             data-category="${c.category || ''}"
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

          if (!name)  { alert('請填寫姓名');  return; }
          if (!phone) { alert('請填寫電話');  return; }
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

          enrollBtn.classList.add('hidden');
          enrolledBadge?.classList.remove('hidden');
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

// ====== Auth 初始化（同步桌機/手機的登入/登出顯示） ======
supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  ['#login-link', '#login-link-m'].forEach(sel => {
    document.querySelector(sel)?.classList.toggle('hidden', !!currentUser);
  });
  ['#logout-link', '#logout-link-m'].forEach(sel => {
    document.querySelector(sel)?.classList.toggle('hidden', !currentUser);
  });
});

supabase.auth.getUser().then(({ data }) => {
  currentUser = data?.user ?? null;
  if (currentUser) {
    ['#login-link', '#login-link-m'].forEach(sel => document.querySelector(sel)?.classList.add('hidden'));
    ['#logout-link', '#logout-link-m'].forEach(sel => document.querySelector(sel)?.classList.remove('hidden'));
  }
  initPage();
});

