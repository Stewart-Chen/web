// === shared-layout.js ===
(function(){
  if (document.getElementById('shared-layout-mounted')) return;

  var tpl = document.createElement('template');
  tpl.innerHTML = `
  <div id="shared-layout-mounted" hidden></div>

  <!-- Header -->
  <header class="site-header">
    <div class="container">
      <h1 class="fancy-title">
        <a href="index.html" class="plain">🌿 園藝與藝術治療課程平台</a>
      </h1>
      <nav>
        <a href="index.html">首頁</a>
        <a href="#" id="login-link">登入/註冊</a>
        <a href="#" id="logout-link" class="hidden">登出</a>
        <a href="#" id="admin-link" class="hidden">課程管理</a>
        <div class="dropdown">
          <a href="#" class="dropbtn">小工具 ▾</a>
          <div class="dropdown-content">
            <a href="mood.html">情緒紀錄</a>
            <a href="feedback.html">課後滿意度</a>
          </div>
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

