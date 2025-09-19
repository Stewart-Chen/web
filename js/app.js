// ====== CONFIG ======
const sb = window.sb; // 由 shared-layout.js 初始化

// ====== 小工具 ======
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function getParam(name){ return new URLSearchParams(location.search).get(name); }
const getUser = () => window.currentUser; // 由 shared-layout.js 維護

// ====== 探索課程頁：完整課程清單（支援多圖輪播） ======
async function loadCourses(){
  const list  = document.getElementById('courses');
  const empty = document.getElementById('courses-empty');
  if (!list) return;

  // 一次把 gallery 一起抓回來
  const { data, error } = await sb
    .from('courses')
    .select('id,title,summary,description,cover_url,gallery,teacher,category,created_at')
    .eq('published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error){ console.error('[all courses] load error:', error); return; }

  if (!data || data.length === 0){
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }

  empty?.classList.add('hidden');

  // 轉成可用圖片 URL（如果沒有 gallery 就退回 cover_url）
  for (const c of data){
    const paths = Array.isArray(c.gallery) ? c.gallery : [];
    c._galleryUrls = paths.length
      ? await toPublicUrls('course-gallery', paths)   // 你專案已內建這個 helper
      : [ c.cover_url || ('https://picsum.photos/seed/'+encodeURIComponent(c.id)+'/640/360') ];
  }

  // 輸出卡片（含輪播容器）
  list.innerHTML = data.map(c => {
    const imgs = (c._galleryUrls && c._galleryUrls.length) ? c._galleryUrls : [];
    const cat  = c.category ? (c.category === 'horti' ? '園藝' : '藝術') : '';
    return `
      <li>
        <article class="course-card card"
                 data-category="${c.category || ''}"
                 data-teacher="${c.teacher || ''}">
          <div class="carousel" data-total="${imgs.length}" data-index="0">
            <div class="track">
              ${imgs.map((url, i) => `
                <div class="slide"><img src="${url}" alt="${c.title} ${i+1}"></div>
              `).join('')}
            </div>
            ${imgs.length > 1 ? `
              <button class="nav prev" aria-label="上一張">&#10094;</button>
              <button class="nav next" aria-label="下一張">&#10095;</button>
              <div class="indicator"><span class="current">1</span>/<span class="total">${imgs.length}</span></div>
            ` : ``}
          </div>

          <div class="course-body">
            <h3>${c.title}</h3>
            ${cat ? `<div class="badge">${cat}</div>` : ``}
            <p class="muted">${(c.summary || '').slice(0, 80)}</p>
            <div class="cta"><a class="btn primary" href="course.html?id=${c.id}">查看課程</a></div>
          </div>
        </article>
      </li>
    `;
  }).join('');

  // 啟用輪播互動（按鈕 + 觸控滑動）
  enableCarousels(list);
}

// ====== 課程頁 ======
async function loadCourse(){
  const idParam = getParam('id');
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
  let { data: course, error } = await sb
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
  const { data: lessons, error: lsErr } = await sb
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
  if (getUser()){
    const { data: en, error: enErr } = await sb
      .from('enrollments')
      .select('course_id')
      .eq('course_id', idNum)
      .eq('user_id', getUser().id)
      .maybeSingle();
    if (!enErr && en) enrolled = true;
  }
  if (enrolled) {
    enrollBtn?.classList.add('hidden');
    enrolledBadge?.classList.remove('hidden');
  } else if (enrollBtn){
    enrollBtn.title = getUser() ? '' : '請先登入';

    enrollBtn.addEventListener('click', async (e)=>{
      if (!window.requireAuthOrOpenModal?.(e)) return;

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

          const { error: insErr } = await sb
            .from('enrollments')
            .insert({
              course_id: idNum,
              user_id: getUser().id,
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

    if (!getUser()){ window.requireAuthOrOpenModal?.(e); return; }
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
        if (!window.requireAuthOrOpenModal?.()) return;
        const { error: upErr } = await sb.from('progress').upsert({
          user_id: getUser().id,
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
    if (!getUser()){ if (progressEl) progressEl.innerHTML = '<span class="muted">登入後可記錄進度。</span>'; return; }
    const ids = (lessonList || []).map(l => l.id);
    if (!ids.length){ if (progressEl) progressEl.innerHTML = '<span class="muted">尚無單元。</span>'; return; }
    const { data: prog, error: pErr } = await sb
      .from('progress')
      .select('lesson_id, done_at')
      .eq('user_id', getUser().id)
      .in('lesson_id', ids);
    if (pErr) { console.error(pErr); return; }
    const doneSet = new Set((prog||[]).map(p=>p.lesson_id));
    if (progressEl) progressEl.innerHTML = `完成 ${doneSet.size} / ${ids.length} 單元`;
  }
  loadProgress(lessons || []);
}

// ====== 頁面初始化 ======
function initPage(){
  const isHome = !!document.getElementById('btn-more-courses'); // 首頁才會有這顆
  if (isHome) {
    renderHomeCourses();   // ← 首頁用這個
  } else if (document.getElementById('courses')) {
    loadCourses();         // ← 其他頁才載入完整清單
  }

  if (document.getElementById('course-info')) loadCourse();
}
document.addEventListener('DOMContentLoaded', initPage);

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
    titleEl.textContent = '老師精選課程';
    wrap.innerHTML = `<p class="muted">點選上方「看某位老師的課程」或直接瀏覽下方課程列表。</p>`;
    return;
  }
  titleEl.textContent = `${meta.name} 的精選課程`;

  const { data, error } = await sb
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
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const teacherKey = params.get('teacher'); // fanfan / xd
  renderTeacherPicksFromDb(teacherKey);
});

// ====== 首頁課程一覽（最多 4 筆 + 查看更多） ======
function renderHomeCourses(){
  const LIMIT = 4;     // 首頁顯示幾張卡片
  let rendered = false;

  function waitFor(pred, {interval = 80, timeout = 8000} = {}){
    return new Promise((resolve, reject)=>{
      const start = Date.now();
      (function tick(){
        try{ const v = pred(); if (v) return resolve(v); }catch{}
        if (Date.now() - start > timeout) return reject(new Error('waitFor timeout'));
        setTimeout(tick, interval);
      })();
    });
  }

  async function run(){
    if (rendered) return;

    // 1) 等 DOM
    if (document.readyState === 'loading') {
      await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    }

    const listEl  = document.getElementById('courses-list');
    const emptyEl = document.getElementById('courses-empty');
    const moreBtn = document.getElementById('btn-more-courses');
    if (!listEl) return;

    // 2) 等 Supabase
    await waitFor(() => window.sb && typeof window.sb.from === 'function').catch(()=>{});
    const sb = window.sb;
    if (!sb){
      listEl.innerHTML = '';
      emptyEl?.classList.remove('hidden');
      moreBtn?.classList.add('hidden');
      return;
    }

    // 3) 抓資料（含 gallery）
    const { data, error, count } = await sb
      .from('courses')
      .select('id,title,summary,description,cover_url,gallery,category,created_at', { count: 'exact' })
      .eq('published', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, LIMIT - 1); // 安全保險只抓 LIMIT 筆

    if (error){
      console.warn('[home courses] load error:', error);
      emptyEl?.classList.remove('hidden');
      moreBtn?.classList.add('hidden');
      return;
    }

    const items = (data || []).slice(0, LIMIT);

    if (!items.length){
      listEl.innerHTML = '';
      emptyEl?.classList.remove('hidden');
      moreBtn?.classList.add('hidden');
      return;
    }

    // 轉 URL：若有多圖用 Storage 取 public URL，否則退回 cover_url
    for (const c of items){
      const paths = Array.isArray(c.gallery) ? c.gallery : [];
      c._galleryUrls = paths.length
        ? await toPublicUrls('course-gallery', paths)
        : [ c.cover_url || ('https://picsum.photos/seed/' + encodeURIComponent(c.id) + '/640/360') ];
    }

    // 輸出卡片（含輪播結構）
    listEl.innerHTML = items.map(c => {
      const cat  = c.category ? (c.category === 'horti' ? '園藝' : '藝術') : '';
      const imgs = c._galleryUrls && c._galleryUrls.length ? c._galleryUrls : [];
      return `
        <article class="course-card card">
          <div class="carousel" data-total="${imgs.length}" data-index="0">
            <div class="track">
              ${imgs.map((url, i) => `
                <div class="slide"><img src="${url}" alt="${c.title} ${i+1}"></div>
              `).join('')}
            </div>
            ${imgs.length > 1 ? `
              <button class="nav prev" aria-label="上一張">&#10094;</button>
              <button class="nav next" aria-label="下一張">&#10095;</button>
              <div class="indicator"><span class="current">1</span>/<span class="total">${imgs.length}</span></div>
            ` : ``}
          </div>

          <div class="course-body">
            <h3>${c.title}</h3>
            ${cat ? `<div class="badge">${cat}</div>` : ``}
            <p class="muted">${(c.summary || '').slice(0, 80)}</p>
            <div class="cta"><a class="btn primary" href="course.html?id=${c.id}">查看課程</a></div>
          </div>
        </article>
      `;
    }).join('');

    // 啟用輪播互動（很重要！）
    enableCarousels(listEl);

    // 4) 顯示「查看更多」
    if (typeof count === 'number' ? count > LIMIT : items.length >= LIMIT) {
      moreBtn?.classList.remove('hidden');
    } else {
      moreBtn?.classList.add('hidden');
    }

    // 5) 再保險裁切 DOM（若其它腳本有多塞卡片）
    const cards = listEl.querySelectorAll('.course-card');
    if (cards.length > LIMIT) {
      [...cards].slice(LIMIT).forEach(el => el.remove());
      moreBtn?.classList.remove('hidden');
    }

    rendered = true;
  }

  run().catch(err => console.error('[home courses] unexpected:', err));
}


// 平滑滾動到錨點
document.addEventListener('click', (e)=>{
  const a = e.target.closest('.sticky-chips .chip[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = document.querySelector(id);
  if (!target) return;

  e.preventDefault();
  const headerH = parseInt(getComputedStyle(document.documentElement)
                    .getPropertyValue('--header-height')) || 68;
  const y = target.getBoundingClientRect().top + window.scrollY - (headerH + 12);
  window.scrollTo({ top: y, behavior: 'smooth' });
});

// 觀察當前區塊，切換 .active
(function observeSections(){
  const chips = document.querySelectorAll('.sticky-chips .chip[href^="#"]');
  if (!chips.length) return;

  const map = new Map(); // section -> chip
  chips.forEach(ch => {
    const sec = document.querySelector(ch.getAttribute('href'));
    if (sec) map.set(sec, ch);
  });

  const headerH = parseInt(getComputedStyle(document.documentElement)
                    .getPropertyValue('--header-height')) || 68;

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(ent=>{
      const chip = map.get(ent.target);
      if (!chip) return;
      if (ent.isIntersecting){
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      }
    });
  }, {
    rootMargin: `-${headerH + 10}px 0px -30% 0px`, // 上方多留 10px，下方只排除 30%
    threshold: 0                               // 只要進來一點點就算
  });

  map.forEach((_, sec)=> io.observe(sec));
})();

async function toSignedUrls(bucket, paths = [], expires = 60 * 60) { // 1hr
  if (!paths.length) return [];
  const results = await Promise.all(paths.map(p =>
    sb.storage.from(bucket).createSignedUrl(p, expires)
  ));
  return results.map(r => r.data?.signedUrl).filter(Boolean);
}

async function toPublicUrls(bucket, paths = []) {
  if (!paths.length) return [];
  const storage = sb.storage.from(bucket);
  return paths
    .map(p => storage.getPublicUrl(p).data.publicUrl)
    .filter(Boolean);
}

// 簡易輪播控制：左右按鈕 + 觸控滑動
function enableCarousels(root=document){
  const carousels = root.querySelectorAll('.carousel');
  carousels.forEach(setupCarousel);
}

function setupCarousel(carousel){
  const track = carousel.querySelector('.track');
  const slides = carousel.querySelectorAll('.slide');
  if (!track || !slides.length) return;

  let index = 0;
  const total = slides.length;
  const indicatorCur = carousel.querySelector('.indicator .current');

  function update(){
    track.style.transform = `translateX(-${index * 100}%)`;
    if (indicatorCur) indicatorCur.textContent = String(index + 1);
    carousel.dataset.index = String(index);
  }

  function go(delta){
    index = (index + delta + total) % total;
    update();
  }

  carousel.querySelector('.nav.prev')?.addEventListener('click', ()=>go(-1));
  carousel.querySelector('.nav.next')?.addEventListener('click', ()=>go(+1));

  // 觸控滑動
  let startX = 0, isDown = false;
  const onDown = (x)=>{ isDown = true; startX = x; };
  const onUp   = (x)=>{
    if (!isDown) return;
    const dx = x - startX;
    isDown = false;
    if (Math.abs(dx) > 40){ go(dx < 0 ? +1 : -1); }
  };

  track.addEventListener('touchstart', e=>onDown(e.touches[0].clientX), {passive:true});
  track.addEventListener('touchend',   e=>onUp(e.changedTouches[0].clientX));
  track.addEventListener('mousedown',  e=>onDown(e.clientX));
  window.addEventListener('mouseup',   e=>onUp(e.clientX));

  // 初始
  update();
}
