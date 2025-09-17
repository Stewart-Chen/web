// === shared-layout.js ===
(function () {
  if (window.__SHARED_LAYOUT_MOUNTED__) return;
  window.__SHARED_LAYOUT_MOUNTED__ = true;

  // Supabase client
  (function ensureSupabase() {
    if (!window.sb) {
      const URL = "https://ilhmywiktdqilmaisbyp.supabase.co";
      const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaG15d2lrdGRxaWxtYWlzYnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NTczODcsImV4cCI6MjA3MTIzMzM4N30.qCpu7NhwaEkmyFJmg9MB6MrkcqmPiywGV2c_U3U9h4c";
      if (window.supabase?.createClient) window.sb = window.supabase.createClient(URL, KEY);
    }
  })();

  const sb = window.sb;
  window.currentUser = null;

  // Header / Footer
  const tpl = document.createElement("template");
  tpl.innerHTML = `
    <header class="site-header">
      <div class="container header-bar">
        <h1 class="site-title">
          <a href="/web/index.html" class="plain brand">
            <img src="/web/img/logo-cute2.png" alt="HeartHub Studio Logo" class="logo" width="42" height="42">
            <span class="title-text"><span class="no-break">心聚坊</span></span>
          </a>
        </h1>

        <button class="hamburger" id="navToggle" aria-label="主選單" aria-expanded="false" aria-controls="mobileMenu">
          <span class="bar" aria-hidden="true"></span>
        </button>

        <nav class="main-nav nav-desktop">
          <div class="nav-left">
            <a href="/web/index.html">首頁</a>
            <a href="/web/courses.html">探索課程</a>
            <a href="/web/teachers.html">教學團隊</a>
            <a href="/web/store.html">療癒小舖</a>
            <div class="dropdown">
              <a href="#" class="dropbtn">線上服務</a>
              <div class="dropdown-content">
                <a href="/web/one-minute.html">心聚1分鐘</a>
                <a href="/web/feedback.html">學習回饋表</a>
              </div>
            </div>
            <div class="dropdown hidden" id="admin-group-desktop">
              <a href="#" class="dropbtn">管理編輯</a>
              <div class="dropdown-content">
                <a href="/web/admin_page/admin.html">課程管理</a>
                <a href="/web/admin_page/admin-teachers.html">師資專區</a>
                <a href="/web/admin_page/admin-one-minutes.html">量表編輯</a>
              </div>
            </div>
          </div>
          
          <div class="nav-right">
            <!-- 個人化課程推薦：放大鏡 icon-only 按鈕 -->
            <a href="#" id="recommend-link" 
               class="btn icon-only" aria-label="個人化課程推薦">
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <circle cx="11" cy="11" r="7"></circle>
                <line x1="16.65" y1="16.65" x2="21" y2="21"></line>
              </svg>
            </a>
          
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

      <nav class="nav-mobile" id="mobileMenu" aria-label="主選單（手機）">
        <a href="/web/index.html">首頁</a>
        <a href="/web/courses.html">探索課程</a>
        <a href="/web/teachers.html">教學團隊</a>
        <a href="/web/store.html">療癒小舖</a>
        <div class="group">
          <span class="group-title">線上服務</span>
          <a href="/web/one-minute.html" class="sub">心聚1分鐘</a>
          <a href="/web/feedback.html" class="sub">學習回饋表</a>
        </div>
        <div class="group hidden" id="admin-group-mobile">
          <span class="group-title">管理編輯</span>
          <a href="/web/admin_page/admin.html" class="sub">課程管理</a>
          <a href="/web/admin_page/admin-teachers.html" class="sub">師資專區</a>
          <a href="/web/admin_page/admin-one-minutes.html" class="sub">量表編輯</a>
        </div>
      </nav>
      <div class="backdrop" id="backdrop" hidden></div>
    </header>

    <footer class="site-footer">
      <div class="container">
        <small>© 2025 園藝與藝術治療課程平台</small>
        <div id="qrcode"></div>
      </div>
    </footer>
  `.trim();


  // 功能：在所有頁面自動插入「底部選單」並高亮目前頁籤
  (function insertBottomNav() {
    // 避免重複插入
    if (document.querySelector('.bottom-nav')) return;
  
    // --- 1) 底部選單 HTML（你的原始內容） ---
    var navHTML = `
  <nav class="bottom-nav" role="navigation" aria-label="主要選單">
    <a class="nav-item" href="/web/index.html" data-name="home">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12l9-9 9 9"/>
          <path d="M9 21V12h6v9"/>
        </svg>
      </span>
      <span class="label">首頁</span>
    </a>
  
    <a class="nav-item" href="/web/courses.html" data-name="courses">
      <span class="icon" aria-hidden="true">
        <!-- Book Open icon (stroke 版，現代扁線風) -->
        <svg viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 6c-3-1.8-6-1.8-9 0v11c3-1.8 6-1.8 9 0V6z"/>
          <path d="M12 6c3-1.8 6-1.8 9 0v11c-3-1.8-6-1.8-9 0V6z"/>
          <path d="M12 6v11"/>
        </svg>
      </span>
      <span class="label">課程</span>
    </a>
  
    <a class="nav-item" href="/web/teachers.html" data-name="teachers">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </span>
      <span class="label">老師</span>
    </a>
  
    <a class="nav-item" href="/web/store.html" data-name="shop">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39A2 2 0 0 0 9.68 16h9.72a2 2 0 0 0 1.97-1.61L23 6H6"/>
        </svg>
      </span>
      <span class="label">商城</span>
    </a>
  
    <a class="nav-item" href="/web/one-minute.html" data-name="minute">
      <span class="icon" aria-hidden="true">
        <!-- Gauge/Clock hybrid (stroke 版，現代扁線風) -->
        <svg viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/>
          <path d="M8 12a7.5 7.5 0 0 1 8 0"/>
          <path d="M12 7v5l3 3"/>
          <path d="M12 3v2M4.6 7l1.4 1M18 8l1.4-1"/>
        </svg>
      </span>
      <span class="label">心聚一分鐘</span>
    </a>
  </nav>`.trim();
  
    // --- 2) 等 DOM 就緒後插入到 <body> 最後 ---
    function insertNav() {
      // 建立容器用來解析字串
      var wrapper = document.createElement('div');
      wrapper.innerHTML = navHTML;
      var nav = wrapper.firstElementChild;
      if (!nav) return;
      document.body.appendChild(nav);
  
      // 3) 自動高亮目前頁籤（aria-current="page"）
      var path = (location.pathname || '/').toLowerCase();
  
      function isHome() {
        // 你的首頁是 /web/index.html
        return /\/web\/(index\.html)?$/.test(path);
      }
  
      function match(name) {
        if (name === 'home')     return isHome();
        if (name === 'courses')  return /\/web\/courses\.html$/.test(path);
        if (name === 'teachers') return /\/web\/teachers\.html$/.test(path);
        if (name === 'shop')     return /\/web\/store\.html$/.test(path);
        if (name === 'minute')   return /\/web\/one-minute\.html$/.test(path);
        return false;
      }
  
      nav.querySelectorAll('.nav-item').forEach(function(a){
        var name = a.getAttribute('data-name');
        if (match(name)) a.setAttribute('aria-current','page');
      });
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insertNav);
    } else {
      insertNav();
    }
  })();


  
  const frag = tpl.content.cloneNode(true);
  if (!document.querySelector("header.site-header")) document.body.prepend(frag.querySelector("header"));
  if (!document.querySelector("footer.site-footer")) document.body.appendChild(frag.querySelector("footer"));

  // mobile menu
  (function mobileMenu() {
    const btn = document.getElementById("navToggle");
    const menu = document.getElementById("mobileMenu");
    const backdrop = document.getElementById("backdrop");
    function openMenu(){ document.body.classList.add("menu-open"); btn?.setAttribute("aria-expanded","true"); if(backdrop) backdrop.hidden=false; menu?.querySelector("a")?.focus(); }
    function closeMenu(){ document.body.classList.remove("menu-open"); btn?.setAttribute("aria-expanded","false"); if(backdrop) backdrop.hidden=true; btn?.focus(); }
    btn?.addEventListener("click", ()=> document.body.classList.contains("menu-open") ? closeMenu() : openMenu());
    backdrop?.addEventListener("click", closeMenu);
    window.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) closeMenu(); });
    menu?.addEventListener("click", e => { if (e.target.closest("a")) closeMenu(); });
  })();

  // footer QR 產生目前網址
  document.addEventListener("DOMContentLoaded", function () {
    const el = document.getElementById("qrcode");
    if (!el || typeof QRCode === "undefined") return;
    new QRCode(el, { text: window.location.href, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
  });

  // 提供其他頁使用：未登入就開 dialog
  window.requireAuthOrOpenModal = function (e) {
    if (!window.currentUser) {
      if (e?.preventDefault) e.preventDefault();
      document.getElementById("auth-modal")?.showModal();
      return false;
    }
    return true;
  };

  // ===== Auth 綁定（只綁一次，對應分頁結構） =====
  function bindAuthUI(retry = 10) {
    if (window.__AUTH_UI_BOUND__) return;

    const loginLink  = document.getElementById("login-link");
    const logoutLink = document.getElementById("logout-link");
    const dlg        = document.getElementById("auth-modal");

    const loginEmail = document.getElementById("login-email");
    const loginPwd   = document.getElementById("login-password");
    const btnLogin   = document.getElementById("btn-do-login");

    const suEmail = document.getElementById("signup-email");
    const suPwd   = document.getElementById("signup-password");
    const suNick  = document.getElementById("signup-nickname");
    const btnSign = document.getElementById("btn-do-signup");

    if (!dlg || !loginEmail || !loginPwd || !btnLogin || !suEmail || !suPwd || !suNick || !btnSign) {
      if (!window.__AUTH_UI_BOUND__ && retry > 0) setTimeout(() => bindAuthUI(retry - 1), 150);
      return;
    }

    if (loginLink && !loginLink.dataset.bound) {
      loginLink.addEventListener("click", (e) => { e.preventDefault(); dlg.showModal(); }, { passive: false });
      loginLink.dataset.bound = "1";
    }
    if (logoutLink && !logoutLink.dataset.bound) {
      logoutLink.addEventListener("click", async (e) => { e.preventDefault(); await sb.auth.signOut(); }, { passive: false });
      logoutLink.dataset.bound = "1";
    }

    if (btnLogin && !btnLogin.dataset.bound) {
      btnLogin.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = (loginEmail.value || "").trim();
        const password = (loginPwd.value || "").trim();
        if (!email || !password){ alert("請輸入 Email 與密碼"); return; }
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { alert("登入失敗：" + (error.message || "未知錯誤")); return; }
        dlg.close();
      });
      btnLogin.dataset.bound = "1";
    }

    if (btnSign && !btnSign.dataset.bound) {
      btnSign.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = (suEmail.value || "").trim();
        const password = (suPwd.value || "").trim();
        const nickname = (suNick.value || "").trim();

        if (!email || !password){ alert("請輸入 Email 與密碼"); return; }
        if (!nickname){ alert("請填寫暱稱"); return; }

        // 把暱稱寫到 nickname / name / full_name → Supabase 後台 Display name 會顯示
        const { error } = await sb.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${location.origin}/web/index.html`,
            data: { nickname, name: nickname, full_name: nickname }
          }
        });
        if (error) { alert("註冊失敗：" + (error.message || "未知錯誤")); return; }
        alert("已寄出驗證郵件（如有設定）。驗證後即可登入。");
        dlg.close();
      });
      btnSign.dataset.bound = "1";
    }

    window.__AUTH_UI_BOUND__ = true;
  }

  // Admin 群組顯示
  async function revealAdminGroups() {
    try {
      const user = window.currentUser;
      const desk = document.getElementById("admin-group-desktop");
      const mob  = document.getElementById("admin-group-mobile");
      if (!user) { desk?.classList.add("hidden"); mob?.classList.add("hidden"); return; }
      const { data, error } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      const ok = !!data && !error;
      desk?.classList.toggle("hidden", !ok);
      mob?.classList.toggle("hidden", !ok);
    } catch (err) { console.warn("[shared-layout] revealAdminGroups:", err); }
  }

  // auth state
  sb?.auth.onAuthStateChange((event, session) => {
    window.currentUser = session?.user || null;
    document.getElementById("login-link")?.classList.toggle("hidden", !!window.currentUser);
    document.getElementById("logout-link")?.classList.toggle("hidden", !window.currentUser);
    revealAdminGroups();
    document.dispatchEvent(new CustomEvent("auth:changed", { detail: { event, user: window.currentUser } }));
  });

  (async function initAuth(){
    try {
      const { data } = await sb.auth.getUser();
      window.currentUser = data?.user ?? null;
      document.getElementById("login-link")?.classList.toggle("hidden", !!window.currentUser);
      document.getElementById("logout-link")?.classList.toggle("hidden", !window.currentUser);
      revealAdminGroups();
      document.dispatchEvent(new CustomEvent("auth:changed", { detail: { event: "init", user: window.currentUser } }));
    } catch(e){ console.warn("[shared-layout] initAuth:", e); }
  })();

  document.addEventListener("dialogs:mounted", () => bindAuthUI());
  document.addEventListener("DOMContentLoaded", () => bindAuthUI());
})();
