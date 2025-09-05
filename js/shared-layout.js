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
          <div class="plain brand">
            <img src="/web/img/logo.png" alt="HeartHub Studio Logo" class="logo" width="42" height="42">
            <span class="title-text">HeartHub Studio 心聚坊</span>
          </div>
        </h1>

        <button class="hamburger" id="navToggle" aria-label="主選單" aria-expanded="false" aria-controls="mobileMenu">
          <span class="bar" aria-hidden="true"></span>
        </button>

        <nav class="main-nav nav-desktop">
          <div class="nav-left">
            <a href="/web/index.html">首頁</a>
            <a href="/web/courses.html">探索課程</a>
            <a href="/web/teachers.html">教學團隊</a>
            <a href="/web/teachers.html">療癒商城</a>
            <div class="dropdown">
              <a href="#" class="dropbtn">線上服務</a>
              <div class="dropdown-content">
                <a href="/web/one-minute.html">心聚指標</a>
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
        <a href="/web/teachers.html">療癒商城</a>
        <div class="group">
          <span class="group-title">線上服務</span>
          <a href="/web/one-minute.html" class="sub">心聚指標</a>
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
