// ====== CONFIG ======
const sb = window.sb; // 由 shared-layout.js 初始化

// ====== 小工具 ======
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function getParam(name){ return new URLSearchParams(location.search).get(name); }
const getUser = () => window.currentUser; // 由 shared-layout.js 維護

function moveCourseFeesToEnd(){
  const list = document.querySelector('#course-info-detail .info-list');
  if (!list) return;
  const fee  = list.querySelector('.info-item[data-key="fee"]');
  const mfee = list.querySelector('.info-item[data-key="material_fee"]');
  // 先費用、再材料費 → 順序就會是 …, 課程總費用, 總材料費
  if (fee)  list.appendChild(fee);
  if (mfee) list.appendChild(mfee);
}

function convertTextToList(el) {
  if (!el) return;

  // 🪄 改這裡：用 innerHTML 取內容，保留 <br>
  const raw = (el.innerHTML || '')
    .replace(/<br\s*\/?>/gi, '\n')  // 把 <br> 換成換行
    .trim();

  if (!raw) return;

  // 1️⃣ 依「兩個以上換行」切成兩段
  const [partMain, partFeature] = raw.split(/\n{2,}/);

  // 2️⃣ 切出課程步驟：支援 1. / 1、 / 全形 １． / １、
  const items = partMain
    .split(/\s*[0-9０-９]+\s*[\.．、]\s*/g)
    .filter(Boolean);

  // 如果有兩個以上項目，轉成 <ol>
  if (items.length >= 2) {
    const ol = document.createElement('ol');
    ol.className = el.className || '';
    ol.id = el.id || '';

    items.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t.trim();
      ol.appendChild(li);
    });

    el.replaceWith(ol);

    // 3️⃣ 如果還有第二段（課程特色）
    if (partFeature && partFeature.trim()) {
      const p = document.createElement('p');
      p.id = 'course-feature';
      p.className = el.className || '';
      p.style.whiteSpace = 'pre-line';
      p.textContent = partFeature.trim();
      ol.insertAdjacentElement('afterend', p);
    }
  }
}

function enhanceLessonsUI(root = document){
  const btns = root.querySelectorAll('#lessons button.btn');
  btns.forEach((btn, idx)=>{
    if (btn.dataset.enhanced) return;
    const title = btn.textContent.trim();
    const duration = btn.dataset.duration || '';
    const chapter = `第 ${idx + 1} 堂`;

    btn.innerHTML = `
      <span class="chapter">${chapter}</span>
      <span class="title">${title}</span>
      <span class="meta">
        ${duration ? `<span class="duration">${duration}</span>` : ``}
      </span>
    `;
    btn.classList.add('lesson-btn');
    btn.dataset.enhanced = '1';
  });
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
  const summaryEl = document.getElementById('course-summary'); // ✅ 新增
  const heroEl = document.getElementById('course-hero');       // ✅ 新增

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

  function expandFirstLessonIfAny(){
    const firstContent = document.querySelector('#lessons .lesson-content');
    if (!firstContent) return; // 沒有任何可展開內容就跳過
    firstContent.classList.remove('hidden');
    const li  = firstContent.closest('li');
    if (li) li.classList.add('open');
    const btn = li?.querySelector('.lesson-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  if (error) { console.error(error); return; }
  if (!course) { if (titleEl) titleEl.textContent = '找不到課程或尚未發佈'; return; }
  if (titleEl) titleEl.textContent = course.title;
  if (summaryEl) summaryEl.textContent = course.summary || '—';

  if (descEl) descEl.textContent = course.description ?? course.summary ?? '';
  convertTextToList(document.getElementById('course-desc'));

  // ✅ Hero 圖：抓第一張 gallery，退而求其次用 cover_url，再退 placeholder
  try {
    const gallery = Array.isArray(course.gallery) ? course.gallery : [];
    const urls = gallery.length ? await toPublicUrls('course-gallery', gallery) : [];
    const heroUrl =
      (urls && urls[0]) ||
      course.cover_url ||
      `https://picsum.photos/seed/${encodeURIComponent(course.id)}/1200/630`;

    if (heroEl) {
      let avatarUrl = null;
      if (course.teacher === '汎汎') {
        avatarUrl = '/web/img/fan_o.jpg';
      } else if (course.teacher === '小D') {
        avatarUrl = '/web/img/dd_o.jpg';
      }
      heroEl.innerHTML = `
        <img src="${heroUrl}" alt="${course.title} 主圖" loading="eager" decoding="async">
        ${avatarUrl ? `
          <div class="hero-avatar">
            <img src="${avatarUrl}" alt="${course.teacher} 縮圖">
          </div>
        ` : ``}
      `;
    }

    
  } catch (e) {
    console.warn('hero image load failed', e);
  }
  
  const teacherBox = document.getElementById('teacher-box-content');
  if (teacherBox) {
    const TEACHER_META = {
      汎汎: { name: '汎汎', role: '園藝治療老師' },
      小D:     { name: '小D', role: '藝術療癒老師' }
    };
    const meta = TEACHER_META[course.teacher];
    teacherBox.textContent = meta ? `${meta.name}｜${meta.role}` : (course.teacher || '—');
  }
  
  const extraSec = document.getElementById('course-extra');
  if (extraSec) {
    // 先清乾淨舊內容（避免重複）
    extraSec.querySelector('#course-info-detail')?.remove();       // icon 列表
    extraSec.querySelector('#course-meta-grid')?.remove();  // 下方 meta grid
  
    // 1) 產生「課程資訊」：icon 清單（人數/時數/方案/費用）
    const items = [];
    if (course.plan_type) {
      items.push({ key: 'plan', label: '方案類型', value: `${course.plan_type}`, icon: 'tag' });
    }
    if (Number.isFinite(course.capacity)) {
      items.push({ key: 'capacity', label: '預估人數', value: `${course.capacity} 人`, icon: 'users' });
    }
    // 系列課：把「課程時數」→「每堂時數」
    if (course.duration_hours) {
      const label = (course.plan_type === '系列課') ? '每堂時數' : '課程時數';
      items.push({ key: 'duration', label, value: `${Number(course.duration_hours)} 小時`, icon: 'clock' });
    }
    if (Number.isFinite(course.course_fee)) {
      const fee = course.course_fee.toLocaleString?.('zh-TW') ?? course.course_fee;
      const label = (course.plan_type === '系列課') ? '課程總費用（含所有人）' : '課程費用（含所有人）';
      items.push({ key: 'fee', label, value: `NT$ ${fee}`, icon: 'coin' });
    }
    if (Number.isFinite(course.material_fee)) {
      const mfee = course.material_fee.toLocaleString?.('zh-TW') ?? course.material_fee;
      const label = (course.plan_type === '系列課') ? '每人總材料費 (另付)' : '每人材料費 (另付)';
      items.push({ key: 'material_fee', label, value: `NT$ ${mfee}`, icon: 'wallet' });
    }
    function planTypeClass(pt){
      if (pt === '系列課') return 'series-course';
      if (pt === '一日工作坊') return 'one-day';
      return (pt || '').trim().replace(/\s+/g,'-').toLowerCase();
    }
    if (items.length) {
      const infoSec = document.createElement('section');
      infoSec.id = 'course-info-detail';
      infoSec.className = 'course-info';
      const title = `<div class="course-info__title">課程資訊</div>`;
      const listHTML = `
        <div class="info-list">
          ${items.map(it => {
            const isPlan = it.key === 'plan';
            const valueClass = isPlan
              ? `badge plan-type ${planTypeClass(course.plan_type)}`
              : 'value';
            return `
              <div class="info-item" data-key="${it.key}">
                <div class="icon">${iconSVG(it.icon)}</div>
                <div class="label">${it.label}</div>
                <div class="${valueClass}">${it.value}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      infoSec.innerHTML = title + listHTML;
      extraSec.appendChild(infoSec);
    }
  }
  
  function iconSVG(name){
    const size = 20; // 統一大小
    switch (name) {
      case 'users':
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      case 'clock':
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
      case 'tag':
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
          <path d="M9 14l2 2 4-4"/>
        </svg>`;

      case 'coin': // 課程費用
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 8v8M9 10a3 3 0 0 1 3-2h1a2 2 0 1 1 0 4h-2a2 2 0 1 0 0 4h3a3 3 0 0 0 3-2"/>
        </svg>`;

      case 'wallet': // 材料費用
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z"/>
          <path d="M3.27 6.96L12 12l8.73-5.04"/>
        </svg>`;
        
      case 'calendar': // 課程節數
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>`;
      
      case 'sum': // 總時數
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 4h14M7 8h10M9 12h6M7 16h10M5 20h14"/>
        </svg>`;

      default:
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`;
    }
  }

  // 啟用 tabs 切換
  document.querySelectorAll('#course-extra-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // 清掉 active
      document.querySelectorAll('#course-extra-tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#course-extra-tabs .tab-pane').forEach(p => p.classList.remove('active'));
  
      // 設定新的 active
      tab.classList.add('active');
      const target = tab.dataset.target;
      document.getElementById('tab-' + target)?.classList.add('active');
    });
  });

function renderEquip(items){
  const box = document.getElementById('equip-items');
  if (!box) return;

  if (!Array.isArray(items) || !items.length) {
    box.textContent = '尚無設備項目';
    return;
  }

  const groups = { org: [], teacher: [], other: [] };
  items.forEach(raw => {
    if (typeof raw === 'string') {
      const s = raw.trim().replace(/^(\s*[-–—•]\s*)/, '');
      const m = s.match(/^(單位|老師)\s*[:：]\s*(.+)$/);
      if (m) {
        (m[1] === '單位' ? groups.org : groups.teacher).push(m[2].trim());
      } else {
        groups.other.push(s);
      }
    }
  });

  const section = (title, arr) => !arr.length ? '' : `
    <div class="equip-group">
      <div class="equip-title">${title}</div>
      <div class="equip-chips">
        ${arr.map(x => `<span class="chip chip-items">${x}</span>`).join('')}
      </div>
    </div>
  `;

  const html = `
    <div class="equip-groups">
      ${section('由主辦單位提供', groups.org)}
      ${section('講師自備', groups.teacher)}
      ${groups.other.length ? section('未分類', groups.other) : ''}
    </div>
  `;

  box.innerHTML = html || '尚無設備項目';
}

  
  // 呼叫
  renderEquip(course.equipment_items);

  
  if (Array.isArray(course.material_items) && course.material_items.length) {
    $('#material-items').innerHTML = course.material_items.map(x => `<span class="chip chip-items">${x}</span>`).join('');
  } else {
    $('#material-items').textContent = '尚無材料項目';
  }
  
  if (Array.isArray(course.keywords) && course.keywords.length) {
    $('#keyword-items').innerHTML = course.keywords.map(k => `<span class="chip chip-items">${k}</span>`).join('');
  } else {
    $('#keyword-items').textContent = '尚無關鍵字';
  }


  // (B) 系列課程單元
  const { data: lessons, error: lsErr } = await sb
    .from('lessons')
    .select('id, title, content, order_no')
    .eq('course_id', idNum)
    .order('order_no');
  if (lsErr) { console.error(lsErr); return; }
  
  if (!lessons || lessons.length === 0){
    //lessonsEmpty?.classList.remove('hidden');
    $('#lessons-section')?.classList.add('hidden');
    $('#progress-section')?.classList.add('hidden');
  } else if (lessonsEl){
    $('#progress-section')?.classList.add('hidden');
    lessonsEl.innerHTML = lessons.map((ls) => {
        const dur = course.duration_hours ? `${course.duration_hours} 小時` : '';
        const contentHTML = ls.content
          ? `<div class="lesson-content hidden">${ls.content.replace(/\n/g, '<br>')}</div>`
          : '';
        return `
          <li>
            <button class="btn lesson-toggle" aria-expanded="false"
                    data-lesson="${ls.id}" ${dur ? `data-duration="${dur}"` : ''}>
              ${ls.title}
            </button>
            ${contentHTML}
          </li>
        `;
      }).join('');

    enhanceLessonsUI(document);   // ← 這行：把按鈕包成「圓點 + 標題 + 時長」
    
    // 沒內容的按鈕 → 不顯示箭頭
    document.querySelectorAll('#lessons li').forEach(li => {
      const btn = li.querySelector('.lesson-toggle');
      const content = li.querySelector('.lesson-content');
      if (btn && !content) btn.classList.add('no-content');
    });

    // 把「1. ... 2. ...」轉成 <ol>
    document.querySelectorAll('#lessons .lesson-content').forEach(convertTextToList);
    // 預設展開第一個有內容的單元
    expandFirstLessonIfAny();
  }

  // ---- 系列課補充：課程節數 & 總時數 ----
  if (course.plan_type === '系列課') {
    const weeks = Array.isArray(lessons) ? lessons.length : 0;
    const per = Number(course.duration_hours) || 0;
    const total = weeks * per;
  
    const infoSec = document.getElementById('course-info-detail');
    const list = infoSec?.querySelector('.info-list');
    if (list) {
      // 1) 修正「每堂時數」(若先前不是就強制改)
      let durItem = list.querySelector('.info-item[data-key="duration"]');
      if (durItem) {
        durItem.querySelector('.label')?.replaceChildren(document.createTextNode('每堂時數'));
        durItem.querySelector('.value')?.replaceChildren(document.createTextNode(per ? `${per} 小時` : '—'));
      } else if (per) {
        list.insertAdjacentHTML('beforeend', `
          <div class="info-item" data-key="duration">
            <div class="icon">${iconSVG('clock')}</div>
            <div class="label">每堂時數</div>
            <div class="value">${per} 小時</div>
          </div>
        `);
      }
  
      // 2) 課程節數
      let freqItem = list.querySelector('.info-item[data-key="frequency"]');
      const freqHTML = `
        <div class="info-item" data-key="frequency">
          <div class="icon">${iconSVG('calendar')}</div>
          <div class="label">課程節數</div>
          <div class="value">共 ${weeks} 堂課</div>
        </div>
      `;
      if (freqItem) {
        freqItem.querySelector('.value')?.replaceChildren(document.createTextNode(`每週一堂，共 ${weeks} 週`));
      } else {
        list.insertAdjacentHTML('beforeend', freqHTML);
      }
  
      // 3) 總時數：每堂時數 × 週數
      let totalItem = list.querySelector('.info-item[data-key="total_hours"]');
      const totalText = total ? `${total} 小時` : '—';
      const totalHTML = `
        <div class="info-item" data-key="total_hours">
          <div class="icon">${iconSVG('sum')}</div>
          <div class="label">總時數</div>
          <div class="value">${totalText}</div>
        </div>
      `;
      if (totalItem) {
        totalItem.querySelector('.value')?.replaceChildren(document.createTextNode(totalText));
      } else {
        list.insertAdjacentHTML('beforeend', totalHTML);
      }
    }
  }
  moveCourseFeesToEnd();

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

  // 啟用展開/收合
  lessonsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.lesson-toggle'); // ← 不要加 #lessons
    if (!btn) return;
  
    const li = btn.closest('li');
    const contentEl = li?.querySelector('.lesson-content');
    if (!contentEl) return; // 沒內容就不切換
  
    const willOpen = contentEl.classList.contains('hidden');
    contentEl.classList.toggle('hidden', !willOpen);
    li.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  // (D) 點單元 → 完成標記
  /*lessonsEl?.addEventListener('click', async (e)=>{
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
  });*/

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
  const teacher  = c.teacher;
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
            ${c.plan_type ? (() => {
              // 判斷類型 → 給不同 class
              let extraClass = '';
              if (c.plan_type === '系列課') extraClass = ' series-course';
              else if (c.plan_type === '一日工作坊') extraClass = ' one-day';
            
              return `<span class="badge plan-type${extraClass}">${c.plan_type}</span>`;
            })() : ``}

         
            ${c.category
              ? `<img class="badge badgeImg" src="${c.category === 'horti' ? '/web/img/garden_simple.png' : '/web/img/art_simple.png'}"
                       alt="${c.category === 'horti' ? '園藝' : '藝術'}">`
              : ``}
          </div>
          <p class="muted">${(c.summary || '').slice(0, 80)}</p>
          
          ${(c.duration_hours || Number.isFinite(c.course_fee) || (Array.isArray(c.keywords) && c.keywords.length)) ? `
            ${Array.isArray(c.keywords) && c.keywords.length ? `
              <div class="meta-row keywords-row">
                <span class="meta meta-kw">
                  <svg aria-hidden="true" viewBox="0 0 24 24" class="i">
                    <path d="M3 12V6a3 3 0 0 1 3-3h6l9 9-9 9H6a3 3 0 0 1-3-3v-6z"
                          fill="none" stroke="currentColor" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="8" cy="8" r="1" fill="currentColor"/>
                  </svg>
                  <span class="kw-list">
                    ${c.keywords.map(k => `<span class="kw">${k}</span>`).join('')}
                  </span>
                </span>
              </div>
            ` : ``}
            
            <div class="meta-row">
              ${teacher ? `<span class="meta">${teacher}</span>` : ``}

              ${c.duration_hours ? (() => {
                const per = Number(c.duration_hours);
                const weeks = (c.plan_type === '系列課') ? Number(c._weeks) : 0; // ← 從外面回填進來
                const label = (weeks && per)
                  ? `${weeks} 堂 × ${per} 小時`
                  : `${per} 小時`;
                return `<span class="meta"><svg aria-hidden="true" viewBox="0 0 24 24" class="i">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M12 6v6l4 2" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/></svg>${label}</span>`;
              })() : ``}
     
              ${Number.isFinite(c.course_fee) ? `<span class="meta">NT$ ${c.course_fee.toLocaleString?.('zh-TW') ?? c.course_fee}</span>` : ``}
            </div>
          
          ` : ``}

        </div>
      </a>
    </article>
  `;
}

// 全域狀態：頁碼 + 過濾條件
window.courseState = window.courseState || {
  page: 1,
  teacher: null,
  category: null,
  plan_type: null,
  keyword: null,
  q: ''
};
const courseState = window.courseState;

// ========= 抓課程並渲染 =========
async function renderCourses(page = 1, filters = {}){
  const listEl  = document.getElementById('courses-list');
  const emptyEl = document.getElementById('courses-empty');
  const moreBtn = document.getElementById('btn-more-courses');
  const paginationEl = document.getElementById('pagination');
  if (!listEl) return;

  const isHome = !!moreBtn;
  const LIMIT = isHome ? 12 : 16;
  const offset = (page - 1) * LIMIT;

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
    .select('id,title,summary,description,cover_url,gallery,teacher,category,created_at,duration_hours,course_fee,keywords,plan_type', { count: 'exact' })
    .eq('published', true)
    .is('deleted_at', null)
    .order('sort_priority', { ascending: false })   // 先比優先順序 sort_priority 大 → 小 排序
    .order('created_at', { ascending: false });    // 再比新舊 建立時間 新 → 舊 排序

  //套用過濾條件（老師 / 類型）
  if (filters.teacher)  query = query.eq('teacher',  filters.teacher);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.plan_type) query = query.eq('plan_type', filters.plan_type);
  if (filters.keyword)   query = query.contains('keywords', [filters.keyword]);

  if (filters.q && filters.q.trim()) {
    const kw  = filters.q.trim();
    const esc = kw.replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(
      `title.ilike.%${esc}%,summary.ilike.%${esc}%,description.ilike.%${esc}%`
    );
  }

  //分頁範圍
  const { data, error, count } = await query.range(offset, offset + LIMIT - 1);
  
  if (error){
    console.warn('[courses] load error:', error);
    emptyEl?.classList.remove('hidden');
    moreBtn?.classList.add('hidden');
    return;
  }

  // 渲染卡片後，更新數量（課程頁才顯示）
  const countBox = document.getElementById('courses-count');
  if (countBox) {
    if (isHome) {
      countBox.textContent = ''; // 首頁不顯示
    } else {
      countBox.textContent = typeof count === 'number' ? `${count} 堂課程` : '';
    }
  }

  const items = (data || []);
  if (!items.length) {
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');

    // 分開處理首頁/課程頁的尾端 UI
    if (isHome) {
      moreBtn?.classList.add('hidden');
    } else {
      // 課程頁：沒有資料時也要把分頁清乾淨
      renderPagination(1, 1, filters); // 渲染成單頁禁用狀態
      paginationEl?.classList.remove('hidden');
      moreBtn?.classList.add('hidden');
    }
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

  // 補系列課的週數（用 lessons 筆數當週數）
  const seriesIds = items.filter(c => c.plan_type === '系列課').map(c => c.id);
  if (seriesIds.length) {
    // 一次抓出所有系列課的 lessons，自己在前端 group 計數
    const { data: lsAll, error: lsErr } = await sb
      .from('lessons')
      .select('course_id')
      .in('course_id', seriesIds);
  
    if (!lsErr && Array.isArray(lsAll)) {
      const weeksMap = {};
      lsAll.forEach(r => { weeksMap[r.course_id] = (weeksMap[r.course_id] || 0) + 1; });
      items.forEach(c => {
        if (c.plan_type === '系列課') c._weeks = weeksMap[c.id] || 0;
      });
    }
  }
  
  // 渲染
  listEl.innerHTML = items.map(courseCardHTML).join('');

  // 輪播
  enableCarousels(listEl);

  // 首頁的「查看更多」
  if (isHome) {
    // 首頁：顯示「查看更多」，不顯示分頁
    if (typeof count === 'number' ? count > items.length : items.length >= LIMIT) {
      moreBtn?.classList.remove('hidden');
    } else {
      moreBtn?.classList.add('hidden');
    }
    paginationEl?.classList.add('hidden');
  } else {
    // 課程頁：依「相同的過濾條件」計算總頁數並渲染分頁
    const totalPages = Math.max(1, Math.ceil(count / LIMIT));

    // 若目前頁碼超過總頁數（例如篩選後資料變少），自動拉回最後一頁
    if (page > totalPages) {
      courseState.page = totalPages;
      return renderCourses(courseState.page, filters);
    }

    renderPagination(page, totalPages, filters);
    paginationEl?.classList.remove('hidden');
    moreBtn?.classList.add('hidden');
  }
}

window.setCourseFilter = function (partial) {
  Object.assign(window.courseState, partial);
  window.courseState.page = 1; // 篩選變更時回到第 1 頁
  console.log('[app_init]');

  if (typeof window.renderCourses === 'function') {
    console.log('[app]');
    window.renderCourses(window.courseState.page, window.courseState);
  }
};

function renderPagination(currentPage, totalPages, filters = {}) {
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageNumbersEl = document.getElementById('page-numbers');

  if (!pageNumbersEl) return;
  pageNumbersEl.innerHTML = '';

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  // ---- helper：滾回課程區頂部 ----
  function scrollToCoursesTop() {
    const section = document.getElementById('courses-section');
    const headerH = parseInt(getComputedStyle(document.documentElement)
                      .getPropertyValue('--header-height')) || 68;
    const y = section ? section.getBoundingClientRect().top + window.scrollY - headerH - 12 : 0;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
  
  prevBtn.onclick = () => {
    courseState.page = Math.max(1, currentPage - 1);
    renderCourses(courseState.page, filters);
    scrollToCoursesTop();
  };
  nextBtn.onclick = () => {
    courseState.page = Math.min(totalPages, currentPage + 1);
    renderCourses(courseState.page, filters);
    scrollToCoursesTop();
  };

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = 'page-number' + (i === currentPage ? ' active' : '');
    btn.onclick = () => {
      if (i !== currentPage) {
        courseState.page = i;
        renderCourses(courseState.page, filters);
        scrollToCoursesTop();
      }
    };
    pageNumbersEl.appendChild(btn);
  }
}

// ====== 頁面初始化 ======
function initPage(){
  if (document.getElementById('courses-list')) {
    renderCourses(window.courseState.page, window.courseState);
  }
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
