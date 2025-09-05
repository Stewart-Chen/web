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
          <img src="/web/img/logo.png" alt="HeartHub Studio Logo" class="logo" width="42" height="42">
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
    
      <!-- 導覽列 -->
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
          <a href="#" id="login-link" class="btn nav-cta">登入</a>
          <a href="#" id="logout-link" class="btn nav-cta secondary hidden">登出</a>
        </div>
      </nav>      
    </div>

    <!-- 手機抽屜選單 -->
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

  <!-- Auth Modal -->
  <dialog id="auth-modal">
    <form method="dialog" id="auth-form">
      <label>Email <input id="auth-email" type="email" required /></label>
      <label>Password <input id="auth-password" type="password" required /></label>
      <menu>
        <button id="btn-signin" value="signin">登入</button>
        <button id="btn-signup" value="signup">註冊</button>
      </menu>
    </form>
  </dialog>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <small>© 2025 園藝與藝術治療課程平台</small>
      <div id="qrcode"></div>
    </div>
  </footer>
  `.trim();

  // 插入 body
  const frag = tpl.content;
  document.body.prepend(frag.querySelector('header'));
  document.body.appendChild(frag.querySelector('dialog'));
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
  function openMenu(){ document.body.classList.add('menu-open'); btn.setAttribute('aria-expanded','true'); backdrop.hidden=false; }
  function closeMenu(){ document.body.classList.remove('menu-open'); btn.setAttribute('aria-expanded','false'); backdrop.hidden=true; }
  btn?.addEventListener('click', ()=>{ document.body.classList.contains('menu-open')?closeMenu():openMenu(); });
  backdrop?.addEventListener('click', closeMenu);
  window.addEventListener('keydown', (e)=>{ if (e.key==='Escape'&&document.body.classList.contains('menu-open')) closeMenu(); });
  menu?.addEventListener('click',(e)=>{ if (e.target.closest('a')) closeMenu(); });

  // === Auth / 登入登出 ===
  const authModal = document.getElementById('auth-modal');
  window.currentUser = null;
  window.requireAuthOrOpenModal = function(e){
    if (!window.currentUser){
      if (e) e.preventDefault();
      if (authModal && !authModal.open) authModal.showModal();
      return false;
    }
    return true;
  };

  function bindAuthUI(){
    document.getElementById('login-link')?.addEventListener('click',(e)=>{ e.preventDefault(); authModal?.showModal(); });
    document.getElementById('logout-link')?.addEventListener('click',async(e)=>{ e.preventDefault(); await sb.auth.signOut(); location.reload(); });

    const email=document.getElementById('auth-email');
    const passwd=document.getElementById('auth-password');
    document.getElementById('btn-signin')?.addEventListener('click',async(e)=>{
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({ email: email.value, password: passwd.value });
      if (error){ alert('登入失敗：'+(error.message||'未知錯誤')); return; }
      authModal.close(); location.reload();
    });
    document.getElementById('btn-signup')?.addEventListener('click',async(e)=>{
      e.preventDefault();
      const { error } = await sb.auth.signUp({ email: email.value, password: passwd.value });
      if (error){ alert('註冊失敗：'+(error.message||'未知錯誤')); return; }
      alert('已寄出驗證郵件'); authModal.close(); location.reload();
    });
  }

  sb.auth.onAuthStateChange((_evt, session)=>{
    window.currentUser = session?.user || null;
    document.getElementById('login-link')?.classList.toggle('hidden',!!window.currentUser);
    document.getElementById('logout-link')?.classList.toggle('hidden',!window.currentUser);
  });
  sb.auth.getUser().then(({ data })=>{
    window.currentUser = data?.user ?? null;
    if (window.currentUser){
      document.getElementById('login-link')?.classList.add('hidden');
      document.getElementById('logout-link')?.classList.remove('hidden');
    }
  });

  document.addEventListener('DOMContentLoaded', bindAuthUI);

  // === Admin 區塊顯示 ===
  (async function revealAdminGroups(){
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;
    if (!user) return;
    const { data, error } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error||!data) return;
    document.getElementById('admin-group-desktop')?.classList.remove('hidden');
    document.getElementById('admin-group-mobile')?.classList.remove('hidden');
  })();

})();
