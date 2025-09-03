// === shared-layout.js ===
(function(){
  if (document.getElementById('shared-layout-mounted')) return;

  var tpl = document.createElement('template');
  tpl.innerHTML = `
  <div id="shared-layout-mounted" hidden></div>

  <!-- Header -->
  <header class="site-header">
    <div class="container header-bar">
      <h1 class="site-title">
        <a href="index.html" class="plain brand">
          <img src="img/logo.png" alt="HeartHub Studio Logo" class="logo">
          <span class="title-text">
            <strong>HeartHub Studio 心聚坊</strong>
            <small>Airbnb × WeWork × INBODY</small>
          </span>
        </a>
      </h1>   
      <!-- 導覽列：左邊連結、右邊登入/登出 -->
      <nav class="main-nav">
        <div class="nav-left">
          <a href="index.html">首頁</a>
          <a href="courses.html">探索課程</a>
          <a href="teachers.html">教學團隊</a>
          <div class="dropdown">
            <a href="#" class="dropbtn">線上服務</a>
            <div class="dropdown-content">
              <a href="mood.html">心情溫度計</a>
              <a href="feedback.html">學習回饋表</a>
            </div>
          </div>

          <a href="#" id="admin-link" class="hidden">課程管理</a>
        </div>

        <div class="nav-right">
          <!-- 登入按鈕：膠囊綠色、含人形圖示 -->
          <a href="#" id="login-link" class="btn nav-cta">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" focusable="false">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" fill="currentColor"/>
            </svg>
            <span>登入</span>
          </a>

          <!-- 登出按鈕：同位置，預設隱藏 -->
          <a href="#" id="logout-link" class="btn nav-cta secondary hidden">登出</a>
        </div>
      </nav>
      
    </div>
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
    if (!el) return;
    new QRCode(el, {
      text: "https://stewart-chen.github.io/web/",
      width: 200,
      height: 200,
      correctLevel: QRCode.CorrectLevel.M
    });
  });
})();

