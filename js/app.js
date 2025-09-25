// ====== CONFIG ======
const sb = window.sb; // 由 shared-layout.js 初始化

// ====== 小工具 ======
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function getParam(name){ return new URLSearchParams(location.search).get(name); }
const getUser = () => window.currentUser; // 由 shared-layout.js 維護

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

  
  // (A) 課程資訊 之後、在 teacherBox 之後插入
  const infoSec = document.getElementById('course-info');
  if (infoSec) {
    // 先移除舊的 meta（避免重覆載入）
    infoSec.querySelector('#course-meta')?.remove();
  
    const metaWrap = document.createElement('section');
    metaWrap.id = 'course-meta';
    metaWrap.className = 'flow-sm';
    metaWrap.innerHTML = `
      <div class="meta-grid">
        ${course.capacity         ? `<div><div class="label">課程人數</div><div class="value">${course.capacity}</div></div>` : ``}
        ${course.duration_hours   ? `<div><div class="label">課程時數</div><div class="value">${Number(course.duration_hours)} 小時</div></div>` : ``}
        ${Array.isArray(course.equipment_items) && course.equipment_items.length ? `
          <div><div class="label">設備項目</div><div class="value chips">${course.equipment_items.map(x=>`<span class="chip">${x}</span>`).join('')}</div></div>` : ``}
        ${Array.isArray(course.material_items) && course.material_items.length ? `
          <div><div class="label">材料項目</div><div class="value chips">${course.material_items.map(x=>`<span class="chip">${x}</span>`).join('')}</div></div>` : ``}
        ${Number.isFinite(course.material_fee) ? `<div><div class="label">材料費</div><div class="value">NT$ ${course.material_fee.toLocaleString?.('zh-TW') ?? course.material_fee}</div></div>` : ``}
        ${course.plan_type        ? `<div><div class="label">方案類型</div><div class="value"><span class="badge">${course.plan_type}</span></div></div>` : ``}
        ${Number.isFinite(course.course_fee) ? `<div><div class="label">課程費用</div><div class="value">NT$ ${course.course_fee.toLocaleString?.('zh-TW') ?? course.course_fee}</div></div>` : ``}
        ${Array.isArray(course.keywords) && course.keywords.length ? `
          <div><div class="label">關鍵字</div><div class="value chips">${course.keywords.map(k=>`<span class="chip">${k}</span>`).join('')}</div></div>` : ``}

      </div>
    `;
    infoSec.appendChild(metaWrap);
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

// ========= 共用：課程卡片模板 =========
function courseCardHTML(c){
  const cat  = c.category ? (c.category === 'horti' ? '園藝' : '藝術') : '';
  const teacher  = c.teacher ? (c.teacher === 'fanfan' ? '汎汎' : '小D') : '';
  const imgs = Array.isArray(c._galleryUrls) && c._galleryUrls.length ? c._galleryUrls : [];
  return `
    <article class="course-card card"
             data-category="${c.category || ''}"
             data-teacher="${c.teacher || ''}">
      <div class="carousel" data-total="${imgs.length}" data-index="0">
        <div class="track">
          ${imgs.map((url, i) => `
            <div class="slide"><img src="${url}" alt="${c.title} ${i+1}" loading="lazy" width="640" height="360"></div>
          `).join('')}
        </div>
        ${imgs.length > 1 ? `
          <button class="nav prev" aria-label="上一張">&#10094;</button>
          <button class="nav next" aria-label="下一張">&#10095;</button>
          <div class="indicator"><span class="current">1</span>/<span class="total">${imgs.length}</span></div>
        ` : ``}
      </div> 
      <a href="course.html?id=${c.id}" class="course-link">
        <div class="course-body">
          <div class="title-row">
            <h3>${c.title}</h3>

            ${c.category
              ? `<img class="badge badgeImg" src="${c.category === 'horti' ? '/web/img/garden_simple.png' : '/web/img/art_simple.png'}"
                       alt="${c.category === 'horti' ? '園藝' : '藝術'}">`
              : ``}
            
            ${teacher ? `<div class="badge">${teacher}</div>` : ``}

          </div>
          <p class="muted">${(c.summary || '').slice(0, 80)}</p>
          
          ${(c.duration_hours || Number.isFinite(c.material_fee) || c.plan_type) ? `
              <div class="meta-row">
                ${c.duration_hours ? `<span class="meta"><svg aria-hidden="true" viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>${Number(c.duration_hours)}小時</span>` : ``}
                ${Number.isFinite(c.course_fee) ? `<span class="meta"><svg aria-hidden="true" viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v12m4-6a4 4 0 0 1-8 0 4 4 0 0 1 8 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>NT$ ${c.course_fee.toLocaleString?.('zh-TW') ?? c.course_fee}</span>` : ``}
                ${c.plan_type ? `<span class="meta"><svg aria-hidden="true" viewBox="0 0 24 24" class="i"><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9H5a2 2 0 0 1-2-2v-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/></svg>${c.plan_type}</span>` : ``}
              </div>
            ` : ``}
            
        </div>
      </a>
    </article>
  `;
}

// ========= 抓課程並渲染 =========
async function renderCourses(){
  const listEl  = document.getElementById('courses-list');
  const emptyEl = document.getElementById('courses-empty');
  const moreBtn = document.getElementById('btn-more-courses');
  if (!listEl) return;

  const isHome = !!moreBtn;
  const LIMIT  = isHome ? 6 : null;

  if (!window.sb || typeof window.sb.from !== 'function'){
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    moreBtn?.classList.add('hidden');
    return;
  }
  const sb = window.sb;

  // 查詢
  let query = sb
    .from('courses')
    .select('id,title,summary,description,cover_url,gallery,teacher,category,created_at,duration_hours,material_fee,plan_type,course_fee', { count: LIMIT ? 'exact' : null })
    .eq('published', true)
    .is('deleted_at', null)
    .order('sort_priority', { ascending: false })   // 先比優先順序
    .order('created_at', { ascending: false });     // 再比新舊


  if (LIMIT) query = query.range(0, LIMIT - 1);

  const { data, error, count } = await query;
  if (error){
    console.warn('[courses] load error:', error);
    emptyEl?.classList.remove('hidden');
    moreBtn?.classList.add('hidden');
    return;
  }

  const items = (data || []);
  if (!items.length){
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    moreBtn?.classList.add('hidden');
    return;
  }
  emptyEl?.classList.add('hidden');

  // 圖片 URL
  for (const c of items){
    const paths = Array.isArray(c.gallery) ? c.gallery : [];
    c._galleryUrls = paths.length
      ? await toPublicUrls('course-gallery', paths)
      : [ c.cover_url || ('https://picsum.photos/seed/' + encodeURIComponent(c.id) + '/640/360') ];
  }

  // 渲染
  listEl.innerHTML = items.map(courseCardHTML).join('');

  // 輪播
  enableCarousels(listEl);

  // 首頁的「查看更多」
  if (isHome){
    if (typeof count === 'number' ? count > items.length : items.length >= LIMIT) {
      moreBtn.classList.remove('hidden');
    } else {
      moreBtn.classList.add('hidden');
    }
  }
}

// ====== 頁面初始化 ======
function initPage(){
  if (document.getElementById('courses-list')) renderCourses();
  if (document.getElementById('course-info')) loadCourse();
}
document.addEventListener('DOMContentLoaded', initPage);

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

// ========= 共用渲染：把課程陣列渲染到任一容器 =========
function renderCourseCards(rootEl, courses){
  if (!rootEl) return;
  rootEl.innerHTML = (courses || []).map(courseCardHTML).join('');
  enableCarousels(rootEl);
}

// 將常用工具掛到全域，讓其他檔案可直接呼叫
window.courseCardHTML   = window.courseCardHTML   || courseCardHTML;
window.enableCarousels  = window.enableCarousels  || enableCarousels;
window.toPublicUrls     = window.toPublicUrls     || toPublicUrls;
window.renderCourseCards= window.renderCourseCards|| renderCourseCards;
window.renderCourses    = window.renderCourses    || renderCourses;
