// /web/js/teacher.js
(function(){
  const sb = window.sb; // shared-layout.js 初始化
  const $  = (sel, root=document)=> root.querySelector(sel);
  const $id = (id)=> document.getElementById(id);

  function getParam(name){ return new URLSearchParams(location.search).get(name); }

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[m]);
  }

  function badgeHTML(txt, extraClass=''){
    return `<span class="badge ${extraClass}">${escapeHtml(txt)}</span>`;
  }

  function planTypeClass(pt){
    if (pt === '系列課') return 'series-course';
    if (pt === '一日工作坊') return 'one-day';
    return (pt || '').trim().replace(/\s+/g,'-').toLowerCase();
  }

  // -------- Links / Icons 工具 --------
  function normalizeUrl(u){
    if (!u) return null;
    const s = String(u).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[a-z]+:/i.test(s)) return s; // 其他 schema
    return 'https://' + s;             // 預設補 https
  }
  function whichBrand(url){
    try{
      const u = new URL(url);
      const h = u.hostname.replace(/^www\./,'').toLowerCase();
      if (h.includes('instagram.com')) return 'ig';
      if (h.includes('facebook.com') || h === 'fb.me') return 'fb';
      if (h.includes('youtube.com') || h === 'youtu.be') return 'yt';
      if (h.includes('x.com') || h.includes('twitter.com')) return 'x';
      if (h.includes('linktr.ee')) return 'linktree';
      return 'web';
    }catch{ return 'web'; }
  }
  function iconSVG(kind, size=18){
    switch (kind){
      case 'mail':
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#EA4335">
          <path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>`;

      case 'ig':
        /*return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#E4405F">
          <rect x="3" y="3" width="18" height="18" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <circle cx="17.5" cy="6.5" r="1.5"/></svg>`;*/

       return `<svg viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <!-- IG 漸層 -->
              <linearGradient id="igGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#F58529"></stop>
                <stop offset="30%" stop-color="#FEDA77"></stop>
                <stop offset="60%" stop-color="#DD2A7B"></stop>
                <stop offset="100%" stop-color="#8134AF"></stop>
              </linearGradient>
            </defs>
            <rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="url(#igGradient)"></rect>
            <circle cx="12" cy="12" r="4.2" fill="#fff"></circle>
            <circle cx="17.4" cy="6.6" r="1.2" fill="#fff"></circle>
          </svg>`; 
      
      case 'fb':
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.01 3.66 9.16 8.44 9.94v-7.03H7.9v-2.9h2.54V9.41c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34V22c4.78-.78 8.44-4.93 8.44-9.94z"/></svg>`;
      
      case 'yt':
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#FF0000">
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .6 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .6-5.8 31 31 0 0 0-.6-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>`;
      
      case 'x':
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#000000">
          <path d="M18 2h3l-7.5 8.5L22 22h-7l-5-6-5 6H2l8.5-9.5L2 2h7l4.5 5L18 2z"/></svg>`;
      
      case 'linktree':
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#43E55E">
          <path d="M12 2l3.5 4H14v5h-4V6H8.5L12 2zm0 12a3 3 0 0 1 3 3v5h-6v-5a3 3 0 0 1 3-3z"/></svg>`;

      default:
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#F4F4F4"/>
          <path fill="#EA4335" d="M12 2a10 10 0 0 1 8.66 5H12z"/>
          <path fill="#FBBC04" d="M20.66 7A10 10 0 0 1 12 22l4.33-7.5z"/>
          <path fill="#34A853" d="M7.67 14.5 12 22A10 10 0 0 1 3.34 7h8.66z"/>
          <circle cx="12" cy="12" r="4.5" fill="#4285F4"/>
        </svg>`;

    }
  }

  async function loadTeacher(){
    const idParam   = getParam('id');
    const nameParam = getParam('name')?.trim();

    // 1) 讀取老師資訊：先用 id，再用 name（* 已含 email / links 欄位 *）
    let teacher = null;

    if (idParam && /^\d+$/.test(idParam)) {
      const { data, error } = await sb.from('teachers').select('*').eq('id', Number(idParam)).maybeSingle();
      if (!error && data) teacher = data;
    }
    if (!teacher && nameParam) {
      const { data, error } = await sb.from('teachers').select('*').eq('name', nameParam).maybeSingle();
      if (!error && data) teacher = data;
    }
    if (!teacher){
      $id('teacher-name').textContent = '找不到這位老師';
      $id('teacher-summary').textContent = '—';
      return;
    }

    // 2) Hero / 基本
    $id('teacher-name').textContent = teacher.name;
    $id('teacher-summary').textContent = teacher.summary || '—';
 
    // 封面圖（優先 cover_url）
    const heroUrl =
      teacher.cover_url ||
      `https://picsum.photos/seed/teacher-${encodeURIComponent(teacher.id)}/1200/630`;
    $id('teacher-cover').innerHTML = `
      <img src="${heroUrl}" alt="${escapeHtml(teacher.name)} 主圖" loading="eager" decoding="async">
      <div class="hero-avatar" id="teacher-avatar"></div>
    `;
    
    // 插入老師頭像
    const avatarEl = $id('teacher-avatar');
    if (avatarEl) {
      // 來源優先順序：teacher.avatar_url → 自訂圖片 → 預設圖
      let avatarSrc = teacher.avatar_url || '';
      if (!avatarSrc) {
        if (teacher.name === '汎汎') avatarSrc = '/web/img/fan_o.jpg';
        else if (teacher.name === '小D') avatarSrc = '/web/img/dd_o.jpg';
        else avatarSrc = '/web/img/default.jpg';
      }
      avatarEl.innerHTML = `<img src="${avatarSrc}" alt="${escapeHtml(teacher.name)} 縮圖">`;
    }


    // 3) 老師介紹 & 資訊（類別 / 信箱 / 連結）
    $id('teacher-desc').textContent = teacher.description || '—';

    const infoList = $id('teacher-info-list');
    if (infoList){
      infoList.innerHTML = '';

      // 類別（你目前 teachers.category 是 text；若改成 text[] 也可顯示多個）
      const cats = Array.isArray(teacher.category)
        ? teacher.category
        : (teacher.category ? [teacher.category] : []);
      if (cats.length){
        infoList.insertAdjacentHTML('beforeend', `
          <div class="info-item" data-key="category">
            <div class="icon">
              <img class="badge badgeImg" src="/web/img/${cats.includes('園藝') ? 'garden_simple_bk' : 'art_simple_bk'}.png" alt="類別">
            </div>
            <div class="label">療癒領域</div>
            <div class="value">
              ${cats.map(c => badgeHTML(c, 'cat-type ' + planTypeClass(c))).join(' ')}
            </div>
          </div>
        `);
      }

      // 聯絡信箱（若有）
      if (teacher.email){
        const mail = String(teacher.email).trim();
        const mailHtml = `
          <div class="info-item" data-key="email">
            <div class="icon">${iconSVG('mail')}</div>
            <div class="label">聯絡信箱</div>
            <div class="value">
              <a href="mailto:${encodeURIComponent(mail)}" class="link" rel="nofollow">${escapeHtml(mail)}</a>
            </div>
          </div>
        `;
        infoList.insertAdjacentHTML('beforeend', mailHtml);
      }

      // 社群 / 官網連結（text[]）
      const links = Array.isArray(teacher.links) ? teacher.links.filter(Boolean) : [];
      if (links.length){
        const chips = links.map(raw => {
          const url = normalizeUrl(raw);
          if (!url) return '';
          const kind = whichBrand(url);
          const label = ({
            ig:'Instagram', fb:'Facebook', yt:'YouTube', x:'X', linktree:'Linktree', web:'官網'
          })[kind] || '連結';
          return `
            <a class="chip chip-items link-chip" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow" title="${escapeHtml(url)}">
              ${iconSVG(kind, 14)}&nbsp;${label}
            </a>
          `;
        }).join('');

        if (chips.trim()){
          infoList.insertAdjacentHTML('beforeend', `
            <div class="info-item" data-key="links">
              <div class="icon">${iconSVG('web')}</div>
              <div class="label">個人官網</div>
              <div class="value">
                <span class="links">${chips}</span>
              </div>
            </div>
          `);
        }
      }
    }

    // 4) 這位老師的課程
    const listEl  = $id('teacher-courses-list');
    const emptyEl = $id('teacher-courses-empty');

    let q = sb
      .from('courses')
      .select('id,title,summary,description,cover_url,gallery,teacher,teachers,category,created_at,duration_hours,course_fee,keywords,plan_type')
      .eq('published', true)
      .is('deleted_at', null)
      .order('sort_priority', { ascending: false })
      .order('created_at', { ascending: false });

    // 兼容 teacher (text) 或 teachers (text[]) 兩欄位
    q = q.or(`teacher.eq.${teacher.name},teachers.cs.{${teacher.name}}`);

    const { data: courses, error } = await q;
    if (error){ console.warn('[teacher page] load courses error', error); }

    const items = courses || [];
    if (!items.length){
      listEl.innerHTML = '';
      emptyEl?.classList.remove('hidden');
      return;
    }
    emptyEl?.classList.add('hidden');

    // 圖片 URL（沿用你現有工具）
    for (const c of items){
      const paths = Array.isArray(c.gallery) ? c.gallery : [];
      c._galleryUrls = paths.length
        ? await window.toPublicUrls('course-gallery', paths)
        : [ c.cover_url || ('https://picsum.photos/seed/' + encodeURIComponent(c.id) + '/640/360') ];
    }

    // 渲染卡片
    listEl.innerHTML = items.map(window.courseCardHTML).join('');
    window.enableCarousels(listEl);

    // 「更多課程」：幫你帶好同名老師的 filter 到 courses.html
    const moreBtn = $id('btn-more-courses');
    if (moreBtn){
      moreBtn.classList.remove('hidden');
      moreBtn.addEventListener('click', ()=>{
        const nextState = {
          page: 1,
          teacher: teacher.name,
          category: null,
          plan_type: null,
          keyword: null,
          q: ''
        };
        try { sessionStorage.setItem('courseState', JSON.stringify(nextState)); } catch {}
      });
    }

    // 返回鍵
    const backBtn = $id('back-btn');
    if (backBtn){
      backBtn.addEventListener('click', () => {
        if (document.referrer && document.referrer !== location.href) {
          history.back();
        } else {
          location.href = '/web/teachers.html';
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', loadTeacher);
})();
