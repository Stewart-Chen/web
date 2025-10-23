// ====== CONFIG ======
const sb = window.sb; // 由 shared-layout.js 初始化

// ====== 小工具 ======
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function getParam(name){ return new URLSearchParams(location.search).get(name); }
const getUser = () => window.currentUser; // 由 shared-layout.js 維護

function getTeacherNames(course){
  // 允許 teacher: '小D' | null、teachers: ['小D', '汎汎'] | null
  const arr = Array.isArray(course?.teachers)
    ? course.teachers.filter(Boolean).map(String)
    : [];
  if (arr.length) return arr;
  const single = (course?.teacher ?? '').trim();
  return single ? [single] : [];
}

// 讀 select：如果還是 placeholder（''），就不要覆蓋現有 state
function readSelectValue(sel) {
  if (!sel) return undefined;
  const v = (sel.value ?? '').trim();
  return v === '' ? undefined : v;  // 只有有選到真實值才回傳
}

function syncFiltersFromUI() {
  const qEl       = document.getElementById('q');
  const catEl     = document.getElementById('cat');
  const teacherEl = document.getElementById('teacher');
  const planEl    = document.getElementById('planType');

  const patch = {};

  // 關鍵字：空字串允許覆蓋（因為真的可能清空文字）
  if (qEl) patch.q = qEl.value || '';

  const vCat = readSelectValue(catEl);
  if (vCat !== undefined) patch.category = vCat || null;

  const vTeacher = readSelectValue(teacherEl);
  if (vTeacher !== undefined) patch.teacher = vTeacher || null;

  const vPlan = readSelectValue(planEl);
  if (vPlan !== undefined) patch.plan_type = vPlan || null;

  Object.assign(window.courseState || (window.courseState = {}), patch);

  // 同步後保存（避免下次又被空值蓋掉）
  try { sessionStorage.setItem('courseState', JSON.stringify(window.courseState)); } catch {}
}

// app 啟動很早的地方（initPage 之前）先嘗試讀回
try {
  const saved = sessionStorage.getItem('courseState');
  if (saved) Object.assign(window.courseState, JSON.parse(saved));
} catch {}

// 單一出入口：永遠以 window.courseState 為準
function renderCoursesFromState() {
  window.renderCourses(window.courseState.page, window.courseState);
}

let __restoringBF = false;
let _didInitialRender = false;

// === [app.js 頂層] 返回(BFCache) 時：先同步 UI → state，再渲染 ===
window.addEventListener('pageshow', (e) => {
  if (!document.getElementById('courses-list')) return;
  const nav = performance.getEntriesByType('navigation')[0];
  const isBF = e.persisted || nav?.type === 'back_forward';
  if (!isBF) return;

  __restoringBF = true;       // 只在同步 UI → state 時開保護
  syncFiltersFromUI();
  __restoringBF = false;      // ✅ 渲染前關閉，避免被 guard 擋掉

  console.log('[pageshow] state synced', window.courseState);
  renderCoursesFromState();   // 這次會正常渲染
  _didInitialRender = true;
});

function moveCourseFeesToEnd(){
  const list = document.querySelector('#course-info-detail .info-list');
  if (!list) return;
  const fee  = list.querySelector('.info-item[data-key="fee"]');
  const mfee = list.querySelector('.info-item[data-key="material_fee"]');
  // 先費用、再材料費 → 順序就會是 …, 課程總費用, 總材料費
  if (fee)  list.appendChild(fee);
  if (mfee) list.appendChild(mfee);
}

function enhanceLessonsUI(root = document){
  // 判斷是否在「一日工作坊單元」容器中
  const isOneDay =
    root.id === 'lessons-section-one-day' ||
    root.closest?.('#lessons-section-one-day') ||
    !!root.querySelector?.('#lessons-one-day');

  // 取得兩種清單裡的 lesson 按鈕
  const btns = Array.from(
    root.querySelectorAll('button.lesson-toggle, #lessons button.btn, #lessons-one-day button.btn')
  ).filter(Boolean);

  // 工具：把 "3 小時" 之類字串抓出數字小時，預設 3
  const parseHours = (s) => {
    const m = String(s || '').match(/([0-9]+(?:\.[0-9]+)?)/);
    return m ? parseFloat(m[1]) : 3;
  };
  const fmt = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  const addMinutes = (baseH, baseM, plusMin) => {
    const total = baseH * 60 + baseM + plusMin;
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return [hh, mm];
  };

  if (isOneDay) {
    // 一日工作坊：預期只有兩個課程按鈕（上午、下午）
    // 1) 準備容器與中午休息的插入點
    const listEl =
      root.querySelector('#lessons-one-day') ||
      btns[0]?.closest('ol') ||
      root.querySelector('ol');

    // 避免重複插入休息卡（若已存在 .lesson-rest 就跳過插入）
    const hasRest = !!root.querySelector('.lesson-rest');

    // 2) 先處理上午（第 1 個按鈕）——以結束時間 12:00 往前推
    const amBtn = btns[0];
    if (amBtn && !amBtn.dataset.enhanced) {
      const rawTitle = amBtn.textContent.trim();
      const durHrs = parseHours(amBtn.dataset.duration); // e.g. "3 小時" → 3
      const endH = 12, endM = 0;                         // 上午固定 12:00 結束
      const mins = Math.round(durHrs * 60);
      const [startH, startM] = addMinutes(endH, endM, -mins); // 往前推回開始時間
      const durationStr = `${fmt(startH, startM)}~${fmt(endH, endM)}`;
    
      amBtn.innerHTML = `
        <span class="chapter">上午</span>
        <span class="title">${rawTitle}</span>
        <span class="meta">${durHrs ? `<span class="duration">${durationStr}</span>` : ''}</span>
      `;
      amBtn.classList.add('lesson-btn');
      amBtn.dataset.enhanced = '1';
    }

    // 3) 插入中午休息卡片
    if (listEl && !hasRest && amBtn) {
      const amLi = amBtn.closest('li');
      if (amLi) {
        amLi.insertAdjacentHTML('afterend', `
          <li class="lesson-rest">
            <button class="btn lesson-btn no-content rest" aria-disabled="true" tabindex="-1">
              <span class="chapter">午間休息</span>
              <span class="title">午餐與自由交流</span>
              <span class="meta"><span class="duration">12:00~13:00</span></span>
            </button>
          </li>
        `);
      }
    }

    // 4) 再處理下午（第 2 個按鈕）
    const pmBtn = btns[1];
    if (pmBtn && !pmBtn.dataset.enhanced) {
      const rawTitle = pmBtn.textContent.trim();
      const durHrs = parseHours(pmBtn.dataset.duration);
      const startH = 13, startM = 0;
      const [endH, endM] = addMinutes(startH, startM, Math.round(durHrs * 60));
      const durationStr = `${fmt(startH, startM)}~${fmt(endH, endM)}`;

      pmBtn.innerHTML = `
        <span class="chapter">下午</span>
        <span class="title">${rawTitle}</span>
        <span class="meta">${durHrs ? `<span class="duration">${durationStr}</span>` : ''}</span>
      `;
      pmBtn.classList.add('lesson-btn');
      pmBtn.dataset.enhanced = '1';
    }

    // 其餘（若意外出現第 3 個之後的按鈕），就當作一般課處理
    btns.slice(2).forEach((btn, idx) => {
      if (btn.dataset.enhanced) return;
      const title = btn.textContent.trim();
      const duration = btn.dataset.duration || '';
      btn.innerHTML = `
        <span class="chapter">第 ${idx + 3} 堂</span>
        <span class="title">${title}</span>
        <span class="meta">${duration ? `<span class="duration">${duration}</span>` : ``}</span>
      `;
      btn.classList.add('lesson-btn');
      btn.dataset.enhanced = '1';
    });

    return; // 一日工作坊到此結束
  }

  // ===== 非一日工作坊（維持原行為）=====
  btns.forEach((btn, idx)=>{
    if (btn.dataset.enhanced) return;
    // 清掉可能夾帶的「第N堂 / 單元N」，保留純標題
    const raw = btn.textContent.trim();
    const title = raw
      .replace(/^第\s*\d+\s*堂\s*/,'')
      .replace(/^單元\s*\d+\s*/,'')
      .trim();
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
  const enrollBtn = document.getElementById('enroll-btn');
  const enrolledBadge = document.getElementById('enrolled-badge');
  const progressEl = document.getElementById('progress');
  const modal = document.getElementById('lesson-modal');
  const summaryEl = document.getElementById('course-summary'); 
  const heroEl = document.getElementById('course-hero');
  const lessonsElOneDay = document.getElementById('lessons-one-day');
  const lessonsSecSeries = document.getElementById('lessons-section');
  const lessonsSecOneDay = document.getElementById('lessons-section-one-day');


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

  function expandFirstLessonIfAny(rootSel){
    const firstContent = document.querySelector(`${rootSel} .lesson-content`);
    if (!firstContent) return;
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

  function convertCourseText(el) {
    if (!el) return;
  
    const raw = (el.textContent || '').trim();
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
  if (descEl) descEl.textContent = course.description ?? course.summary ?? '';
  convertCourseText(document.getElementById('course-desc'));

  // ✅ Hero 圖：抓第一張 gallery，退而求其次用 cover_url，再退 placeholder
  try {
    const gallery = Array.isArray(course.gallery) ? course.gallery : [];
    const urls = gallery.length ? await toPublicUrls('course-gallery', gallery) : [];
    const heroUrl =
      (urls && urls[0]) ||
      course.cover_url ||
      `https://picsum.photos/seed/${encodeURIComponent(course.id)}/1200/630`;

    if (heroEl) {
      const names = getTeacherNames(course);
      const TEACHER_META = {
        汎汎: { avatar: '/web/img/fan_o.jpg' },
        小D:  { avatar: '/web/img/dd_o.jpg' }
      };
      const avatars = names
        .map(n => TEACHER_META[n]?.avatar)
        .filter(Boolean)
        .slice(0, 3); // 顯示最多 3 個
      
      heroEl.innerHTML = `
        <img src="${heroUrl}" alt="${course.title} 主圖" loading="eager" decoding="async">
        ${avatars.length ? `
          <div class="hero-avatar">
            ${avatars.map((url, i)=>`<img src="${url}" alt="${names[i]} 縮圖">`).join('')}
          </div>
        ` : ``}
      `;
    }

    
  } catch (e) {
    console.warn('hero image load failed', e);
  }

  // === 根據方案類型為 teacher-box 加上 class ===
  const teacherBoxWrap = document.getElementById('teacher-box');
  if (teacherBoxWrap && course.plan_type) {
    teacherBoxWrap.classList.remove('is-series', 'is-one-day', 'is-unknown');
    if (course.plan_type === '系列課') {
      teacherBoxWrap.classList.add('is-series');
    } else if (course.plan_type === '一日工作坊') {
      teacherBoxWrap.classList.add('is-one-day');
    } else {
      teacherBoxWrap.classList.add('is-unknown');
    }
  }

const teacherBox = document.getElementById('teacher-box-content');
if (teacherBox) {
  // 給老師一個可穩定引用的 id（你也可以改成從資料庫拿）
  const TEACHER_META = {
    汎汎: { id: 2, name: '汎汎', role: '園藝治療老師', avatar: '/web/img/fan_o.jpg' },
    小D:  { id: 1, name: '小D',  role: '藝術療癒老師', avatar: '/web/img/dd_o.jpg' }
  };

  // 後備方案：若沒有預先配置 id，就用 name 做簡單 slug 當 id
  const slugify = s => String(s).trim()
    .normalize('NFKC').replace(/\s+/g,'-').toLowerCase();
  const getTeacherId = (name) => TEACHER_META[name]?.id ?? slugify(name);

  const names = getTeacherNames(course);

  if (!names.length) {
    teacherBox.textContent = '—';
  } else {
    teacherBox.innerHTML = names.map((n, i) => {
      const m = TEACHER_META[n];
      const text = m ? `${m.name}｜${m.role}` : n;
      const id = getTeacherId(n);
      const link = `
        <a href="teacher.html?id=${encodeURIComponent(id)}"
           class="chip chip-items">
          ${text}
        </a>
      `;
      // 保留中間的「×」分隔
      return i < names.length - 1
        ? `${link}<div class="teacher-sep">×</div>`
        : link;
    }).join('');
  }
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
    
    // 一日工作坊：顯示「上午、下午各 X 小時」與「活動時長 約 Y 小時（含午休）」。
    if (course.duration_hours) {
      const per = Number(course.duration_hours);
      if (course.plan_type === '一日工作坊') {
        const totalCourseHrs = per * 2;      // 上午+下午的實際上課時數
        const totalDayHrs    = totalCourseHrs + 1; // 含午休（預設 1 小時）
    
        items.push({
          key: 'duration',
          label: '課程時數',
          value: `上午 ${per} 小時 + 下午 ${per} 小時`,
          icon: 'clock'
        });
        items.push({
          key: 'total_duration',
          label: '活動時長（含午休）',
          value: `共 ${totalDayHrs} 小時`,
          icon: 'calendar'
        });
      } else {
        const label = (course.plan_type === '系列課') ? '每堂時數' : '課程時數';
        items.push({ key: 'duration', label, value: `${per} 小時`, icon: 'clock' });
      }
    }

    if (Number.isFinite(course.course_fee)) {
      const fee = course.course_fee.toLocaleString?.('zh-TW') ?? course.course_fee;
      const label = '全班課程費用';
      items.push({ key: 'fee', label, value: `NT$ ${fee} /小時`, icon: 'coin' });
    }
    if (Number.isFinite(course.material_fee)) {
      const mfee = course.material_fee.toLocaleString?.('zh-TW') ?? course.material_fee;
      const label = (course.plan_type === '系列課') ? '總材料費 (另付)' : '材料費 (另付)';
      items.push({ key: 'material_fee', label, value: `NT$ ${mfee} /人`, icon: 'wallet' });
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

  function injectCostCalculator(course, { weeks=0, perHour=0 } = {}){
    // 找到「課程資訊」區塊
    const infoSec = document.getElementById('course-info-detail');
    if (!infoSec) return;
  
    // 預設值
    const isSeries = course.plan_type === '系列課';
    const people   = Number(course.capacity) || 0;
    const feePerHr = Number(course.course_fee) || 0;
    const durHour  = Number(course.duration_hours) || 0;
    const totalHr = isSeries
      ? (weeks * perHour || (weeks * durHour) || 0)
      : (course.plan_type === '一日工作坊'
          ? durHour * 2 // 上午 + 下午
          : durHour);
    const matPer   = Number(course.material_fee) || 0; // 系列課這是「總材料費/人」
  
    // DOM
    const sec = document.createElement('section');
    sec.id = 'cost-calculator';
    sec.className = 'course-info cost-calculator';
    const title = `<div class="course-info__title">總金額試算</div>`;
  
    const labelHours = isSeries ? '總時數' : '課程時數';
    const labelMat   = isSeries ? '總材料費 / 人' : '材料費 / 人';
    const formulaTxt = isSeries
      ? '課程費用 × 總時數 ＋ 總材料費 × 預估人數'
      : '課程費用 × 課程時數 ＋ 材料費 × 預估人數';
  
    sec.innerHTML = `
      ${title}
      <div class="calc-grid">
        <label class="calc-field">
          <span>預估人數</span>
          <input type="number" id="calc-people" min="0" step="1" value="${people}">
        </label>
        <label class="calc-field">
          <span>${labelHours}</span>
          <input type="number" id="calc-hours" min="0" step="0.5" value="${totalHr}">
        </label>
        <label class="calc-field">
          <span>課程費用 / 小時</span>
          <input type="number" id="calc-fee" min="0" step="1" value="${feePerHr}">
        </label>
        <label class="calc-field">
          <span>${labelMat}</span>
          <input type="number" id="calc-mat" min="0" step="1" value="${matPer}">
        </label>
      </div>
  
      <div class="calc-result">
        <!--<div class="formula">${formulaTxt}</div>-->
        <div class="lines">
          <div><span>課程費用小計</span><strong id="calc-sub-fee">NT$ 0</strong></div>
          <div><span>${isSeries ? '總材料費小計' : '材料費小計'}</span><strong id="calc-sub-mat">NT$ 0</strong></div>
          <hr>
          <div class="total"><span>預估總金額</span><strong id="calc-total">NT$ 0</strong></div>
        </div>
      </div>
    `;
  
    // 插入在課程資訊（icon 列表）後面
    infoSec.insertAdjacentElement('afterend', sec);
  
    // 工具
    const $ = sel => sec.querySelector(sel);
    const nt = n => 'NT$ ' + (Math.round(Number(n)||0)).toLocaleString('zh-TW');
  
    function calc(){
      const p  = Number($('#calc-people').value) || 0;
      const h  = Number($('#calc-hours').value) || 0;
      const fh = Number($('#calc-fee').value) || 0;
      const mp = Number($('#calc-mat').value) || 0;
  
      // 兩種公式
      const subFee = fh * h;
      const subMat = mp * p;
      const total  = subFee + subMat;
  
      $('#calc-sub-fee').textContent = nt(subFee);
      $('#calc-sub-mat').textContent = nt(subMat);
      $('#calc-total').textContent   = nt(total);
    }
  
    // 綁定事件
    ['#calc-people', '#calc-hours', '#calc-fee', '#calc-mat'].forEach(sel=>{
      $(sel).addEventListener('input', calc);
      $(sel).addEventListener('change', calc);
    });
  
    // 初算
    calc();
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

    // (B) 課程單元（系列課 or 一日工作坊）
    const { data: lessons, error: lsErr } = await sb
      .from('lessons')
      .select('id, title, content, order_no')
      .eq('course_id', idNum)
      .order('order_no');
    
    if (lsErr) { console.error(lsErr); return; }
    
    const isOneDay = course.plan_type === '一日工作坊';
    const secSeries = document.getElementById('lessons-section');
    const secOneDay = document.getElementById('lessons-section-one-day');
    const listSeries = document.getElementById('lessons');
    const listOneDay = document.getElementById('lessons-one-day');
    
    // 先全部隱藏
    secSeries?.classList.add('hidden');
    secOneDay?.classList.add('hidden');
    
    if (!lessons || lessons.length === 0) {
      $('#progress-section')?.classList.add('hidden');
    } else {
      // 根據課程類型決定顯示哪一塊
      const targetSec = isOneDay ? secOneDay : secSeries;
      const targetList = isOneDay ? listOneDay : listSeries;
      targetSec?.classList.remove('hidden');
      $('#progress-section')?.classList.add('hidden');
    
      // 渲染課程單元
      targetList.innerHTML = lessons.map((ls, idx) => {
        const dur = course.duration_hours ? `${course.duration_hours} 小時` : '';
        const contentHTML = ls.content
          ? `<div class="lesson-content hidden">${ls.content.replace(/\n/g, '<br>')}</div>`
          : '';
       
        return `
          <li>
            <button class="btn lesson-toggle" aria-expanded="false"
                    data-lesson="${ls.id}" data-duration="${dur}">
              ${ls.title}
            </button>
            ${contentHTML}
          </li>
        `;
      }).join('');
    
      // 這一步會自動轉成「章節＋標題＋meta」結構
      enhanceLessonsUI(targetSec);
    
      // 沒內容的按鈕 → 不顯示箭頭
      targetSec.querySelectorAll('li').forEach(li => {
        const btn = li.querySelector('.lesson-toggle');
        const content = li.querySelector('.lesson-content');
        if (btn && !content) btn.classList.add('no-content');
      });
    
      // 預設展開第一個有內容的單元
      expandFirstLessonIfAny(isOneDay ? '#lessons-one-day' : '#lessons');
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

  // --- 總金額試算表 ---
  (function addCalculator(){
    const isSeries = course.plan_type === '系列課';
    let weeks = 0;
    let perHour = Number(course.duration_hours) || 0;

    // 若是系列課，盡量用剛剛算過的 lessons 數量當週數
    if (isSeries) {
      // lessons 在上面已經查過
      // 若沒查到（理論上不會），weeks 就是 0
      const ls = (typeof lessons !== 'undefined' && Array.isArray(lessons)) ? lessons : [];
      weeks = ls.length;
    }

    injectCostCalculator(course, { weeks, perHour });
  })();

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
          const message = document.getElementById('enroll-message')?.value.trim() || null;

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
              line_id: line || null,
              user_email: getUser()?.email || null,  // ← 新增：存會員信箱
              message: message                       // ← 新增：存留言
            });

          if (insErr){ console.error(insErr); alert('報名失敗：' + insErr.message + '\n\n有任何疑問請洽汎汎: fun790327@gmail.com'); return; }

          alert('報名成功！\n\n有任何疑問請洽汎汎: fun790327@gmail.com');
          dlg.close();

      
          const { data: fnData, error: fnErr } = await sb.functions.invoke('notify-enrollment', {
            body: {
              course_id: idNum,
              course_title: course.title,
              fullname: name,
              phone: phone,
              line_id: line || null,
              user_id: getUser()?.id || null,
              user_email: getUser()?.email || null,
              message: message
            }
          });
          if (fnErr) {
            console.error('notify-enrollment error:', fnErr);
          } else {
            console.log('notify-enrollment ok:', fnData);
          }

          
          enrollBtn.classList.add('hidden');
          enrolledBadge?.classList.remove('hidden');
          if (typeof setLessonLock === 'function') setLessonLock(true);
          
          loadProgress(lessons || []);


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
  function bindLessonToggle(container){
    container?.addEventListener('click', (e) => {
      const btn = e.target.closest('.lesson-toggle');
      if (!btn) return;
      const li = btn.closest('li');
      const contentEl = li?.querySelector('.lesson-content');
      if (!contentEl) return;
      const willOpen = contentEl.classList.contains('hidden');
      contentEl.classList.toggle('hidden', !willOpen);
      li.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  }
  bindLessonToggle(lessonsEl);
  bindLessonToggle(lessonsElOneDay);

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
  const cats = Array.isArray(c.category) ? c.category.filter(Boolean) : (c.category ? [c.category] : []);
  const teacherNames = getTeacherNames(c);
  const imgs = Array.isArray(c._galleryUrls) && c._galleryUrls.length ? c._galleryUrls : [];
  const showCatBadge = c.plan_type !== '一日工作坊' && !!cats.length;
  const catBadgeHTML = showCatBadge
    ? `<img class="badge badgeImg"
             src="${Array.isArray(c.category) && c.category.includes('園藝') ? '/web/img/garden_simple.png' : '/web/img/art_simple.png'}"
             alt="${c.category}">`
    : `
      <div class="badges-one-day">  
        <img class="badge badgeImg-one-day" src="/web/img/art_simple.png" alt="藝術">
        <img class="badge badgeImg-one-day" src="/web/img/garden_simple.png" alt="園藝">
      </div>
    `;
  
  return `
    <article class="course-card card"
             data-category="${c.category || ''}"
             data-teachers="${teacherNames.join(',')}">
  
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

            ${catBadgeHTML}
          </div>
          <p class="muted">${(c.summary || '').slice(0, 80)}</p>
          
          ${(c.duration_hours || Number.isFinite(c.course_fee) || (Array.isArray(c.keywords) && c.keywords.length)) ? `
            
            ${Array.isArray(c.keywords) && c.keywords.length ? `
              <!--<div class="meta-row keywords-row">
                <span class="meta meta-kw">
                  <span class="kw-list">
                    ${c.keywords.map(k => `<span class="kw">${k}</span>`).join('')}
                  </span>
                </span>
              </div>-->
            ` : ``}
            
            <div class="meta-row">
              ${teacherNames.length ? `<span class="meta">
                ${teacherNames.map(n => `<span>${n}</span>`).join('×')}
              </span>` : ``}

              ${c.duration_hours ? (() => {
                const per = Number(c.duration_hours);
                const weeks = (c.plan_type === '系列課') ? Number(c._weeks) : 0; // ← 從外面回填進來
                let label;
                if (c.plan_type === '一日工作坊') {
                  const total = per * 2;
                  label = `${per} 小時 + ${per} 小時`;
                } else if (weeks && per) {
                  label = `${weeks} 堂 × ${per} 小時`;
                } else {
                  label = `${per} 小時`;
                }
                return `<span class="meta"><svg aria-hidden="true" viewBox="0 0 24 24" class="i">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M12 6v6l4 2" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/></svg>${label}</span>`;
              })() : ``}
     
              ${Number.isFinite(c.course_fee) ? `<span class="meta">NT$ ${c.course_fee.toLocaleString?.('zh-TW') ?? c.course_fee} /小時</span>` : ``}
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
  const LIMIT = isHome ? 15 : 15;
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
    .select('id,title,summary,description,cover_url,gallery,teacher,teachers,category,created_at,duration_hours,course_fee,keywords,plan_type', { count: 'exact' })
    .eq('published', true)
    .is('deleted_at', null)
    .order('sort_priority', { ascending: false })   // 先比優先順序 sort_priority 大 → 小 排序
    .order('created_at', { ascending: false });    // 再比新舊 建立時間 新 → 舊 排序

  //套用過濾條件（老師 / 類型）
  if (filters.teacher) {
    const t = String(filters.teacher).trim();
    query = query.or(`teacher.eq.${t},teachers.cs.{${t}}`);
  }
  // ✅ category 是 text[] → 用 contains
  if (Array.isArray(filters.category) && filters.category.length) {
    query = query.contains('category', filters.category);
  } else if (typeof filters.category === 'string' && filters.category.trim()) {
    // 相容舊字串：包成陣列再查
    query = query.contains('category', [filters.category.trim()]);
  }

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
    //emptyEl?.classList.remove('hidden');

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
      return renderCoursesFromState();
    }

    renderPagination(page, totalPages, filters);
    paginationEl?.classList.remove('hidden');
    moreBtn?.classList.add('hidden');
  }
}

window.setCourseFilter = function (partial) {
  Object.assign(window.courseState, partial);
  window.courseState.page = 1;
  try { sessionStorage.setItem('courseState', JSON.stringify(window.courseState)); } catch {}
  if (typeof window.renderCourses === 'function') {
    renderCoursesFromState();
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
    renderCoursesFromState();
    scrollToCoursesTop();
  };
  nextBtn.onclick = () => {
    courseState.page = Math.min(totalPages, currentPage + 1);
    renderCoursesFromState();
    scrollToCoursesTop();
  };

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = 'page-number' + (i === currentPage ? ' active' : '');
    btn.onclick = () => {
      if (i !== currentPage) {
        courseState.page = i;
        renderCoursesFromState();
        scrollToCoursesTop();
      }
    };
    pageNumbersEl.appendChild(btn);
  }
}

// ====== 頁面初始化 ======
function initPage(){
  if (document.getElementById('courses-list')) {
    requestAnimationFrame(() => {
      if (_didInitialRender) return;
      syncFiltersFromUI();
      renderCoursesFromState();
      _didInitialRender = true;
    });
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

// === [app.js 結尾掛 window.renderCourses 之後立刻包裝] ===
(function guardRenderDuringRestore(){
  const _orig = window.renderCourses;
  if (!_orig) return;
  window.renderCourses = function(page, filters){
    if (__restoringBF) {
      console.log('[renderCourses] skipped during BF restore');
      return;
    }
    return _orig(page, filters);
  };
})();

// === 首頁：課程方案卡片點擊 → 帶著方案類型跳到課程頁 ===
(function enablePlanTypeJumpFromHome(){
  const sec = document.querySelector('#course-type .feature-grid');
  if (!sec) return;

  const planMap = new Map([
    ['一般課程', '課程'],
    ['系列課程', '系列課'],
    ['一日工作坊', '一日工作坊']
  ]);

  // 讓整張卡片可點
  sec.querySelectorAll('article.card').forEach(card => {
    card.style.cursor = 'pointer';
    card.setAttribute('tabindex', '0'); // 鍵盤也可操作

    const labelEl = card.querySelector('.badge.plan-type');
    const raw = labelEl?.textContent.trim() || '';
    const planType = planMap.get(raw) || null;

    const go = () => {
      // 建立要帶去課程頁的狀態（清掉其他既有條件）
      const nextState = {
        page: 1,
        teacher: null,
        category: null,
        plan_type: planType, // 可能是「課程 / 系列課 / 一日工作坊」
        keyword: null,
        q: ''
      };
      try { sessionStorage.setItem('courseState', JSON.stringify(nextState)); } catch {}

      // 前往課程頁
      location.href = 'courses.html';
    };

    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
})();

// === 首頁：療癒領域卡片點擊 → 帶著 category 跳到課程頁 ===
(function enableDomainJumpFromHome(){
  const sec = document.querySelector('#domains .feature-grid');
  if (!sec) return;

  const map = new Map([
    ['園藝治療', '園藝'],
    ['藝術療癒', '藝術']
  ]);

  sec.querySelectorAll('article.feature.card').forEach(card => {
    const title = card.querySelector('h3')?.textContent.trim();
    const category = map.get(title);
    if (!category) return; // 安全防呆

    const go = () => {
      const nextState = {
        page: 1,
        teacher: null,
        category: category ? [category] : [],
        plan_type: null,    // 不帶方案（避免互相干擾）
        keyword: null,
        q: ''
      };
      try { sessionStorage.setItem('courseState', JSON.stringify(nextState)); } catch {}
      location.href = 'courses.html';
    };

    card.style.cursor = 'pointer';
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
})();
