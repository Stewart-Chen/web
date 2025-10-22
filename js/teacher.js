// /web/js/teacher.js
(function(){
  const sb = window.sb; // shared-layout.js 初始化
  const $  = (sel, root=document)=> root.querySelector(sel);
  const $id = (id)=> document.getElementById(id);

  function getParam(name){ return new URLSearchParams(location.search).get(name); }

  function badgeHTML(txt, extraClass=''){
    return `<span class="badge ${extraClass}">${txt}</span>`;
  }

  function planTypeClass(pt){
    if (pt === '系列課') return 'series-course';
    if (pt === '一日工作坊') return 'one-day';
    return (pt || '').trim().replace(/\s+/g,'-').toLowerCase();
  }

  async function loadTeacher(){
    const idParam   = getParam('id');
    const nameParam = getParam('name')?.trim();

    // 1) 讀取老師資訊：先用 id，再用 name
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
    $id('teacher-cover').innerHTML = `<img src="${heroUrl}" alt="${teacher.name} 主圖" loading="eager" decoding="async">`;

    // 3) 老師介紹 & 類別徽章
    $id('teacher-desc').textContent = teacher.description || '—';

    const infoList = $id('teacher-info-list');
    if (infoList){
      infoList.innerHTML = '';

      // 類別（你目前 teachers.category 是 text 單值；若未來改成陣列也可顯示多個）
      const cats = Array.isArray(teacher.category)
        ? teacher.category
        : (teacher.category ? [teacher.category] : []);
      if (cats.length){
        infoList.insertAdjacentHTML('beforeend', `
          <div class="info-item" data-key="category">
            <div class="icon">
              <img class="badge badgeImg" src="/web/img/${cats.includes('園藝') ? 'garden_simple' : 'art_simple'}.png" alt="類別">
            </div>
            <div class="label">療癒領域</div>
            <div class="value">
              ${cats.map(c => badgeHTML(c, 'plan-type ' + planTypeClass(c))).join(' ')}
            </div>
          </div>
        `);
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
      moreBtn.addEventListener('click', (e)=>{
        // 設定課程頁的狀態：只看此老師
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
