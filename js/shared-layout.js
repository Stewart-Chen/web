// === shared-layout.js ===
(function () {
  // 防止重覆掛載
  if (window.__SHARED_LAYOUT_MOUNTED__) return;
  window.__SHARED_LAYOUT_MOUNTED__ = true;

  // ========= Supabase client =========
  (function ensureSupabase() {
    if (!window.sb) {
      // 你的專案設定（保持與既有一致）
      const URL = "https://ilhmywiktdqilmaisbyp.supabase.co";
      const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaG15d2lrdGRxaWxtYWlzYnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NTczODcsImV4cCI6MjA3MTIzMzM4N30.qCpu7NhwaEkmyFJmg9MB6MrkcqmPiywGV2c_U3U9h4c";
      if (window.supabase?.createClient) {
        window.sb = window.supabase.createClient(URL, KEY);
      } else {
        console.warn("[shared-layout] supabase-js not loaded yet.");
      }
    }
  })();

  const sb = window.sb;

  // ========= Header / Footer Markup =========
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

        <!-- 漢堡 -->
        <button class="hamburger" id="navToggle" aria-label="主選單" aria-expanded="false" aria-controls="mobileMenu">
          <span class="bar" aria-hidden="true"></span>
        </button>

        <!-- 導覽（桌機） -->
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

      <!-- 手機選單 -->
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

  // 挂載（若已存在就不再插入）
  if (!document.querySelector("header.site-header")) {
    document.body.prepend(tpl.content.firstElementChild);
  }
  if (!document.querySelector("footer.site-footer")) {
    document.body.appendChild(tpl.content.lastElementChild);
  }

  // ========= 手機選單 =========
  (function mobileMenu() {
    const btn = document.getElementById("navToggle");
    const menu = document.getElementById("mobileMenu");
    const backdrop = document.getElementById("backdrop");
    function openMenu() {
      document.body.classList.add("menu-open");
      btn?.setAttribute("aria-expanded", "true");
      if (backdrop) backdrop.hidden = false;
      menu?.querySelector("a")?.focus();
    }
    function closeMenu() {
      document.body.classList.remove("menu-open");
      btn?.setAttribute("aria-expanded", "false");
      if (backdrop) backdrop.hidden = true;
      btn?.focus();
    }
    btn?.addEventListener("click", () => {
      document.body.classList.contains("menu-open") ? closeMenu() : openMenu();
    });
    backdrop?.addEventListener("click", closeMenu);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) closeMenu();
    });
    menu?.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) closeMenu();
    });
  })();

  // ========= Footer QRCode：掃目前頁面 URL =========
  document.addEventListener("DOMContentLoaded", function () {
    const el = document.getElementById("qrcode");
    if (!el || typeof QRCode === "undefined") return;
    new QRCode(el, {
      text: window.location.href,
      width: 200,
      height: 200,
      correctLevel: QRCode.CorrectLevel.M
    });
  });

  // ========= Auth / Admin 顯示 / 事件 =========
  window.currentUser = null;

  // 給 app.js 用：未登入就開登入視窗
  window.requireAuthOrOpenModal = function (e) {
    if (!window.currentUser) {
      if (e?.preventDefault) e.preventDefault();
      document.getElementById("auth-modal")?.showModal();
      return false;
    }
    return true;
  };

  // 綁定登入/登出 & 註冊（需要 auth-modal 存在，若沒找到會稍後再試）
  function bindAuthUI(retry = 10) {
    const loginLink  = document.getElementById("login-link");
    const logoutLink = document.getElementById("logout-link");
    const dlg        = document.getElementById("auth-modal");
    const emailEl    = document.getElementById("auth-email");
    const pwdEl      = document.getElementById("auth-password");
    const nickEl     = document.getElementById("auth-nickname");
    const btnIn      = document.getElementById("btn-signin");
    const btnUp      = document.getElementById("btn-signup");

    // Header 登入/登出按鈕
    loginLink?.addEventListener("click", (e) => { e.preventDefault(); dlg?.showModal(); });
    logoutLink?.addEventListener("click", async (e) => { e.preventDefault(); await sb.auth.signOut(); });

    // 元件尚未注入（shared-dialog.js 還沒掛）→ 等一下再綁
    if (!dlg || !emailEl || !pwdEl || !btnIn || !btnUp) {
      if (retry > 0) setTimeout(() => bindAuthUI(retry - 1), 150);
      return;
    }

    function setPwdAutocomplete(mode){ pwdEl.setAttribute("autocomplete", mode === "signup" ? "new-password" : "current-password"); }

    btnIn.addEventListener("click", async (e) => {
      e.preventDefault();
      setPwdAutocomplete("signin");
      const { error } = await sb.auth.signInWithPassword({
        email: (emailEl.value || "").trim(),
        password: (pwdEl.value || "").trim()
      });
      if (error) { alert("登入失敗：" + (error.message || "未知錯誤")); return; }
      dlg.close();
      // 不重整：onAuthStateChange 會廣播 auth:changed
    });

    btnUp.addEventListener("click", async (e) => {
      e.preventDefault();
      setPwdAutocomplete("signup");
      const { error } = await sb.auth.signUp({
        email: (emailEl.value || "").trim(),
        password: (pwdEl.value || "").trim(),
        options: { data: { nickname: (nickEl?.value || "").trim() || null } }
      });
      if (error) { alert("註冊失敗：" + (error.message || "未知錯誤")); return; }
      alert("已寄出驗證郵件（如有設定）。驗證後即可登入。");
      dlg.close();
    });
  }

  // Admin 群組顯示/隱藏
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
    } catch (err) {
      console.warn("[shared-layout] revealAdminGroups:", err);
    }
  }

  // Auth 變化 → 切換按鈕 + 廣播 + 顯示 Admin 區
  sb?.auth.onAuthStateChange((event, session) => {
    window.currentUser = session?.user || null;
    document.getElementById("login-link")?.classList.toggle("hidden", !!window.currentUser);
    document.getElementById("logout-link")?.classList.toggle("hidden", !window.currentUser);

    revealAdminGroups();

    // 全站廣播：讓 app.js 等頁面即時更新 UI（報名/進度）
    document.dispatchEvent(new CustomEvent("auth:changed", {
      detail: { event, user: window.currentUser }
    }));
  });

  // 首次載入 → 同步一次狀態
  (async function initAuth() {
    try {
      const { data } = await sb.auth.getUser();
      window.currentUser = data?.user ?? null;
      document.getElementById("login-link")?.classList.toggle("hidden", !!window.currentUser);
      document.getElementById("logout-link")?.classList.toggle("hidden", !window.currentUser);
      revealAdminGroups();
      // 廣播 init
      document.dispatchEvent(new CustomEvent("auth:changed", {
        detail: { event: "init", user: window.currentUser }
      }));
    } catch (e) {
      console.warn("[shared-layout] initAuth:", e);
    }
  })();

  // dialogs 掛載好再綁（shared-dialog.js 會發這個事件）
  document.addEventListener("dialogs:mounted", () => bindAuthUI());
  // 若 shared-dialog 較晚載入，這裡也先嘗試綁一次
  document.addEventListener("DOMContentLoaded", () => bindAuthUI());
})();
