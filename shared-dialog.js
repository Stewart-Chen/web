// === shared-dialog.js ===
// Auto-generated shared dialog DOM
(function(){
  if (document.getElementById('shared-dialogs-mounted')) return;
  var tpl = document.createElement('template');
  tpl.innerHTML = `
  <div id="shared-dialogs-mounted" hidden></div>
  <dialog id="lesson-modal">
    <form method="dialog" class="card">
      <h3 id="lesson-title">單元</h3>
      <article id="lesson-content" class="prose" style="margin-top:6px;"></article>
      <div class="actions" style="margin-top:10px; display:flex; gap:10px;">
        <button id="mark-done" class="btn primary">標記完成</button>
        <button value="close" class="btn secondary">關閉</button>
      </div>
    </form>
  </dialog>

  <dialog id="auth-modal">
    <form method="dialog" class="card" style="min-width:min(520px,92vw);">
      <h3>登入 / 註冊</h3>
      <label>Email
        <input type="email" id="auth-email" required placeholder="you@example.com" autocomplete="email" />
      </label>
      <label>密碼
        <input type="password" id="auth-password" required placeholder="至少 6 碼" autocomplete="current-password" />
      </label>
      <div class="actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
        <button id="btn-signin"  value="signin"  class="btn primary">登入</button>
        <button id="btn-signup"  value="signup"  class="btn secondary">註冊</button>
        <button type="button" class="btn" onclick="document.getElementById('auth-modal').close()">取消</button>
      </div>
      <p class="muted" style="margin:8px 0 0;">
        若顯示「Email not confirmed」，請到信箱點驗證連結或再試註冊以重寄驗證信。
      </p>
    </form>
  </dialog>

  <dialog id="enroll-dialog">
    <form id="enroll-form" class="card" method="dialog" style="min-width:min(480px, 92vw);">
      <h3 style="margin-top:0;">課程報名資訊</h3>
      <p class="muted" style="margin-top:-6px;">請填寫聯絡資訊以完成報名</p>
      <div class="form-grid" style="margin-top:10px;">
        <label>姓名（必填）
          <input id="enroll-name" type="text" required placeholder="請輸入姓名">
        </label>
        <label>電話（必填）
          <input id="enroll-phone" type="tel" required placeholder="例如 09xx-xxx-xxx">
        </label>
        <label>LINE ID（選填）
          <input id="enroll-line" type="text" placeholder="選填">
        </label>
      </div>
      <div class="actions">
        <button class="btn" type="button" onclick="document.getElementById('enroll-dialog').close()">取消</button>
        <button class="btn primary" type="submit">送出報名</button>
      </div>
    </form>
  </dialog>
  `.trim();
  document.body.appendChild(tpl.content);
})();

