// === shared-layout.js ===
(function(){
  if (document.getElementById('shared-layout-mounted')) return;

  // ========= Supabase client 初始化 =========
  if (!window.sb) {
    window.SUPABASE_URL = "https://ilhmywiktdqilmaisbyp.supabase.co";
    window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaG15d2lrdGRxaWxtYWlzYnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NTczODcsImV4cCI6MjA3MTIzMzM4N30.qCpu7NhwaEkmyFJmg9MB6MrkcqmPiywGV2c_U3U9h4c";
    window.sb = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }
  const sb = window.sb;  // 全域 client

  var tpl = document.createElement('template');
  tpl.innerHTML = `
  <div id="shared-layout-mounted" hidden></div>

  <!-- Header -->
  <header class="site-header">
    <div class="container header-bar">
      <h1 class="site-title">
        <div class="plain brand">
          <img src="img/logo.png" alt="HeartHub Studio Logo" class="logo" width="42" height="42">
          <span class="title-text">HeartHub Studio 心聚坊</span>
        </div>
      </h1>   

      <!-- 漢堡按鈕（手機用） -->
      <button class="hamburger" id="navToggle"
              aria-label="主選單"
              aria-expanded="false"
              aria-controls="mobileMenu">
        <span class="bar" aria-hidden="true"></span>
      </button>
    
      <!-- 導覽列：左邊連結、右邊登入/登出 -->
      <nav class="main-nav nav-desktop">
        <div class="nav-left">
          <a href="index.html">首頁</a>
          <a href="courses.html">探索課程</a>
          <a href="teachers.html">教學團隊</a>
          <a href="teachers.html">療癒商城</a>
          <div class="dropdown">
            <a href="#" class="dropbtn">線上服務</a>
            <div class="dropdown-content">
              <a href="mood.html">心聚指標</a>
              <a href="feedback.html">學習回饋表</a>
            </div>
          </div>
          
          <div class="dropdown hidden" id="admin-group-desktop">
            <a href="#" class="dropbtn">管理編輯</a>
            <div class="dropdown-content">
              <a href="admin.html">課程管理</a>
              <a href="admin-teachers.html">師資專區</a>
              <a href="admin-one-minutes.html">量表編輯</a>
            </div>
          </div>

        </div>

        <div class="nav-right">
          <!-- 登入按鈕：膠囊綠色、含人形圖示 -->
          <a href="#" id="login-link" class="btn nav-cta">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" focusable="false">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" fill="currentColor"/>
            </svg>
            <span>登入</span>
          </a>
          <a href="#" id="logout-link" class="btn nav-cta secondary hidden">登出</a>
        </div>
      </nav>      
    </div>

    <!-- 手機抽屜選單 -->
    <nav class="nav-mobile" id="mobileMenu" aria-label="主選單（手機）">
      <a href="index.html">首頁</a>
      <a href="courses.html">探索課程</a>
      <a href="teachers.html">教學團隊</a>
      <a href="teachers.html">療癒商城</a>
      <div class="group">
        <span class="group-title">線上服務</span>
        <a href="mood.html" class="sub">心聚指標</a>
        <a href="feedback.html" class="sub">學習回饋表</a>
      </div>

      <div class="group hidden" id="admin-group-mobile">
        <span class="group-title">管理編輯</span>
        <a href="admin.html" class="sub">課程管理</a>
        <a href="admin-teachers.html" class="sub">師資專區</a>
        <a href="admin-one-minutes.html" class="sub">量表編輯</a>
      </div>

    </nav>
    <div class="backdrop" id="backdrop" hidden></div>
    
  </header>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <small>© 2025 園藝與藝術治療課程平台</small>
      <div id="qrcode"></div>
    </div>
  </footer>
  `.trim();

  // 插入 body 頭尾
  const frag = tpl.content;
  document.body.prepend(frag.querySelector('header'));
  document.body.appendChild(frag.querySelector('footer'));

  // 初始化 QRCode
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('qrcode');
    if (!el || typeof QRCode === "undefined") return;
    new QRCode(el, {
      text: "https://stewart-chen.github.io/web/",
      width: 200,
      height: 200,
      correctLevel: QRCode.CorrectLevel.M
    });
  });

  // === 手機選單 ===
  const btn = document.getElementById('navToggle');
  const menu = document.getElementById('mobileMenu');
  const backdrop = document.getElementById('backdrop');

  function openMenu() {
    document.body.classList.add('menu-open');
    btn.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    const firstLink = menu.querySelector('a');
    firstLink && firstLink.focus();
  }
  function closeMenu() {
    document.body.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');
    backdrop.hidden = true;
    btn.focus();
  }
  if (btn) {
    btn.addEventListener('click', () => {
      document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
    });
  }
  if (backdrop) backdrop.addEventListener('click', closeMenu);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
  });
  if (menu) {
    menu.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) closeMenu();
    });
  }

// === 同步「課程管理」：桌機/手機一起顯示或隱藏，並同步 href ===
/*(function syncAdminLinkSetup(){
  const adminDesktop = document.getElementById('admin-link');
  const adminMobile  = document.getElementById('admin-link-m');

  function syncAdminLink(){
    if (!adminMobile) return;
    if (!adminDesktop) { adminMobile.classList.add('hidden'); return; }

    // 依桌機版 hidden 狀態切換手機版
    const hidden = adminDesktop.classList.contains('hidden');
    adminMobile.classList.toggle('hidden', hidden);

    // 複製 href（若有設定）
    const href = adminDesktop.getAttribute('href');
    if (href) adminMobile.setAttribute('href', href);
  }

  // 初次同步
  syncAdminLink();

  // 登入／權限變更時，你的程式可能會增減 .hidden 或修改 href
  // 用 MutationObserver 監聽變化並同步到手機
  if (adminDesktop) {
    new MutationObserver(syncAdminLink)
      .observe(adminDesktop, { attributes: true, attributeFilter: ['class','href'] });
  }
})();*/


// === 在 shared-layout.js 內，取代原本 revealAdminGroups ===
(function () {
  function onReady(cb) {
    if (document.readyState !== 'loading') cb();
    else document.addEventListener('DOMContentLoaded', cb);
  }

  // 等待 sb/supabase client（最多 3 秒）
  async function waitForSupabaseClient(maxTries = 30, interval = 100) {
    for (let i = 0; i < maxTries; i++) {
      const c = window.sb || window.supabase; // 你的專案是用 sb
      if (c && c.auth) return c;
      await new Promise(r => setTimeout(r, interval));
    }
    return null;
  }

  async function revealAdminGroups() {
    try {
      const client = await waitForSupabaseClient();
      if (!client) return; // 沒有 client 就安靜跳過

      const { data: userData } = await client.auth.getUser();
      const user = userData?.user;
      if (!user) return; // 未登入不顯示

      const { data, error } = await client
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return; // 非管理者不顯示

      document.getElementById('admin-group-desktop')?.classList.remove('hidden');
      document.getElementById('admin-group-mobile')?.classList.remove('hidden');
    } catch (err) {
      console.warn('revealAdminGroups_error:', err);
    }
  }

  onReady(revealAdminGroups);
})();


  
})();

